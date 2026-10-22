/**
 * Review operations on a live editor view: accept and reject revisions, list pending revisions,
 * and propose tracked changes.
 *
 * Marks in the document are the source of truth. Store records get status, provenance and
 * `resolvedBy`/`resolvedAt` updates, and are created when missing.
 *
 * @module
 */

import { Fragment, Slice, type Node as PMNode } from 'prosemirror-model';
import type { EditorState, Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import { REVIEW_META_INTERNAL, getReviewState } from './trackChanges';
import { applyTrackedChange, syncRevisionRecords } from './tracked';
import type { ReviewAuthor, RevisionRecord, RevisionStore } from './types';
import {
  DELETION_MARK,
  INSERTION_MARK,
  clampPos,
  collectRevisionInfo,
  newId,
  nowIso,
  resolveLocation,
  revisionIdsIn,
  revisionText,
  type RevisionMarkInfo,
  type SectionResolver,
} from './util';

type Action = 'accept' | 'reject';

function storeOf(state: EditorState): RevisionStore | undefined {
  return getReviewState(state)?.store;
}

function sectionResolverOf(state: EditorState): SectionResolver | undefined {
  return getReviewState(state)?.getSectionId;
}

/** Expands a set of ids with every revision that shares a group with them. */
function expandTargets(
  ids: readonly string[],
  info: Map<string, RevisionMarkInfo>,
  store: RevisionStore | undefined
): Set<string> {
  const groups = new Set<string>();
  for (const id of ids) {
    const g = info.get(id)?.groupId ?? store?.get(id)?.groupId;
    if (g) groups.add(g);
  }
  const targets = new Set<string>(ids);
  for (const [id, mark] of info) {
    if (mark.groupId && groups.has(mark.groupId)) targets.add(id);
  }
  if (store) {
    for (const rec of store.list()) {
      if (rec.groupId && groups.has(rec.groupId) && rec.status === 'pending') targets.add(rec.id);
    }
  }
  return targets;
}

/**
 * Builds the transaction that accepts or rejects the given revisions in the document.
 *
 * Accepting an insertion or rejecting a deletion removes the mark. Accepting a deletion or
 * rejecting an insertion removes the text. A textblock whose text is entirely removed is removed
 * too, as long as its parent keeps at least one child.
 */
function buildResolutionTransaction(state: EditorState, targets: Set<string>, action: Action): Transaction | null {
  const { schema, doc } = state;
  const insType = schema.marks[INSERTION_MARK];
  const delType = schema.marks[DELETION_MARK];
  if (!insType || !delType) return null;

  const removeType = action === 'accept' ? delType : insType;
  const unmarkType = action === 'accept' ? insType : delType;
  const tr = state.tr;

  // Unmark first: marks do not change positions.
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type === unmarkType && targets.has(String(mark.attrs.revisionId))) {
        tr.removeMark(pos, pos + node.nodeSize, mark);
      }
    }
  });

  const removed = (node: PMNode): boolean =>
    node.isText && node.marks.some((m) => m.type === removeType && targets.has(String(m.attrs.revisionId)));

  // Textblocks whose text is entirely removed.
  const emptied: Array<{ pos: number; node: PMNode; parent: PMNode }> = [];
  doc.descendants((node, pos, parent) => {
    if (!node.isTextblock) return true;
    if (!parent) return false;
    let any = false;
    let all = true;
    node.descendants((child) => {
      if (child.isText) {
        any = true;
        if (!removed(child)) all = false;
      }
      return true;
    });
    if (any && all) emptied.push({ pos, node, parent });
    return false;
  });

  const removableBlocks = emptied.filter(({ parent }) => {
    const countInParent = emptied.filter((e) => e.parent === parent).length;
    return parent.childCount - countInParent >= 1 && parent.childCount > 1;
  });
  const insideBlock = (pos: number): boolean =>
    removableBlocks.some((b) => pos >= b.pos && pos < b.pos + b.node.nodeSize);

  const ranges: Array<{ from: number; to: number }> = [];
  for (const b of removableBlocks) ranges.push({ from: b.pos, to: b.pos + b.node.nodeSize });
  doc.descendants((node, pos) => {
    if (!removed(node) || insideBlock(pos)) return;
    ranges.push({ from: pos, to: pos + node.nodeSize });
  });

  ranges.sort((a, b) => b.from - a.from);
  for (const r of ranges) tr.delete(r.from, r.to);

  return tr.docChanged || tr.steps.length > 0 ? tr : null;
}

function resolveRevisions(view: EditorView, ids: readonly string[], action: Action, by: string): boolean {
  const state = view.state;
  const store = storeOf(state);
  const info = collectRevisionInfo(state.doc);
  const targets = expandTargets(ids, info, store);
  if (targets.size === 0) return false;

  const now = nowIso();
  const updates: RevisionRecord[] = [];
  if (store) {
    for (const id of targets) {
      const existing = store.get(id);
      const mark = info.get(id);
      let rec: RevisionRecord | undefined = existing;
      if (!rec && mark) {
        const loc = resolveLocation(state.doc, mark.from, sectionResolverOf(state));
        rec = {
          id,
          kind: mark.kind,
          authorId: mark.authorId ?? '',
          authorName: mark.authorName ?? undefined,
          at: mark.at ?? now,
          status: 'pending',
          aiGenerated: mark.aiGenerated,
          sectionId: loc.sectionId,
          blockId: loc.blockId,
          text: revisionText(state.doc, id),
          groupId: mark.groupId ?? undefined,
        };
      }
      if (!rec || rec.status !== 'pending') continue;
      updates.push({
        ...rec,
        status: action === 'accept' ? 'accepted' : 'rejected',
        resolvedBy: by,
        resolvedAt: now,
      });
    }
  }

  // The store is updated only after the document change went through. A plugin filter can refuse
  // the transaction, and the store must not say "accepted" for text that is still pending.
  const tr = buildResolutionTransaction(state, targets, action);
  if (tr) {
    tr.setMeta(REVIEW_META_INTERNAL, true);
    const before = view.state;
    view.dispatch(tr);
    if (view.state === before) return false;
  }
  if (store) {
    for (const rec of updates) store.upsert(rec);
  }
  return true;
}

/**
 * Accepts a revision. If it belongs to a replacement group, the whole group is accepted.
 *
 * @returns `true` when a revision was resolved
 */
export function acceptRevision(view: EditorView, id: string, by: string): boolean {
  return resolveRevisions(view, [id], 'accept', by);
}

/**
 * Rejects a revision. If it belongs to a replacement group, the whole group is rejected.
 *
 * @returns `true` when a revision was resolved
 */
export function rejectRevision(view: EditorView, id: string, by: string): boolean {
  return resolveRevisions(view, [id], 'reject', by);
}

/** Accepts every pending revision in the document and every pending format record. */
export function acceptAll(view: EditorView, by: string): boolean {
  return resolveRevisions(view, allPendingIds(view.state), 'accept', by);
}

/** Rejects every pending revision in the document and every pending format record. */
export function rejectAll(view: EditorView, by: string): boolean {
  return resolveRevisions(view, allPendingIds(view.state), 'reject', by);
}

function allPendingIds(state: EditorState): string[] {
  const ids = [...collectRevisionInfo(state.doc).keys()];
  const store = storeOf(state);
  if (store) {
    for (const rec of store.list()) {
      if (rec.status === 'pending' && !ids.includes(rec.id)) ids.push(rec.id);
    }
  }
  return ids;
}

/**
 * Lists pending revisions. Insert and delete revisions are derived from the marks in the document,
 * in document order. Pending format records come from the store.
 *
 * @param state - Editor state
 * @param store - Store to read format records from. Defaults to the store of the tracking plugin.
 */
export function listPendingRevisions(state: EditorState, store?: RevisionStore): RevisionRecord[] {
  const source = store ?? storeOf(state);
  const resolver = sectionResolverOf(state);
  const out: RevisionRecord[] = [];
  for (const [id, mark] of collectRevisionInfo(state.doc)) {
    const rec = source?.get(id);
    const loc = resolveLocation(state.doc, mark.from, resolver);
    out.push({
      id,
      kind: mark.kind,
      authorId: mark.authorId ?? '',
      authorName: mark.authorName ?? undefined,
      at: mark.at ?? rec?.at ?? '',
      status: 'pending',
      aiGenerated: mark.aiGenerated,
      sectionId: loc.sectionId,
      blockId: loc.blockId,
      text: revisionText(state.doc, id),
      groupId: mark.groupId ?? undefined,
      note: rec?.note,
    });
  }
  if (source) {
    for (const rec of source.list()) {
      if (rec.kind === 'format' && rec.status === 'pending') out.push(rec);
    }
  }
  return out;
}

/** Input for {@link proposeChange}. */
export interface ProposeChangeOptions {
  from: number;
  to: number;
  text: string;
  author: ReviewAuthor;
  aiGenerated?: boolean;
  note?: string;
}

/** Revision ids created by {@link proposeChange}. */
export interface ProposedChange {
  groupId: string | null;
  deletionRevisionId: string | null;
  insertionRevisionId: string | null;
  from: number;
  to: number;
}

/**
 * Proposes a tracked replacement of `[from, to)` with `text`. The old text is marked deleted and the
 * new text is marked inserted. Both halves share a group id. Nothing is accepted automatically, and
 * this works whether or not track changes is on.
 *
 * @throws RangeError for an invalid range or an empty proposal
 */
export function proposeChange(view: EditorView, opts: ProposeChangeOptions): ProposedChange {
  const state = view.state;
  const doc = state.doc;
  const { from, to, text } = opts;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > doc.content.size || from > to) {
    throw new RangeError(`proposeChange: invalid range ${from}-${to}`);
  }
  if (from === to && text.length === 0) {
    throw new RangeError('proposeChange: nothing to delete or insert');
  }
  if (!state.schema.marks[INSERTION_MARK] || !state.schema.marks[DELETION_MARK]) {
    throw new Error('proposeChange: the schema needs "insertion" and "deletion" marks');
  }

  const groupId = from < to && text.length > 0 ? newId('grp') : null;
  const insertion = text.length > 0 ? new Slice(Fragment.from(state.schema.text(text)), 0, 0) : null;
  const tr = state.tr;
  const result = applyTrackedChange(tr, {
    from: clampPos(doc, from),
    to: clampPos(doc, to),
    insertion,
    author: opts.author,
    aiGenerated: opts.aiGenerated ?? false,
    groupId,
  });
  if (result.failed) {
    throw new Error('proposeChange: the replacement does not fit at this position');
  }
  tr.setMeta(REVIEW_META_INTERNAL, true);

  syncRevisionRecords(tr.doc, {
    store: storeOf(state),
    touched: [
      ...result.deletionIds.map((id) => ({ id, kind: 'delete' as const })),
      ...result.insertionIds.map((id) => ({ id, kind: 'insert' as const })),
    ],
    previousIds: revisionIdsIn(doc, from, to),
    actor: opts.author,
    note: opts.note,
    getSectionId: sectionResolverOf(state),
  });

  view.dispatch(tr);
  return {
    groupId,
    deletionRevisionId: result.deletionIds[0] ?? null,
    insertionRevisionId: result.insertionIds[0] ?? null,
    from,
    to: result.insertEnd,
  };
}
