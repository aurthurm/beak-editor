/**
 * In-memory implementations of the revision and comment stores.
 *
 * Both stores are for tests and single-session use. Production apps should implement the store
 * interfaces over their own persistence.
 *
 * @module
 */

import type {
  AnchoredComment,
  CommentEntry,
  CommentThreadStore,
  NewCommentInput,
  ReplyInput,
  RevisionRecord,
  RevisionStore,
} from './types';
import { newId, nowIso } from './util';

/** Extracts `@handle` mentions from a comment body. Handles are returned without the `@`, in order, once each. */
export function parseMentions(body: string): string[] {
  const found: string[] = [];
  const re = /(?:^|[^A-Za-z0-9_@])@([A-Za-z0-9_][A-Za-z0-9_.-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const handle = (match[1] ?? '').replace(/[.-]+$/, '');
    if (handle && !found.includes(handle)) found.push(handle);
  }
  return found;
}

/** Revision store that keeps records in a Map. */
export class InMemoryRevisionStore implements RevisionStore {
  private readonly records = new Map<string, RevisionRecord>();
  private readonly listeners = new Set<(record: RevisionRecord) => void>();

  constructor(initial: RevisionRecord[] = []) {
    for (const r of initial) this.records.set(r.id, { ...r });
  }

  list(): RevisionRecord[] {
    return [...this.records.values()].map((r) => ({ ...r }));
  }

  get(id: string): RevisionRecord | undefined {
    const r = this.records.get(id);
    return r ? { ...r } : undefined;
  }

  upsert(record: RevisionRecord): void {
    const copy = { ...record };
    this.records.set(copy.id, copy);
    for (const listener of this.listeners) listener({ ...copy });
  }

  subscribe(listener: (record: RevisionRecord) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/** Options for {@link InMemoryCommentThreadStore}. */
export interface InMemoryCommentThreadStoreOptions {
  /** Clock used for timestamps. Defaults to `new Date().toISOString()`. */
  now?: () => string;
  initial?: AnchoredComment[];
}

/**
 * Comment thread store that keeps threads in a Map. Replies parse `@mentions` from the body.
 * Resolving a thread keeps it readable. Replying to a resolved thread does not reopen it.
 */
export class InMemoryCommentThreadStore implements CommentThreadStore {
  private readonly comments = new Map<string, AnchoredComment>();
  private readonly listeners = new Set<(comment: AnchoredComment) => void>();
  private readonly now: () => string;

  constructor(options: InMemoryCommentThreadStoreOptions = {}) {
    this.now = options.now ?? nowIso;
    for (const c of options.initial ?? []) this.comments.set(c.id, clone(c));
  }

  list(): AnchoredComment[] {
    return [...this.comments.values()].map(clone);
  }

  get(id: string): AnchoredComment | undefined {
    const c = this.comments.get(id);
    return c ? clone(c) : undefined;
  }

  add(input: NewCommentInput): AnchoredComment {
    const id = input.id ?? newId('cmt');
    const comment: AnchoredComment = {
      id,
      anchor: { ...input.anchor },
      thread: [makeEntry(input.authorId, input.authorName, input.body, this.now())],
      status: 'open',
    };
    this.comments.set(id, comment);
    return this.emit(comment);
  }

  reply(commentId: string, input: ReplyInput): AnchoredComment {
    const comment = this.require(commentId);
    comment.thread.push(makeEntry(input.authorId, input.authorName, input.body, this.now()));
    return this.emit(comment);
  }

  resolve(commentId: string, by: string): AnchoredComment {
    const comment = this.require(commentId);
    comment.status = 'resolved';
    comment.resolvedBy = by;
    comment.resolvedAt = this.now();
    return this.emit(comment);
  }

  reopen(commentId: string, _by?: string): AnchoredComment {
    const comment = this.require(commentId);
    comment.status = 'open';
    delete comment.resolvedBy;
    delete comment.resolvedAt;
    return this.emit(comment);
  }

  update(comment: AnchoredComment): AnchoredComment {
    this.require(comment.id);
    const copy = clone(comment);
    this.comments.set(copy.id, copy);
    return this.emit(copy);
  }

  subscribe(listener: (comment: AnchoredComment) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private require(id: string): AnchoredComment {
    const comment = this.comments.get(id);
    if (!comment) throw new Error(`comment not found: ${id}`);
    return comment;
  }

  private emit(comment: AnchoredComment): AnchoredComment {
    const copy = clone(comment);
    for (const listener of this.listeners) listener(clone(copy));
    return copy;
  }
}

function makeEntry(authorId: string, authorName: string | undefined, body: string, at: string): CommentEntry {
  return {
    id: newId('msg'),
    authorId,
    authorName,
    body,
    mentions: parseMentions(body),
    at,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
