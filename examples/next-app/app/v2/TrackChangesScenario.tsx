"use client";

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { BeakBlockView, OfficeShell, useBeakBlock } from '@amusendame/beakblock-react';
import type { BeakBlockEditor, Block } from '@amusendame/beakblock-core';
import {
  acceptAll,
  acceptRevision,
  compareRevisions,
  createCommentAnchor,
  createCommentAnchorFromSelection,
  InMemoryCommentThreadStore,
  InMemoryRevisionStore,
  listPendingRevisions,
  rejectAll,
  rejectRevision,
  renderRedlineHTML,
  reviewExtension,
  setReviewView,
  setTrackChangesEnabledTransaction,
  isTrackChangesEnabled,
  type AnchoredComment,
  type RevisionRecord } from '@amusendame/beakblock-review';
import { releasedRevisionBlocks, trackRevisionRecords, TRACK_AUTHORS, workingCopyBlocks } from './demoData';
import { Badge, Notice, Panel, ScenarioIntro, useEditorTick } from './common';

type ReviewView = 'markup' | 'final' | 'original';

const VIEWS: Array<{ id: ReviewView; label: string }> = [
  { id: 'markup', label: 'Markup' },
  { id: 'final', label: 'Final' },
  { id: 'original', label: 'Original' },
];

export function TrackChangesScenario(): ReactElement {
  // The review plugin keeps a reference to this object, so switching authors updates the plugin in place.
  const [author] = useState(() => ({ id: TRACK_AUTHORS[0].id as string, name: TRACK_AUTHORS[0].name as string }));
  const [authorId, setAuthorId] = useState<string>(author.id);
  const [revisionStore] = useState(() => new InMemoryRevisionStore(trackRevisionRecords()));
  const [commentStore] = useState(() => {
    const store = new InMemoryCommentThreadStore();
    try {
      store.add({
        anchor: createCommentAnchor(workingCopyBlocks(), 'wc-p2', 0, 7),
        authorId: 'rita',
        authorName: 'Rita Reviewer',
        body: 'Ann, please confirm this wording before release. @ben, can you check the scope line?',
      });
    } catch {
      // The seed anchor is generated from the same blocks; if it ever fails, the panel starts empty.
    }
    return store;
  });
  const [reviewExt] = useState(() => reviewExtension({ enabled: false, author, store: revisionStore }));
  const [initialBlocks] = useState<Block[]>(() => workingCopyBlocks());
  const editor = useBeakBlock({
    mode: 'office',
    wordBehaviour: true,
    initialContent: initialBlocks,
    extensions: [reviewExt],
  });
  const tick = useEditorTick(editor);

  const [trackOn, setTrackOn] = useState(false);
  const [reviewView, setView] = useState<ReviewView>('markup');
  const [showCompare, setShowCompare] = useState(false);
  const [revisions, setRevisions] = useState<RevisionRecord[]>(() => revisionStore.list());
  const [comments, setComments] = useState<AnchoredComment[]>(() => commentStore.list());
  const [commentDraft, setCommentDraft] = useState('');
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => revisionStore.subscribe(() => setRevisions(revisionStore.list())), [revisionStore]);
  useEffect(() => commentStore.subscribe(() => setComments(commentStore.list())), [commentStore]);

  // Keep the pending list in step with the editor. Accepting or rejecting also updates the store.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors the external ProseMirror state
    setRevisions(listPendingRevisions(editor.pm.state, revisionStore));
  }, [editor, tick, revisionStore]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setReviewView(reviewView);
  }, [editor, reviewView]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors the external ProseMirror state
    setTrackOn(isTrackChangesEnabled(editor.pm.state));
  }, [editor]);

  const pendingCount = revisions.filter((r) => r.status === 'pending').length;

  const toggleTrack = () => {
    if (!editor || editor.isDestroyed) return;
    const next = !isTrackChangesEnabled(editor.pm.state);
    editor.pm.view.dispatch(setTrackChangesEnabledTransaction(editor.pm.state.tr, next));
    setTrackOn(next);
    setMessage(next ? `Track changes on. Edits are recorded as ${author.name}.` : 'Track changes off. Edits apply directly.');
  };

  const switchAuthor = (id: string) => {
    const next = TRACK_AUTHORS.find((a) => a.id === id);
    if (!next) return;
    // eslint-disable-next-line react-hooks/immutability -- reviewExtension holds this object by reference; in-place update is how the plugin sees the new author
    author.id = next.id;
    author.name = next.name;
    setAuthorId(next.id);
    setMessage(`Acting as ${next.name}. New edits and comments carry this name.`);
  };

  const withView = (fn: (view: BeakBlockEditor['pm']['view']) => boolean, label: string) => {
    if (!editor || editor.isDestroyed) return;
    const ok = fn(editor.pm.view);
    setMessage(ok ? label : 'Nothing to change.');
  };

  const acceptOne = (id: string) => withView((view) => acceptRevision(view, id, authorId), 'Accepted.');
  const rejectOne = (id: string) => withView((view) => rejectRevision(view, id, authorId), 'Rejected.');

  const addComment = () => {
    if (!editor || editor.isDestroyed) return;
    const anchor = createCommentAnchorFromSelection(editor.getDocument(), editor.pm.state.selection);
    if (!anchor) {
      setMessage('Select text inside one paragraph to anchor the comment.');
      return;
    }
    const body = commentDraft.trim();
    if (!body) {
      setMessage('Write the comment first. Use @name to mention someone.');
      return;
    }
    commentStore.add({ anchor, authorId, authorName: author.name, body });
    setCommentDraft('');
  };

  const comparison = useMemo(() => {
    if (!showCompare || !editor || editor.isDestroyed) return null;
    return compareRevisions(releasedRevisionBlocks(), editor.getDocument());
  }, [showCompare, editor, tick]);

  const redline = useMemo(() => (comparison ? renderRedlineHTML(comparison) : ''), [comparison]);

  return (
    <div className="v2-scenario">
      <ScenarioIntro
        kicker="BeakBlock 2.0 · Review"
        title="Track changes, comments and compare"
        capability="Durable revision records with Markup, Final and Original views, accept and reject per change, anchored comment threads with @mentions, and comparison with the released revision."
      >
        <p>
          The working copy starts with pending changes: Ben&apos;s insertion, Ann&apos;s deletion and an AI-generated insertion.
          Switch the author, then toggle tracking and type. Accept or reject from the revisions panel, or compare the
          draft with the released revision.
        </p>
      </ScenarioIntro>

      <div className="v2-toolbar">
        <button type="button" className={`v2-btn ${trackOn ? 'v2-btn--primary' : ''}`} onClick={toggleTrack}>
          Track changes: {trackOn ? 'on' : 'off'}
        </button>
        <div className="v2-segment" role="tablist" aria-label="Review view">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={reviewView === item.id}
              className={`v2-segment__btn ${reviewView === item.id ? 'is-active' : ''}`}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className={`v2-btn ${showCompare ? 'v2-btn--primary' : ''}`} onClick={() => setShowCompare((v) => !v)}>
          Compare with released revision
        </button>
        <span className="v2-spacer" />
        <span className="v2-muted">Acting as</span>
        {TRACK_AUTHORS.map((a) => (
          <button key={a.id} type="button" className={`v2-user ${authorId === a.id ? 'is-active' : ''}`} onClick={() => switchAuthor(a.id)}>
            {a.name}
          </button>
        ))}
      </div>

      {message ? <Notice tone="info">{message}</Notice> : null}

      <div className="v2-track-grid">
        <div className="v2-track-main">
          <div className="v2-page-wrap">
            <OfficeShell editor={editor} mode="office" rulers={false} navigation={false} statusBar={false} showRibbon={false}>
              <BeakBlockView editor={editor} className="editor-view v2-track-view" />
            </OfficeShell>
          </div>

          {showCompare ? (
            <Panel title="Compare: released v1 → working copy" right={<Badge tone="info">{comparison?.summary.modified ?? 0} modified</Badge>}>
              {comparison ? (
                <>
                  <p className="v2-muted">
                    Added {comparison.summary.added} · removed {comparison.summary.removed} · modified {comparison.summary.modified} · moved{' '}
                    {comparison.summary.moved}
                    {comparison.summary.sectionsChanged.length ? ` · sections: ${comparison.summary.sectionsChanged.join(', ')}` : ''}
                  </p>
                  {/* renderRedlineHTML HTML-escapes every piece of document text (see packages/review compare.ts), so
                      only its own markup reaches the DOM here. */}
                  <div className="v2-redline" dangerouslySetInnerHTML={{ __html: redline }} />
                </>
              ) : null}
            </Panel>
          ) : null}
        </div>

        <aside className="v2-track-side">
          <Panel
            title="Revisions"
            right={
              <div className="v2-row">
                <Badge tone={pendingCount ? 'warn' : 'ok'}>{pendingCount} pending</Badge>
              </div>
            }
          >
            <div className="v2-row v2-wrap">
              <button type="button" className="v2-btn" onClick={() => withView((v) => acceptAll(v, authorId), 'All changes accepted.')}>
                Accept all
              </button>
              <button type="button" className="v2-btn v2-btn--ghost" onClick={() => withView((v) => rejectAll(v, authorId), 'All changes rejected.')}>
                Reject all
              </button>
            </div>
            <ul className="v2-rev-list">
              {revisions.length === 0 ? <li className="v2-muted">No revisions. Turn on tracking and edit.</li> : null}
              {revisions.map((rev) => (
                <li key={rev.id} className="v2-rev">
                  <div>
                    <Badge tone={rev.kind === 'insert' ? 'ok' : rev.kind === 'delete' ? 'bad' : 'info'}>{rev.kind}</Badge>{' '}
                    {rev.aiGenerated ? <Badge tone="ai" title="Generated by AI. Verify before accepting.">AI-generated</Badge> : null}{' '}
                    <span className="v2-muted">{rev.authorName ?? rev.authorId}</span>
                  </div>
                  {rev.text ? <div className="v2-rev__text">“{rev.text.trim()}”</div> : null}
                  <div className="v2-row">
                    <button type="button" className="v2-btn v2-btn--ghost" onClick={() => acceptOne(rev.id)}>
                      Accept
                    </button>
                    <button type="button" className="v2-btn v2-btn--ghost" onClick={() => rejectOne(rev.id)}>
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Comments" right={<Badge tone="info">{comments.length}</Badge>}>
            <textarea
              className="v2-textarea"
              rows={3}
              placeholder="Select text in the document, then write a comment. Use @name to mention."
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
            />
            <div className="v2-row">
              <button type="button" className="v2-btn" onClick={addComment}>
                Comment on selection
              </button>
            </div>
            <ul className="v2-thread-list">
              {comments.map((comment) => (
                <li key={comment.id} className={`v2-thread ${comment.status === 'resolved' ? 'is-resolved' : ''}`}>
                  <blockquote className="v2-quote">“{comment.anchor.quote}”</blockquote>
                  {comment.thread.map((entry) => (
                    <p key={entry.id} className="v2-entry">
                      <strong>{entry.authorName ?? entry.authorId}</strong> {entry.body}
                      {entry.mentions.length ? (
                        <span className="v2-muted"> · mentions {entry.mentions.map((m) => `@${m}`).join(' ')}</span>
                      ) : null}
                    </p>
                  ))}
                  <div className="v2-row">
                    <input
                      className="v2-input"
                      placeholder="Reply"
                      value={replyDraft[comment.id] ?? ''}
                      onChange={(event) => setReplyDraft((d) => ({ ...d, [comment.id]: event.target.value }))}
                      onKeyDown={(event) => {
                        const body = (replyDraft[comment.id] ?? '').trim();
                        if (event.key === 'Enter' && body) {
                          commentStore.reply(comment.id, { authorId, authorName: author.name, body });
                          setReplyDraft((d) => ({ ...d, [comment.id]: '' }));
                        }
                      }}
                    />
                    {comment.status === 'open' ? (
                      <button type="button" className="v2-btn v2-btn--ghost" onClick={() => commentStore.resolve(comment.id, authorId)}>
                        Resolve
                      </button>
                    ) : (
                      <button type="button" className="v2-btn v2-btn--ghost" onClick={() => commentStore.reopen(comment.id, authorId)}>
                        Reopen
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
