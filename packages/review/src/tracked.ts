/**
 * Core tracked-edit construction: marks a range as deleted, inserts new content as inserted,
 * and keeps revision records in sync with the document.
 *
 * Used by the tracking plugin (for user edits) and by `proposeChange` (for AI and other proposals).
 *
 * @module
 */

import { Fragment, Slice, type Attrs, type Mark, type Node as PMNode } from 'prosemirror-model';
import type { Transaction } from 'prosemirror-state';

import type { ReviewAuthor, RevisionKind, RevisionRecord, RevisionStore } from './types';
import {
  DELETION_MARK,
  INSERTION_MARK,
  collectRevisionInfo,
  newId,
  nowIso,
  resolveLocation,
  revisionText,
  textSegments,
  clampPos,
  type SectionResolver,
  type TextSegment,
} from './util';

/** Options for {@link applyTrackedChange}. */
export interface TrackedChangeOptions {
  /** Start of the replaced range (in the transaction's current document). */
  from: number;
  /** End of the replaced range. Equal to `from` for a pure insertion. */
  to: number;
  /** Content to insert at `to` after the deleted range. Its text receives insertion marks. */
  insertion: Slice | null;
  author: ReviewAuthor;
  aiGenerated?: boolean;
  /** Group id for both halves. Overrides `groupReplacements`. */
  groupId?: string | null;
  /** Assign a fresh group id when the change both deletes and inserts text. */
  groupReplacements?: boolean;
}

/** Result of {@link applyTrackedChange}. */
export interface TrackedChangeResult {
  tr: Transaction;
  /** Revision ids of deletion marks created or reused by this change. */
  deletionIds: string[];
  /** Revision ids of insertion marks on the inserted content (own author). */
  insertionIds: string[];
  /** Start of the inserted content in the resulting document. */
  insertStart: number;
  /** End of the inserted content in the resulting document. The deleted text sits before it. */
  insertEnd: number;
  /** Own pending insertions whose text was removed for real. */
  removedOwnIds: string[];
  /** True when the insertion could not be placed. The transaction is then left unchanged for it. */
  failed: boolean;
}

function mapFragment(frag: Fragment, fn: (node: PMNode) => PMNode): Fragment {
  const nodes: PMNode[] = [];
  frag.forEach((child) => {
    if (child.isText) {
      nodes.push(fn(child));
    } else if (child.content.size > 0) {
      nodes.push(child.copy(mapFragment(child.content, fn)));
    } else {
      nodes.push(child);
    }
  });
  return Fragment.fromArray(nodes);
}

/**
 * Attributes of an adjacent mark of the same author, so that consecutive typing or deleting
 * coalesces into one revision.
 */
export function adjacentOwnAttrs(
  doc: PMNode,
  pos: number,
  markName: string,
  authorId: string
): Attrs | null {
  const $pos = doc.resolve(clampPos(doc, pos));
  for (const node of [$pos.nodeBefore, $pos.nodeAfter]) {
    if (!node || !node.isText) continue;
    const mark = node.marks.find((m) => m.type.name === markName && m.attrs.authorId === authorId);
    if (mark) return { ...mark.attrs };
  }
  return null;
}

/**
 * Applies a tracked replacement to a transaction.
 *
 * Text in `[from, to)` is deleted in one of two ways:
 * - text that is the author's own pending insertion is removed for real;
 * - any other text is kept and receives a `deletion` mark (already-deleted text is left alone).
 *
 * `insertion` is then inserted at `to`. Its text receives an `insertion` mark unless it already has
 * one from the same author. Deletion marks are stripped from inserted content.
 *
 * @param tr - Transaction whose current document is the base to edit
 * @param opts - Range, inserted content and author
 * @returns The transaction and the revision ids involved
 */
export function applyTrackedChange(tr: Transaction, opts: TrackedChangeOptions): TrackedChangeResult {
  const doc = tr.doc;
  const schema = doc.type.schema;
  const insType = schema.marks[INSERTION_MARK];
  const delType = schema.marks[DELETION_MARK];
  if (!insType || !delType) {
    throw new Error('review: the schema needs "insertion" and "deletion" marks');
  }
  const { from, to, author } = opts;
  const result: TrackedChangeResult = {
    tr,
    deletionIds: [],
    insertionIds: [],
    insertStart: from,
    insertEnd: from,
    removedOwnIds: [],
    failed: false,
  };

  const segs = to > from ? textSegments(doc, from, to) : [];
  const toMark: TextSegment[] = [];
  const toCut: TextSegment[] = [];
  for (const seg of segs) {
    const insMarks = seg.marks.filter((m) => m.type === insType);
    if (insMarks.length > 0 && insMarks.every((m) => m.attrs.authorId === author.id)) {
      toCut.push(seg);
      continue;
    }
    if (!seg.marks.some((m) => m.type === delType)) toMark.push(seg);
  }

  const willInsert = Boolean(opts.insertion && opts.insertion.size > 0);
  const groupId =
    opts.groupId !== undefined
      ? opts.groupId
      : opts.groupReplacements && toMark.length > 0 && willInsert
        ? newId('grp')
        : null;
  const now = nowIso();
  const freshAttrs = (): Attrs => ({
    revisionId: newId('rev'),
    authorId: author.id,
    authorName: author.name ?? null,
    at: now,
    aiGenerated: opts.aiGenerated ?? false,
    groupId,
  });

  // 1. Mark deletions first: marks do not move positions.
  if (toMark.length > 0) {
    const attrs = adjacentOwnAttrs(doc, from, DELETION_MARK, author.id) ?? freshAttrs();
    result.deletionIds.push(String(attrs.revisionId));
    const mark = delType.create(attrs);
    for (const seg of toMark) tr.addMark(seg.from, seg.to, mark);
  }

  // 2. Remove own pending insertions for real, from the end so earlier positions stay valid.
  for (const seg of toCut) {
    for (const m of seg.marks) {
      if (m.type === insType) result.removedOwnIds.push(String(m.attrs.revisionId));
    }
  }
  for (const seg of [...toCut].reverse()) tr.delete(seg.from, seg.to);

  // 3. Insert new content after the deleted range.
  const insPos = tr.mapping.map(to, 1);
  result.insertStart = insPos;
  result.insertEnd = insPos;

  if (willInsert && opts.insertion) {
    const slice = opts.insertion;
    let needsMark = false;
    slice.content.descendants((node) => {
      if (node.isText && !node.marks.some((m) => m.type === insType && m.attrs.authorId === author.id)) {
        needsMark = true;
      }
    });
    const insAttrs = needsMark
      ? (adjacentOwnAttrs(tr.doc, insPos, INSERTION_MARK, author.id) ?? freshAttrs())
      : null;

    const mapped = new Slice(
      mapFragment(slice.content, (node) => {
        let marks: readonly Mark[] = node.marks.filter((m) => m.type !== delType);
        const own = marks.some((m) => m.type === insType && m.attrs.authorId === author.id);
        if (!own && insAttrs) {
          marks = insType.create(insAttrs).addToSet(marks);
        }
        return node.mark(marks);
      }),
      slice.openStart,
      slice.openEnd
    );

    mapped.content.descendants((node) => {
      for (const m of node.marks) {
        if (m.type === insType && m.attrs.authorId === author.id) {
          const id = String(m.attrs.revisionId);
          if (!result.insertionIds.includes(id)) result.insertionIds.push(id);
        }
      }
    });

    const steps = tr.steps.length;
    tr.replace(insPos, insPos, mapped);
    if (tr.steps.length === steps) {
      result.failed = true;
      return result;
    }
    result.insertEnd = tr.mapping.map(to, 1);
  }

  return result;
}

/** Options for {@link syncRevisionRecords}. */
export interface RecordSyncOptions {
  store?: RevisionStore;
  touched: Array<{ id: string; kind: RevisionKind }>;
  /** Revision ids that were in the changed range before the edit. Ids that vanished are rejected. */
  previousIds?: Iterable<string>;
  /** Who made the change. Used as `resolvedBy` for revisions removed by their own author. */
  actor: ReviewAuthor;
  note?: string;
  getSectionId?: SectionResolver;
  /** Store the `format` record for a formatting change (no marks). */
  formatRecord?: { id: string; sectionId: string | null; blockId?: string; text: string; note: string };
}

/**
 * Writes or updates store records for the revisions touched by an edit. The marks in `doc` provide
 * the author, timestamps, group and AI flag. Records are not created when there is no store.
 */
export function syncRevisionRecords(doc: PMNode, opts: RecordSyncOptions): void {
  const { store } = opts;
  if (!store) return;
  const now = nowIso();
  const info = collectRevisionInfo(doc);

  for (const { id, kind } of opts.touched) {
    const mark = info.get(id);
    if (!mark) continue;
    const existing = store.get(id);
    const loc = resolveLocation(doc, mark.from, opts.getSectionId);
    const record: RevisionRecord = {
      id,
      kind: existing?.kind ?? kind,
      authorId: mark.authorId ?? existing?.authorId ?? '',
      authorName: mark.authorName ?? existing?.authorName,
      at: mark.at ?? existing?.at ?? now,
      status: existing?.status ?? 'pending',
      aiGenerated: mark.aiGenerated,
      sectionId: loc.sectionId,
      blockId: loc.blockId,
      text: revisionText(doc, id),
      note: opts.note ?? existing?.note,
      groupId: mark.groupId ?? existing?.groupId,
    };
    store.upsert(record);
  }

  if (opts.formatRecord) {
    const f = opts.formatRecord;
    store.upsert({
      id: f.id,
      kind: 'format',
      authorId: opts.actor.id,
      authorName: opts.actor.name,
      at: now,
      status: 'pending',
      sectionId: f.sectionId,
      blockId: f.blockId,
      text: f.text,
      note: f.note,
    });
  }

  if (opts.previousIds) {
    for (const id of opts.previousIds) {
      if (info.has(id)) continue;
      const existing = store.get(id);
      if (existing && existing.status === 'pending') {
        store.upsert({
          ...existing,
          status: 'rejected',
          resolvedBy: opts.actor.id,
          resolvedAt: now,
        });
      }
    }
  }
}
