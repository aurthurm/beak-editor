import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { type BeakBlockEditor, type CommentStore, type CommentThread } from '@aurthurm/beakblock-core';

export interface CommentModalProps {
  open: boolean;
  editor: BeakBlockEditor | null;
  store: CommentStore;
  currentUserId?: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

type SelectionAnchor = { from: number; to: number; text: string };

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉'];

function getPortalTarget(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.body;
}

function formatDate(date: Date | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function threadRangeLabel(thread: CommentThread): string {
  return `Range ${thread.from} - ${thread.to}`;
}

export function CommentModal({
  open,
  editor,
  store,
  currentUserId = 'you',
  title,
  subtitle,
  onClose,
}: CommentModalProps): React.ReactElement | null {
  const [anchor, setAnchor] = useState<SelectionAnchor | null>(null);
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [draft, setDraft] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');

  useEffect(() => {
    if (!open || !editor || editor.isDestroyed) {
      setAnchor(null);
      setDraft('');
      return;
    }

    const from = editor.pm.selection.from;
    const to = editor.pm.selection.to;
    const text = editor.pm.getSelectedText();
    setAnchor(from === to ? null : { from, to, text });
    setDraft('');
    setEditingCommentId(null);
    setEditingBody('');
    setReplyDrafts({});
    setThreads(store.snapshot());

    const unsubscribe = store.subscribe((snapshot) => setThreads(snapshot));
    return unsubscribe;
  }, [open, editor, store]);

  const visibleThreads = useMemo(() => {
    const sorted = [...threads].filter((thread) => !thread.deletedAt).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    if (!anchor) return sorted;
    return sorted.filter((thread) => thread.from <= anchor.to && thread.to >= anchor.from);
  }, [anchor, threads]);

  if (!open) return null;
  const portalTarget = getPortalTarget();
  if (!portalTarget) return null;

  const createThread = () => {
    if (!anchor || !draft.trim()) return;
    store.createThread({
      from: anchor.from,
      to: anchor.to,
      authorId: currentUserId,
      body: draft.trim(),
    });
    setDraft('');
  };

  const saveReply = (threadId: string) => {
    const body = replyDrafts[threadId]?.trim();
    if (!body) return;
    store.addComment({
      threadId,
      authorId: currentUserId,
      body,
    });
    setReplyDrafts((current) => ({ ...current, [threadId]: '' }));
  };

  const startEdit = (commentId: string, body: string) => {
    setEditingCommentId(commentId);
    setEditingBody(body);
  };

  const saveEdit = (threadId: string, commentId: string) => {
    if (!editingBody.trim()) return;
    store.updateComment({
      threadId,
      commentId,
      body: editingBody.trim(),
    });
    setEditingCommentId(null);
    setEditingBody('');
  };

  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditingBody('');
  };

  return createPortal(
    <div className="beakblock-modal-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="beakblock-comment-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Comments'}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="beakblock-modal-header">
          <div>
            <div className="beakblock-modal-kicker">Collaboration</div>
            <h2>{title || 'Comments'}</h2>
            <p>{subtitle || 'Capture review notes, replies, reactions, and resolution state on the selected text.'}</p>
          </div>
          <button type="button" className="beakblock-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="beakblock-comment-modal__body">
          <section className="beakblock-comment-modal__composer">
            <div className="beakblock-modal-section-title">Selected text</div>
            <div className="beakblock-comment-modal__selection">
              {anchor?.text || 'Select text in the editor before opening comments.'}
            </div>
            <div className="beakblock-modal-section-title">New thread</div>
            <textarea
              className="beakblock-comment-modal__textarea"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Leave a comment for your collaborators..."
            />
            <div className="beakblock-comment-modal__actions">
              <button type="button" className="beakblock-modal-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="beakblock-modal-primary" onClick={createThread} disabled={!anchor || !draft.trim()}>
                Add comment
              </button>
            </div>
          </section>

          <section className="beakblock-comment-modal__threads">
            <div className="beakblock-modal-section-title">Threads</div>
            {visibleThreads.length === 0 ? (
              <div className="beakblock-comment-modal__empty">No comment threads yet.</div>
            ) : (
              visibleThreads.map((thread) => (
                <article key={thread.id} className={`beakblock-comment-thread ${thread.resolved ? 'beakblock-comment-thread--resolved' : ''}`}>
                  <header className="beakblock-comment-thread__header">
                    <div>
                      <strong>{thread.resolved ? 'Resolved thread' : 'Open thread'}</strong>
                      <div className="beakblock-comment-thread__meta">{threadRangeLabel(thread)} · {formatDate(thread.createdAt)}</div>
                    </div>
                    <div className="beakblock-comment-thread__header-actions">
                      <button
                        type="button"
                        className="beakblock-comment-thread__chip"
                        onClick={() => (thread.resolved ? store.unresolveThread({ threadId: thread.id }) : store.resolveThread({ threadId: thread.id, userId: currentUserId }))}
                      >
                        {thread.resolved ? 'Unresolve' : 'Resolve'}
                      </button>
                      <button
                        type="button"
                        className="beakblock-comment-thread__chip"
                        onClick={() => store.deleteThread({ threadId: thread.id })}
                      >
                        Delete thread
                      </button>
                    </div>
                  </header>

                  <div className="beakblock-comment-thread__comments">
                    {thread.comments.map((comment) => (
                      <div key={comment.id} className="beakblock-comment-thread__comment">
                        <div className="beakblock-comment-thread__comment-meta">
                          <strong>{comment.authorId}</strong>
                          <span>{formatDate(comment.updatedAt)}</span>
                        </div>

                        {editingCommentId === comment.id ? (
                          <>
                            <textarea
                              className="beakblock-comment-modal__textarea"
                              value={editingBody}
                              onChange={(event) => setEditingBody(event.target.value)}
                            />
                            <div className="beakblock-comment-thread__row-actions">
                              <button type="button" className="beakblock-modal-secondary" onClick={cancelEdit}>Cancel</button>
                              <button type="button" className="beakblock-modal-primary" onClick={() => saveEdit(thread.id, comment.id)}>
                                Save
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="beakblock-comment-thread__body">{comment.body}</p>
                            <div className="beakblock-comment-thread__reactions">
                              {QUICK_REACTIONS.map((emoji) => {
                                const count = comment.reactions.find((reaction) => reaction.emoji === emoji)?.userIds.length ?? 0;
                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className="beakblock-comment-thread__reaction"
                                    onClick={() => store.addReaction({ threadId: thread.id, commentId: comment.id, emoji, userId: currentUserId })}
                                  >
                                    {emoji} {count > 0 ? count : ''}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="beakblock-comment-thread__row-actions">
                              <button type="button" className="beakblock-comment-thread__chip" onClick={() => startEdit(comment.id, comment.body)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                className="beakblock-comment-thread__chip"
                                onClick={() => store.deleteComment({ threadId: thread.id, commentId: comment.id })}
                              >
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="beakblock-comment-thread__reply">
                    <textarea
                      className="beakblock-comment-modal__textarea"
                      value={replyDrafts[thread.id] || ''}
                      onChange={(event) => setReplyDrafts((current) => ({ ...current, [thread.id]: event.target.value }))}
                      placeholder="Reply..."
                    />
                    <div className="beakblock-comment-thread__row-actions">
                      <button
                        type="button"
                        className="beakblock-modal-primary"
                        onClick={() => saveReply(thread.id)}
                        disabled={!replyDrafts[thread.id]?.trim()}
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
        </div>
      </div>
    </div>,
    portalTarget
  );
}

