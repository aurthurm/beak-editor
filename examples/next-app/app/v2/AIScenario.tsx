"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { BeakBlockView, OfficeShell, useBeakBlock } from '@amusendame/beakblock-react';
import type { BeakBlockEditor, BeakExtension, Block } from '@amusendame/beakblock-core';
import { Decoration, DecorationSet, Plugin, PluginKey } from '@amusendame/beakblock-core';
import { qmsExtension } from '@amusendame/beakblock-blocks-qms';
import { createPermissionGuardPlugin, type PolicyContext, type PolicyDecision } from '@amusendame/beakblock-permissions';
import type { BeakDocument } from '@amusendame/beakblock-schema';
import {
  AI_DISCLAIMER,
  AICommandError,
  createAICommandLayer,
  createFetchProvider,
  createMockProvider,
  type AICommandId,
  type AICommandLayer,
  type AIProvider,
  type AIResult,
} from '@amusendame/beakblock-ai';
import { InMemoryRevisionStore, listPendingRevisions, acceptRevision, rejectRevision, reviewExtension, type RevisionRecord } from '@amusendame/beakblock-review';
import { buildPolicyContext, instantiateDocument, publishTemplate } from '@amusendame/beakblock-templates';
import { MOCK_AI_REPLIES } from './demoData';
import { buildSopTemplateDraft, DEMO_USERS, demoUser, SECTION_ASSIGNMENTS, SECTION_TITLES, USER_HEADER } from './controlledShared';
import { canEditSection } from './ControlledEditor';
import { Badge, errorText, Notice, Panel, ScenarioIntro, useEditorTick, useFlash, useLatestRef } from './common';

type Entry = { id: number; at: string; command: string; status: AIResult['status']; detail: string };

const COMMANDS: Array<{ id: AICommandId; label: string; hint: string }> = [
  { id: 'ai.rewriteSelection', label: 'Rewrite selection', hint: 'Select a sentence in your section first.' },
  { id: 'ai.proposeProcedureSteps', label: 'Propose procedure steps', hint: 'Place the cursor in your section, then run.' },
  { id: 'ai.reviewDocumentConsistency', label: 'Review consistency', hint: 'Advisory only. Returns findings, no edits.' },
];

/** Arguments each command needs from the button. `ai.proposeProcedureSteps` requires a goal. */
function commandArgs(command: AICommandId): Record<string, unknown> | undefined {
  if (command === 'ai.rewriteSelection') return { instruction: 'Make it more formal.' };
  if (command === 'ai.proposeProcedureSteps') return { goal: 'Stain a fixed smear by the Gram method and read it' };
  return undefined;
}

const decoStateKey = new PluginKey<DecorationSet>('v2-ai-readonly');

/** Document with every section filled with a line of content, so the AI has something to work with. */
function sampleContent(doc: BeakDocument): Block[] {
  const lines: Record<string, string> = {
    purpose: 'This procedure describes the Gram stain used to classify bacteria on fixed smears.',
    scope: 'Applies to all bench analysts who prepare and read smears for culture review.',
    procedure: 'Fix, stain with crystal violet, decolourise, counterstain and read under oil.',
    records: 'Stain logs are kept for five years.',
  };
  return doc.sections[0]!.blocks.map((block) => {
    if (block.type !== 'controlledSection') return block;
    const tsid = String(block.props.templateSectionId);
    const children = (block.children ?? []).filter((c) => !c.props.placeholder);
    children.push({
      id: `ai-${tsid}-p`,
      type: 'paragraph',
      props: { textAlign: 'left' },
      content: [{ type: 'text', text: lines[tsid] ?? '', styles: {} }],
    } as unknown as Block);
    return { ...block, children };
  });
}

function sectionRange(editor: BeakBlockEditor, sectionId: string): { from: number; to: number } | null {
  const { doc } = editor.pm.state;
  let range: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (range) return false;
    if (node.type.name !== 'controlledSection' || node.attrs.sectionId !== sectionId) return true;
    node.descendants((child, childPos) => {
      if (range) return false;
      if (child.isTextblock && child.textContent.length > 0) {
        const start = pos + 1 + childPos + 1;
        range = { from: start, to: start + Math.min(child.textContent.length, 40) };
        return false;
      }
      return true;
    });
    return false;
  });
  return range;
}

function readOnlyPlugin(getCtx: () => PolicyContext): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: decoStateKey,
    state: {
      init(_c, state) {
        return build(state.doc, getCtx());
      },
      apply(tr, value, _old, state) {
        return tr.docChanged || tr.getMeta(decoStateKey) ? build(state.doc, getCtx()) : value;
      },
    },
    props: { decorations: (state) => decoStateKey.getState(state) },
  });
}

function build(doc: Parameters<typeof DecorationSet.create>[0], ctx: PolicyContext): DecorationSet {
  const decos: Decoration[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name !== 'controlledSection') return;
    if (!canEditSection(ctx, String(node.attrs.sectionId ?? ''))) {
      decos.push(Decoration.node(offset, offset + node.nodeSize, { class: 'v2-section-readonly' }));
    }
  });
  return DecorationSet.create(doc, decos);
}

/** Mounted only once the document is ready, because the editor reads its initial content once. */
function AIEditorPane({
  blocks,
  extensions,
  onEditor,
}: {
  blocks: Block[];
  extensions: BeakExtension[];
  onEditor: (editor: BeakBlockEditor | null) => void;
}): ReactElement {
  const [initial] = useState(() => blocks);
  const editor = useBeakBlock({ mode: 'controlled', initialContent: initial, extensions });
  useEffect(() => {
    onEditor(editor);
    return () => onEditor(null);
  }, [editor, onEditor]);
  return (
    <OfficeShell editor={editor} mode="controlled" showRibbon={false} navigation={false} rulers={false} statusBar={false}>
      <BeakBlockView editor={editor} className="editor-view v2-controlled-view" />
    </OfficeShell>
  );
}

export function AIScenario(): ReactElement {
  const [userId, setUserId] = useState<string>('ann');
  const user = demoUser(userId) ?? { id: userId, name: userId, roles: [] as string[] };
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [providerCalls, setProviderCalls] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [layer, setLayer] = useState<AICommandLayer | null>(null);
  const [editor, setEditor] = useState<BeakBlockEditor | null>(null);
  const [busy, setBusy] = useState<AICommandId | null>(null);
  const [lastAdvisory, setLastAdvisory] = useState<string[]>([]);
  const [flash, showFlash] = useFlash(6000);
  const nextId = useRef(1);
  const tick = useEditorTick(editor);

  // The principal and grants are read through refs, so switching users needs no remount.
  const ctxInput = useLatestRef({ userId, roles: user.roles });
  const docBlocks = useRef<Block[]>([]);
  const getCtx = useCallback((): PolicyContext => {
    const doc = { sections: [{ blocks: docBlocks.current }] } as unknown as BeakDocument;
    return buildPolicyContext(doc, SECTION_ASSIGNMENTS, ctxInput.current.userId, ctxInput.current.roles);
  }, [ctxInput]);
  const [revStore] = useState(() => new InMemoryRevisionStore());
  const [reviewAuthor] = useState(() => ({ id: 'ann', name: 'Ann Author' }));

  const extensions = useMemo<BeakExtension[]>(
    () => [
      reviewExtension({ enabled: true, author: reviewAuthor, store: revStore }),
      // The getter is only invoked by the plugin on transactions, never while rendering.
      // eslint-disable-next-line react-hooks/refs
      qmsExtension({ getPolicyContext: () => getCtx() }),
      {
        name: 'v2-ai-guard',
        plugins: () => [createPermissionGuardPlugin({ getContext: () => getCtx() }), readOnlyPlugin(() => getCtx())],
      },
    ],
    [getCtx, revStore, reviewAuthor]
  );

  // Build a published template and an instantiated document on the client, for this demo only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const published = await publishTemplate(buildSopTemplateDraft());
      const doc = instantiateDocument(published, {
        documentId: 'doc-ai-demo',
        docNumber: 'SOP-0042',
        properties: { title: 'Gram stain procedure', revision: '1' },
        assignments: SECTION_ASSIGNMENTS,
      });
      const content = sampleContent(doc);
      docBlocks.current = content;
      if (!cancelled) setBlocks(content);
    })().catch((error) => showFlash('bad', errorText(error)));
    return () => {
      cancelled = true;
    };
  }, [showFlash]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v2/ai')
      .then((r) => r.json())
      .then((data: { configured?: boolean; model?: string | null }) => {
        if (cancelled) return;
        setConfigured(Boolean(data.configured));
        setModel(data.model ?? null);
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pending AI proposals are read from the editor state; `tick` re-derives them on every transaction.
  const revisions = useMemo<RevisionRecord[]>(
    () => (editor && !editor.isDestroyed ? listPendingRevisions(editor.pm.state, revStore) : []),
    [editor, tick, revStore]
  );

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.pm.view.dispatch(editor.pm.state.tr.setMeta(decoStateKey, userId));
  }, [editor, userId]);

  // Provider: the app endpoint when a key is configured, otherwise canned replies. Calls are counted,
  // so the denied case can show that the provider was never reached.
  useEffect(() => {
    if (configured === null || !editor || editor.isDestroyed) return;
    const base: AIProvider = configured
      ? createFetchProvider({ url: '/api/v2/ai' })
      : createMockProvider(MOCK_AI_REPLIES as unknown as Parameters<typeof createMockProvider>[0]);
    const counted: AIProvider = (request, signal) => {
      setProviderCalls((n) => n + 1);
      return base(request, signal);
    };
    const next = createAICommandLayer({
      provider: counted,
      editor,
      getPolicyContext: () => getCtx(),
      author: { id: 'ann', name: 'Ann Author' },
      options: { terminology: ['Gram stain', 'crystal violet'], approvedReferences: [] },
    });
    // The layer wraps an imperative editor plugin set. It is created here and disposed in the cleanup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayer(next);
    return () => next.dispose();
  }, [configured, editor, getCtx]);

  const record = (command: AICommandId, result: AIResult) => {
    const detail =
      result.status === 'proposed'
        ? `${result.revisionIds.length} tracked change(s) proposed, marked AI-generated`
        : result.status === 'advisory'
          ? `${result.findings.length} finding(s)`
          : result.status === 'denied'
            ? result.reason
            : result.status === 'error'
              ? `${result.error.code}: ${result.error.message}`
              : 'Cancelled';
    const entry: Entry = { id: nextId.current++, at: new Date().toLocaleTimeString(), command, status: result.status, detail };
    setEntries((list) => [entry, ...list].slice(0, 10));
    if (result.status === 'advisory') {
      setLastAdvisory(result.findings.map((f) => `${f.severity.toUpperCase()}: ${f.message}${f.suggestion ? ` Suggestion: ${f.suggestion}` : ''}`));
    }
  };

  const run = async (command: AICommandId, args?: unknown) => {
    if (!layer) return;
    setBusy(command);
    try {
      const result = await layer.run(command, args);
      record(command, result);
      if (result.status === 'proposed') showFlash('ok', 'Proposals are tracked changes. Accept or reject them in the Proposals panel.');
      if (result.status === 'denied') showFlash('bad', `Denied before any provider call: ${result.reason}`);
    } catch (error) {
      showFlash('bad', errorText(error));
    } finally {
      setBusy(null);
    }
  };

  const selectIn = (templateSectionId: string) => {
    if (!editor) return false;
    const range = sectionRange(editor, sectionIdOf(editor, templateSectionId));
    if (!range) return false;
    editor.pm.setSelection(editor.pm.createTextSelection(range.from, range.to));
    return true;
  };

  const selectInOwnSection = () => {
    const target = userId === 'ben' ? 'scope' : userId === 'cy' ? 'procedure' : 'purpose';
    if (selectIn(target)) showFlash('info', `Selected a sentence in ${SECTION_TITLES[target]}. Run a command now.`);
  };

  const runDeniedCase = () => {
    // Ann selects text in Ben's Scope section. The layer refuses before it calls the provider.
    setUserId('ann');
    if (selectIn('scope')) void run('ai.rewriteSelection', { instruction: 'Make it more formal.' });
  };

  const accept = (id: string) => {
    if (editor) acceptRevision(editor.pm.view, id, 'ann');
  };
  const reject = (id: string) => {
    if (editor) rejectRevision(editor.pm.view, id, 'ann');
  };

  const mode = configured === null ? 'checking' : configured ? 'live' : 'mock';

  return (
    <div className="v2-scenario">
      <ScenarioIntro
        kicker="BeakBlock 2.0 · AI command layer"
        title="AI proposals as tracked changes"
        capability="Typed, policy-aware AI commands. Every rewrite or step proposal is a tracked change marked AI-generated, and nothing is applied until a person accepts it. Advisory checks return findings only."
      >
        <p>
          Run a command on your own section. Then try the denied case: text in another author&apos;s section is never sent
          to the provider. The provider counter shows whether a call was made.
        </p>
      </ScenarioIntro>

      <div className="v2-toolbar">
        <Badge tone={mode === 'live' ? 'ok' : 'warn'}>
          {mode === 'live' ? `live provider${model ? ` · ${model}` : ''}` : mode === 'mock' ? 'mock provider' : 'checking provider'}
        </Badge>
        <Badge tone="ai">AI-generated</Badge>
        <span className="v2-muted">Provider calls: {providerCalls}</span>
        <span className="v2-spacer" />
        <span className="v2-muted">Acting as</span>
        {DEMO_USERS.filter((u) => u.id === 'ann' || u.id === 'ben' || u.id === 'cy').map((u) => (
          <button key={u.id} type="button" className={`v2-user ${userId === u.id ? 'is-active' : ''}`} onClick={() => setUserId(u.id)}>
            {u.name}
          </button>
        ))}
      </div>

      <Notice tone="warn">{AI_DISCLAIMER}</Notice>
      {flash ? <Notice tone={flash.tone === 'bad' ? 'bad' : flash.tone === 'ok' ? 'ok' : 'info'}>{flash.text}</Notice> : null}

      <div className="v2-ai-grid">
        <div className="v2-ai-main">
          <div className="v2-doc-frame">
            {blocks ? <AIEditorPane blocks={blocks} extensions={extensions} onEditor={setEditor} /> : <p className="v2-muted">Preparing the document…</p>}
          </div>
          <p className="v2-muted">
            Dimmed sections are not editable by {user.name}. Scope belongs to Ben, Procedure to Cy, Purpose to Ann.
          </p>
        </div>

        <aside className="v2-ai-side">
          <Panel title="Commands" right={<Badge tone="info">as {user.name.split(' ')[0]}</Badge>}>
            <div className="v2-row v2-wrap">
              <button type="button" className="v2-btn" onClick={selectInOwnSection} disabled={!editor}>
                Select text in my section
              </button>
            </div>
            <ul className="v2-cmd-list">
              {COMMANDS.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="v2-btn v2-btn--primary"
                    disabled={!layer || busy !== null}
                    onClick={() => run(c.id, commandArgs(c.id))}
                  >
                    {busy === c.id ? 'Working…' : c.label}
                  </button>
                  <span className="v2-muted">{c.hint}</span>
                </li>
              ))}
            </ul>
            <div className="v2-row">
              <button type="button" className="v2-btn v2-btn--bad" onClick={runDeniedCase} disabled={!layer || busy !== null}>
                Denied case: rewrite Ben&apos;s section
              </button>
            </div>
          </Panel>

          <Panel title="Proposals" right={<Badge tone={revisions.length ? 'ai' : 'neutral'}>{revisions.length}</Badge>}>
            <ul className="v2-rev-list">
              {revisions.length === 0 ? <li className="v2-muted">No pending AI proposals.</li> : null}
              {revisions.map((rev) => (
                <li key={rev.id} className="v2-rev">
                  <div>
                    <Badge tone={rev.kind === 'insert' ? 'ok' : 'bad'}>{rev.kind}</Badge> {rev.aiGenerated ? <Badge tone="ai">AI-generated</Badge> : null}
                  </div>
                  {rev.text ? <div className="v2-rev__text">“{rev.text.trim()}”</div> : null}
                  <div className="v2-row">
                    <button type="button" className="v2-btn v2-btn--ghost" onClick={() => accept(rev.id)}>
                      Accept
                    </button>
                    <button type="button" className="v2-btn v2-btn--ghost" onClick={() => reject(rev.id)}>
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          {lastAdvisory.length ? (
            <Panel title="Consistency findings (advisory)">
              <ul className="v2-list">
                {lastAdvisory.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Activity">
            <ol className="v2-audit">
              {entries.length === 0 ? <li className="v2-muted">Run a command to see its outcome.</li> : null}
              {entries.map((e) => (
                <li key={e.id}>
                  <span className="v2-muted">{e.at}</span> <strong>{e.command}</strong>{' '}
                  <Badge tone={e.status === 'proposed' || e.status === 'advisory' ? 'ok' : e.status === 'denied' ? 'bad' : 'warn'}>{e.status}</Badge>
                  <div className="v2-muted">{e.detail}</div>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function sectionIdOf(editor: BeakBlockEditor, templateSectionId: string): string {
  let found = '';
  editor.pm.state.doc.descendants((node) => {
    if (found) return false;
    if (node.type.name === 'controlledSection' && node.attrs.templateSectionId === templateSectionId) {
      found = String(node.attrs.sectionId);
      return false;
    }
    return true;
  });
  return found;
}
