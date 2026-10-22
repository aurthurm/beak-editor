/**
 * Comment anchors: creating anchors from block text and re-anchoring after edits.
 *
 * Anchors point at a block id plus the quoted text and its offset in the block's plain text.
 * `reanchorComments` finds the quote again after edits and flags comments whose block or quote is gone.
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';
import type { Selection } from 'prosemirror-state';

import type { AnchoredComment, CommentAnchor } from './types';
import { blockPlainText, flattenBlocks } from './util';

/**
 * Creates an anchor for `[from, to)` of a block's plain text.
 *
 * @throws Error when the block is not found or the range is invalid
 */
export function createCommentAnchor(blocks: Block[], blockId: string, from: number, to: number): CommentAnchor {
  const found = flattenBlocks(blocks).find((f) => f.block.id === blockId);
  if (!found) throw new Error(`block not found: ${blockId}`);
  const text = blockPlainText(found.block);
  if (from < 0 || to > text.length || from > to) {
    throw new RangeError(`invalid anchor range ${from}-${to} for block of length ${text.length}`);
  }
  return {
    sectionId: found.sectionId,
    blockId,
    quote: text.slice(from, to),
    offset: from,
    length: to - from,
  };
}

/**
 * Anchors the text selection in a ProseMirror state.
 *
 * The anchored block is the nearest ancestor of the selection that exists in `blocks`. Text inside a
 * list item, for example, lives in a paragraph whose editor id is not a block id: the list item is
 * used instead. Returns null for an empty selection, a selection spanning two textblocks, or a
 * selection with no enclosing block in `blocks`.
 */
export function createCommentAnchorFromSelection(blocks: Block[], selection: Selection): CommentAnchor | null {
  const { $from, $to, empty } = selection;
  if (empty || !$from.sameParent($to)) return null;
  const known = new Set(flattenBlocks(blocks).map((f) => f.block.id));
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    const id = node.attrs.id;
    if (typeof id !== 'string' || !known.has(id)) continue;
    // Offset of the selection within the anchored block's text: the text of earlier textblocks inside it.
    const prefix = node.textBetween(0, $from.start($from.depth) - $from.start(depth), '');
    const from = prefix.length + $from.parentOffset;
    const to = prefix.length + $to.parentOffset;
    try {
      return createCommentAnchor(blocks, id, from, to);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Re-anchors comments against the current blocks.
 *
 * - The block is looked up by `anchor.blockId`, including nested children. If it is missing, the
 *   comment is marked `orphaned: true`.
 * - If the quote is still at its offset, nothing changes. Otherwise the nearest occurrence of the
 *   quote in the block is used and the offset is updated. If the quote is gone, the comment is orphaned.
 * - `anchor.sectionId` is refreshed from the block's enclosing `controlledSection`.
 *
 * Returns new objects. The input is not mutated.
 */
export function reanchorComments(blocks: Block[], comments: AnchoredComment[]): AnchoredComment[] {
  const index = new Map(flattenBlocks(blocks).map((f) => [f.block.id, f] as const));

  return comments.map((comment) => {
    const found = index.get(comment.anchor.blockId);
    if (!found) return { ...comment, orphaned: true };

    const text = blockPlainText(found.block);
    const { quote, offset, length } = comment.anchor;
    const anchorSection = found.sectionId;

    if (quote.length === 0) {
      const clamped = Math.min(offset, text.length);
      return {
        ...comment,
        anchor: { ...comment.anchor, sectionId: anchorSection, offset: clamped, length: 0 },
        orphaned: false,
      };
    }

    if (text.slice(offset, offset + length) === quote) {
      return {
        ...comment,
        anchor: { ...comment.anchor, sectionId: anchorSection },
        orphaned: false,
      };
    }

    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    let idx = text.indexOf(quote);
    while (idx !== -1) {
      const distance = Math.abs(idx - offset);
      if (distance < bestDistance) {
        best = idx;
        bestDistance = distance;
      }
      idx = text.indexOf(quote, idx + 1);
    }

    if (best < 0) {
      return { ...comment, orphaned: true };
    }

    return {
      ...comment,
      anchor: { ...comment.anchor, sectionId: anchorSection, offset: best, length: quote.length },
      orphaned: false,
    };
  });
}
