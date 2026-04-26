import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { BeakBlockEditor, type CommentStore, type CommentThread } from '@amusendame/beakblock-core';
import { QUICK_REACTIONS, formatCommentDate, threadAuditMetaLine, threadRangeLabel } from './commentCommon';

export interface CommentRailProps {
  editor: BeakBlockEditor | null;
  store: CommentStore;
  currentUserId?: string;
  children: React.ReactNode;
}

type ChatDrafts = Record<string, string>;
type ConnectorGeom = { w: number; h: number; d: string };

function clampPos(doc: { content: { size: number } }, pos: number): number {
  return Math.max(1, Math.min(pos, doc.content.size));
}

function escapeAttrSelector(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function CommentRail({ editor, store, currentUserId = 'you', children }: CommentRailProps): React.ReactElement {
  const flyoutId = `beakblock-comment-flyout-${useId()}`;
  const editorColRef = useRef<HTMLDivElement>(null);
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [layoutY, setLayoutY] = useState<Record<string, number>>({});
  const [connectorGeom, setConnectorGeom] = useState<ConnectorGeom | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<ChatDrafts>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const rafRef = useRef<number>(0);
  const activeThreadsRef = useRef<CommentThread[]>([]);
  const selectedThreadIdRef = useRef<string | null>(null);

  const activeThreads = useMemo(
    () =>
      [...threads]
        .filter((thread) => !thread.deletedAt && thread.from < thread.to)
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [threads]
  );
  activeThreadsRef.current = activeThreads;
  selectedThreadIdRef.current = selectedThreadId;

  const selectedThread = useMemo(() => {
    if (!selectedThreadId) return null;
    return activeThreads.find((thread) => thread.id === selectedThreadId) ?? null;
  }, [activeThreads, selectedThreadId]);

  const layoutMarkers = () => {
    const ed = editor;
    const col = editorColRef.current;
    if (!ed || ed.isDestroyed || !col) {
      setLayoutY({});
      setConnectorGeom(null);
      return;
    }

    const view = ed.pm.view;
    const doc = ed.pm.doc;
    const colRect = col.getBoundingClientRect();
    const raw: { id: string; y: number }[] = [];

    for (const thread of activeThreadsRef.current) {
      const pos = clampPos(doc, thread.from);
      try {
        const coords = view.coordsAtPos(pos);
        raw.push({ id: thread.id, y: coords.top - colRect.top });
      } catch {
        // stale position
      }
    }

    raw.sort((a, b) => a.y - b.y);
    const minGap = 30;
    let last = -Infinity;
    const next: Record<string, number> = {};
    for (const { id, y } of raw) {
      let yy = y;
      if (yy < last + minGap) yy = last + minGap;
      next[id] = yy;
      last = yy;
    }

    setLayoutY(next);
    col.style.setProperty('--beakblock-comment-flyout-left', `${colRect.width + 20}px`);

    const sid = selectedThreadIdRef.current;
    if (sid && next[sid] !== undefined) {
      col.style.setProperty('--beakblock-comment-flyout-top', `${next[sid]}px`);
    } else {
      col.style.removeProperty('--beakblock-comment-flyout-top');
    }

    const clearConnector = () => setConnectorGeom(null);

    if (!sid) {
      clearConnector();
      return;
    }

    const thread = activeThreadsRef.current.find((t) => t.id === sid);
    const rail = col.querySelector('.beakblock-comment-shell__marker-rail');
    if (!thread || !rail) {
      clearConnector();
      return;
    }

    const escaped = escapeAttrSelector(sid);
    const annNodes = view.dom.querySelectorAll(`[data-thread-id="${escaped}"]`);

    let spanTop = Infinity;
    let spanBottom = -Infinity;
    let spanRight = -Infinity;

    if (annNodes.length > 0) {
      annNodes.forEach((el) => {
        const r = el.getBoundingClientRect();
        spanTop = Math.min(spanTop, r.top);
        spanBottom = Math.max(spanBottom, r.bottom);
        spanRight = Math.max(spanRight, r.right);
      });
    } else {
      try {
        const a = clampPos(doc, Math.min(thread.from, thread.to));
        const b = clampPos(doc, Math.max(thread.from, thread.to));
        const cFrom = view.coordsAtPos(a);
        const cTo = view.coordsAtPos(b);
        spanRight = Math.max(cFrom.right, cTo.right);
        spanTop = Math.min(cFrom.top, cTo.top);
        spanBottom = Math.max(cFrom.bottom, cTo.bottom);
      } catch {
        clearConnector();
        return;
      }
    }

    const flyoutEl = col.querySelector('.beakblock-comment-flyout');
    const railRect = rail.getBoundingClientRect();
    const lineEndX = flyoutEl ? flyoutEl.getBoundingClientRect().left : railRect.left;

    const spanH = Math.max(1, spanBottom - spanTop);
    const gapAbove = Math.round(Math.max(10, Math.min(20, 8 + spanH * 0.06)));
    const yBottom = spanTop - colRect.top;
    let yTop = yBottom - gapAbove;
    const minY = 4;
    if (yTop < minY) {
      yTop = minY;
    }
    if (yTop >= yBottom - 2) {
      clearConnector();
      return;
    }

    const x0 = spanRight - colRect.left;
    const x1 = lineEndX - colRect.left;
    if (x1 - x0 < 3) {
      clearConnector();
      return;
    }

    const w = Math.max(1, colRect.width);
    const h = Math.max(1, colRect.height);
    const rx0 = Math.round(x0 * 100) / 100;
    const ryBottom = Math.round(yBottom * 100) / 100;
    const ryTop = Math.round(yTop * 100) / 100;
    const rx1 = Math.round(x1 * 100) / 100;

    setConnectorGeom({
      w,
      h,
      d: `M ${rx0} ${ryBottom} L ${rx0} ${ryTop} L ${rx1} ${ryTop}`,
    });
  };

  const focusThreadInEditor = (thread: CommentThread) => {
    const ed = editor;
    if (!ed || ed.isDestroyed) return;
    const doc = ed.pm.doc;
    const from = clampPos(doc, thread.from);
    const to = clampPos(doc, thread.to);
    const a = Math.min(from, to);
    const b = Math.max(from, to);
    try {
      const tr = ed.pm.state.tr.setSelection(ed.pm.createTextSelection(a, b)).scrollIntoView();
      ed.pm.dispatch(tr);
      ed.focus();
    } catch {
      // invalid range
    }
  };

  useEffect(() => {
    setThreads(store.snapshot());
    const unsubscribe = store.subscribe((snapshot) => setThreads(snapshot));
    return unsubscribe;
  }, [store]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const update = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(layoutMarkers);
    };
    const unsubTx = editor.on('transaction', update);
    const unsubSel = editor.on('selectionChange', update);
    update();

    const onResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(layoutMarkers);
    };

    window.addEventListener('scroll', onResize, true);
    window.addEventListener('resize', onResize);

    return () => {
      unsubTx();
      unsubSel();
      window.removeEventListener('scroll', onResize, true);
      window.removeEventListener('resize', onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [editor, store]);

  useEffect(() => {
    if (selectedThreadId && !activeThreads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(null);
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(layoutMarkers);
  }, [activeThreads, selectedThreadId]);

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

  const renderThreadDetail = (thread: CommentThread) => {
    const auditLine = threadAuditMetaLine(thread);
    return (
      <article className={`beakblock-comment-thread ${thread.resolved ? 'beakblock-comment-thread--resolved' : ''}`}>
        <header className="beakblock-comment-thread__header">
          <div>
            <strong>{thread.resolved ? 'Resolved thread' : 'Open thread'}</strong>
            <div className="beakblock-comment-thread__meta">
              {threadRangeLabel(thread)} · {formatCommentDate(thread.createdAt)}
            </div>
            {auditLine ? <div className="beakblock-comment-thread__audit">{auditLine}</div> : null}
          </div>
          <div className="beakblock-comment-thread__header-actions">
            <button
              type="button"
              className="beakblock-comment-thread__chip"
              onClick={() =>
                thread.resolved
                  ? store.unresolveThread({ threadId: thread.id })
                  : store.resolveThread({ threadId: thread.id, userId: currentUserId })
              }
            >
              {thread.resolved ? 'Unresolve' : 'Resolve'}
            </button>
            <button type="button" className="beakblock-comment-thread__chip" onClick={() => store.deleteThread({ threadId: thread.id })}>
              Delete thread
            </button>
          </div>
        </header>
        <div className="beakblock-comment-thread__comments">
          {thread.comments.map((comment) => (
            <div key={comment.id} className="beakblock-comment-thread__comment">
              <div className="beakblock-comment-thread__comment-meta">
                <strong>{comment.authorId}</strong>
                <span>{formatCommentDate(comment.updatedAt)}</span>
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
                          onClick={() =>
                            store.addReaction({
                              threadId: thread.id,
                              commentId: comment.id,
                              emoji,
                              userId: currentUserId,
                            })
                          }
                        >
                          {emoji} {count > 0 ? count : ''}
                        </button>
                      );
                    })}
                  </div>
                  <div className="beakblock-comment-thread__row-actions">
                    <button type="button" className="beakblock-comment-thread__chip" onClick={() => setEditingCommentId(comment.id)}>
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
            placeholder="Reply..."
            onChange={(event) => setReplyDrafts((current) => ({ ...current, [thread.id]: event.target.value }))}
          />
          <div className="beakblock-comment-thread__row-actions">
            <button
              type="button"
              className="beakblock-modal-primary"
              disabled={!replyDrafts[thread.id]?.trim()}
              onClick={() => saveReply(thread.id)}
            >
              Reply
            </button>
          </div>
        </div>
      </article>
    );
  };

  const count = activeThreads.length;

  return (
    <div className="beakblock-comment-shell">
      <div className="beakblock-comment-shell__editor" ref={editorColRef}>
        <div className="beakblock-comment-shell__row">
          <div className="beakblock-comment-shell__doc">{children}</div>
          {count > 0 ? (
            <div className="beakblock-comment-shell__marker-rail">
              <div className="beakblock-comment-markers__track" role="group" aria-label="Comment threads">
                {activeThreads.map((thread) => {
                  const y = layoutY[thread.id] ?? 0;
                  const n = thread.comments.length;
                  const active = selectedThreadId === thread.id;
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      className={[
                        'beakblock-comment-marker__bubble',
                        thread.resolved ? 'beakblock-comment-marker__bubble--resolved' : '',
                        active ? 'beakblock-comment-marker__bubble--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{ top: `${y}px` }}
                      title={thread.resolved ? 'Resolved thread' : 'Open thread'}
                      aria-expanded={active}
                      {...(active ? { 'aria-controls': flyoutId } : {})}
                      aria-label={`Thread with ${n} ${n === 1 ? 'comment' : 'comments'}, ${thread.resolved ? 'resolved' : 'open'}`}
                      onClick={() => {
                        setSelectedThreadId((current) => (current === thread.id ? null : thread.id));
                        focusThreadInEditor(thread);
                      }}
                    >
                      <span className="beakblock-comment-marker__bubble-icon" aria-hidden="true">
                        💬
                      </span>
                      <span className="beakblock-comment-marker__bubble-n">{String(n)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {count > 0 && selectedThread ? (
            <div className="beakblock-comment-flyout" id={flyoutId}>
              <button type="button" className="beakblock-comment-flyout__close" onClick={() => setSelectedThreadId(null)} aria-label="Close comment thread">
                ×
              </button>
              <div className="beakblock-comment-flyout__inner">{renderThreadDetail(selectedThread)}</div>
            </div>
          ) : null}
          {connectorGeom ? (
            <svg className="beakblock-comment-flyout-connector" viewBox={`0 0 ${connectorGeom.w} ${connectorGeom.h}`} preserveAspectRatio="none" aria-hidden="true">
              <path className="beakblock-comment-flyout-connector__path" d={connectorGeom.d} />
            </svg>
          ) : null}
        </div>
      </div>
    </div>
  );
}
