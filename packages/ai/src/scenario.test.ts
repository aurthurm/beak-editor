/**
 * Mirrors the AI scenario in examples/next-app (AIScenario.tsx): the review, QMS and permission
 * guard extensions combined in one controlled-mode editor, with the mock provider replies.
 *
 * The QMS, templates and schema packages are imported from source because this package does not
 * depend on them. Their code paths are the ones the example runs.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { BeakBlockEditor, Decoration, DecorationSet, Plugin, PluginKey, type Block, type BeakExtension } from '@amusendame/beakblock-core';
import { createPermissionGuardPlugin, type PolicyContext } from '@amusendame/beakblock-permissions';
import { InMemoryRevisionStore, acceptAll, listPendingRevisions, reviewExtension } from '@amusendame/beakblock-review';
import type { BeakDocument } from '@amusendame/beakblock-schema';

import { qmsExtension } from '@amusendame/beakblock-blocks-qms';
import { addSection, buildPolicyContext, createTemplate, instantiateDocument, publishTemplate } from '@amusendame/beakblock-templates';
import { createAICommandLayer } from './layer';
import { createMockProvider } from './providers';
import type { AIResult } from './types';

const SECTION_ASSIGNMENTS = {
  purpose: { ownerId: 'ann', ownerName: 'Ann (Author A)' },
  scope: { ownerId: 'ben', ownerName: 'Ben (Author B)' },
  procedure: { ownerId: 'cy', ownerName: 'Cy (Author C)' },
  records: { ownerId: 'ben', ownerName: 'Ben (Author B)' },
};

const para = (id: string, value: string, props: Record<string, unknown> = {}): Block => ({
  id,
  type: 'paragraph',
  props,
  content: [{ type: 'text', text: value, styles: {} }],
});

/** Template of the controlled SOP, as in examples/next-app/app/v2/controlledShared.ts. */
function sectionDraft() {
  let t = createTemplate({
    id: 'tpl-gram-stain-sop',
    title: 'Gram stain SOP',
    documentType: 'SOP',
    properties: {
      docNumber: { generated: true, readOnly: true, required: true, pattern: '^SOP-\\d{4}$' },
      title: { required: true, maxLength: 120 },
      revision: { required: true, readOnly: true },
    },
  });
  t = addSection(t, {
    templateSectionId: 'purpose',
    title: 'Purpose',
    required: true,
    allowedBlocks: ['paragraph'],
    lockedBoilerplate: [para('bp-1', 'This SOP describes the Gram stain procedure.')],
    placeholder: [para('ph-1', 'Describe the purpose.', { placeholder: true })],
  });
  t = addSection(t, {
    templateSectionId: 'scope',
    title: 'Scope',
    required: true,
    allowedBlocks: null,
    placeholder: [para('ph-2', 'Describe the scope.', { placeholder: true })],
  });
  t = addSection(t, {
    templateSectionId: 'procedure',
    title: 'Procedure',
    required: true,
    kind: 'procedure',
    allowedBlocks: ['paragraph', 'table', 'orderedList', 'heading'],
    placeholder: [para('ph-3', 'Describe the procedure.', { placeholder: true })],
  });
  t = addSection(t, {
    templateSectionId: 'records',
    title: 'Records',
    required: false,
    placeholder: [para('ph-4', 'List the records.', { placeholder: true })],
  });
  return t;
}

const MOCK_AI_REPLIES = {
  'ai.rewriteSelection': { text: 'Applies to all microbiology bench staff who prepare and read smears.' },
  'ai.proposeProcedureSteps': { json: { steps: ['Dry the smear fully before fixing.', 'Record the stain lot number in the log.'] } },
};

/** Fills every section with a line of content, as the example's sampleContent does. */
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

/** Editable when the principal holds an editing capability on the section (as the example's canEditSection). */
function canEdit(ctx: PolicyContext, sectionId: string): boolean {
  return [...(ctx.sectionGrants[sectionId] ?? []), ...(ctx.defaultGrants ?? [])].some(
    (cap) => cap === 'section.editText' || cap === 'section.insertBlock'
  );
}

const readOnlyKey = new PluginKey<DecorationSet>('test-ai-readonly');
function readOnlyPlugin(getCtx: () => PolicyContext): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: readOnlyKey,
    state: {
      init(_c, state) {
        return build(state.doc, getCtx());
      },
      apply(tr, value, _old, state) {
        return tr.docChanged ? build(state.doc, getCtx()) : value;
      },
    },
    props: { decorations: (state) => readOnlyKey.getState(state) },
  });
}

function build(doc: BeakDocument | Parameters<typeof DecorationSet.create>[0], ctx: PolicyContext): DecorationSet {
  const decos: Decoration[] = [];
  (doc as Parameters<typeof DecorationSet.create>[0]).forEach((node, offset) => {
    if (node.type.name === 'controlledSection' && !canEdit(ctx, String(node.attrs.sectionId ?? ''))) {
      decos.push(Decoration.node(offset, offset + node.nodeSize, { class: 'v2-section-readonly' }));
    }
  });
  return DecorationSet.create(doc as Parameters<typeof DecorationSet.create>[0], decos);
}

const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 0));

interface Harness {
  editor: BeakBlockEditor;
  layer: ReturnType<typeof createAICommandLayer>;
  store: InMemoryRevisionStore;
  provider: ReturnType<typeof createMockProvider>;
  denials: string[];
  sectionIdOf: (templateSectionId: string) => string;
}

async function setup(userId = 'ann', roles: string[] = ['author']): Promise<Harness> {
  const published = await publishTemplate(sectionDraft());
  const doc = instantiateDocument(published, {
    documentId: 'doc-ai-demo',
    docNumber: 'SOP-0042',
    properties: { title: 'Gram stain procedure', revision: '1' },
    assignments: SECTION_ASSIGNMENTS,
  });
  const blocks = sampleContent(doc);
  const user = { id: userId, roles };
  const getCtx = (): PolicyContext =>
    buildPolicyContext({ sections: [{ blocks }] } as unknown as BeakDocument, SECTION_ASSIGNMENTS, user.id, user.roles);
  const store = new InMemoryRevisionStore();
  const author = { id: userId, name: userId };
  const denials: string[] = [];
  const onDenied = (decisions: Array<{ allowed: boolean; reason?: string }>) =>
    denials.push(decisions.filter((d) => !d.allowed).map((d) => d.reason).join('; '));
  const extensions: BeakExtension[] = [
    reviewExtension({ enabled: true, author, store }),
    qmsExtension({ getPolicyContext: () => getCtx(), onDenied }),
    {
      name: 'v2-ai-guard',
      plugins: () => [createPermissionGuardPlugin({ getContext: () => getCtx(), onDenied }), readOnlyPlugin(() => getCtx())],
    },
  ];
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new BeakBlockEditor({ element, mode: 'controlled', initialContent: blocks, extensions });
  const provider = createMockProvider(MOCK_AI_REPLIES as unknown as Parameters<typeof createMockProvider>[0]);
  const layer = createAICommandLayer({
    provider,
    editor,
    getPolicyContext: () => getCtx(),
    author,
    options: { terminology: ['Gram stain'], approvedReferences: [] },
  });
  const sectionIdOf = (templateSectionId: string) => {
    let id = '';
    editor.pm.state.doc.descendants((node) => {
      if (id) return false;
      if (node.type.name === 'controlledSection' && node.attrs.templateSectionId === templateSectionId) id = String(node.attrs.sectionId);
      return !id;
    });
    return id;
  };
  return { editor, layer, store, provider, denials, sectionIdOf };
}

/** Selects ten characters of the first text in a section. */
function selectIn(editor: BeakBlockEditor, sectionId: string): void {
  let from = -1;
  editor.pm.state.doc.descendants((node, pos) => {
    if (from >= 0) return false;
    if (node.type.name !== 'controlledSection' || node.attrs.sectionId !== sectionId) return true;
    node.descendants((child, childPos) => {
      if (from >= 0) return false;
      if (child.isTextblock && child.textContent.length > 0) {
        from = pos + 1 + childPos + 1;
        return false;
      }
      return true;
    });
    return false;
  });
  editor.pm.setSelection(editor.pm.createTextSelection(from, from + 10));
}

/** Places a collapsed cursor at the start of the first text in a section. */
function cursorIn(editor: BeakBlockEditor, sectionId: string): void {
  let from = -1;
  editor.pm.state.doc.descendants((node, pos) => {
    if (from >= 0) return false;
    if (node.type.name !== 'controlledSection' || node.attrs.sectionId !== sectionId) return true;
    node.descendants((child, childPos) => {
      if (from >= 0) return false;
      if (child.isTextblock) {
        from = pos + 1 + childPos + 1;
        return false;
      }
      return true;
    });
    return false;
  });
  editor.pm.setSelection(editor.pm.createTextSelection(from, from));
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('AI scenario composition (examples/next-app AIScenario)', () => {
  it('a rewrite in the author section is proposed, listed, and changes the document once accepted', async () => {
    const { editor, layer, store, provider, sectionIdOf } = await setup();
    await nextTurn();
    const before = editor.pm.state.doc.textContent;
    selectIn(editor, sectionIdOf('purpose'));

    const result: AIResult = await layer.run('ai.rewriteSelection', { instruction: 'Make it more formal.' });

    expect(result.status).toBe('proposed');
    expect(provider.calls).toHaveLength(1);
    const pending = listPendingRevisions(editor.pm.state, store);
    expect(pending.some((r) => r.kind === 'insert' && r.text?.includes('microbiology bench staff'))).toBe(true);
    expect(editor.pm.state.doc.textContent).not.toBe(before);

    acceptAll(editor.pm.view, 'ann');
    expect(listPendingRevisions(editor.pm.state, store)).toHaveLength(0);
    expect(editor.pm.state.doc.textContent).toContain('Applies to all microbiology bench staff who prepare and read smears.');
    editor.destroy();
  });

  it('a step proposal the section does not allow is refused by the document rules and not recorded', async () => {
    const { editor, layer, store, denials, sectionIdOf } = await setup();
    await nextTurn();
    const before = editor.pm.state.doc.textContent;
    cursorIn(editor, sectionIdOf('purpose'));

    const result = await layer.run('ai.proposeProcedureSteps', { goal: 'Stain a fixed smear by the Gram method and read it' });

    // Purpose allows paragraphs only. The steps are a list, so the QMS plugin refuses the change.
    expect(result.status).toBe('denied');
    expect(denials.join(' ')).toContain('not allowed');
    expect(editor.pm.state.doc.textContent).toBe(before);
    expect(store.list()).toHaveLength(0);
    editor.destroy();
  });

  it('a step proposal in the procedure section is proposed, listed, and accepted by its owner', async () => {
    const { editor, layer, store, sectionIdOf } = await setup('cy', ['author']);
    await nextTurn();
    cursorIn(editor, sectionIdOf('procedure'));

    const result = await layer.run('ai.proposeProcedureSteps', { goal: 'Stain a fixed smear by the Gram method and read it' });

    expect(result.status).toBe('proposed');
    expect(listPendingRevisions(editor.pm.state, store).length).toBeGreaterThan(0);
    expect(editor.pm.state.doc.textContent).toContain('Dry the smear fully before fixing.');
    acceptAll(editor.pm.view, 'cy');
    expect(listPendingRevisions(editor.pm.state, store)).toHaveLength(0);
    expect(editor.pm.state.doc.textContent).toContain('Dry the smear fully before fixing.');
    editor.destroy();
  });

  it('a rewrite in another author section is denied before the provider is called', async () => {
    const { editor, layer, provider, sectionIdOf } = await setup();
    await nextTurn();
    selectIn(editor, sectionIdOf('scope'));
    const result = await layer.run('ai.rewriteSelection', { instruction: 'Make it more formal.' });
    expect(result.status).toBe('denied');
    expect(provider.calls).toHaveLength(0);
    editor.destroy();
  });
});
