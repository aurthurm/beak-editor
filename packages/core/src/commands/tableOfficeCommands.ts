/**
 * Office-class table commands (contracts §1.6).
 *
 * Cell formatting applies to the prosemirror-tables selection rect (a cell
 * cursor or a CellSelection). Structural commands that have no direct
 * prosemirror-tables equivalent (sorting, widths, header rows) are
 * implemented on top of TableMap so spans are respected.
 *
 * Factory commands (`setCellBorders(...)`) return a ProseMirror command.
 *
 * @module
 */

import { EditorState, Transaction } from 'prosemirror-state';
import { Node as PMNode } from 'prosemirror-model';
import { TableMap, selectedRect, mergeCells as pmMergeCells, splitCell as pmSplitCell } from 'prosemirror-tables';
import { findTableContext, isInTable, repairingDispatch } from './tableCommands';
import {
  twipsToPx,
  pxToTwips,
  type CellBorder,
  type CellBorders,
  type CellPadding,
  type CellVAlign,
  type CellHAlign,
  type TableLook,
  type TableWidthMode,
} from '../schema/nodes/tableOffice';

/** ProseMirror command type. */
type Command = (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean;

/** Border edge names. */
export type BorderEdge = 'top' | 'right' | 'bottom' | 'left';

/** Sort direction for {@link sortTableByColumn}. */
export type SortDirection = 'asc' | 'desc';

const ALL_EDGES: BorderEdge[] = ['top', 'right', 'bottom', 'left'];

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Relative (to table content start) position of each unique cell in a rect. */
function cellPositionsInRect(map: TableMap, rect: Rect): number[] {
  const out = new Set<number>();
  for (let r = rect.top; r < rect.bottom; r++) {
    for (let c = rect.left; c < rect.right; c++) {
      out.add(map.map[r * map.width + c]);
    }
  }
  return [...out];
}

/** Every unique cell position in a table. */
function allCellPositions(map: TableMap): number[] {
  return cellPositionsInRect(map, { left: 0, top: 0, right: map.width, bottom: map.height });
}

/** Writes `patch` into the attrs of each cell in `positions`. */
function patchCells(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  table: PMNode,
  tableStart: number,
  positions: number[],
  patchOf: (attrs: Record<string, unknown>) => Record<string, unknown> | null
): boolean {
  if (dispatch) {
    const tr = state.tr;
    for (const rel of positions) {
      const cell = table.nodeAt(rel);
      if (!cell) continue;
      const patch = patchOf(cell.attrs);
      if (patch) tr.setNodeMarkup(tableStart + rel, undefined, { ...cell.attrs, ...patch });
    }
    dispatch(tr);
  }
  return true;
}

/** Applies a cell patch to every cell covered by the current selection. */
function updateSelectedCells(
  patchOf: (attrs: Record<string, unknown>) => Record<string, unknown> | null
): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) return false;
    const rect = selectedRect(state);
    return patchCells(
      state,
      dispatch,
      rect.table,
      rect.tableStart,
      cellPositionsInRect(rect.map, rect),
      patchOf
    );
  };
}

/** Merge selected cells (rowspan and colspan). */
export const mergeCells: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  return pmMergeCells(state, repairingDispatch(state, dispatch));
};

/** Split the selected merged cell (restores colspan and rowspan). */
export const splitCell: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  return pmSplitCell(state, repairingDispatch(state, dispatch));
};

/**
 * Sets (or clears with `null`) one or more border edges on the selected cells.
 * Shared edges are mirrored onto the neighbouring cell so both sides agree.
 *
 * @param edges - Edges to change, or `'all'`
 * @param border - Border to apply, or `null` to clear
 */
export function setCellBorders(edges: BorderEdge[] | 'all', border: CellBorder | null): Command {
  const sides = edges === 'all' ? ALL_EDGES : edges;
  const opposite: Record<BorderEdge, BorderEdge> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

  return (state, dispatch) => {
    if (!isInTable(state)) return false;
    const rect = selectedRect(state);
    const { map, table, tableStart } = rect;

    const next = new Map<number, CellBorders>();
    const bordersOf = (rel: number): CellBorders => {
      const existing = next.get(rel);
      if (existing) return existing;
      const current = (table.nodeAt(rel)?.attrs.borders as CellBorders | null) ?? null;
      const copy: CellBorders = current
        ? { ...current }
        : { top: null, right: null, bottom: null, left: null };
      next.set(rel, copy);
      return copy;
    };

    for (const rel of cellPositionsInRect(map, rect)) {
      const cell = map.findCell(rel);
      for (const side of sides) {
        bordersOf(rel)[side] = border;
        // Neighbour cells that share this edge.
        const neighbours: number[] = [];
        if (side === 'top' && cell.top > 0) {
          for (let c = cell.left; c < cell.right; c++) neighbours.push(map.map[(cell.top - 1) * map.width + c]);
        } else if (side === 'bottom' && cell.bottom < map.height) {
          for (let c = cell.left; c < cell.right; c++) neighbours.push(map.map[cell.bottom * map.width + c]);
        } else if (side === 'left' && cell.left > 0) {
          for (let r = cell.top; r < cell.bottom; r++) neighbours.push(map.map[r * map.width + cell.left - 1]);
        } else if (side === 'right' && cell.right < map.width) {
          for (let r = cell.top; r < cell.bottom; r++) neighbours.push(map.map[r * map.width + cell.right]);
        }
        for (const n of neighbours) {
          if (n !== rel) bordersOf(n)[opposite[side]] = border;
        }
      }
    }

    return applyBorderMap(state, dispatch, table, tableStart, next);
  };
}

/** Writes the prepared border map back to the document. */
function applyBorderMap(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  table: PMNode,
  tableStart: number,
  next: Map<number, CellBorders>
): boolean {
  if (dispatch) {
    const tr = state.tr;
    for (const [rel, borders] of next) {
      const cell = table.nodeAt(rel);
      if (!cell) continue;
      const empty = ALL_EDGES.every((e) => borders[e] === null);
      tr.setNodeMarkup(tableStart + rel, undefined, { ...cell.attrs, borders: empty ? null : borders });
    }
    dispatch(tr);
  }
  return true;
}

/**
 * Sets the background shading of the selected cells (`null` clears).
 * Also mirrors the legacy `backgroundColor` attr.
 */
export function setCellShading(color: string | null): Command {
  return updateSelectedCells(() => ({ shading: color, backgroundColor: color }));
}

/** Sets cell padding in points for the selected cells (`null` clears). */
export function setCellPadding(padding: CellPadding | null): Command {
  return updateSelectedCells(() => ({ padding }));
}

/** Sets vertical alignment of the selected cells (`null` clears). */
export function setCellVerticalAlign(vAlign: CellVAlign | null): Command {
  return updateSelectedCells(() => ({ vAlign }));
}

/** Sets horizontal alignment of the selected cells (`null` clears). */
export function setCellHorizontalAlign(hAlign: CellHAlign | null): Command {
  return updateSelectedCells(() => ({ hAlign }));
}

/**
 * Sets the table width mode and value. `value` is twips for `fixed`,
 * fiftieths of a percent for `pct` (5000 = 100%), and ignored for `auto`.
 */
export function setTableWidth(mode: TableWidthMode, value: number | null = null): Command {
  return (state, dispatch) => {
    const ctx = findTableContext(state);
    if (!ctx) return false;
    if (dispatch) {
      const attrs = { ...ctx.table.attrs, widthMode: mode, widthValue: mode === 'auto' ? null : value };
      dispatch(state.tr.setNodeMarkup(ctx.tablePos, undefined, attrs));
    }
    return true;
  };
}

/** Column widths in CSS px for every grid column of the table. */
function readColumnPx(table: PMNode, map: TableMap): number[] {
  const fixedWidth = table.attrs.widthMode === 'fixed' && typeof table.attrs.widthValue === 'number'
    ? twipsToPx(table.attrs.widthValue)
    : null;
  const fallback = fixedWidth !== null ? fixedWidth / map.width : 100;
  const out: number[] = [];
  for (let c = 0; c < map.width; c++) {
    const cell = table.nodeAt(map.map[c]);
    const widths = cell?.attrs.colwidth as number[] | null;
    const span = Number(cell?.attrs.colspan ?? 1);
    const own = span === 1 && Array.isArray(widths) ? widths[0] : undefined;
    out.push(typeof own === 'number' && own > 0 ? own : fallback);
  }
  return out;
}

/** Writes per-column px widths to every cell (colwidth and widthTwips). */
function writeColumnPx(state: EditorState, dispatch: ((tr: Transaction) => void) | undefined, ctx: NonNullable<ReturnType<typeof findTableContext>>, px: number[]): boolean {
  const map = TableMap.get(ctx.table);
  if (dispatch) {
    const tr = state.tr;
    for (const rel of allCellPositions(map)) {
      const cell = ctx.table.nodeAt(rel);
      if (!cell) continue;
      const r = map.findCell(rel);
      const colwidth = px.slice(r.left, r.right);
      const widthTwips = pxToTwips(colwidth.reduce((a, b) => a + b, 0));
      tr.setNodeMarkup(ctx.tablePos + 1 + rel, undefined, { ...cell.attrs, colwidth, widthTwips });
    }
    dispatch(tr);
  }
  return true;
}

/** Sets one column's width in twips. */
export function setColumnWidthTwips(colIndex: number, twips: number): Command {
  return (state, dispatch) => {
    const ctx = findTableContext(state);
    if (!ctx) return false;
    const map = TableMap.get(ctx.table);
    if (colIndex < 0 || colIndex >= map.width || twips <= 0) return false;
    const px = readColumnPx(ctx.table, map);
    px[colIndex] = twipsToPx(twips);
    return writeColumnPx(state, dispatch, ctx, px);
  };
}

/** Makes all columns of the table the same width, keeping the total width. */
export const distributeColumns: Command = (state, dispatch) => {
  const ctx = findTableContext(state);
  if (!ctx) return false;
  const map = TableMap.get(ctx.table);
  const current = readColumnPx(ctx.table, map);
  const total = current.reduce((a, b) => a + b, 0);
  const each = total / map.width;
  return writeColumnPx(state, dispatch, ctx, current.map(() => each));
};

/** Rows touched by the current selection (relative offset and node). */
function selectedRows(table: PMNode, top: number, bottom: number): { offset: number; row: PMNode }[] {
  const out: { offset: number; row: PMNode }[] = [];
  table.forEach((row, offset, index) => {
    if (index >= top && index < bottom) out.push({ offset, row });
  });
  return out;
}

/**
 * Toggles repeat-as-header-row for the selected rows (`isHeader`). The layout
 * engine repeats these rows at the top of each page.
 */
export const toggleHeaderRow: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  const rect = selectedRect(state);
  const rows = selectedRows(rect.table, rect.top, rect.bottom);
  if (!rows.length) return false;
  const on = !rows[0]!.row.attrs.isHeader;
  if (dispatch) {
    const tr = state.tr;
    for (const { offset, row } of rows) {
      tr.setNodeMarkup(rect.tableStart + offset, undefined, { ...row.attrs, isHeader: on ? true : null });
    }
    dispatch(tr);
  }
  return true;
};

/** Toggles whether the selected rows may split across pages. */
export const toggleRowCantSplit: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  const rect = selectedRect(state);
  const rows = selectedRows(rect.table, rect.top, rect.bottom);
  if (!rows.length) return false;
  const on = !rows[0]!.row.attrs.cantSplit;
  if (dispatch) {
    const tr = state.tr;
    for (const { offset, row } of rows) {
      tr.setNodeMarkup(rect.tableStart + offset, undefined, { ...row.attrs, cantSplit: on ? true : null });
    }
    dispatch(tr);
  }
  return true;
};

/** Parses a cell's text as a number, accepting thousands separators. */
function numericValue(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Sorts the body rows by the text of one column. Leading header rows
 * (`isHeader`) stay in place. Numbers compare numerically when every
 * non-empty value is numeric; empty cells sort last. Returns false when
 * body rows contain merged cells (sorting would corrupt the grid).
 *
 * @param colIndex - Grid column to sort by
 * @param dir - `'asc'` or `'desc'`
 */
export function sortTableByColumn(colIndex: number, dir: SortDirection): Command {
  return (state, dispatch) => {
    const ctx = findTableContext(state);
    if (!ctx) return false;
    const { table, tablePos } = ctx;
    const map = TableMap.get(table);
    if (colIndex < 0 || colIndex >= map.width) return false;

    let headerCount = 0;
    while (headerCount < table.childCount && table.child(headerCount).attrs.isHeader) headerCount++;

    const body: PMNode[] = [];
    for (let r = headerCount; r < table.childCount; r++) {
      const row = table.child(r);
      if (row.childCount !== map.width) return false;
      let spanned = false;
      row.forEach((cell) => {
        if (Number(cell.attrs.colspan) > 1 || Number(cell.attrs.rowspan) > 1) spanned = true;
      });
      if (spanned) return false;
      body.push(row);
    }

    const keyed = body.map((row, index) => {
      const text = row.child(colIndex).textContent.trim();
      return { row, index, text, num: numericValue(text) };
    });
    const nonEmpty = keyed.filter((k) => k.text !== '');
    const numeric = nonEmpty.length > 0 && nonEmpty.every((k) => k.num !== null);
    const factor = dir === 'desc' ? -1 : 1;

    keyed.sort((a, b) => {
      if (a.text === '' || b.text === '') return a.text === '' && b.text === '' ? a.index - b.index : a.text === '' ? 1 : -1;
      const cmp = numeric
        ? (a.num as number) - (b.num as number)
        : a.text.localeCompare(b.text, undefined, { numeric: true, sensitivity: 'base' });
      return cmp !== 0 ? cmp * factor : a.index - b.index;
    });

    if (dispatch) {
      const headers: PMNode[] = [];
      for (let r = 0; r < headerCount; r++) headers.push(table.child(r));
      const rows = [...headers, ...keyed.map((k) => k.row)];
      const tr = state.tr.replaceWith(tablePos + 1, tablePos + table.nodeSize - 1, rows);
      dispatch(tr);
    }
    return true;
  };
}

/**
 * Sets the table style id and optional conditional look flags.
 *
 * @param styleId - Table style id, or `null` to clear
 * @param look - Conditional parts; unchanged when omitted
 */
export function setTableStyle(styleId: string | null, look?: TableLook | null): Command {
  return (state, dispatch) => {
    const ctx = findTableContext(state);
    if (!ctx) return false;
    if (dispatch) {
      const attrs = {
        ...ctx.table.attrs,
        styleId,
        look: look === undefined ? ctx.table.attrs.look : look,
      };
      dispatch(state.tr.setNodeMarkup(ctx.tablePos, undefined, attrs));
    }
    return true;
  };
}

/** Compares cell widths for tests and callers that need the grid in px. */
export function getColumnWidthsPx(state: EditorState): number[] | null {
  const ctx = findTableContext(state);
  if (!ctx) return null;
  return readColumnPx(ctx.table, TableMap.get(ctx.table));
}
