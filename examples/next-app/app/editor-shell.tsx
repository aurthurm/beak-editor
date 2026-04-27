/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { yCursorPlugin, ySyncPlugin, yUndoPlugin } from 'y-prosemirror';
import {
  AIModal,
  BeakBlockView,
  BubbleMenu,
  CommentModal,
  CommentRail,
  MediaMenu,
  SlashMenu,
  TableHandles,
  TableMenu,
  createChartBlockSpec,
  buildAIContext,
  useBeakBlock,
  useCustomSlashMenuItems,
  useEditorContent,
} from '@amusendame/beakblock-react';
import {
  BUBBLE_AI_PRESETS,
  applyAIBlockOutput,
  SLASH_AI_PRESETS,
  InMemoryCommentStore,
  blocksToMarkdown,
  createCommentPlugin,
  type AIContext,
  type BeakBlockEditor,
  type Block,
  type CommentStore,
} from '@amusendame/beakblock-core';
import {
  boardOnePagerDocument,
  financialAnalystCvDocument,
  lessonPlanDocument,
  newsletterShowcaseDocument,
  postmortemDocument,
  prdShowcaseDocument,
  runbookShowcaseDocument,
  sampleDocument,
} from './data';
import { sendAIRequest } from './ai.client';

type DocumentTabId =
  | 'generic'
  | 'cv'
  | 'prd'
  | 'runbook'
  | 'board'
  | 'lesson'
  | 'postmortem'
  | 'newsletter';

type ViewMode = DocumentTabId | 'collaboration' | 'compliance';

type PanelApi = {
  getEditor: () => BeakBlockEditor | null;
  getBlocks: () => Block[];
  getCommentStore: () => CommentStore;
};

type ComplianceManifest = {
  documentTitle: string;
  sections: Array<{ id: string; title: string; blockIds: string[] }>;
};

type ComplianceTemplateRecord = {
  id: string;
  name: string;
  updatedAt: string;
  blocks: Block[];
  sectionRequiredByLockId: Record<string, boolean>;
};

const customBlocks = [createChartBlockSpec()];

const documentTabs = [
  { id: 'generic', label: 'Generic showcase', sub: 'Full block tour', document: sampleDocument, editorClass: undefined as string | undefined },
  { id: 'cv', label: 'Financial CV', sub: 'Columns & résumé', document: financialAnalystCvDocument, editorClass: 'editor-view--cv' },
  { id: 'prd', label: 'PRD brief', sub: 'Product specs', document: prdShowcaseDocument, editorClass: undefined },
  { id: 'runbook', label: 'On-call runbook', sub: 'Code & checks', document: runbookShowcaseDocument, editorClass: undefined },
  { id: 'board', label: 'Board one-pager', sub: 'KPIs & chart', document: boardOnePagerDocument, editorClass: undefined },
  { id: 'lesson', label: 'Lesson plan', sub: 'Agenda & HW', document: lessonPlanDocument, editorClass: undefined },
  { id: 'postmortem', label: 'Postmortem', sub: 'Incident review', document: postmortemDocument, editorClass: undefined },
  { id: 'newsletter', label: 'Newsletter', sub: 'Magazine layout', document: newsletterShowcaseDocument, editorClass: 'editor-view--newsletter' },
] as const satisfies ReadonlyArray<{
  id: DocumentTabId;
  label: string;
  sub: string;
  document: Block[];
  editorClass?: string;
}>;

function blockText(block: Block): string {
  return block.content
    ?.map((item) => (item.type === 'text' ? item.text : item.type === 'link' ? blockInlineText(item.content) : ''))
    .join('')
    .trim() ?? '';
}

function blockInlineText(items: NonNullable<Block['content']>): string {
  return items
    .map((item) => {
      if (item.type === 'text') return item.text;
      if (item.type === 'link') return blockInlineText(item.content);
      return '';
    })
    .join('');
}

function snapshotBlocks(blocks: Block[]): string {
  return JSON.stringify(blocks);
}

function buildComplianceTemplate(
  id: string,
  name: string,
  title: string,
  body: string[]
): ComplianceTemplateRecord {
  const sectionIds = body.map((_, i) => `compliance-${id}-section-${i + 1}`);
  const blocks: Block[] = [
    {
      id: `${id}-h1`,
      type: 'heading',
      props: { level: 1, textAlign: 'left' },
      content: [{ type: 'text', text: title, styles: {} }],
    },
  ];
  body.forEach((paragraph, index) => {
    const sectionId = sectionIds[index]!;
    blocks.push(
      {
        id: `${id}-h2-${index + 1}`,
        type: 'heading',
        props: {
          level: 2,
          textAlign: 'left',
          locked: true,
          lockReason: 'Section heading (template)',
          lockId: sectionId,
        },
        content: [{ type: 'text', text: `Section ${index + 1}`, styles: {} }],
      },
      {
        id: `${id}-p-${index + 1}`,
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: paragraph, styles: {} }],
      }
    );
  });
  return {
    id,
    name,
    updatedAt: new Date().toISOString(),
    blocks,
    sectionRequiredByLockId: Object.fromEntries(sectionIds.map((sectionId) => [sectionId, true])),
  };
}

function cloneTemplateBlocks(blocks: Block[]): Block[] {
  return structuredClone(blocks) as Block[];
}

function buildMergeManifestFromBlocks(blocks: Block[], documentTitle: string): ComplianceManifest {
  const sections: Array<{ id: string; title: string; blockIds: string[] }> = [];
  let current: { id: string; title: string; blockIds: string[] } | null = null;
  for (const block of blocks) {
    if (block.type === 'heading' && Number(block.props?.level ?? 0) >= 1 && String(block.props?.lockId ?? '').length > 0) {
      current = {
        id: String(block.props.lockId),
        title: blockText(block) || '(untitled section)',
        blockIds: [String(block.id)],
      };
      sections.push(current);
      continue;
    }
    current?.blockIds.push(String(block.id));
  }
  return { documentTitle, sections };
}

function downloadTextFile(filename: string, text: string, mimeType = 'application/json') {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const COMPLIANCE_SEED_TEMPLATES: ComplianceTemplateRecord[] = [
  buildComplianceTemplate(
    'gram-stain',
    'Gram stain SOP (demo seed)',
    'Gram stain — standard operating procedure (controlled)',
    [
      'Purpose, scope, and controlled-document policy.',
      'Step-by-step workflow with approved reagents, timing, and review notes.',
      'Release checklist, approvals, and exception handling.',
    ]
  ),
  buildComplianceTemplate(
    'equipment-check',
    'Equipment check SOP',
    'Equipment check — controlled procedure',
    [
      'Inspect the workstation and confirm all calibration stickers are current.',
      'Record the maintenance log entry and escalation path for anomalies.',
      'Attach the sign-off and retention policy before publishing.',
    ]
  ),
];

const ComplianceExampleEditor = forwardRef<
  PanelApi,
  {
    initialBlocks: Block[];
    editorClassName?: string;
    onBlocksChange?: (blocks: Block[]) => void;
  }
>(function ComplianceExampleEditor({ initialBlocks, editorClassName, onBlocksChange }, ref) {
  const commentStore = useMemo(() => new InMemoryCommentStore(), []);
  const lastBlocksSnapshotRef = useRef('');
  const editor = useBeakBlock({
    initialContent: initialBlocks,
    customBlocks,
    complianceLock: { allowReorder: false },
    prosemirror: { plugins: [createCommentPlugin(commentStore)] },
  });
  const blocks = useEditorContent(editor);
  const customSlashItems = useCustomSlashMenuItems(editor, customBlocks);

  useEffect(() => {
    const nextSnapshot = snapshotBlocks(blocks);
    if (lastBlocksSnapshotRef.current === nextSnapshot) return;
    lastBlocksSnapshotRef.current = nextSnapshot;
    onBlocksChange?.(blocks);
  }, [blocks, onBlocksChange]);

  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
    getBlocks: () => blocks,
    getCommentStore: () => commentStore,
  }), [blocks, commentStore, editor]);

  return (
    <div className="example-editor-panel">
      <CommentRail editor={editor} store={commentStore} currentUserId="amusendame">
        <BeakBlockView editor={editor} className={editorClassName ?? 'editor-view'} />
      </CommentRail>
      <SlashMenu editor={editor} customItems={customSlashItems} onAI={() => {}} />
      <BubbleMenu editor={editor} onComment={() => {}} onAI={() => {}} />
      <TableMenu editor={editor} />
      <TableHandles editor={editor} />
      <MediaMenu editor={editor} />
    </div>
  );
});

const ExampleEditorPanel = forwardRef<
  PanelApi,
  {
    initialDocument: Block[];
    className?: string;
    onAi: (mode: 'bubble' | 'slash') => void;
    onComment: () => void;
    onBlocksChange?: (blocks: Block[]) => void;
  }
>(function ExampleEditorPanel({ initialDocument, className, onAi, onComment, onBlocksChange }, ref) {
  const commentStore = useMemo(() => new InMemoryCommentStore(), []);
  const lastBlocksSnapshotRef = useRef('');
  const editor = useBeakBlock({
    initialContent: initialDocument,
    customBlocks,
    prosemirror: { plugins: [createCommentPlugin(commentStore)] },
  });
  const blocks = useEditorContent(editor);
  const customSlashItems = useCustomSlashMenuItems(editor, customBlocks);

  useEffect(() => {
    const nextSnapshot = snapshotBlocks(blocks);
    if (lastBlocksSnapshotRef.current === nextSnapshot) return;
    lastBlocksSnapshotRef.current = nextSnapshot;
    onBlocksChange?.(blocks);
  }, [blocks, onBlocksChange]);

  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
    getBlocks: () => blocks,
    getCommentStore: () => commentStore,
  }), [blocks, commentStore, editor]);

  return (
    <div className="example-editor-panel">
      <CommentRail editor={editor} store={commentStore} currentUserId="amusendame">
        <BeakBlockView editor={editor} className={className ?? 'editor-view'} />
      </CommentRail>
      <SlashMenu editor={editor} customItems={customSlashItems} onAI={() => onAi('slash')} />
      <BubbleMenu editor={editor} onComment={onComment} onAI={() => onAi('bubble')} />
      <TableMenu editor={editor} />
      <TableHandles editor={editor} />
      <MediaMenu editor={editor} />
    </div>
  );
});

const CollaborationPanel = forwardRef<
  PanelApi,
  {
    onAi: (mode: 'bubble' | 'slash') => void;
    onComment: () => void;
    onBlocksChange?: (blocks: Block[]) => void;
  }
>(function CollaborationPanel({ onAi, onComment, onBlocksChange }, ref) {
  const commentStore = useMemo(() => new InMemoryCommentStore(), []);
  const lastBlocksSnapshotRef = useRef('');
  const [displayName, setDisplayName] = useState('Guest 2001');
  const [roomId, setRoomId] = useState('beakblock-next-showcase');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const editor = useBeakBlock({
    initialContent: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text:
              'This document syncs in real time over Yjs. Open two browser tabs on this sample, give yourself different display names, and type — you should see remote carets and selections.',
            styles: {},
          },
        ],
      },
    ],
    history: false,
    customBlocks,
    prosemirror: { plugins: [createCommentPlugin(commentStore)] },
  });
  const blocks = useEditorContent(editor);
  const customSlashItems = useCustomSlashMenuItems(editor, customBlocks);
  useEffect(() => {
    const nextSnapshot = snapshotBlocks(blocks);
    if (lastBlocksSnapshotRef.current === nextSnapshot) return;
    lastBlocksSnapshotRef.current = nextSnapshot;
    onBlocksChange?.(blocks);
  }, [blocks, onBlocksChange]);

  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
    getBlocks: () => blocks,
    getCommentStore: () => commentStore,
  }), [blocks, commentStore, editor]);

  useEffect(() => {
    const ed = editor;
    if (!ed || ed.isDestroyed) return;
    const wsBase = (process.env.NEXT_PUBLIC_BEAKBLOCK_COLLAB_WS_URL || '').trim();
    if (!wsBase) {
      setConnectionStatus('idle');
      return;
    }

    setConnectionStatus('connecting');
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(wsBase, roomId.trim() || 'beakblock-next-showcase', ydoc);
    const fragment = ydoc.getXmlFragment('prosemirror');

    const onStatus = (event: { status: string }) => {
      if (event.status === 'connected') setConnectionStatus('connected');
      else if (event.status === 'disconnected') setConnectionStatus('disconnected');
      else setConnectionStatus('connecting');
    };

    provider.on('status', onStatus);
    provider.awareness.setLocalStateField('user', {
      name: displayName.trim() || 'Anonymous',
      color: `hsl(${Math.abs(provider.awareness.clientID) % 360} 70% 55%)`,
    });

    ed.enableCollaboration({
      plugins: [ySyncPlugin(fragment), yCursorPlugin(provider.awareness), yUndoPlugin()],
    });

    return () => {
      provider.off('status', onStatus);
      ed.disableCollaboration();
      provider.destroy();
      ydoc.destroy();
      setConnectionStatus('idle');
    };
  }, [displayName, editor, roomId]);

  return (
    <div className="collab-panel">
      <div className="collab-panel__bar" role="group" aria-label="Collaboration">
        <label className="collab-panel__field">
          <span className="collab-panel__label">Your name</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} type="text" className="collab-panel__input" autoComplete="nickname" />
        </label>
        <label className="collab-panel__field">
          <span className="collab-panel__label">Room</span>
          <input value={roomId} onChange={(e) => setRoomId(e.target.value)} type="text" className="collab-panel__input" autoComplete="off" spellCheck={false} />
        </label>
        <div className="collab-panel__meta">
          <span
            className="collab-panel__pill"
            data-status={connectionStatus}
          >
            {connectionStatus === 'idle' ? '…' : connectionStatus}
          </span>
          <span className="collab-panel__ws">
            {(process.env.NEXT_PUBLIC_BEAKBLOCK_COLLAB_WS_URL || '').trim() || 'not configured'}
          </span>
        </div>
        <p className="collab-panel__help">
          Run a Yjs WebSocket server and point <code className="collab-panel__code">NEXT_PUBLIC_BEAKBLOCK_COLLAB_WS_URL</code> at it to see cursors sync across tabs.
        </p>
      </div>

      <div className="example-editor-panel">
        <CommentRail editor={editor} store={commentStore} currentUserId="amusendame">
          <BeakBlockView editor={editor} className="editor-view" />
        </CommentRail>
        <SlashMenu editor={editor} customItems={customSlashItems} onAI={() => onAi('slash')} />
        <BubbleMenu editor={editor} onComment={onComment} onAI={() => onAi('bubble')} />
        <TableMenu editor={editor} />
        <TableHandles editor={editor} />
        <MediaMenu editor={editor} />
      </div>
    </div>
  );
});

function ComplianceWorkspace({
  onBlocksChange,
  onInspectorChange,
}: {
  onBlocksChange?: (blocks: Block[]) => void;
  onInspectorChange?: (payload: { blocks: Block[]; manifest: ComplianceManifest | null }) => void;
}) {
  const [mode, setMode] = useState<'document' | 'templates'>('document');
  const [templateId, setTemplateId] = useState(COMPLIANCE_SEED_TEMPLATES[0]?.id ?? '');
  const [templates, setTemplates] = useState(COMPLIANCE_SEED_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState(COMPLIANCE_SEED_TEMPLATES[0]?.id ?? '');
  const [reviewerOnly, setReviewerOnly] = useState(false);
  const [disableAi, setDisableAi] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingBlocks, setEditingBlocks] = useState<Block[]>([]);
  const [mergedBlocks, setMergedBlocks] = useState<Block[]>(cloneTemplateBlocks(templates[0]?.blocks ?? []));
  const [manifest, setManifest] = useState<ComplianceManifest | null>(null);
  const previewEditor = useBeakBlock({
    initialContent: [],
    customBlocks,
    editable: false,
  });
  const activeTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null;
  const visibleBlocks = mode === 'templates' && editingTemplateId ? editingBlocks : mergedBlocks;
  const lastVisibleSnapshotRef = useRef('');

  useEffect(() => {
    if (!activeTemplate) return;
    if (mode === 'document') {
      setMergedBlocks(cloneTemplateBlocks(activeTemplate.blocks));
    }
  }, [activeTemplate, mode]);

  useEffect(() => {
    const nextManifest = buildMergeManifestFromBlocks(visibleBlocks, activeTemplate?.name ?? 'Compliance document');
    const nextSnapshot = JSON.stringify({
      title: activeTemplate?.name ?? 'Compliance document',
      blocks: visibleBlocks,
      manifest: nextManifest,
    });
    if (lastVisibleSnapshotRef.current === nextSnapshot) return;
    lastVisibleSnapshotRef.current = nextSnapshot;
    onBlocksChange?.(visibleBlocks);
    setManifest(nextManifest);
    onInspectorChange?.({ blocks: visibleBlocks, manifest: nextManifest });
  }, [activeTemplate?.name, onBlocksChange, onInspectorChange, visibleBlocks]);

  useEffect(() => {
    if (!previewOpen) return;
    previewEditor.setDocument(visibleBlocks);
  }, [previewEditor, previewOpen, visibleBlocks]);

  useEffect(() => {
    if (!editingTemplateId) {
      setEditingName('');
      setEditingBlocks([]);
      return;
    }
    const template = templates.find((t) => t.id === editingTemplateId);
    if (!template) return;
    setEditingName(template.name);
    setEditingBlocks(cloneTemplateBlocks(template.blocks));
  }, [editingTemplateId, templates]);

  const activeManifest = manifest ?? buildMergeManifestFromBlocks(visibleBlocks, activeTemplate?.name ?? 'Compliance document');

  const openPreview = () => {
    setPreviewOpen(true);
  };

  const exportBundle = () => {
    const payload = {
      blocks: visibleBlocks,
      mergeManifest: activeManifest,
      markdown: blocksToMarkdown(visibleBlocks),
    };
    downloadTextFile(
      `${(activeTemplate?.name ?? 'compliance-document').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`,
      JSON.stringify(payload, null, 2)
    );
  };

  const commitTemplate = () => {
    if (!editingTemplateId) return;
    setTemplates((current) =>
      current.map((template) =>
        template.id === editingTemplateId
          ? { ...template, name: editingName.trim() || template.name, blocks: cloneTemplateBlocks(editingBlocks), updatedAt: new Date().toISOString() }
          : template
      )
    );
    setEditingTemplateId(null);
  };

  return (
    <div className="editor-stage__panel editor-stage__panel--compliance">
      <div className="compliance-toolbar">
        <p className="compliance-toolbar__label">
          {mode === 'templates' ? 'Template studio' : 'Controlled document'}
        </p>
        <div className="compliance-toolbar__controls">
          <button type="button" className={`compliance-toolbar__tab ${mode === 'document' ? 'compliance-toolbar__tab--active' : ''}`} onClick={() => setMode('document')}>
            Document
          </button>
          <button type="button" className={`compliance-toolbar__tab ${mode === 'templates' ? 'compliance-toolbar__tab--active' : ''}`} onClick={() => setMode('templates')}>
            Templates
          </button>
          {mode === 'document' ? (
            <>
              <label className="compliance-toolbar__select-label">
                Template
                <select className="compliance-toolbar__select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="compliance-toolbar__tab" onClick={() => setSelectedTemplateId(templateId)}>
                New document
              </button>
              <label className="compliance-toolbar__toggle">
                <input type="checkbox" checked={reviewerOnly} onChange={(e) => setReviewerOnly(e.target.checked)} />
                Reviewer view
              </label>
              <label className="compliance-toolbar__toggle">
                <input type="checkbox" checked={disableAi} onChange={(e) => setDisableAi(e.target.checked)} />
                Disable AI
              </label>
              <button type="button" className="compliance-toolbar__preview" onClick={openPreview}>
                Preview document
              </button>
              <button type="button" className="compliance-toolbar__export" onClick={exportBundle}>
                Export bundle
              </button>
            </>
          ) : null}
        </div>
      </div>

      {mode === 'templates' ? (
        <div className="compliance-template-studio">
          <div className="compliance-template-studio__list-head">
            <h2 className="compliance-template-studio__title">Compliance templates</h2>
            <p className="compliance-template-studio__lede">
              Templates are full documents: an optional title line, then a hierarchy of locked H1–H3 headings with body blocks beneath them.
            </p>
            <button type="button" className="compliance-template-studio__btn compliance-template-studio__btn--primary" onClick={() => setEditingTemplateId(templates[0]?.id ?? null)}>
              New template
            </button>
          </div>
          <ul className="compliance-template-studio__list">
            {templates.map((template) => (
              <li key={template.id} className="compliance-template-studio__row">
                <span className="compliance-template-studio__name">{template.name}</span>
                <span className="compliance-template-studio__meta">Updated {template.updatedAt.slice(0, 10)}</span>
                <button type="button" className="compliance-template-studio__btn" onClick={() => setEditingTemplateId(template.id)}>
                  Edit
                </button>
              </li>
            ))}
          </ul>
          {editingTemplateId ? (
            <div className="compliance-template-studio__editor-shell">
              <header className="compliance-template-studio__toolbar">
                <label className="compliance-template-studio__name-field">
                  Template name
                  <input className="compliance-template-studio__input" value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                </label>
                <div className="compliance-template-studio__toolbar-actions">
                  <button type="button" className="compliance-template-studio__btn" onClick={() => setEditingTemplateId(null)}>
                    Back
                  </button>
                  <button type="button" className="compliance-template-studio__btn compliance-template-studio__btn--primary" onClick={commitTemplate}>
                    Save template
                  </button>
                </div>
              </header>
              <div className="compliance-template-studio__split">
                <aside className="compliance-template-studio__aside" aria-label="Section requirements">
                  <p className="compliance-template-studio__aside-title">Sections</p>
                  <p className="compliance-template-studio__aside-hint">Toggle whether each section is required for validation in authored documents.</p>
                  <ul className="compliance-template-studio__aside-list">
                    {editingBlocks
                      .filter((block) => block.type === 'heading' && Number(block.props?.level ?? 0) >= 2)
                      .map((block, index) => (
                        <li key={block.id} className="compliance-template-studio__aside-item">
                          <label className="compliance-template-studio__check">
                            <input type="checkbox" defaultChecked />
                            <span>{`H${block.props?.level ?? 2} · ${blockText(block) || `Section ${index + 1}`}`}</span>
                          </label>
                        </li>
                      ))}
                  </ul>
                </aside>
                <div className="compliance-template-studio__editor-panel">
                  <ComplianceExampleEditor
                    key={editingTemplateId ?? 'editing-template'}
                    initialBlocks={editingBlocks}
                    editorClassName="editor-view"
                    onBlocksChange={setEditingBlocks}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="compliance-document">
          <p className="compliance-workspace__banner">
            This controlled document uses the same BeakBlock surface as the sample tabs, but with a compliance-style toolbar and preview/export actions.
          </p>
          <ComplianceExampleEditor
            key={selectedTemplateId}
            initialBlocks={mergedBlocks.length > 0 ? mergedBlocks : activeTemplate?.blocks ?? []}
            editorClassName="editor-view"
            onBlocksChange={(next) => {
              setMergedBlocks(next);
              onBlocksChange?.(next);
              const nextManifest = buildMergeManifestFromBlocks(next, activeTemplate?.name ?? 'Compliance document');
              setManifest(nextManifest);
              onInspectorChange?.({ blocks: next, manifest: nextManifest });
            }}
          />
        </div>
      )}

      {previewOpen ? createPortal(
        <div className="doc-preview-backdrop" role="presentation" onMouseDown={() => setPreviewOpen(false)}>
          <div className="doc-preview-dialog" role="dialog" aria-modal="true" aria-label="Compliance preview" onMouseDown={(event) => event.stopPropagation()}>
            <header className="doc-preview-dialog__head">
              <div>
                <p className="doc-preview-dialog__title">{(activeTemplate?.name ?? 'Compliance document')} — preview</p>
                <p className="doc-preview-dialog__sub">Read-only merged document from the controlled editor.</p>
              </div>
              <button type="button" className="doc-preview-dialog__close" onClick={() => setPreviewOpen(false)}>Close</button>
            </header>
            <div className="doc-preview-dialog__body">
              <BeakBlockView editor={previewEditor} className="editor-view doc-preview-dialog__editor" />
            </div>
          </div>
        </div>,
        document.body
      ) : null}

    </div>
  );
}

export function BeakBlockShowcase(): ReactElement {
  const [viewMode, setViewMode] = useState<ViewMode>('generic');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'bubble' | 'slash'>('bubble');
  const [aiContextSnapshot, setAiContextSnapshot] = useState<AIContext | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [inspectorBlocks, setInspectorBlocks] = useState<Block[]>([]);
  const [complianceInspector, setComplianceInspector] = useState<{ blocks: Block[]; manifest: ComplianceManifest | null }>({ blocks: [], manifest: null });

  const panelRefs = useRef<Record<string, PanelApi | null>>({});
  const viewModeRef = useRef<ViewMode>(viewMode);
  const inspectorBlocksSnapshotRef = useRef('');
  const complianceInspectorSnapshotRef = useRef('');

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  const handleTabBlocksChange = useCallback((tabId: DocumentTabId, blocks: Block[]) => {
    if (viewModeRef.current !== tabId) return;
    const nextSnapshot = snapshotBlocks(blocks);
    if (inspectorBlocksSnapshotRef.current === nextSnapshot) return;
    inspectorBlocksSnapshotRef.current = nextSnapshot;
    setInspectorBlocks(blocks);
  }, []);

  const handleCollaborationBlocksChange = useCallback((blocks: Block[]) => {
    if (viewModeRef.current !== 'collaboration') return;
    const nextSnapshot = snapshotBlocks(blocks);
    if (inspectorBlocksSnapshotRef.current === nextSnapshot) return;
    inspectorBlocksSnapshotRef.current = nextSnapshot;
    setInspectorBlocks(blocks);
  }, []);

  const handleComplianceBlocksChange = useCallback((blocks: Block[]) => {
    if (viewModeRef.current !== 'compliance') return;
    const nextSnapshot = snapshotBlocks(blocks);
    if (inspectorBlocksSnapshotRef.current === nextSnapshot) return;
    inspectorBlocksSnapshotRef.current = nextSnapshot;
    setInspectorBlocks(blocks);
  }, []);

  const modalTargetEditor = useMemo(() => {
    if (viewMode === 'compliance') return panelRefs.current.compliance?.getEditor() ?? null;
    if (viewMode === 'collaboration') return panelRefs.current.collaboration?.getEditor() ?? null;
    return panelRefs.current[viewMode]?.getEditor() ?? null;
  }, [viewMode, inspectorBlocks, complianceInspector]);

  const modalCommentStore = useMemo(() => {
    if (viewMode === 'compliance') return panelRefs.current.compliance?.getCommentStore() ?? null;
    if (viewMode === 'collaboration') return panelRefs.current.collaboration?.getCommentStore() ?? null;
    return panelRefs.current[viewMode]?.getCommentStore() ?? null;
  }, [viewMode, inspectorBlocks, complianceInspector]);

  useEffect(() => {
    setCommentOpen(false);
    setAiOpen(false);
  }, [viewMode]);

  useEffect(() => {
    const panel = panelRefs.current[viewMode];
    if (viewMode === 'compliance') {
      setInspectorBlocks(complianceInspector.blocks);
      return;
    }
    if (!panel) {
      setInspectorBlocks([]);
      return;
    }
    setInspectorBlocks(panel.getBlocks());
  }, [viewMode, complianceInspector.blocks]);

  const openAiModal = (mode: 'bubble' | 'slash') => {
    setAiMode(mode);
    const editor = modalTargetEditor;
    setAiContextSnapshot(editor ? buildAIContext(editor, mode, null, '') : null);
    setAiOpen(true);
  };

  return (
    <div className="page-shell">
      <div className="page-shell__mesh" aria-hidden="true" />
      <header className="hero hero--enter">
        <div className="hero-copy">
          <p className="eyebrow">Nuxt + Vue example</p>
          <h1>Almost every block in one editorial page.</h1>
          <p>
            Pick a sample from the <strong>left rail</strong> — each opens a dedicated editor with comments, AI, tables, media, and charts where the document uses them. The
            <strong>Compliance</strong> mode uses templates (seeded Gram stain SOP), per-section approvals, and export.
          </p>
        </div>

        <aside className="hero-panel hero-panel--enter">
          <div className="hero-stat">
            <span className="hero-stat-label">Package</span>
            <span className="hero-stat-value">@amusendame/beakblock-react</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-label">Samples</span>
            <span className="hero-stat-value">10 scenarios</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-label">Layout</span>
            <span className="hero-stat-value">Sticky nav + editor</span>
          </div>
        </aside>
      </header>

      <main className="layout layout--with-sidebar">
        <aside className="sample-sidebar sample-sidebar--enter" aria-label="Sample documents">
          <p className="sample-sidebar__title">Samples</p>
          <nav className="sample-sidebar__nav">
            {documentTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`sample-sidebar__btn ${viewMode === tab.id ? 'sample-sidebar__btn--active' : ''}`}
                onClick={() => setViewMode(tab.id)}
              >
                {tab.label}
                <span className="sample-sidebar__sub">{tab.sub}</span>
              </button>
            ))}
          </nav>
          <div className="sample-sidebar__divider" role="presentation" />
          <button
            type="button"
            className={`sample-sidebar__btn sample-sidebar__btn--collab ${viewMode === 'collaboration' ? 'sample-sidebar__btn--active' : ''}`}
            onClick={() => setViewMode('collaboration')}
          >
            Live collaboration
            <span className="sample-sidebar__sub">Yjs · awareness cursors</span>
          </button>
          <button
            type="button"
            className={`sample-sidebar__btn sample-sidebar__btn--compliance ${viewMode === 'compliance' ? 'sample-sidebar__btn--active' : ''}`}
            onClick={() => setViewMode('compliance')}
          >
            Compliance
            <span className="sample-sidebar__sub">Compliance + preview</span>
          </button>
        </aside>

        <div className="layout__main">
          <section className="editor-stage editor-stage--enter">
            <div key={viewMode} className="editor-stage__sheen" aria-hidden="true" />

            <div className="editor-stage__panel">
              {documentTabs.map((tab) => (
                <div key={tab.id} style={{ display: viewMode === tab.id ? 'block' : 'none' }}>
                  <ExampleEditorPanel
                    key={tab.id}
                    ref={(el) => {
                      panelRefs.current[tab.id] = el;
                    }}
                    initialDocument={tab.document}
                    className={tab.editorClass ?? 'editor-view'}
                    onAi={openAiModal}
                    onComment={() => setCommentOpen(true)}
                    onBlocksChange={(blocks) => handleTabBlocksChange(tab.id, blocks)}
                  />
                </div>
              ))}

              <div style={{ display: viewMode === 'collaboration' ? 'block' : 'none' }}>
                <CollaborationPanel
                  key="collaboration"
                  ref={(el) => {
                    panelRefs.current.collaboration = el;
                  }}
                  onAi={openAiModal}
                  onComment={() => setCommentOpen(true)}
                  onBlocksChange={handleCollaborationBlocksChange}
                />
              </div>

              <div style={{ display: viewMode === 'compliance' ? 'block' : 'none' }}>
                <ComplianceWorkspace
                  key="compliance"
                  ref={(el) => {
                    panelRefs.current.compliance = el;
                  }}
                  onBlocksChange={handleComplianceBlocksChange}
                  onInspectorChange={(payload) => setComplianceInspector(payload)}
                />
              </div>
            </div>
          </section>

          <section className="inspector inspector--enter">
            <p className="section-label">Document readout</p>
            <h2>Document JSON</h2>
            <p className="inspector__lede">
              {viewMode === 'compliance'
                ? 'Merged blocks plus mergeManifest (section id → block ids in the preview document).'
                : viewMode === 'collaboration'
                  ? 'Live Yjs document for this tab — open two clients on the same room to verify sync.'
                  : 'Serialized blocks for the active sample tab.'}
            </p>
            <pre className="inspector__pre">
              {viewMode === 'compliance' ? JSON.stringify({ blocks: complianceInspector.blocks, mergeManifest: complianceInspector.manifest }, null, 2) : JSON.stringify(inspectorBlocks, null, 2)}
            </pre>
          </section>
        </div>
      </main>

      <footer className="footer">
        <p>
          `useBeakBlock` → editor instance | `CommentRail` → threaded annotations | `app/api/ai/route.ts` → OpenAI-compatible server route
        </p>
      </footer>

      {viewMode !== 'compliance' ? (
        <>
          <AIModal
            open={aiOpen}
            editor={modalTargetEditor}
            mode={aiMode}
            presets={aiMode === 'bubble' ? BUBBLE_AI_PRESETS : SLASH_AI_PRESETS}
            customBlocks={customBlocks}
            contextSnapshot={aiContextSnapshot}
            title="AI assistant"
            subtitle="Use curated prompts to rewrite the selection or continue the document."
            onClose={() => setAiOpen(false)}
            onExecute={(request) => sendAIRequest(request, '/api/ai')}
            onApply={({ output, ...request }) => {
              if (!modalTargetEditor) return;
              applyAIBlockOutput(modalTargetEditor, request, output);
            }}
          />

          <CommentModal
            open={commentOpen && !!modalCommentStore}
            editor={modalTargetEditor}
            store={modalCommentStore ?? new InMemoryCommentStore()}
            currentUserId="amusendame"
            title="Comments"
            subtitle="Leave threads, replies, reactions, or mark notes resolved."
            onClose={() => setCommentOpen(false)}
          />
        </>
      ) : null}
    </div>
  );
}
