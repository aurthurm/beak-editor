import type { Mapping } from 'prosemirror-transform';
import { v4 as uuid } from 'uuid';

import type {
  CommentEntry,
  CommentReaction,
  CommentReactionInput,
  CommentStore,
  CommentStoreListener,
  CommentThread,
} from './types';

function cloneReaction(reaction: CommentReaction): CommentReaction {
  return {
    emoji: reaction.emoji,
    createdAt: new Date(reaction.createdAt),
    userIds: [...reaction.userIds],
  };
}

function cloneComment(comment: CommentEntry): CommentEntry {
  return {
    ...comment,
    createdAt: new Date(comment.createdAt),
    updatedAt: new Date(comment.updatedAt),
    deletedAt: comment.deletedAt ? new Date(comment.deletedAt) : undefined,
    reactions: comment.reactions.map(cloneReaction),
    metadata: comment.metadata ? { ...comment.metadata } : undefined,
  };
}

function cloneThread(thread: CommentThread): CommentThread {
  return {
    ...thread,
    createdAt: new Date(thread.createdAt),
    updatedAt: new Date(thread.updatedAt),
    resolvedAt: thread.resolvedAt ? new Date(thread.resolvedAt) : undefined,
    deletedAt: thread.deletedAt ? new Date(thread.deletedAt) : undefined,
    metadata: thread.metadata ? { ...thread.metadata } : undefined,
    comments: thread.comments.map(cloneComment),
  };
}

function insertReaction(comment: CommentEntry, emoji: string, userId: string): void {
  const existing = comment.reactions.find((reaction) => reaction.emoji === emoji);
  if (existing) {
    if (!existing.userIds.includes(userId)) {
      existing.userIds.push(userId);
    }
    return;
  }

  comment.reactions.push({
    emoji,
    userIds: [userId],
    createdAt: new Date(),
  });
}

function removeReaction(comment: CommentEntry, emoji: string, userId: string): void {
  comment.reactions = comment.reactions
    .map((reaction) => {
      if (reaction.emoji !== emoji) return reaction;
      return {
        ...reaction,
        userIds: reaction.userIds.filter((id) => id !== userId),
      };
    })
    .filter((reaction) => reaction.userIds.length > 0);
}

export class InMemoryCommentStore implements CommentStore {
  private threads = new Map<string, CommentThread>();
  private listeners = new Set<CommentStoreListener>();

  constructor(initialThreads: CommentThread[] = []) {
    initialThreads.forEach((thread) => {
      this.threads.set(thread.id, cloneThread(thread));
    });
  }

  snapshot(): CommentThread[] {
    return this.getThreads();
  }

  hydrate(snapshot: CommentThread[]): void {
    this.threads.clear();
    for (const thread of snapshot) {
      this.threads.set(thread.id, cloneThread(thread));
    }
    this.emit();
  }

  getThreads(): CommentThread[] {
    return [...this.threads.values()].map(cloneThread);
  }

  getThread(threadId: string): CommentThread | undefined {
    const thread = this.threads.get(threadId);
    return thread ? cloneThread(thread) : undefined;
  }

  getThreadsAt(pos: number): CommentThread[] {
    return this.getThreads().filter((thread) => !thread.deletedAt && thread.from <= pos && thread.to >= pos);
  }

  getActiveThreadAtRange(from: number, to: number): CommentThread | undefined {
    return this.getThreads().find((thread) => !thread.deletedAt && thread.from === from && thread.to === to);
  }

  createThread(options: { from: number; to: number; authorId: string; body: string; metadata?: Record<string, unknown> }): CommentThread {
    const now = new Date();
    const thread: CommentThread = {
      id: uuid(),
      from: Math.min(options.from, options.to),
      to: Math.max(options.from, options.to),
      createdAt: now,
      updatedAt: now,
      resolved: false,
      comments: [
        {
          id: uuid(),
          authorId: options.authorId,
          body: options.body,
          createdAt: now,
          updatedAt: now,
          reactions: [],
          metadata: options.metadata ? { ...options.metadata } : undefined,
        },
      ],
      metadata: options.metadata ? { ...options.metadata } : undefined,
    };

    this.threads.set(thread.id, thread);
    this.emit();
    return cloneThread(thread);
  }

  addComment(options: { threadId: string; authorId: string; body: string; metadata?: Record<string, unknown> }): CommentEntry {
    const thread = this.threads.get(options.threadId);
    if (!thread) throw new Error(`Unknown comment thread: ${options.threadId}`);

    const now = new Date();
    const comment: CommentEntry = {
      id: uuid(),
      authorId: options.authorId,
      body: options.body,
      createdAt: now,
      updatedAt: now,
      reactions: [],
      metadata: options.metadata ? { ...options.metadata } : undefined,
    };
    thread.comments.push(comment);
    thread.updatedAt = now;
    this.emit();
    return cloneComment(comment);
  }

  updateComment(options: { threadId: string; commentId: string; body: string }): CommentEntry | undefined {
    const thread = this.threads.get(options.threadId);
    if (!thread) return undefined;
    const comment = thread.comments.find((entry) => entry.id === options.commentId && !entry.deletedAt);
    if (!comment) return undefined;
    comment.body = options.body;
    comment.updatedAt = new Date();
    thread.updatedAt = new Date();
    this.emit();
    return cloneComment(comment);
  }

  deleteComment(options: { threadId: string; commentId: string }): void {
    const thread = this.threads.get(options.threadId);
    if (!thread) return;
    thread.comments = thread.comments.filter((comment) => comment.id !== options.commentId);
    thread.updatedAt = new Date();
    if (thread.comments.length === 0) {
      this.threads.delete(options.threadId);
    }
    this.emit();
  }

  deleteThread(options: { threadId: string }): void {
    this.threads.delete(options.threadId);
    this.emit();
  }

  resolveThread(options: { threadId: string; userId: string }): void {
    const thread = this.threads.get(options.threadId);
    if (!thread) return;
    thread.resolved = true;
    thread.resolvedAt = new Date();
    thread.resolvedBy = options.userId;
    thread.updatedAt = new Date();
    this.emit();
  }

  unresolveThread(options: { threadId: string }): void {
    const thread = this.threads.get(options.threadId);
    if (!thread) return;
    thread.resolved = false;
    thread.resolvedAt = undefined;
    thread.resolvedBy = undefined;
    thread.updatedAt = new Date();
    this.emit();
  }

  addReaction(options: CommentReactionInput): void {
    const thread = this.threads.get(options.threadId);
    if (!thread) return;
    const comment = thread.comments.find((entry) => entry.id === options.commentId && !entry.deletedAt);
    if (!comment) return;
    insertReaction(comment, options.emoji, options.userId);
    comment.updatedAt = new Date();
    thread.updatedAt = new Date();
    this.emit();
  }

  deleteReaction(options: CommentReactionInput): void {
    const thread = this.threads.get(options.threadId);
    if (!thread) return;
    const comment = thread.comments.find((entry) => entry.id === options.commentId && !entry.deletedAt);
    if (!comment) return;
    removeReaction(comment, options.emoji, options.userId);
    comment.updatedAt = new Date();
    thread.updatedAt = new Date();
    this.emit();
  }

  mapAnchors(mapping: Mapping): void {
    for (const thread of this.threads.values()) {
      if (thread.deletedAt) continue;
      const mappedFrom = mapping.mapResult(thread.from, 1);
      const mappedTo = mapping.mapResult(thread.to, -1);
      if (mappedFrom.deleted && mappedTo.deleted) {
        thread.deletedAt = new Date();
        continue;
      }
      const nextFrom = mappedFrom.pos;
      const nextTo = mappedTo.pos;
      thread.from = Math.min(nextFrom, nextTo);
      thread.to = Math.max(nextFrom, nextTo);
    }
    this.emit();
  }

  subscribe(listener: CommentStoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.getThreads();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

