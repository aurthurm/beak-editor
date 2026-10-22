/**
 * @module
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BeakBlockEditor, type Block } from '@amusendame/beakblock-core';
import { CommandRegistry } from '@amusendame/beakblock-commands';
import {
  createRevisionTrackingPlugin,
  InMemoryRevisionStore,
  acceptAll,
  listPendingRevisions,
} from '@amusendame/beakblock-review';
import type { PolicyContext } from '@amusendame/beakblock-permissions';
import type { NodeSpec } from 'prosemirror-model';

import { createAICommandLayer } from './layer';
import { createMockProvider } from './providers';
import { AI_DISCLAIMER, AICommandError, type AIAuditEntry, type AIResult } from './types';

const author = { id: 'user-1', name: 'Ada' };

const controlledSpec: NodeSpec = {
  content: 'block+',
  group: 'block',
  defining: true,
  isolating: true,
  attrs: {
    id: { default: null },
    sectionId: { default: null },
    title: { default: '' },
    required: { default: false },
    styleId: { default: null },
    templateSectionId: { default: null },
    policyRef: { default: null },
  },
  parseDOM: [{ tag: 'section[data-controlled]' }],
  toDOM: () => ['section', { 'data-controlled': '' }, 0] as const,
};

function content(): Block[] {
  return [
    { id: 'p1', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'The quick brown fox jumps.', styles: {} }] },
    {
      id: 'sec-a',
      type: 'controlledSection',
      props: { sectionId: 'sec-a', title: 'Procedure' },
      children: [
        { id: 'p2', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Locked wording stays put.', styles: {} }] },
      ],
    },
  ];
}

function allowEverything(): PolicyContext {
  return { userId: author.id, roles: [], sectionGrants: { 'sec-a': ['section.editText', 'section.insertBlock'] }, defaultGrants: ['document.editUncontrolled'] };
}

function uncontrolledOnly(): PolicyContext {
  return { userId: author.id, roles: [], sectionGrants: {}, defaultGrants: ['document.editUncontrolled'] };
}

describe('AI command layer', () => {
  let container: HTMLElement;
  let editor: BeakBlockEditor;
  let store: InMemoryRevisionStore;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      initialContent: content(),
      extensions: [{ name: 'test-sections', nodes: { controlledSection: controlledSpec } }],
    });
    store = new InMemoryRevisionStore();
    editor.pm.addPlugin(createRevisionTrackingPlugin({ author, store }));
  });

  afterEach(() => {
    editor.destroy();
    container.remove();
  });

  function selectText(needle: string) {
    const doc = editor.pm.state.doc;
    let from = -1;
    doc.descendants((node, pos) => {
      if (from === -1 && node.isText && node.text && node.text.includes(needle)) from = pos + node.text.indexOf(needle);
      return from === -1;
    });
    if (from < 0) throw new Error(`text not found: ${needle}`);
    editor.pm.setSelection(editor.pm.createTextSelection(from, from + needle.length));
  }

  function snapshot(): string {
    return JSON.stringify(editor.getDocument());
  }

  function marksOf(markName: string): Array<{ text: string; attrs: Record<string, unknown> }> {
    const out: Array<{ text: string; attrs: Record<string, unknown> }> = [];
    editor.pm.state.doc.descendants((node) => {
      if (!node.isText) return;
      const mark = node.marks.find((m) => m.type.name === markName);
      if (mark) out.push({ text: node.text ?? '', attrs: mark.attrs as Record<string, unknown> });
    });
    return out;
  }

  it('rewriteSelection creates a pending tracked replacement and accepts nothing', async () => {
    const provider = createMockProvider({ 'ai.rewriteSelection': { text: 'A clearer fox sentence.' } });
    const audits: AIAuditEntry[] = [];
    const proposals: AIResult[] = [];
    const layer = createAICommandLayer({
      provider,
      editor,
      author,
      getPolicyContext: allowEverything,
      onAudit: (e) => audits.push(e),
      onProposal: (r) => proposals.push(r),
    });
    selectText('quick brown fox');

    const result = await layer.run('ai.rewriteSelection');

    expect(result.status).toBe('proposed');
    expect(proposals).toHaveLength(1);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]!.responseFormat).toBe('text');
    expect(provider.calls[0]!.context.selectionText).toBe('quick brown fox');

    const deleted = marksOf('deletion');
    const inserted = marksOf('insertion');
    // Word-level proposal: only the changed words are marked, so "fox" is neither deleted nor inserted.
    expect(deleted.map((d) => d.text).join('')).toBe('quickbrown');
    expect(inserted.map((i) => i.text).join('')).not.toContain('fox');

    for (const mark of [...deleted, ...inserted]) {
      expect(mark.attrs.aiGenerated).toBe(true);
      expect(mark.attrs.authorName).toBe('Ada (AI)');
      expect(mark.attrs.authorId).toBe(author.id);
    }

    const records = store.list();
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.status).toBe('pending');
      expect(record.aiGenerated).toBe(true);
      expect(record.note).toBe(AI_DISCLAIMER);
    }
    expect(listPendingRevisions(editor.pm.state).length).toBeGreaterThan(0);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ command: 'ai.rewriteSelection', status: 'proposed', userId: author.id, sectionId: null });
    expect(audits[0]!.revisionIds.length).toBeGreaterThan(0);

    // Nothing is applied until a person accepts: after acceptAll the new wording is the document text.
    expect(editor.pm.state.doc.textContent).not.toContain('A clearer fox sentence.');
    acceptAll(editor.pm.view, author.id);
    expect(editor.pm.state.doc.textContent).toContain('A clearer fox sentence.');
  });

  it('denies a section the user cannot edit without calling the provider', async () => {
    const provider = createMockProvider({ 'ai.rewriteSelection': { text: 'Changed.' } });
    const audits: AIAuditEntry[] = [];
    const layer = createAICommandLayer({
      provider,
      editor,
      author,
      getPolicyContext: uncontrolledOnly,
      onAudit: (e) => audits.push(e),
    });
    selectText('Locked wording');

    const result = await layer.run('ai.rewriteSelection');

    expect(result.status).toBe('denied');
    if (result.status === 'denied') expect(result.reason).toMatch(/section|permitted|edit|capabilit/i);
    expect(provider.calls).toHaveLength(0);
    expect(marksOf('insertion')).toHaveLength(0);
    expect(store.list()).toHaveLength(0);
    expect(audits[0]).toMatchObject({ status: 'denied', sectionId: 'sec-a' });
  });

  it('allows the same section once the user holds the grant', async () => {
    const provider = createMockProvider({ 'ai.rewriteSelection': { text: 'Settled wording.' } });
    const layer = createAICommandLayer({ provider, editor, author, getPolicyContext: allowEverything });
    selectText('Locked wording');

    const result = await layer.run('ai.rewriteSelection');

    expect(result.status).toBe('proposed');
    expect(result.status === 'proposed' && result.sectionId).toBe('sec-a');
    acceptAll(editor.pm.view, author.id);
    expect(editor.pm.state.doc.textContent).toContain('Settled wording.');
  });

  it('malformed output is an error and leaves the document unchanged', async () => {
    const errors: AICommandError[] = [];
    const layer = createAICommandLayer({
      provider: createMockProvider({
        'ai.rewriteSelection': { text: 'First line.\nSecond line.' },
        'ai.proposeProcedureSteps': { json: { steps: 'not an array' } },
      }),
      editor,
      author,
      getPolicyContext: allowEverything,
      onError: (e) => errors.push(e),
    });
    const before = snapshot();

    selectText('quick brown fox');
    const rewrite = await layer.run('ai.rewriteSelection');
    const steps = await layer.run('ai.proposeProcedureSteps', { goal: 'Clean the bench' });

    expect(rewrite).toMatchObject({ status: 'error', error: { code: 'malformed-output' } });
    expect(steps).toMatchObject({ status: 'error', error: { code: 'malformed-output' } });
    expect(errors.map((e) => e.code)).toEqual(['malformed-output', 'malformed-output']);
    expect(snapshot()).toBe(before);
    expect(store.list()).toHaveLength(0);
  });

  it('advisory commands return findings and do not change the document', async () => {
    const provider = createMockProvider({
      'ai.detectMissingReferences': {
        json: {
          findings: [
            { severity: 'warning', message: 'Claim has no reference', blockId: 'p1', suggestion: 'Cite a source' },
            { severity: 'info', message: 'Unknown block', blockId: 'ghost' },
          ],
        },
      },
    });
    const advisories: AIResult[] = [];
    const layer = createAICommandLayer({
      provider,
      editor,
      author,
      getPolicyContext: allowEverything,
      options: { terminology: ['Calibration'], approvedReferences: ['SOP-004'] },
      onAdvisory: (r) => advisories.push(r),
    });
    const before = snapshot();
    // Put a near-miss term and an unapproved reference into the document text.
    editor.pm.setSelection(editor.pm.createTextSelection(1));
    editor.pm.insertText(' Calibratoin per SOP-009.');
    const withText = snapshot();

    const result = await layer.run('ai.detectMissingReferences');

    expect(before).not.toBe(withText);
    expect(result.status).toBe('advisory');
    if (result.status !== 'advisory') throw new Error('expected advisory');
    expect(result.findings.find((f) => f.message === 'Claim has no reference')).toMatchObject({
      severity: 'warning',
      blockId: 'p1',
      suggestion: 'Cite a source',
      origin: 'model',
    });
    const unknown = result.findings.find((f) => f.message === 'Unknown block');
    expect(unknown?.blockId).toBeUndefined();
    expect(result.findings.some((f) => f.origin === 'terminology' && f.suggestion === 'Calibration')).toBe(true);
    expect(result.findings.some((f) => f.origin === 'reference' && f.message.includes('SOP-009'))).toBe(true);
    expect(advisories).toHaveLength(1);
    expect(marksOf('insertion')).toHaveLength(0);
    expect(store.list()).toHaveLength(0);
    expect(snapshot()).toBe(withText);
  });

  it('proposeProcedureSteps inserts tracked blocks after the cursor', async () => {
    const layer = createAICommandLayer({
      provider: createMockProvider({ 'ai.proposeProcedureSteps': { json: { steps: ['Put on gloves', 'Wipe the bench', 'Log the run'] } } }),
      editor,
      author,
      getPolicyContext: allowEverything,
    });
    selectText('quick brown fox');

    const result = await layer.run('ai.proposeProcedureSteps', { goal: 'Clean the bench', maxSteps: 5 });

    expect(result.status).toBe('proposed');
    const blocks = editor.getDocument();
    const list = blocks.find((b) => b.type === 'orderedList');
    expect(list?.children?.map((item) => item.type)).toEqual(['listItem', 'listItem', 'listItem']);
    const inserted = marksOf('insertion').map((m) => m.text).join(' ');
    expect(inserted).toContain('Put on gloves');
    expect(inserted).toContain('Log the run');
    expect(store.list().every((r) => r.aiGenerated === true && r.status === 'pending')).toBe(true);
    expect(blocks.indexOf(list!)).toBeGreaterThan(0);
  });

  it('generateTable inserts a tracked table', async () => {
    const layer = createAICommandLayer({
      provider: createMockProvider({
        'ai.generateTable': { json: { headers: ['Reagent', 'Volume'], rows: [['Ethanol', '70 mL']] } },
      }),
      editor,
      author,
      getPolicyContext: allowEverything,
    });
    selectText('quick brown fox');

    const result = await layer.run('ai.generateTable', { description: 'Reagent volumes' });

    expect(result.status).toBe('proposed');
    const table = editor.getDocument().find((b) => b.type === 'table');
    expect(table?.children).toHaveLength(2);
    expect(table?.children?.[0]?.children?.map((c) => c.type)).toEqual(['tableHeader', 'tableHeader']);
    expect(marksOf('insertion').map((m) => m.text).join('')).toContain('Ethanol');
  });

  it('a malformed table with a wrong row width is rejected', async () => {
    const layer = createAICommandLayer({
      provider: createMockProvider({ 'ai.generateTable': { json: { headers: ['A', 'B'], rows: [['only one']] } } }),
      editor,
      author,
      getPolicyContext: allowEverything,
    });
    const before = snapshot();
    selectText('quick brown fox');
    const result = await layer.run('ai.generateTable', { description: 'bad' });
    expect(result).toMatchObject({ status: 'error', error: { code: 'malformed-output' } });
    expect(snapshot()).toBe(before);
  });

  it('a section-scoped insertion is denied without the insert grant', async () => {
    const provider = createMockProvider({ 'ai.summarizeSection': { text: 'Short summary.' } });
    const layer = createAICommandLayer({ provider, editor, author, getPolicyContext: uncontrolledOnly });
    selectText('Locked wording');
    const result = await layer.run('ai.summarizeSection', { sectionId: 'sec-a' });
    expect(result.status).toBe('denied');
    expect(provider.calls).toHaveLength(0);
  });

  it('summarizeSection inserts tracked paragraphs for the document', async () => {
    const layer = createAICommandLayer({
      provider: createMockProvider({ 'ai.summarizeSection': { text: 'Summary sentence one.\n\nSummary sentence two.' } }),
      editor,
      author,
      getPolicyContext: allowEverything,
    });
    const result = await layer.run('ai.summarizeSection');
    expect(result.status).toBe('proposed');
    const text = marksOf('insertion').map((m) => m.text).join(' ');
    expect(text).toContain('Summary sentence two.');
  });

  it('cancel aborts an in-flight run and applies nothing', async () => {
    const provider = vi.fn(
      (_request: unknown, signal?: AbortSignal) =>
        new Promise<never>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    const layer = createAICommandLayer({ provider, editor, author, getPolicyContext: allowEverything });
    const before = snapshot();
    selectText('quick brown fox');
    const pending = layer.run('ai.rewriteSelection');
    layer.cancel();
    const result = await pending;
    expect(result.status).toBe('cancelled');
    expect(snapshot()).toBe(before);
    expect(store.list()).toHaveLength(0);
  });

  it('refuses to apply when the document changed while the provider was running', async () => {
    const provider = createMockProvider({
      'ai.rewriteSelection': () => {
        // Insert text before the selection, then select the same words at their new position.
        editor.pm.setSelection(editor.pm.createTextSelection(1));
        editor.pm.insertText('Extra. ');
        selectText('quick brown fox');
        return { text: 'Replacement.' };
      },
    });
    const layer = createAICommandLayer({ provider, editor, author, getPolicyContext: allowEverything });
    selectText('quick brown fox');
    const result = await layer.run('ai.rewriteSelection');
    expect(result).toMatchObject({ status: 'error', error: { code: 'stale-target' } });
    expect(marksOf('insertion')).toHaveLength(0);
  });

  it('re-checks the policy before dispatch, so a revoked grant blocks the apply', async () => {
    let granted = true;
    const provider = createMockProvider({
      'ai.rewriteSelection': () => {
        granted = false; // the grant is withdrawn while the provider is running
        return { text: 'Too late.' };
      },
    });
    const layer = createAICommandLayer({
      provider,
      editor,
      author,
      getPolicyContext: () => (granted ? uncontrolledOnly() : { ...uncontrolledOnly(), defaultGrants: [] }),
    });
    selectText('quick brown fox');
    const before = snapshot();

    const result = await layer.run('ai.rewriteSelection');

    expect(result.status).toBe('denied');
    expect(provider.calls).toHaveLength(1);
    expect(snapshot()).toBe(before);
    expect(store.list()).toHaveLength(0);
  });

  it('rejects unknown commands and invalid args before calling the provider', async () => {
    const provider = createMockProvider({});
    const layer = createAICommandLayer({ provider, editor, author, getPolicyContext: allowEverything });
    const unknown = await layer.run('ai.doesNotExist' as never);
    expect(unknown).toMatchObject({ status: 'error', error: { code: 'unknown-command' } });
    const badArgs = await layer.run('ai.proposeProcedureSteps', {});
    expect(badArgs).toMatchObject({ status: 'error', error: { code: 'invalid-args' } });
    expect(provider.calls).toHaveLength(0);
  });

  it('registers the ai commands and runs them through the registry', async () => {
    const registry = new CommandRegistry();
    registry.bind(editor);
    const proposals: AIResult[] = [];
    const audits: AIAuditEntry[] = [];
    const layer = createAICommandLayer({
      provider: createMockProvider({ 'ai.rewriteSelection': { text: 'Registry rewrite.' } }),
      editor,
      registry,
      author,
      getPolicyContext: allowEverything,
      onProposal: (r) => proposals.push(r),
      onAudit: (e) => audits.push(e),
    });

    expect(registry.list('AI')).toHaveLength(9);
    expect(registry.get('ai.rewriteSelection')?.operation).toBe('replaceText');
    expect(registry.get('ai.detectMissingReferences')?.operation).toBeUndefined();

    selectText('quick brown fox');
    expect(registry.execute('ai.rewriteSelection')).toBe(true);
    await vi.waitFor(() => expect(proposals).toHaveLength(1));
    expect(audits[0]?.command).toBe('ai.rewriteSelection');
    acceptAll(editor.pm.view, author.id);
    expect(editor.pm.state.doc.textContent).toContain('Registry rewrite.');

    layer.dispose();
    expect(registry.get('ai.rewriteSelection')).toBeUndefined();
  });
});
