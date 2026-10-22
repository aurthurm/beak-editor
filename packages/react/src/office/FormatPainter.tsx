/**
 * FormatPainter - copies character marks and paragraph formatting from the selection and
 * applies them to the next range the user selects.
 *
 * Single click arms the painter for one application. Double click keeps it armed until
 * Escape or another click. Empty selections are ignored, so the painter waits for a range.
 *
 * @module
 */

import React, { useEffect, useRef, useState } from 'react';
import type { BeakBlockEditor, Mark } from '@amusendame/beakblock-core';
import { getParagraphContext, PARAGRAPH_FORMAT_ATTRS, useEditorTick } from './editorUtils';
import { OfficeIcon } from './icons';
import { joinClass } from './shared';

/** Formatting captured from the selection. */
export interface FormatSnapshot {
  marks: Mark[];
  paragraph: Record<string, unknown> | null;
}

/** Painter state: off, armed for one application, or sticky until cancelled. */
export type FormatPainterMode = 'off' | 'once' | 'sticky';

/** Props for {@link FormatPainter}. */
export interface FormatPainterProps {
  editor: BeakBlockEditor | null;
  /** Fired when the painter's mode changes. */
  onModeChange?: (mode: FormatPainterMode) => void;
  className?: string;
}

/**
 * Capture the character marks and paragraph formatting at the selection.
 * For a range, the marks of its first text node are used.
 */
export function captureFormat(editor: BeakBlockEditor): FormatSnapshot {
  const state = editor.pm.state;
  const { from, to, empty, $from } = state.selection;
  let marks: readonly Mark[] = state.storedMarks ?? $from.marks();
  if (!empty) {
    let found = false;
    state.doc.nodesBetween(from, to, (node) => {
      if (found) return false;
      if (node.isText) {
        marks = node.marks;
        found = true;
        return false;
      }
      return true;
    });
  }
  const paragraph = getParagraphContext(editor);
  let paragraphAttrs: Record<string, unknown> | null = null;
  if (paragraph) {
    paragraphAttrs = {};
    for (const key of PARAGRAPH_FORMAT_ATTRS) {
      if (key in paragraph.node.attrs) paragraphAttrs[key] = paragraph.node.attrs[key];
    }
  }
  return { marks: [...marks], paragraph: paragraphAttrs };
}

/**
 * Apply a captured format to the range `from`..`to` in one transaction. Paragraph formatting is
 * applied to every paragraph or heading the range touches, keeping only attributes they declare.
 */
export function applyFormat(editor: BeakBlockEditor, snapshot: FormatSnapshot, from: number, to: number): boolean {
  const tr = editor.pm.createTransaction();
  const doc = editor.pm.state.doc;
  tr.removeMark(from, to);
  for (const mark of snapshot.marks) tr.addMark(from, to, mark);

  if (snapshot.paragraph) {
    const targets: number[] = [];
    doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === 'paragraph' || node.type.name === 'heading') targets.push(pos);
      return true;
    });
    for (const pos of targets) {
      const node = doc.nodeAt(pos);
      if (!node) continue;
      const declared = node.type.spec.attrs ?? {};
      const attrs: Record<string, unknown> = { ...node.attrs };
      for (const [key, value] of Object.entries(snapshot.paragraph)) {
        if (key in declared) attrs[key] = value;
      }
      tr.setNodeMarkup(pos, undefined, attrs);
    }
  }
  editor.pm.dispatch(tr);
  return true;
}

/**
 * Format painter button. Works on the editor's selection through the core transaction API.
 *
 * @example
 * ```tsx
 * <FormatPainter editor={editor} />
 * ```
 */
export function FormatPainter({ editor, onModeChange, className }: FormatPainterProps): React.ReactElement {
  useEditorTick(editor);
  const [mode, setModeState] = useState<FormatPainterMode>('off');
  const modeRef = useRef<FormatPainterMode>('off');
  const snapshotRef = useRef<FormatSnapshot | null>(null);
  const applyingRef = useRef(false);

  const setMode = (next: FormatPainterMode) => {
    modeRef.current = next;
    setModeState(next);
    onModeChange?.(next);
  };

  // Apply to every non-empty selection while armed.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    return editor.on('selectionChange', () => {
      if (modeRef.current === 'off' || applyingRef.current || !snapshotRef.current) return;
      const { from, to, empty } = editor.pm.state.selection;
      if (empty) return;
      applyingRef.current = true;
      try {
        applyFormat(editor, snapshotRef.current, from, to);
        if (modeRef.current === 'once') setMode('off');
      } finally {
        applyingRef.current = false;
      }
    });
    // setMode only reads refs and the stable onModeChange callback is intentionally not tracked.
  }, [editor]);

  // Escape cancels the painter.
  useEffect(() => {
    if (mode === 'off' || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        snapshotRef.current = null;
        setMode('off');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  const onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!editor || editor.isDestroyed) return;
    if (modeRef.current === 'off') {
      snapshotRef.current = captureFormat(editor);
      setMode('once');
      return;
    }
    if (event.detail >= 2) {
      setMode('sticky');
      return;
    }
    snapshotRef.current = null;
    setMode('off');
  };

  const armed = mode !== 'off';
  return (
    <button
      type="button"
      className={joinClass('bb-office-button', 'bb-office-button-small', 'bb-office-format-painter', armed && 'is-pressed', className)}
      aria-pressed={armed}
      aria-label="Format Painter"
      title={
        mode === 'sticky'
          ? 'Format Painter (sticky): select text to apply. Press Esc to stop'
          : 'Format Painter: click once, then select text. Double-click to keep it on'
      }
      data-painter-mode={mode}
      disabled={!editor}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <OfficeIcon name="highlighter" size={16} />
      <span className="bb-office-button-label">Format Painter</span>
    </button>
  );
}
