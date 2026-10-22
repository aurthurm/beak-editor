/**
 * Public review types: revision records, anchored comments and store contracts.
 *
 * These shapes implement contract section 5 of `docs/2.0/contracts.md`. Fields marked
 * optional are additive extensions.
 *
 * @module
 */

/** Kind of a tracked change. `format` records are kept in the store only (they are applied directly). */
export type RevisionKind = 'insert' | 'delete' | 'replace' | 'move' | 'format';

/** Review status of a revision. */
export type RevisionStatus = 'pending' | 'accepted' | 'rejected';

/**
 * A durable revision record.
 *
 * Pending insert/delete revisions are also derived from the `insertion`/`deletion` marks in the
 * document, so the marks are the source of truth. The store adds provenance and format records.
 */
export interface RevisionRecord {
  id: string;
  kind: RevisionKind;
  authorId: string;
  authorName?: string;
  /** ISO timestamp of creation. */
  at: string;
  status: RevisionStatus;
  /** Who accepted or rejected the revision (or, for own removed insertions, who removed it). */
  resolvedBy?: string;
  /** ISO timestamp of resolution. */
  resolvedAt?: string;
  aiGenerated?: boolean;
  sectionId?: string | null;
  blockId?: string;
  /** Text affected by the revision (inserted or deleted text, or the formatted text). */
  text?: string;
  note?: string;
  /** Shared by the deletion and insertion halves of one replacement. */
  groupId?: string;
}

/** Storage contract for revision records. */
export interface RevisionStore {
  list(): RevisionRecord[];
  get(id: string): RevisionRecord | undefined;
  upsert(record: RevisionRecord): void;
  subscribe(listener: (record: RevisionRecord) => void): () => void;
}

/** Stable anchor of a comment: block id plus the quoted text and its offset inside the block. */
export interface CommentAnchor {
  sectionId: string | null;
  blockId: string;
  quote: string;
  /** Offset of the quote in the block's plain text. */
  offset: number;
  length: number;
}

/** One message in a comment thread. */
export interface CommentEntry {
  id: string;
  authorId: string;
  authorName?: string;
  body: string;
  /** Handles mentioned in the body, without the leading `@`. */
  mentions: string[];
  at: string;
}

/** A comment thread anchored to a block. */
export interface AnchoredComment {
  id: string;
  anchor: CommentAnchor;
  thread: CommentEntry[];
  status: 'open' | 'resolved';
  resolvedBy?: string;
  resolvedAt?: string;
  /** Set by `reanchorComments` when the anchored block or quote no longer exists. */
  orphaned?: boolean;
}

/** Storage contract for comment threads. */
export interface CommentThreadStore {
  list(): AnchoredComment[];
  get(id: string): AnchoredComment | undefined;
  add(input: NewCommentInput): AnchoredComment;
  reply(commentId: string, input: ReplyInput): AnchoredComment;
  resolve(commentId: string, by: string): AnchoredComment;
  reopen(commentId: string, by?: string): AnchoredComment;
  /** Replaces a stored comment (used to persist `reanchorComments` results). */
  update(comment: AnchoredComment): AnchoredComment;
  subscribe(listener: (comment: AnchoredComment) => void): () => void;
}

/** Input for creating a comment thread. */
export interface NewCommentInput {
  id?: string;
  anchor: CommentAnchor;
  authorId: string;
  authorName?: string;
  body: string;
}

/** Input for replying in a thread. */
export interface ReplyInput {
  authorId: string;
  authorName?: string;
  body: string;
}

/** Who is performing a review action. */
export interface ReviewAuthor {
  id: string;
  name?: string;
}

/** The three review projections. */
export type ReviewView = 'markup' | 'final' | 'original';

/** Revision reference stored on inline styles (contract 1.3, `TextStyles.revision`). */
export interface RevisionStyleRef {
  kind: 'insert' | 'delete';
  revisionId: string;
  authorId?: string;
  authorName?: string;
  at: string;
  aiGenerated?: boolean;
}
