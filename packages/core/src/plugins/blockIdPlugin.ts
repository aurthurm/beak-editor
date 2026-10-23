/**
 * Block ID Plugin.
 *
 * Keeps block ids present and unique after every document change.
 *
 * - A block with an empty id gets a fresh UUID.
 * - A block whose id is already used earlier in the document gets a fresh UUID. Copies appear when a
 *   block is split (Enter), pasted, duplicated, dragged as a copy, or loaded with duplicate ids.
 *   The original keeps its id: see {@link chooseKeepers}.
 *
 * @module
 */

import { Plugin, PluginKey, type Transaction } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { v4 as uuid } from 'uuid';
import { implicitParagraphId } from '../blocks/blockToNode';

/**
 * Plugin key for the block ID tracking plugin.
 */
export const BLOCK_ID_PLUGIN_KEY = new PluginKey('blockIds');

/**
 * y-prosemirror tags every change that comes from a remote Yjs update with its sync plugin key and
 * `isChangeOrigin: true`. The key is a `PluginKey` named `y-sync`, so ProseMirror stores it as
 * `y-sync$` (or `y-sync$<n>` when several exist). Matching the name keeps core free of a y-prosemirror
 * import, since y-prosemirror is an optional peer dependency.
 */
const Y_SYNC_META_KEY = /^y-sync(\$\d*)?$/;

/**
 * True when the transaction applies a remote Yjs update. Remote transactions are not re-id'd: every
 * peer runs this plugin, so re-minting ids there would give each client different ids for the same
 * block. The peer that made the local change already minted its ids, and they sync out with it.
 */
export function isRemoteChange(tr: Transaction): boolean {
  // `Transaction.meta` is not in the public typings. It maps plugin-key names to their meta values.
  const meta = (tr as unknown as { meta?: Record<string, unknown> }).meta;
  if (!meta) return false;
  for (const key of Object.keys(meta)) {
    if (!Y_SYNC_META_KEY.test(key)) continue;
    const value = meta[key] as { isChangeOrigin?: unknown } | null | undefined;
    if (value?.isChangeOrigin === true) return true;
  }
  return false;
}

/** Block-level nodes that carry a block id (the document node and inline nodes do not). */
function isIdBearingBlock(node: PMNode): boolean {
  if (node.type.name === 'doc') return false;
  if (!node.isBlock && node.type.name !== 'column') return false;
  return node.attrs.id !== undefined;
}

/**
 * Position where the text of a block starts: the first textblock inside it, or the block itself.
 * `pos` is the block's position in its document.
 */
function textStart(node: PMNode, pos: number): number {
  if (node.isTextblock) return pos + 1;
  let found = -1;
  node.descendants((child, childPos) => {
    if (found < 0 && child.isTextblock) found = pos + 1 + childPos + 1;
    return found < 0;
  });
  return found < 0 ? pos + 1 : found;
}

/**
 * Chooses which member of each duplicated id keeps it.
 *
 * The rule is "the node that holds the original text keeps the id". The text position of the first
 * occurrence in the old document is mapped through this batch's steps. The member that now contains
 * it keeps the id. This covers the cases that matter:
 *
 * - Enter in the middle or at the end of a block: the text stays in the first half, so the first
 *   occurrence keeps the id.
 * - Enter at the start of a block: ProseMirror leaves the empty node first and moves the text into the
 *   second node, so the second node keeps the id.
 * - A pasted copy placed before the original: the original still holds its text, so it keeps the id.
 *
 * When the old text cannot be located (for example a whole-document `setDocument`, or a block that
 * is new in this batch), the first occurrence in document order keeps the id.
 *
 * Runs in O(n) over the document, plus O(n) over the old document for the duplicated ids only.
 */
function chooseKeepers(
  docChanged: readonly Transaction[],
  oldDoc: PMNode,
  newDoc: PMNode,
  duplicated: Set<string>
): Map<string, number> {
  // Members of each duplicated id in the new document, in document order.
  const members = new Map<string, Array<{ pos: number; size: number }>>();
  newDoc.descendants((node, pos) => {
    if (isIdBearingBlock(node) && duplicated.has(String(node.attrs.id))) {
      const id = String(node.attrs.id);
      const list = members.get(id) ?? [];
      list.push({ pos, size: node.nodeSize });
      members.set(id, list);
    }
    return true;
  });

  // Text position of the first occurrence of each duplicated id in the old document.
  const oldText = new Map<string, number>();
  oldDoc.descendants((node, pos) => {
    if (isIdBearingBlock(node)) {
      const id = String(node.attrs.id);
      if (duplicated.has(id) && !oldText.has(id)) oldText.set(id, textStart(node, pos));
    }
    return true;
  });

  const keepers = new Map<string, number>();
  for (const [id, list] of members) {
    let keeper = 0;
    const old = oldText.get(id);
    if (old !== undefined) {
      let mapped = old;
      for (const tr of docChanged) mapped = tr.mapping.map(mapped, 1);
      const index = list.findIndex(({ pos, size }) => pos < mapped && mapped < pos + size);
      if (index >= 0) keeper = index;
    }
    keepers.set(id, keeper);
  }
  return keepers;
}

/**
 * Creates a plugin that keeps every block id present and unique.
 *
 * It runs after each transaction that changes the document. Blocks with an empty id get a UUID. When an
 * id is used by more than one block, the original keeps it and the other blocks get a UUID (see
 * {@link chooseKeepers}). An implicit paragraph `${ownerId}/p` moves with its owner, so it becomes
 * `${newOwnerId}/p`. Other implicit ids are untouched.
 *
 * Transactions that only apply remote Yjs updates are skipped (see {@link isRemoteChange}).
 *
 * @example
 * ```typescript
 * import { createBlockIdPlugin } from '@beakblock/core';
 *
 * const plugins = [
 *   createBlockIdPlugin(),
 *   // ... other plugins
 * ];
 * ```
 *
 * @returns A ProseMirror Plugin
 */
export function createBlockIdPlugin(): Plugin {
  return new Plugin({
    key: BLOCK_ID_PLUGIN_KEY,

    appendTransaction(transactions, oldState, newState) {
      const changes = transactions.filter((tr) => tr.docChanged);
      if (changes.length === 0) return null;
      // Remote-only batches are left alone (see isRemoteChange).
      if (changes.every(isRemoteChange)) return null;

      const newDoc = newState.doc;

      // Pass 1: ids that appear more than once, and blocks with an empty id. O(n) with a Set.
      const seen = new Set<string>();
      const duplicated = new Set<string>();
      const decisions = new Map<number, string>();
      newDoc.descendants((node, pos) => {
        if (!isIdBearingBlock(node)) return true;
        const id = node.attrs.id;
        if (!id) {
          decisions.set(pos, uuid());
        } else if (seen.has(id)) {
          duplicated.add(String(id));
        } else {
          seen.add(String(id));
        }
        return true;
      });

      if (duplicated.size > 0) {
        const keepers = chooseKeepers(changes, oldState.doc, newDoc, duplicated);
        // Second pass for the duplicated ids: which positions are keepers, and what everything else gets.
        const keeperPositions = new Set<number>();
        const copies: Array<{ pos: number; node: PMNode; id: string }> = [];
        const indexOf = new Map<string, number>();
        newDoc.descendants((node, pos) => {
          if (!isIdBearingBlock(node) || !duplicated.has(String(node.attrs.id))) return true;
          const id = String(node.attrs.id);
          const index = indexOf.get(id) ?? 0;
          indexOf.set(id, index + 1);
          if (index === keepers.get(id)) {
            keeperPositions.add(pos);
          } else {
            copies.push({ pos, node, id });
          }
          return true;
        });

        for (const { pos, node, id } of copies) {
          if (decisions.has(pos)) continue;
          const fresh = uuid();
          decisions.set(pos, fresh);
          // An implicit paragraph `${id}/p` follows its owner to the new id.
          const first = node.firstChild;
          const childPos = pos + 1;
          if (first && first.type.name === 'paragraph' && first.attrs.id === implicitParagraphId(id) && !keeperPositions.has(childPos)) {
            decisions.set(childPos, implicitParagraphId(fresh));
          }
        }
      }

      if (decisions.size === 0) return null;

      // Attribute-only changes: positions do not shift, so the order does not matter.
      const tr = newState.tr;
      for (const pos of [...decisions.keys()].sort((a, b) => b - a)) {
        const node = newDoc.nodeAt(pos);
        if (!node) continue;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: decisions.get(pos) });
      }
      return tr;
    },
  });
}
