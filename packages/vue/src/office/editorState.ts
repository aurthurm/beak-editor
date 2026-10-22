/**
 * Shared editor state helpers for the Office shell components.
 *
 * @module
 */

import { ref, watch, type Ref } from 'vue';
import type { BeakBlockEditor, EditorState, Node as PMNode, PageSetup } from '@amusendame/beakblock-core';
import { Selection, findTableContext } from '@amusendame/beakblock-core';

/** Points per CSS pixel: 1pt = 96/72 px at 100% zoom. */
export const PX_PER_PT = 96 / 72;

/** A4 portrait with 1-inch margins, used when no page setup is supplied. */
export const DEFAULT_PAGE_SETUP: PageSetup = {
  size: { widthTwips: 11906, heightTwips: 16838 },
  orientation: 'portrait',
  margins: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720, gutter: 0 },
};

/** Page dimensions and margins in points. */
export interface PageGeometryPt {
  widthPt: number;
  heightPt: number;
  marginTopPt: number;
  marginRightPt: number;
  marginBottomPt: number;
  marginLeftPt: number;
}

/** Convert a page setup (twips) to points. */
export function pageGeometryPt(setup: PageSetup | null | undefined): PageGeometryPt {
  const s = setup ?? DEFAULT_PAGE_SETUP;
  return {
    widthPt: s.size.widthTwips / 20,
    heightPt: s.size.heightTwips / 20,
    marginTopPt: s.margins.top / 20,
    marginRightPt: s.margins.right / 20,
    marginBottomPt: s.margins.bottom / 20,
    marginLeftPt: s.margins.left / 20,
  };
}

/**
 * Returns a reactive counter that increments on every editor transaction. Components read
 * the counter inside render or computed functions so they re-run when editor state changes.
 */
export function useEditorTick(getEditor: () => BeakBlockEditor | null | undefined): Ref<number> {
  const tick = ref(0);
  watch(
    getEditor,
    (editor, _previous, onCleanup) => {
      if (!editor || editor.isDestroyed) return;
      const unsubscribe = editor.on('transaction', () => {
        tick.value++;
      });
      onCleanup(() => unsubscribe());
    },
    { immediate: true }
  );
  return tick;
}

/** A block node that carries paragraph formatting (paragraph or heading). */
export interface IndentedTextblock {
  node: PMNode;
  pos: number;
}

/** Nearest paragraph or heading around the selection, with its position. */
export function findIndentedTextblock(state: EditorState): IndentedTextblock | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.isTextblock && 'indent' in node.attrs) {
      return { node, pos: $from.before(depth) };
    }
  }
  return null;
}

/** Column boundaries (points from the table's left edge) for the table at the selection. */
export function tableColumnBoundariesPt(state: EditorState, textWidthPt: number): number[] | null {
  const ctx = findTableContext(state);
  if (!ctx) return null;
  const firstRow = ctx.table.firstChild;
  if (!firstRow) return null;
  const widths: number[] = [];
  firstRow.forEach((cell) => {
    const colwidth = cell.attrs.colwidth as number[] | null | undefined;
    const span = (cell.attrs.colspan as number | undefined) ?? 1;
    for (let i = 0; i < span; i++) {
      const px = colwidth?.[i];
      widths.push(typeof px === 'number' && px > 0 ? px / PX_PER_PT : 0);
    }
  });
  if (widths.length === 0) return null;
  const fallback = widths.some((w) => w === 0) ? textWidthPt / widths.length : 0;
  let running = 0;
  const boundaries: number[] = [];
  for (const w of widths) {
    running += w > 0 ? w : fallback;
    boundaries.push(running);
  }
  return boundaries;
}

/** Plain text word count for a document. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Word count of the whole document. */
export function documentWordCount(state: EditorState): number {
  return countWords(state.doc.textBetween(0, state.doc.content.size, ' ', ' '));
}

/** Nearest controlledSection around the selection, with its position. */
export function findControlledSection(state: EditorState): { node: PMNode; pos: number } | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === 'controlledSection') {
      return { node, pos: $from.before(depth) };
    }
  }
  return null;
}

/** Move the caret to the nearest valid position at `pos` and scroll it into view. */
export function moveCaretTo(editor: BeakBlockEditor, pos: number): void {
  const { doc } = editor.pm.state;
  const safe = Math.max(0, Math.min(pos, doc.content.size));
  const tr = editor.pm.state.tr.setSelection(Selection.near(doc.resolve(safe))).scrollIntoView();
  editor.pm.dispatch(tr);
}
