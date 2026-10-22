/**
 * Shared editor helpers for the Office shell components.
 *
 * @module
 */

import { useEffect, useState } from 'react';
import type { BeakBlockEditor, Node as PMNode } from '@amusendame/beakblock-core';

/** Names of paragraph attributes that describe formatting, excluding the block id. */
export const PARAGRAPH_FORMAT_ATTRS = [
  'textAlign',
  'styleId',
  'numbering',
  'spacing',
  'indent',
  'keepNext',
  'keepLines',
  'pageBreakBefore',
  'widowControl',
  'tabs',
] as const;

/** A paragraph-like block (paragraph or heading) and its document position. */
export interface ParagraphContext {
  /** Position directly before the node. */
  pos: number;
  node: PMNode;
}

/** A controlled section that contains the selection. */
export interface SectionContext {
  pos: number;
  node: PMNode;
  sectionId: string | null;
  title: string | null;
  owner: string | null;
  workflowState: string | null;
}

/**
 * Re-render a component whenever the editor dispatches a transaction.
 * Returns a counter that changes on every transaction.
 */
export function useEditorTick(editor: BeakBlockEditor | null | undefined): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    return editor.on('transaction', () => setTick((value) => value + 1));
  }, [editor]);
  return tick;
}

/** The nearest paragraph or heading around the selection, or null. */
export function getParagraphContext(editor: BeakBlockEditor): ParagraphContext | null {
  const { $from } = editor.pm.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === 'paragraph' || node.type.name === 'heading') {
      return { pos: $from.before(depth), node };
    }
  }
  return null;
}

/** The nearest controlled section around the selection, or null. */
export function getSectionContext(editor: BeakBlockEditor): SectionContext | null {
  const { $from } = editor.pm.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === 'controlledSection') {
      const attrs = node.attrs as Record<string, unknown>;
      return {
        pos: $from.before(depth),
        node,
        sectionId: asString(attrs.sectionId ?? attrs.id),
        title: asString(attrs.title),
        owner: asString(attrs.ownerName),
        workflowState: asString(attrs.workflowState),
      };
    }
  }
  return null;
}

/** Headings in document order. */
export function getHeadings(editor: BeakBlockEditor): { pos: number; level: number; text: string }[] {
  const headings: { pos: number; level: number; text: string }[] = [];
  editor.pm.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headings.push({
        pos,
        level: Number(node.attrs.level) || 1,
        text: node.textContent.trim() || '(empty heading)',
      });
    }
  });
  return headings;
}

/** Word count of the document, splitting on whitespace. */
export function countWords(editor: BeakBlockEditor): number {
  const text = editor.pm.state.doc.textBetween(0, editor.pm.state.doc.content.size, ' ', ' ');
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Select a document range and scroll it into view. Positions are clamped to the document.
 * Focus is left where it is unless `focus` is true.
 */
export function selectRange(editor: BeakBlockEditor, from: number, to: number = from, focus = false): void {
  if (editor.isDestroyed) return;
  const max = editor.pm.state.doc.content.size;
  const clamp = (value: number) => Math.max(0, Math.min(max, value));
  const tr = editor.pm.createTransaction();
  tr.setSelection(editor.pm.createTextSelection(clamp(from), clamp(to)));
  tr.scrollIntoView();
  editor.pm.dispatch(tr);
  if (focus) editor.pm.view.focus();
}

/** Set attributes on the paragraph or heading at `pos` through a single transaction. */
export function updateParagraphAttrs(
  editor: BeakBlockEditor,
  pos: number,
  attrs: Record<string, unknown>
): boolean {
  const node = editor.pm.nodeAt(pos);
  if (!node) return false;
  const tr = editor.pm.createTransaction();
  tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
  editor.pm.dispatch(tr);
  return true;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
