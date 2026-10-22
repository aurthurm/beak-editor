/**
 * Ruler - horizontal and vertical rulers for the Office shell.
 *
 * Horizontal: page margins, paragraph indent markers (left, first line / hanging),
 * tab stops, or column boundaries when the selection is in a table.
 * Vertical: top and bottom margins.
 *
 * Markers can be dragged with the pointer or nudged with the arrow keys. Each edit is
 * one transaction that updates the paragraph's `indent` or `tabs` attribute
 * (via `setNodeMarkup`), or the cells' `colwidth` for table columns.
 *
 * @module
 */

import React, { useRef, useState } from 'react';
import type { BeakBlockEditor, Node as PMNode } from '@amusendame/beakblock-core';
import { findTableContext } from '@amusendame/beakblock-core';
import { getParagraphContext, updateParagraphAttrs, useEditorTick } from './editorUtils';
import { joinClass } from './shared';
import {
  addTabStop,
  applyIndentDrag,
  clamp,
  columnBoundaries,
  firstLinePosition,
  moveTabStop,
  pxToPt,
  ptToPx,
  ptWidthsToPx,
  pxWidthsToPt,
  resizeColumn,
} from './rulerMath';
import type { IndentMarker, IndentValues, TabStopValues } from './rulerMath';

/** Page geometry in points, as used by the rulers. */
export interface RulerPageSetup {
  widthPt: number;
  heightPt: number;
  margins: { topPt: number; rightPt: number; bottomPt: number; leftPt: number };
}

/** A4 portrait with 1 inch margins. */
export const DEFAULT_RULER_PAGE_SETUP: RulerPageSetup = {
  widthPt: 595.3,
  heightPt: 841.9,
  margins: { topPt: 72, rightPt: 72, bottomPt: 72, leftPt: 72 },
};

/** Props for {@link Ruler}. */
export interface RulerProps {
  editor: BeakBlockEditor | null;
  orientation?: 'horizontal' | 'vertical';
  /** Page geometry. Default A4 with 1 inch margins. */
  pageSetup?: RulerPageSetup;
  /** Zoom factor where 1 is 100%. Default 1. */
  zoom?: number;
  className?: string;
}

/** Thickness of a ruler in px. */
const RULER_THICKNESS = 22;
/** Nudge step in pt for keyboard adjustments. */
const KEY_STEP_PT = 6;
/** Vertical distance in px after which a dragged tab stop is removed. */
const TAB_REMOVE_DISTANCE = 28;

type Draft =
  | { kind: 'indent'; marker: IndentMarker; indent: IndentValues }
  | { kind: 'tabs'; tabs: TabStopValues[] }
  | { kind: 'columns'; widthsPt: number[] };

interface TableColumns {
  tablePos: number;
  table: PMNode;
  widthsPt: number[];
}

/**
 * Horizontal or vertical ruler bound to the editor selection.
 *
 * @example
 * ```tsx
 * <Ruler editor={editor} orientation="horizontal" zoom={1.25} />
 * ```
 */
export function Ruler({
  editor,
  orientation = 'horizontal',
  pageSetup = DEFAULT_RULER_PAGE_SETUP,
  zoom = 1,
  className,
}: RulerProps): React.ReactElement {
  // Subscribes to transactions so the ruler re-renders when the selection or paragraph changes.
  useEditorTick(editor);
  const trackRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const suppressClick = useRef(false);

  if (orientation === 'vertical') {
    return <VerticalRuler pageSetup={pageSetup} zoom={zoom} className={className} />;
  }

  const { margins } = pageSetup;
  const widthPx = ptToPx(pageSetup.widthPt, zoom);
  const textWidthPt = pageSetup.widthPt - margins.leftPt - margins.rightPt;
  const live = editor && !editor.isDestroyed ? editor : null;

  // Recomputed on every transaction (tick).
  const paragraph = live ? getParagraphContext(live) : null;
  const tableColumns = live ? readTableColumns(live, textWidthPt) : null;

  const baseIndent = (paragraph?.node.attrs.indent as IndentValues | null | undefined) ?? null;
  const baseTabs = (paragraph?.node.attrs.tabs as TabStopValues[] | null | undefined) ?? [];
  const indent = draft?.kind === 'indent' ? draft.indent : baseIndent;
  const tabs = draft?.kind === 'tabs' ? draft.tabs : baseTabs;
  const columnWidths = draft?.kind === 'columns' ? draft.widthsPt : tableColumns?.widthsPt ?? null;

  const leftPx = ptToPx(margins.leftPt, zoom);
  const rightPx = ptToPx(margins.rightPt, zoom);

  /** Pointer position in pt relative to the left margin, from a client x coordinate. */
  const relativePt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    const originX = rect?.left ?? 0;
    return pxToPt(clientX - originX, zoom) - margins.leftPt;
  };

  /** Track pointer movement for a drag, then commit the last draft on release. */
  const startDrag = (
    event: React.PointerEvent,
    makeDraft: (relPt: number, dy: number) => Draft | null,
    commit: (draft: Draft) => void
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    let latest: Draft | null = null;
    const onMove = (moveEvent: PointerEvent) => {
      const next = makeDraft(relativePt(moveEvent.clientX), moveEvent.clientY - startY);
      if (next) {
        latest = next;
        setDraft(next);
      }
    };
    const onUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDraft(null);
      const moved = Math.abs(upEvent.clientX - startX) > 2 || Math.abs(upEvent.clientY - startY) > 2;
      if (moved) suppressClick.current = true;
      if (latest) commit(latest);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const commitIndent = (next: Draft) => {
    if (!live || !paragraph || next.kind !== 'indent') return;
    if (JSON.stringify(next.indent) === JSON.stringify(baseIndent)) return;
    updateParagraphAttrs(live, paragraph.pos, { indent: next.indent });
  };

  const commitTabs = (next: Draft) => {
    if (!live || !paragraph || next.kind !== 'tabs') return;
    updateParagraphAttrs(live, paragraph.pos, { tabs: next.tabs.length ? next.tabs : null });
  };

  const commitColumns = (next: Draft) => {
    if (!live || !tableColumns || next.kind !== 'columns') return;
    applyColumnWidths(live, tableColumns.tablePos, tableColumns.table, next.widthsPt);
  };

  const indentMarkers: { marker: IndentMarker; pt: number }[] = paragraph && !tableColumns
    ? [
        { marker: 'firstLine', pt: firstLinePosition(indent) },
        { marker: 'left', pt: indent?.leftPt ?? 0 },
      ]
    : [];

  const ticks = buildTicks(pageSetup.widthPt, margins.leftPt);

  return (
    <div
      className={joinClass('bb-office-ruler', 'bb-office-ruler-horizontal', className)}
      role="group"
      aria-label="Horizontal ruler"
      style={{ width: widthPx, height: RULER_THICKNESS }}
    >
      <div className="bb-office-ruler-margin" style={{ left: 0, width: leftPx }} />
      <div className="bb-office-ruler-margin" style={{ left: widthPx - rightPx, width: rightPx }} />
      {ticks.map((tick) => (
        <React.Fragment key={tick.pt}>
          <div
            className={joinClass('bb-office-ruler-tick', tick.major && 'is-major')}
            style={{ left: ptToPx(margins.leftPt + tick.pt, zoom) }}
          />
          {tick.label !== null && (
            <span className="bb-office-ruler-number" style={{ left: ptToPx(margins.leftPt + tick.pt, zoom) }}>
              {tick.label}
            </span>
          )}
        </React.Fragment>
      ))}
      <div
        ref={trackRef}
        className="bb-office-ruler-track"
        style={{ left: leftPx, width: widthPx - leftPx - rightPx }}
        onClick={(event) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          if (!live || !paragraph || tableColumns || event.target !== event.currentTarget) return;
          const pt = clamp(relativePt(event.clientX), 0, textWidthPt);
          updateParagraphAttrs(live, paragraph.pos, { tabs: addTabStop(baseTabs, pt, 'left') });
        }}
      />

      {tableColumns && columnWidths &&
        columnBoundaries(columnWidths)
          .slice(0, -1)
          .map((edge, index) => (
            <div
              key={`col-${index}`}
              className="bb-office-col-marker"
              role="separator"
              aria-orientation="vertical"
              aria-label={`Column ${index + 1} boundary`}
              style={{ left: ptToPx(margins.leftPt + edge, zoom) - 3 }}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                const base = columnWidths;
                startDrag(
                  event,
                  (relPt) => ({ kind: 'columns', widthsPt: resizeColumn(base, index, relPt) }),
                  commitColumns
                );
              }}
            />
          ))}

      {indentMarkers.map(({ marker, pt }) => (
        <div
          key={marker}
          role="slider"
          tabIndex={0}
          className={joinClass('bb-office-indent', marker === 'left' ? 'bb-office-indent-left' : 'bb-office-indent-first')}
          aria-label={marker === 'left' ? 'Left indent' : 'First line indent'}
          aria-valuemin={0}
          aria-valuemax={Math.round(textWidthPt)}
          aria-valuenow={Math.round(pt * 100) / 100}
          aria-valuetext={`${Math.round(pt * 100) / 100} points`}
          style={{ left: ptToPx(margins.leftPt + pt, zoom) - 5 }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const base = baseIndent;
            startDrag(
              event,
              (relPt) => ({ kind: 'indent', marker, indent: applyIndentDrag(base, marker, relPt, textWidthPt) }),
              commitIndent
            );
          }}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const step = event.key === 'ArrowRight' ? KEY_STEP_PT : -KEY_STEP_PT;
            const current = marker === 'left' ? indent?.leftPt ?? 0 : firstLinePosition(indent);
            const next = applyIndentDrag(baseIndent, marker, current + step, textWidthPt);
            commitIndent({ kind: 'indent', marker, indent: next });
          }}
        />
      ))}

      {paragraph && !tableColumns &&
        tabs.map((tab, index) => (
          <div
            key={`tab-${index}-${tab.posPt}`}
            role="button"
            tabIndex={-1}
            className={joinClass('bb-office-tab-stop', `bb-office-tab-${tab.kind}`)}
            aria-label={`${tab.kind} tab stop at ${tab.posPt} points`}
            style={{ left: ptToPx(margins.leftPt + tab.posPt, zoom) - 5 }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              const base = baseTabs;
              startDrag(
                event,
                (relPt, dy) => {
                  const removed = Math.abs(dy) > TAB_REMOVE_DISTANCE;
                  const position = removed ? null : clamp(relPt, 0, textWidthPt);
                  return { kind: 'tabs', tabs: moveTabStop(base, index, position) };
                },
                commitTabs
              );
            }}
          >
            {tab.kind === 'left' ? 'L' : tab.kind === 'center' ? 'C' : tab.kind === 'right' ? 'R' : 'D'}
          </div>
        ))}
    </div>
  );
}

function VerticalRuler({ pageSetup, zoom, className }: { pageSetup: RulerPageSetup; zoom: number; className?: string }): React.ReactElement {
  const { margins } = pageSetup;
  const heightPx = ptToPx(pageSetup.heightPt, zoom);
  const topPx = ptToPx(margins.topPt, zoom);
  const bottomPx = ptToPx(margins.bottomPt, zoom);
  const ticks = buildTicks(pageSetup.heightPt, margins.topPt);
  return (
    <div
      className={joinClass('bb-office-ruler', 'bb-office-ruler-vertical', className)}
      role="group"
      aria-label="Vertical ruler"
      style={{ height: heightPx, width: RULER_THICKNESS }}
    >
      <div className="bb-office-ruler-margin" style={{ top: 0, height: topPx }} />
      <div className="bb-office-ruler-margin" style={{ top: heightPx - bottomPx, height: bottomPx }} />
      {ticks.map((tick) => (
        <React.Fragment key={tick.pt}>
          <div
            className={joinClass('bb-office-ruler-tick', tick.major && 'is-major')}
            style={{ top: ptToPx(margins.topPt + tick.pt, zoom) }}
          />
          {tick.label !== null && (
            <span className="bb-office-ruler-number" style={{ top: ptToPx(margins.topPt + tick.pt, zoom) }}>
              {tick.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

interface Tick {
  pt: number;
  major: boolean;
  label: string | null;
}

/** Ticks every half inch, numbered every inch, measured from the margin. */
function buildTicks(lengthPt: number, originPt: number): Tick[] {
  const ticks: Tick[] = [];
  const first = -Math.floor(originPt / 36);
  const last = Math.floor((lengthPt - originPt) / 36);
  for (let k = first; k <= last; k++) {
    const pt = k * 36;
    if (originPt + pt < 0 || originPt + pt > lengthPt) continue;
    const major = k % 2 === 0;
    ticks.push({ pt, major, label: major ? String(k / 2) : null });
  }
  return ticks;
}

/** Read the column widths of the table containing the selection, in pt. */
function readTableColumns(editor: BeakBlockEditor, textWidthPt: number): TableColumns | null {
  const context = findTableContext(editor.pm.state);
  if (!context) return null;
  const firstRow = context.table.firstChild;
  if (!firstRow) return null;
  const widthsPx: Array<number | null> = [];
  firstRow.forEach((cell) => {
    const span = Number(cell.attrs.colspan) || 1;
    const colwidth = cell.attrs.colwidth as number[] | null | undefined;
    const total = Array.isArray(colwidth) ? colwidth.reduce((sum, value) => sum + (Number(value) || 0), 0) : null;
    for (let i = 0; i < span; i++) widthsPx.push(total ? total / span : null);
  });
  if (widthsPx.length === 0) return null;
  const widthsPt = pxWidthsToPt(widthsPx, textWidthPt);
  return { tablePos: context.tablePos, table: context.table, widthsPt };
}

/** Write new column widths to every cell of a table in one transaction. */
function applyColumnWidths(editor: BeakBlockEditor, tablePos: number, table: PMNode, widthsPt: number[]): void {
  const tr = editor.pm.createTransaction();
  table.forEach((row, rowOffset) => {
    let column = 0;
    row.forEach((cell, cellOffset) => {
      const span = Number(cell.attrs.colspan) || 1;
      const cellPos = tablePos + 1 + rowOffset + 1 + cellOffset;
      const colwidth = ptWidthsToPx(widthsPt.slice(column, column + span));
      tr.setNodeMarkup(cellPos, undefined, { ...cell.attrs, colwidth });
      column += span;
    });
  });
  editor.pm.dispatch(tr);
}
