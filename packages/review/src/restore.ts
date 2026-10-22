/**
 * Snapshot restore that keeps pending revisions.
 *
 * Restoring a snapshot replaces the document with the snapshot's content. Pending revisions in the
 * current document are carried over where they still apply, so restoring never silently clears
 * review history.
 *
 * @module
 */

import { isBuiltinInline, type Block } from '@amusendame/beakblock-core';

import { blockPlainText, flattenBlocks, revisionRefOf } from './util';

/** A pending revision that the restore could not carry over. */
export interface DroppedRevision {
  revisionId: string;
  kind: 'insert' | 'delete';
  /** Block that held the revision in the current document. */
  blockId: string;
  /** `block-removed`: the block is not in the snapshot. `text-changed`: the block's base text differs from the snapshot. */
  reason: 'block-removed' | 'text-changed';
}

/** Result of {@link restoreSnapshotPreservingRevisions}. */
export interface SnapshotRestoreResult {
  blocks: Block[];
  droppedRevisions: DroppedRevision[];
}

interface PendingRef {
  revisionId: string;
  kind: 'insert' | 'delete';
  blockId: string;
}

function ownPendingRefs(block: Block): PendingRef[] {
  const refs: PendingRef[] = [];
  for (const item of block.content ?? []) {
    if (!isBuiltinInline(item)) continue;
    if (item.type === 'text') {
      const ref = revisionRefOf(item.styles);
      if (ref) refs.push({ revisionId: ref.revisionId, kind: ref.kind, blockId: block.id });
    } else if (item.type === 'link') {
      for (const t of item.content) {
        const ref = revisionRefOf(t.styles);
        if (ref) refs.push({ revisionId: ref.revisionId, kind: ref.kind, blockId: block.id });
      }
    }
  }
  return refs;
}

/** Text of a block with pending inserts removed and pending deletes kept (the base text). */
function baseText(block: Block): string {
  const parts: string[] = [];
  for (const item of block.content ?? []) {
    if (!isBuiltinInline(item)) {
      parts.push(blockPlainText({ ...block, content: [item] }));
    } else if (item.type === 'text') {
      if (revisionRefOf(item.styles)?.kind !== 'insert') parts.push(item.text);
    } else if (item.type === 'link') {
      for (const t of item.content) {
        if (revisionRefOf(t.styles)?.kind !== 'insert') parts.push(t.text);
      }
    } else {
      parts.push(blockPlainText({ ...block, content: [item] }));
    }
  }
  return parts.join('');
}

/**
 * Restores `snapshotBlocks` and re-applies pending revisions from `currentBlocks`.
 *
 * For each block id in both trees, when the current block has pending revisions and its base text
 * (the text with pending inserts removed) equals the snapshot's text, the current block is kept
 * with its revisions. Its props and children come from the snapshot. Otherwise the snapshot block
 * is used as is.
 *
 * Revisions that cannot be carried over are returned in `droppedRevisions`, with the reason. The
 * caller decides what to do with them. Nothing is dropped silently.
 *
 * Limit: revisions are not re-applied to a block whose base text differs from the snapshot, because
 * their positions no longer correspond. Those revisions are reported instead.
 */
export function restoreSnapshotPreservingRevisions(
  currentBlocks: Block[],
  snapshotBlocks: Block[]
): SnapshotRestoreResult {
  const current = new Map(flattenBlocks(currentBlocks).map((f) => [f.block.id, f.block] as const));
  const snapshotIds = new Set(flattenBlocks(snapshotBlocks).map((f) => f.block.id));

  const carried = new Set<string>();

  const restore = (snap: Block): Block => {
    const cur = current.get(snap.id);
    let result: Block = { ...snap, props: { ...snap.props } };
    if (cur && cur.type === snap.type) {
      const refs = ownPendingRefs(cur);
      if (refs.length > 0 && baseText(cur) === blockPlainText(snap)) {
        result = { ...cur, props: { ...snap.props } };
        for (const r of refs) carried.add(r.revisionId);
      }
    }
    if (snap.children) {
      result.children = snap.children.map(restore);
    } else if (result.children) {
      delete result.children;
    }
    return result;
  };

  const blocks = snapshotBlocks.map(restore);

  const dropped: DroppedRevision[] = [];
  const seen = new Set<string>();
  for (const block of current.values()) {
    for (const ref of ownPendingRefs(block)) {
      if (carried.has(ref.revisionId) || seen.has(ref.revisionId)) continue;
      seen.add(ref.revisionId);
      dropped.push({
        revisionId: ref.revisionId,
        kind: ref.kind,
        blockId: ref.blockId,
        reason: snapshotIds.has(ref.blockId) ? 'text-changed' : 'block-removed',
      });
    }
  }

  return { blocks, droppedRevisions: dropped };
}
