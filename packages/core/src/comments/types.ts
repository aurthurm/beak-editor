export type CommentReaction = {
  emoji: string;
  userIds: string[];
  createdAt: Date;
};

export type CommentEntry = {
  id: string;
  authorId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  reactions: CommentReaction[];
  metadata?: Record<string, unknown>;
};

export type CommentThread = {
  id: string;
  from: number;
  to: number;
  createdAt: Date;
  updatedAt: Date;
  comments: CommentEntry[];
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  deletedAt?: Date;
  metadata?: Record<string, unknown>;
};

export type CommentReactionInput = {
  threadId: string;
  commentId: string;
  emoji: string;
  userId: string;
};

export type CommentStoreSnapshot = CommentThread[];

export type CommentStoreListener = (threads: CommentStoreSnapshot) => void;

export interface CommentStore {
  snapshot(): CommentStoreSnapshot;
  /**
   * Replace all threads (e.g. after loading from persistence). Notifies subscribers so the editor refreshes annotations.
   */
  hydrate(snapshot: CommentStoreSnapshot): void;
  getThreads(): CommentThread[];
  getThread(threadId: string): CommentThread | undefined;
  getThreadsAt(pos: number): CommentThread[];
  getActiveThreadAtRange(from: number, to: number): CommentThread | undefined;
  createThread(options: {
    from: number;
    to: number;
    authorId: string;
    body: string;
    metadata?: Record<string, unknown>;
  }): CommentThread;
  addComment(options: {
    threadId: string;
    authorId: string;
    body: string;
    metadata?: Record<string, unknown>;
  }): CommentEntry;
  updateComment(options: {
    threadId: string;
    commentId: string;
    body: string;
  }): CommentEntry | undefined;
  deleteComment(options: {
    threadId: string;
    commentId: string;
  }): void;
  deleteThread(options: { threadId: string }): void;
  resolveThread(options: { threadId: string; userId: string }): void;
  unresolveThread(options: { threadId: string }): void;
  addReaction(options: CommentReactionInput): void;
  deleteReaction(options: CommentReactionInput): void;
  mapAnchors(mapping: import('prosemirror-transform').Mapping): void;
  subscribe(listener: CommentStoreListener): () => void;
}

