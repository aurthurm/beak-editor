"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { TextSelection, type BeakBlockEditor, type Block } from '@amusendame/beakblock-core';
import { buildPolicyContext, documentHashOf, stampControlledCopy, updateSection, type ComposedDocument, type TemplateDefinition } from '@amusendame/beakblock-templates';
import { PERMISSION_BYPASS_META, type PolicyContext, type PolicyDecision } from '@amusendame/beakblock-permissions';
import type { BeakDocument } from '@amusendame/beakblock-schema';
import { documentToIR, type IRDocument } from '@amusendame/beakblock-ir';
import { layoutDocument, renderPrintHTML, renderPrintToWindow } from '@amusendame/beakblock-layout';
import { DOCX_MIME, exportDocxWithReport } from '@amusendame/beakblock-export-docx';
import { createCommentAnchorFromSelection, InMemoryCommentThreadStore, type AnchoredComment, type CommentAnchor } from '@amusendame/beakblock-review';
import {
  buildSopTemplateDraft,
  demoUser,
  DEMO_USERS,
  mergeOwnSections,
  SECTION_TITLES,
  sectionIdFor,
  USER_HEADER,
  type ControlledDocumentView,
  type ServerError,
} from './controlledShared';
import { ControlledEditor, canEditSection } from './ControlledEditor';
import { Badge, downloadFile, errorText, Notice, Panel, ScenarioIntro, useFlash, useLatestRef } from './common';

type LifecycleEvent = 'submit' | 'review' | 'requestChanges' | 'approve' | 'reopen';

interface DocumentsResponse {
  document: ControlledDocumentView | null;
  editableSections?: string[];
  template?: TemplateDefinition;
}

class ApiError extends Error {
  status = 0;
  code = '';
  violations: ServerError['violations'] = [];
}

async function api<T>(userId: string, body: Record<string, unknown> | null): Promise<T> {
  const response = await fetch('/api/v2/documents', {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', [USER_HEADER]: userId },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as Partial<ServerError> & Record<string, unknown>;
  if (!response.ok) {
    const error = new ApiError(data.error ?? `Request failed (${response.status})`);
    error.status = response.status;
    error.code = data.code ?? '';
    error.violations = data.violations ?? [];
    throw error;
  }
  return data as T;
}

/** Policy context for the current view and principal. Used by the client guard and the UI. */
function contextFor(view: ControlledDocumentView | null, userId: string, roles: string[]): PolicyContext {
  const doc = { sections: [{ blocks: view?.blocks ?? [] }] } as unknown as BeakDocument;
  return buildPolicyContext(doc, view?.assignments ?? {}, userId, roles);
}

function describe(error: unknown): string {
  if (error instanceof ApiError) {
    const detail = error.violations?.length ? ` (${error.violations.map((v) => v.reason).join('; ')})` : '';
    return `${error.message}${detail} [HTTP ${error.status}]`;
  }
  return errorText(error);
}

function findTextPosInSection(editor: BeakBlockEditor, sectionId: string): number | null {
  const { doc } = editor.pm.state;
  let found: number | null = null;
  doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type.name !== 'controlledSection' || node.attrs.sectionId !== sectionId) return true;
    node.descendants((child, childPos) => {
      if (found !== null) return false;
      if (child.isTextblock) {
        found = pos + 1 + childPos + 1;
        return false;
      }
      return true;
    });
    return false;
  });
  return found;
}

/**
 * Anchor from the browser selection. Read-only (locked or other-owner) sections are contenteditable=false, so
 * ProseMirror never takes a selection there. Reviewers still need to comment on that text, so map the DOM range.
 */
function anchorFromDomSelection(editor: BeakBlockEditor, blocks: Block[]): CommentAnchor | null {
  if (typeof window === 'undefined' || editor.isDestroyed) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const { view } = editor.pm;
  if (!view.dom.contains(range.startContainer) || !view.dom.contains(range.endContainer)) return null;
  try {
    const from = view.posAtDOM(range.startContainer, range.startOffset);
    const to = view.posAtDOM(range.endContainer, range.endOffset);
    const selection = TextSelection.create(editor.pm.state.doc, from, to);
    return createCommentAnchorFromSelection(blocks, selection);
  } catch {
    return null;
  }
}

const STATE_TONE: Record<string, 'neutral' | 'info' | 'warn' | 'ok' | 'bad'> = {
  draft: 'neutral',
  submitted: 'info',
  reviewed: 'warn',
  approved: 'ok',
  reopened: 'bad',
};

function canAct(event: LifecycleEvent, state: string, roles: string[], userId: string, ownerId: string | null): boolean {
  switch (event) {
    case 'submit':
      return userId === ownerId && (state === 'draft' || state === 'reopened');
    case 'review':
      return roles.includes('reviewer') && state === 'submitted';
    case 'requestChanges':
      return roles.includes('reviewer') && (state === 'submitted' || state === 'reviewed');
    case 'approve':
      return roles.includes('approver') && state === 'reviewed';
    case 'reopen':
      return state === 'approved' && (roles.includes('qualityManager') || userId === ownerId);
    default:
      return false;
  }
}

export function ControlledScenario(): ReactElement {
  const [userId, setUserId] = useState<string>('qm');
  const user = demoUser(userId) ?? { id: userId, name: userId, roles: [] as string[] };
  const [view, setView] = useState<ControlledDocumentView | null>(null);
  const [editor, setEditor] = useState<BeakBlockEditor | null>(null);
  const [templateDraft, setTemplateDraft] = useState<TemplateDefinition>(() => buildSopTemplateDraft());
  const [templatePublished, setTemplatePublished] = useState(false);
  const [denials, setDenials] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [flash, showFlash] = useFlash(7000);
  const store = useMemo(() => new InMemoryCommentThreadStore(), []);
  const [comments, setComments] = useState<AnchoredComment[]>(() => store.list());
  const [commentDraft, setCommentDraft] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [malicious, setMalicious] = useState<{ local: string; server: string } | null>(null);
  const [verifyNote, setVerifyNote] = useState<string | null>(null);
  const lastDenial = useRef<string | null>(null);

  useEffect(() => store.subscribe(() => setComments(store.list())), [store]);

  // The editor reads the principal and grants through these refs, so switching users needs no remount.
  const ctxInput = useLatestRef({ view, userId, roles: user.roles });
  const getCtx = useCallback(() => contextFor(ctxInput.current.view, ctxInput.current.userId, ctxInput.current.roles), []);
  const ctx = useMemo(() => contextFor(view, userId, user.roles), [view, userId, user.roles]);
  const editableIds = useMemo(() => Object.keys(ctx.sectionGrants).filter((sid) => canEditSection(ctx, sid)), [ctx]);
  const titleBySection = useMemo(() => {
    const map: Record<string, string> = {};
    for (const block of view?.blocks ?? []) {
      if (block.type === 'controlledSection') {
        map[block.props.sectionId as string] = String(block.props.title ?? '');
      }
    }
    return map;
  }, [view]);

  const onDenied = useCallback(
    (decisions: PolicyDecision[]) => {
      const first = decisions.find((d) => !d.allowed);
      if (!first) return;
      const where = first.operation.sectionId ? titleBySection[first.operation.sectionId] ?? first.operation.sectionId : 'uncontrolled content';
      const message = `${first.reason ?? 'Not permitted'} (${first.operation.kind} in ${where})`;
      lastDenial.current = message;
      setDenials((prev) => [`${new Date().toLocaleTimeString()} ${message}`, ...prev].slice(0, 8));
    },
    [titleBySection]
  );

  const onEditor = useCallback((next: BeakBlockEditor | null) => setEditor(next), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<DocumentsResponse>(userId, null);
        if (!cancelled) setView(data.document);
      } catch (error) {
        if (!cancelled) showFlash('bad', describe(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, showFlash]);

  // Section and document state from the server. Every write is checked there.
  const saveOwn = async (): Promise<ControlledDocumentView | null> => {
    if (!view || !editor) return null;
    const merged = mergeOwnSections(view.blocks, editor.getDocument(), editableIds);
    try {
      const data = await api<{ document: ControlledDocumentView }>(userId, {
        action: 'save',
        documentId: view.documentId,
        baseHash: view.hash,
        blocks: merged,
      });
      setView(data.document);
      showFlash('ok', 'Saved. The server verified your changes against your identity.');
      return data.document;
    } catch (error) {
      showFlash('bad', describe(error));
      return null;
    }
  };

  const runTransition = async (sectionId: string, event: LifecycleEvent) => {
    if (!view) return;
    setBusy(true);
    try {
      let current: ControlledDocumentView | null = view;
      if (event === 'submit') {
        current = await saveOwn();
        if (!current) return;
      }
      const comment = commentDraft.trim() || undefined;
      const data = await api<{ document: ControlledDocumentView }>(userId, {
        action: 'transition',
        documentId: current.documentId,
        baseHash: current.hash,
        sectionId,
        event,
        comment,
      });
      setView(data.document);
      if (comment) setCommentDraft('');
      showFlash('ok', `${titleBySection[sectionId] ?? 'Section'}: ${event} recorded in the audit log.`);
    } catch (error) {
      showFlash('bad', describe(error));
    } finally {
      setBusy(false);
    }
  };

  const createTemplate = async () => {
    setBusy(true);
    try {
      await api(userId, { action: 'publishTemplate', template: templateDraft });
      setTemplatePublished(true);
      showFlash('ok', 'Template published as version 1. It is now frozen.');
    } catch (error) {
      showFlash('bad', describe(error));
    } finally {
      setBusy(false);
    }
  };

  const instantiate = async () => {
    setBusy(true);
    try {
      const data = await api<{ document: ControlledDocumentView }>(userId, { action: 'instantiate', docNumber: 'SOP-0042' });
      setView(data.document);
      showFlash('ok', 'Document SOP-0042 created from the template. Each section has one owner.');
    } catch (error) {
      showFlash('bad', describe(error));
    } finally {
      setBusy(false);
    }
  };

  const resetDemo = async () => {
    await api(userId, { action: 'reset' });
    setView(null);
    setTemplatePublished(false);
    setTemplateDraft(buildSopTemplateDraft());
    setMalicious(null);
    showFlash('info', 'Demo reset. The server store is empty.');
  };

  const addComment = () => {
    if (!editor || !view) return;
    const anchor =
      createCommentAnchorFromSelection(editor.getDocument(), editor.pm.state.selection) ??
      anchorFromDomSelection(editor, editor.getDocument());
    if (!anchor) {
      showFlash('info', 'Select some text inside a paragraph to anchor the comment.');
      return;
    }
    const body = commentDraft.trim();
    if (!body) {
      showFlash('info', 'Write the comment in the box first.');
      return;
    }
    store.add({ anchor, authorId: user.id, authorName: user.name, body });
    setCommentDraft('');
  };

  const runMalicious = async () => {
    if (!view || !editor) return;
    // Prefer an approved (locked) section. Otherwise pick a section this user does not own, so the
    // server's refusal is the expected result and not a pass on the user's own draft.
    const target =
      Object.entries(view.lifecycles).find(([, lc]) => lc.state === 'approved')?.[0] ??
      Object.keys(view.lifecycles).find((tsid) => !editableIds.includes(sectionIdFor(view.blocks, tsid) ?? '')) ??
      'purpose';
    const sectionId = sectionIdFor(view.blocks, target);
    if (!sectionId) return;

    // 1. Local: a transaction marked as a permission bypass. Only the system principal may bypass.
    lastDenial.current = null;
    const pos = findTextPosInSection(editor, sectionId);
    let local: string;
    if (pos === null) {
      local = 'Section not found in the editor.';
    } else {
      const tr = editor.pm.state.tr.insertText(' [edited by malicious client]', pos).setMeta(PERMISSION_BYPASS_META, true);
      editor.pm.view.dispatch(tr);
      // Check the document, not just the guard log: some editor plugins drop a transaction without calling onDenied.
      const applied = editor.pm.state.doc.textContent.includes(' [edited by malicious client]');
      local = applied
        ? 'Applied in the editor (unexpected).'
        : lastDenial.current
          ? `Rejected by the client guard: ${lastDenial.current}`
          : 'Rejected by the editor before it changed the document (the transaction was filtered out).';
    }

    // 2. Server: the same change sent directly, with the current base hash, skipping the client entirely.
    const tampered = structuredClone(view.blocks);
    const section = tampered.find((b) => b.type === 'controlledSection' && b.props.sectionId === sectionId);
    const firstText = section?.children?.find((c) => c.type === 'paragraph');
    if (firstText?.content?.[0] && 'text' in firstText.content[0]) {
      (firstText.content[0] as { text: string }).text += ' [edited by malicious client]';
    }
    let server: string;
    try {
      await api(userId, { action: 'save', documentId: view.documentId, baseHash: view.hash, blocks: tampered });
      server = 'Accepted by the server (unexpected).';
    } catch (error) {
      server = `Rejected by the server: ${describe(error)}`;
    }
    setMalicious({ local, server });
  };

  const addReply = (commentId: string) => {
    const body = (replyDrafts[commentId] ?? '').trim();
    if (!body) return;
    store.reply(commentId, { authorId: user.id, authorName: user.name, body });
    setReplyDrafts((drafts) => ({ ...drafts, [commentId]: '' }));
  };

  const release = async () => {
    if (!view) return;
    setBusy(true);
    try {
      const data = await api<{ document: ControlledDocumentView }>(userId, {
        action: 'release',
        documentId: view.documentId,
        baseHash: view.hash,
      });
      setView(data.document);
      setVerifyNote(null);
      showFlash('ok', 'Released. The manifest records section hashes and a signature bound to the document hash.');
    } catch (error) {
      showFlash('bad', describe(error));
    } finally {
      setBusy(false);
    }
  };

  const releaseView = view?.release;
  const releaseIR = useMemo<IRDocument | null>(() => (releaseView ? documentToIR(releaseView.document) : null), [releaseView]);

  const printControlled = () => {
    if (!view?.release || !releaseIR) return;
    const stamp = stampControlledCopy({ copyNumber: 1, issuedTo: 'Microbiology bench' });
    const layout = layoutDocument(releaseIR);
    const html = renderPrintHTML(releaseIR, layout, {
      title: `SOP-0042 revision 1`,
      watermark: stamp.watermark,
      controlledCopy: stamp.controlledCopy,
    });
    if (!renderPrintToWindow(html)) showFlash('bad', 'Printing is only available in the browser.');
  };

  const downloadDocx = async () => {
    if (!view?.release || !releaseIR) return;
    try {
      const { bytes, report } = await exportDocxWithReport(releaseIR);
      downloadFile('SOP-0042-rev1.docx', bytes, DOCX_MIME);
      showFlash('ok', `DOCX written. Export losses: ${report.losses.length}. Each section is a Word content control.`);
    } catch (error) {
      showFlash('bad', describe(error));
    }
  };

  const verifyInBrowser = async () => {
    if (!view?.release || !releaseIR) return;
    const hash = await documentHashOf({ document: view.release.document, ir: releaseIR, manifestDraft: null } as unknown as ComposedDocument);
    setVerifyNote(hash === view.release.manifest.documentHash ? 'Recomputed in the browser: document hash matches the manifest.' : 'Hash mismatch: the release has been altered.');
  };

  const sections = (view?.template.sections ?? []).map((s) => s.templateSectionId);
  const approvedCount = view ? Object.values(view.lifecycles).filter((lc) => lc.state === 'approved').length : 0;
  const steps = [
    { label: 'Template published', done: templatePublished || !!view },
    { label: 'Document created', done: !!view },
    { label: 'Sections authored', done: !!view && Object.values(view.lifecycles).some((lc) => lc.state !== 'draft') },
    { label: 'Reviewed', done: !!view && Object.values(view.lifecycles).every((lc) => lc.state === 'reviewed' || lc.state === 'approved') },
    { label: `Approved (${approvedCount}/${sections.length || 4})`, done: !!view && approvedCount === (sections.length || 4) },
    { label: 'Released', done: !!view?.release },
  ];

  return (
    <div className="v2-scenario">
      <ScenarioIntro
        kicker="BeakBlock 2.0 · Controlled document"
        title="Controlled SOP: template to release"
        capability="Template → instantiate → per-section ownership → review → approval → immutable release with signature bound to hash. Save, transitions and release run on the server."
      >
        <p>
          Switch user in the bar. Authors can edit only their own section. The reviewer can comment and request
          changes, and approved sections lock. The approver releases the document. Then try the malicious-client test.
        </p>
      </ScenarioIntro>

      <ol className="v2-steps" aria-label="Progress">
        {steps.map((step) => (
          <li key={step.label} className={step.done ? 'is-done' : ''}>
            {step.label}
          </li>
        ))}
      </ol>

      <div className="v2-userbar" role="radiogroup" aria-label="Current user">
        <span className="v2-muted">Acting as</span>
        {DEMO_USERS.map((u) => (
          <button
            key={u.id}
            type="button"
            role="radio"
            aria-checked={userId === u.id}
            className={`v2-user ${userId === u.id ? 'is-active' : ''}`}
            onClick={() => setUserId(u.id)}
          >
            {u.name}
          </button>
        ))}
        <Badge tone="info">{user.roles.join(', ')}</Badge>
        <span className="v2-spacer" />
        <button type="button" className="v2-btn v2-btn--ghost" onClick={resetDemo}>
          Reset demo
        </button>
      </div>

      {flash ? <Notice tone={flash.tone === 'bad' ? 'bad' : flash.tone === 'ok' ? 'ok' : 'info'}>{flash.text}</Notice> : null}

      <div className="v2-ctl-grid">
        <div className="v2-ctl-main">
          {!view ? (
            <Panel title="1. Quality Manager: template" right={<Badge tone={templatePublished ? 'ok' : 'neutral'}>{templatePublished ? 'published v1' : 'draft'}</Badge>}>
              {user.roles.includes('qualityManager') ? (
                <>
                  <table className="v2-table v2-table--compact">
                    <thead>
                      <tr>
                        <th>Section</th>
                        <th>Required</th>
                        <th>Boilerplate locked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templateDraft.sections.map((section) => (
                        <tr key={section.templateSectionId}>
                          <td>
                            <input
                              className="v2-input"
                              value={section.title}
                              onChange={(event) =>
                                setTemplateDraft((t) => updateSection(t, section.templateSectionId, { title: event.target.value }))
                              }
                              aria-label={`Title of ${section.templateSectionId}`}
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={section.required}
                              onChange={(event) =>
                                setTemplateDraft((t) => updateSection(t, section.templateSectionId, { required: event.target.checked }))
                              }
                              aria-label={`${section.title} required`}
                            />
                          </td>
                          <td>{section.lockedBoilerplate?.length ? 'Yes' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="v2-row">
                    <button type="button" className="v2-btn" disabled={busy || templatePublished} onClick={createTemplate}>
                      Publish template v1
                    </button>
                    <button type="button" className="v2-btn v2-btn--primary" disabled={busy || !templatePublished} onClick={instantiate}>
                      Create SOP-0042 from template
                    </button>
                  </div>
                  <p className="v2-muted">Assignments: Purpose → Ann · Scope and Records → Ben · Procedure → Cy.</p>
                </>
              ) : (
                <p className="v2-muted">Switch to Maya (Quality Manager) to publish the template and create the document.</p>
              )}
            </Panel>
          ) : null}

          {view ? (
            <section className="v2-doc-frame">
              <header className="v2-doc-frame__head">
                <div>
                  <strong>
                    {String(view.docNumber)} · revision {view.revision}
                  </strong>
                  <span className="v2-muted"> Gram stain procedure · controlled copy</span>
                </div>
                <div className="v2-row">
                  {editableIds.length ? <Badge tone="ok">You can edit {editableIds.length} section(s)</Badge> : <Badge tone="neutral">Read-only for you</Badge>}
                  {view.release ? <Badge tone="ok">Released</Badge> : null}
                </div>
              </header>
              <ControlledEditor
                key={view.hash}
                blocks={view.blocks}
                getCtx={getCtx}
                refreshKey={`${userId}:${view.hash}`}
                onDenied={onDenied}
                onEditor={onEditor}
              />
              <p className="v2-muted v2-doc-frame__foot">
                Sections you cannot edit are dimmed. Edits to them are rejected by the client guard and again by the server.
              </p>
            </section>
          ) : (
            <div className="v2-empty">
              <p>No document yet. Publish the template and create SOP-0042 to start the slice.</p>
            </div>
          )}
        </div>

        <aside className="v2-ctl-side">
          {view ? (
            <Panel title="Sections and lifecycle">
              <ul className="v2-sections">
                {sections.map((tsid) => {
                  const lc = view.lifecycles[tsid];
                  const assignment = view.assignments[tsid];
                  const sid = sectionIdFor(view.blocks, tsid);
                  if (!lc || !sid) return null;
                  const ownerId = assignment?.ownerId ?? null;
                  const editable = editableIds.includes(sid);
                  return (
                    <li key={tsid} className="v2-section-card">
                      <div className="v2-section-card__head">
                        <strong>{SECTION_TITLES[tsid] ?? tsid}</strong>
                        <Badge tone={STATE_TONE[lc.state] ?? 'neutral'}>{lc.state}</Badge>
                      </div>
                      <div className="v2-muted">
                        Owner: {assignment?.ownerName ?? '—'}
                        {lc.state === 'approved' ? ' · locked' : ''}
                      </div>
                      <div className="v2-row v2-wrap">
                        {editable && (lc.state === 'draft' || lc.state === 'reopened') ? (
                          <button type="button" className="v2-btn v2-btn--ghost" disabled={busy} onClick={() => saveOwn()}>
                            Save draft
                          </button>
                        ) : null}
                        {canAct('submit', lc.state, user.roles, user.id, ownerId) ? (
                          <button type="button" className="v2-btn" disabled={busy} onClick={() => runTransition(sid, 'submit')}>
                            Submit
                          </button>
                        ) : null}
                        {canAct('review', lc.state, user.roles, user.id, ownerId) ? (
                          <button type="button" className="v2-btn" disabled={busy} onClick={() => runTransition(sid, 'review')}>
                            Start review
                          </button>
                        ) : null}
                        {canAct('requestChanges', lc.state, user.roles, user.id, ownerId) ? (
                          <button type="button" className="v2-btn v2-btn--warn" disabled={busy} onClick={() => runTransition(sid, 'requestChanges')}>
                            Request changes
                          </button>
                        ) : null}
                        {canAct('approve', lc.state, user.roles, user.id, ownerId) ? (
                          <button type="button" className="v2-btn v2-btn--primary" disabled={busy} onClick={() => runTransition(sid, 'approve')}>
                            Approve
                          </button>
                        ) : null}
                        {canAct('reopen', lc.state, user.roles, user.id, ownerId) ? (
                          <button type="button" className="v2-btn v2-btn--ghost" disabled={busy} onClick={() => runTransition(sid, 'reopen')}>
                            Reopen
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="v2-muted">Request changes and reopen take the comment box text as their reason.</p>
            </Panel>
          ) : null}

          {view ? (
            <Panel title="Reviewer comments" right={<Badge tone="info">{comments.length}</Badge>}>
              <textarea
                className="v2-textarea"
                placeholder="Comment for the selected text, or the reason for a change request"
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                rows={3}
              />
              <div className="v2-row">
                <button type="button" className="v2-btn" onClick={addComment} disabled={!editor}>
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
                      </p>
                    ))}
                    <div className="v2-row">
                      <input
                        className="v2-input"
                        placeholder="Reply"
                        value={replyDrafts[comment.id] ?? ''}
                        onChange={(event) => setReplyDrafts((d) => ({ ...d, [comment.id]: event.target.value }))}
                        onKeyDown={(event) => event.key === 'Enter' && addReply(comment.id)}
                      />
                      <button type="button" className="v2-btn v2-btn--ghost" onClick={() => addReply(comment.id)}>
                        Reply
                      </button>
                      {comment.status === 'open' ? (
                        <button type="button" className="v2-btn v2-btn--ghost" onClick={() => store.resolve(comment.id, user.id)}>
                          Resolve
                        </button>
                      ) : (
                        <button type="button" className="v2-btn v2-btn--ghost" onClick={() => store.reopen(comment.id, user.id)}>
                          Reopen
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {view ? (
            <Panel title="Audit log" right={<Badge tone="neutral">{view.audit.length}</Badge>}>
              <ol className="v2-audit">
                {[...view.audit].reverse().slice(0, 12).map((event, index) => (
                  <li key={`${event.at}-${index}`}>
                    <span className="v2-muted">{new Date(event.at).toLocaleTimeString()}</span> {event.actor.userId}{' '}
                    <strong>{event.event}</strong> {event.from} → {event.to}
                    {event.comment ? <em> “{event.comment}”</em> : null}
                  </li>
                ))}
                {view.audit.length === 0 ? <li className="v2-muted">No transitions yet.</li> : null}
              </ol>
            </Panel>
          ) : null}

          {view ? (
            <Panel title="Malicious client test">
              <p className="v2-muted">
                Targets an approved section, or a section this user does not own before approval. The first attempt uses a bypass flag in the
                editor. The second posts the change directly to the server with the current hash.
              </p>
              <button type="button" className="v2-btn v2-btn--bad" onClick={runMalicious} disabled={busy}>
                Try to alter a protected section
              </button>
              {malicious ? (
                <ul className="v2-list">
                  <li>
                    <strong>Editor:</strong> {malicious.local}
                  </li>
                  <li>
                    <strong>Server:</strong> {malicious.server}
                  </li>
                </ul>
              ) : null}
              {denials.length ? (
                <>
                  <p className="v2-muted">Client guard log</p>
                  <ul className="v2-list v2-list--mono">
                    {denials.map((line, index) => (
                      <li key={`${line}-${index}`}>{line}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </Panel>
          ) : null}

          {view ? (
            <Panel title="Release" right={view.release ? <Badge tone="ok">released</Badge> : <Badge tone="neutral">not released</Badge>}>
              {!view.release ? (
                user.roles.includes('approver') ? (
                  <button type="button" className="v2-btn v2-btn--primary" disabled={busy || approvedCount < sections.length} onClick={release}>
                    Compose and release
                  </button>
                ) : (
                  <p className="v2-muted">The final approver composes and releases once every section is approved.</p>
                )
              ) : (
                <>
                  <div className="v2-row v2-wrap">
                    <button type="button" className="v2-btn" onClick={printControlled}>
                      Print PDF (controlled copy)
                    </button>
                    <button type="button" className="v2-btn" onClick={downloadDocx}>
                      Download DOCX
                    </button>
                    <button type="button" className="v2-btn v2-btn--ghost" onClick={verifyInBrowser}>
                      Verify hash
                    </button>
                  </div>
                  {verifyNote ? <p className="v2-muted">{verifyNote}</p> : null}
                  <details>
                    <summary>Release manifest</summary>
                    <pre className="v2-pre">{JSON.stringify(view.release.manifest, null, 2)}</pre>
                  </details>
                </>
              )}
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
