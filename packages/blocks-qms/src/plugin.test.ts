import { describe, expect, it, vi } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import type { Transaction } from 'prosemirror-state';
import type { Node as PMNode, Schema } from 'prosemirror-model';
import type { PolicyContext, PolicyDecision } from '@amusendame/beakblock-permissions';
import { BEAKBLOCK_META_LOAD_DOCUMENT, createSchema } from '@amusendame/beakblock-core';

import { createControlledSectionPlugin, CONTROLLED_SECTION_PLUGIN_KEY } from './plugin';
import { QMS_NODE_SPECS } from './nodes';
import { QMS_SERVICE_META, QMS_WORKFLOW_META, SIGNATURE_SERVICE_META } from './types';

const schema: Schema = createSchema(QMS_NODE_SPECS);

function para(id: string, text = ''): PMNode {
  return schema.nodes.paragraph!.create({ id }, text ? schema.text(text) : undefined);
}

function section(sectionId: string, attrs: Record<string, unknown>, children: PMNode[]): PMNode {
  return schema.nodes.controlledSection!.create(
    {
      id: `blk-${sectionId}`,
      sectionId,
      templateSectionId: null,
      policyRef: null,
      required: false,
      allowedBlocks: null,
      title: sectionId,
      ownerName: null,
      workflowState: 'draft',
      locked: false,
      ...attrs,
    },
    children
  );
}

function signature(id: string, attrs: Record<string, unknown> = {}): PMNode {
  return schema.nodes.signatureBlock!.create({
    id,
    role: 'Approver',
    signerName: null,
    signedAt: null,
    meaning: 'approved',
    contentHash: null,
    signatureId: null,
    ...attrs,
  });
}

/** Document: section A (required, allows paragraphs), section B (open), then a placeholder signature. */
function buildDoc(): PMNode {
  return schema.node('doc', null, [
    section('A', { required: true, allowedBlocks: ['paragraph'], ownerName: 'Ann' }, [para('pa', 'alpha')]),
    section('B', { ownerName: 'Ben' }, [para('pb', 'beta')]),
    signature('sig-1'),
  ]);
}

function stateFor(options: Parameters<typeof createControlledSectionPlugin>[0] = {}, doc = buildDoc()): EditorState {
  return EditorState.create({ doc, schema, plugins: [createControlledSectionPlugin(options)] });
}

/** Position just inside the start of the section with the given sectionId. */
function innerStart(doc: PMNode, sectionId: string): number {
  let found = -1;
  doc.descendants((node, pos) => {
    if (found < 0 && node.type.name === 'controlledSection' && node.attrs.sectionId === sectionId) {
      found = pos + 1;
    }
    return found < 0;
  });
  if (found < 0) throw new Error(`no section ${sectionId}`);
  return found;
}

function sectionPos(doc: PMNode, sectionId: string): number {
  return innerStart(doc, sectionId) - 1;
}

function apply(state: EditorState, build: (tr: Transaction) => Transaction): EditorState {
  return state.apply(build(state.tr));
}

describe('controlled section plugin: trusted document load', () => {
  it('allows a trusted load to contain an already signed signature block', () => {
    const onDenied = vi.fn();
    const state = stateFor({ onDenied });
    const signed = signature('sig-9', { signatureId: 'sign-1', signedAt: '2026-01-01T00:00:00Z', contentHash: 'abc' });
    const loaded = schema.node('doc', null, [section('A', { allowedBlocks: ['paragraph'] }, [para('pa', 'alpha')]), signed]);
    const next = apply(state, (tr) =>
      tr.replaceWith(0, state.doc.content.size, loaded.content).setMeta(BEAKBLOCK_META_LOAD_DOCUMENT, true)
    );
    expect(onDenied).not.toHaveBeenCalled();
    expect(next.doc.lastChild!.attrs.signatureId).toBe('sign-1');
  });
});

describe('controlled section plugin: signed blocks on document load', () => {
  it('rejects a signed signature block that arrives with a document load', () => {
    const onDenied = vi.fn();
    const state = stateFor({ onDenied });
    const signed = signature('sig-9', { signatureId: 'sign-1', signedAt: '2026-01-01T00:00:00Z', contentHash: 'abc' });
    const loaded = schema.node('doc', null, [section('A', { allowedBlocks: ['paragraph'] }, [para('pa', 'alpha')]), signed]);
    const next = apply(state, (tr) => tr.replaceWith(0, state.doc.content.size, loaded.content));
    expect(next).toBe(state);
    expect(onDenied).toHaveBeenCalledTimes(1);
  });
});

describe('controlled section plugin: allowedBlocks', () => {
  it('rejects inserting a block type the section does not allow', () => {
    const onDenied = vi.fn();
    const state = stateFor({ onDenied });
    const next = apply(state, (tr) => tr.insert(innerStart(state.doc, 'A'), schema.nodes.heading!.create({ id: 'h1', level: 2 }, schema.text('Nope'))));
    expect(next).toBe(state);
    expect(onDenied).toHaveBeenCalledTimes(1);
    const decisions = onDenied.mock.calls[0]![0] as PolicyDecision[];
    expect(decisions[0]!.allowed).toBe(false);
    expect(decisions[0]!.reason).toContain('heading');
  });

  it('never refuses silently: without onDenied it logs the reason', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const state = stateFor();
      const next = apply(state, (tr) => tr.insert(innerStart(state.doc, 'A'), schema.nodes.heading!.create({ id: 'h2', level: 2 }, schema.text('Nope'))));
      expect(next).toBe(state);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('heading');
    } finally {
      warn.mockRestore();
    }
  });

  it('accepts allowed block types in the same section', () => {
    const state = stateFor();
    const next = apply(state, (tr) => tr.insert(innerStart(state.doc, 'A'), para('pnew', 'gamma')));
    expect(next).not.toBe(state);
    expect(next.doc.child(0).childCount).toBe(2);
  });

  it('accepts any block type when allowedBlocks is null', () => {
    const state = stateFor();
    const next = apply(state, (tr) => tr.insert(innerStart(state.doc, 'B'), schema.nodes.heading!.create({ id: 'h2', level: 1 })));
    expect(next).not.toBe(state);
  });

  it('can be disabled with enforceAllowedBlocks: false', () => {
    const state = stateFor({ enforceAllowedBlocks: false });
    const next = apply(state, (tr) => tr.insert(innerStart(state.doc, 'A'), schema.nodes.heading!.create({ id: 'h3', level: 2 })));
    expect(next).not.toBe(state);
  });

  it('rejects a wrapping step that puts a disallowed node inside a section', () => {
    const doc = schema.node('doc', null, [section('A', { allowedBlocks: ['paragraph'] }, [para('pa', 'x')])]);
    const state = stateFor({}, doc);
    const range = { from: 2, to: 2 + doc.child(0).firstChild!.nodeSize - 2 };
    const next = apply(state, (tr) => tr.setBlockType(range.from, range.to, schema.nodes.heading!, { level: 1 }));
    expect(next).toBe(state);
  });
});

describe('controlled section plugin: required sections and protected attributes', () => {
  it('rejects deleting a required section', () => {
    const state = stateFor();
    const next = apply(state, (tr) => tr.delete(sectionPos(state.doc, 'A'), sectionPos(state.doc, 'A') + state.doc.child(0).nodeSize));
    expect(next).toBe(state);
  });

  it('allows deleting an optional section', () => {
    const state = stateFor();
    const pos = sectionPos(state.doc, 'B');
    const next = apply(state, (tr) => tr.delete(pos, pos + state.doc.child(1).nodeSize));
    expect(next).not.toBe(state);
    expect(next.doc.childCount).toBe(2);
  });

  it('allows the QMS service to delete a required section', () => {
    const state = stateFor();
    const pos = sectionPos(state.doc, 'A');
    const next = apply(state, (tr) =>
      tr.delete(pos, pos + state.doc.child(0).nodeSize).setMeta(QMS_SERVICE_META, true)
    );
    expect(next).not.toBe(state);
  });

  it('rejects a user change to a protected attribute such as ownerName or required', () => {
    const state = stateFor();
    const pos = sectionPos(state.doc, 'B');
    const attrs = state.doc.child(1).attrs;
    expect(apply(state, (tr) => tr.setNodeMarkup(pos, undefined, { ...attrs, ownerName: 'Mallory' }))).toBe(state);
    const a = sectionPos(state.doc, 'A');
    const attrsA = state.doc.child(0).attrs;
    expect(apply(state, (tr) => tr.setNodeMarkup(a, undefined, { ...attrsA, required: false }))).toBe(state);
  });

  it('rejects a workflowState change without the workflow meta, but allows it with the meta', () => {
    const state = stateFor();
    const pos = sectionPos(state.doc, 'B');
    const attrs = state.doc.child(1).attrs;
    const change = (tr: Transaction) => tr.setNodeMarkup(pos, undefined, { ...attrs, workflowState: 'approved' });
    expect(apply(state, change)).toBe(state);
    expect(apply(state, (tr) => change(tr).setMeta(QMS_WORKFLOW_META, true))).not.toBe(state);
    expect(apply(state, (tr) => change(tr).setMeta(QMS_SERVICE_META, true))).not.toBe(state);
  });

  it('allows a user to change the presentation lock and the title', () => {
    const state = stateFor();
    const pos = sectionPos(state.doc, 'B');
    const attrs = state.doc.child(1).attrs;
    expect(apply(state, (tr) => tr.setNodeMarkup(pos, undefined, { ...attrs, locked: true }))).not.toBe(state);
    expect(apply(state, (tr) => tr.setNodeMarkup(pos, undefined, { ...attrs, title: 'Renamed' }))).not.toBe(state);
  });
});

describe('controlled section plugin: signature blocks', () => {
  it('rejects changing a signature block attribute', () => {
    const state = stateFor();
    let sigPos = -1;
    state.doc.descendants((n, p) => {
      if (n.type.name === 'signatureBlock') sigPos = p;
      return true;
    });
    const attrs = state.doc.nodeAt(sigPos)!.attrs;
    const next = apply(state, (tr) => tr.setNodeMarkup(sigPos, undefined, { ...attrs, signerName: 'Forged', signedAt: '2026-01-01', contentHash: 'abc', signatureId: 'x' }));
    expect(next).toBe(state);
  });

  it('allows the signature service to change a signature block', () => {
    const state = stateFor();
    let sigPos = -1;
    state.doc.descendants((n, p) => {
      if (n.type.name === 'signatureBlock') sigPos = p;
      return true;
    });
    const attrs = state.doc.nodeAt(sigPos)!.attrs;
    const next = apply(state, (tr) =>
      tr
        .setNodeMarkup(sigPos, undefined, { ...attrs, signerName: 'Ann', signedAt: '2026-01-01', contentHash: 'abc', signatureId: 'sig-x' })
        .setMeta(SIGNATURE_SERVICE_META, true)
    );
    expect(next).not.toBe(state);
  });

  it('rejects the QMS service meta as a way to sign (only the signature meta counts)', () => {
    const state = stateFor();
    let sigPos = -1;
    state.doc.descendants((n, p) => {
      if (n.type.name === 'signatureBlock') sigPos = p;
      return true;
    });
    const attrs = state.doc.nodeAt(sigPos)!.attrs;
    const next = apply(state, (tr) =>
      tr.setNodeMarkup(sigPos, undefined, { ...attrs, signatureId: 'sig-y' }).setMeta(QMS_SERVICE_META, true)
    );
    expect(next).toBe(state);
  });

  it('allows inserting an unsigned placeholder but rejects inserting a pre-signed block', () => {
    const state = stateFor();
    const end = state.doc.content.size;
    expect(apply(state, (tr) => tr.insert(end, signature('sig-2'))).doc.childCount).toBe(4);
    const forged = apply(state, (tr) => tr.insert(end, signature('sig-3', { signatureId: 'fake', signedAt: 'now', contentHash: 'h' })));
    expect(forged).toBe(state);
  });

  it('rejects deleting a signed signature block', () => {
    const state = stateFor();
    let sigPos = -1;
    state.doc.descendants((n, p) => {
      if (n.type.name === 'signatureBlock') sigPos = p;
      return true;
    });
    const signed = schema.nodes.signatureBlock!.create({ ...state.doc.nodeAt(sigPos)!.attrs, signatureId: 's', signedAt: 'now', contentHash: 'h' });
    const doc = schema.node('doc', null, [section('A', {}, [para('pa')]), signed]);
    const s2 = stateFor({}, doc);
    const next = apply(s2, (tr) => tr.delete(s2.doc.child(0).nodeSize, s2.doc.content.size));
    expect(next).toBe(s2);
  });
});

describe('controlled section plugin: permission composition', () => {
  const ctx: PolicyContext = {
    userId: 'ann',
    roles: ['author'],
    sectionGrants: { A: ['section.editText', 'section.insertBlock', 'section.deleteBlock'] },
  };

  it('lets an author edit their own section and rejects edits in another section', () => {
    const state = stateFor({ getPolicyContext: () => ctx });
    const own = apply(state, (tr) => tr.insert(innerStart(state.doc, 'A'), para('pn1', 'ok')));
    expect(own).not.toBe(state);
    const other = apply(state, (tr) => tr.insert(innerStart(state.doc, 'B'), para('pn2', 'no')));
    expect(other).toBe(state);
  });

  it('rejects edits to a locked section even when granted', () => {
    const state = stateFor({ getPolicyContext: () => ({ ...ctx, lockedSections: ['A'] }) });
    expect(apply(state, (tr) => tr.insert(innerStart(state.doc, 'A'), para('pn3', 'no')))).toBe(state);
  });

  it('decorates sections the principal cannot edit as read-only', () => {
    const plugin = createControlledSectionPlugin({ getPolicyContext: () => ctx });
    const state = EditorState.create({ doc: buildDoc(), schema, plugins: [plugin] });
    const decorations = plugin.props.decorations!.call(plugin, state);
    expect(decorations).toBeDefined();
    const found = (decorations as import('prosemirror-view').DecorationSet).find();
    const attrsBySection = new Map<number, Record<string, string | undefined>>();
    for (const d of found) attrsBySection.set(d.from, (d as unknown as { type: { attrs: Record<string, string> } }).type.attrs);
    const aPos = sectionPos(state.doc, 'A');
    const bPos = sectionPos(state.doc, 'B');
    expect(attrsBySection.get(aPos)?.['data-editable']).toBe('true');
    expect(attrsBySection.get(bPos)?.['data-editable']).toBe('false');
    expect(attrsBySection.get(bPos)?.contenteditable).toBe('false');
  });

  it('exposes the plugin key', () => {
    expect(CONTROLLED_SECTION_PLUGIN_KEY).toBeDefined();
  });
});

describe('controlled section plugin: selection safety', () => {
  it('a text selection inside an allowed section can still be typed into', () => {
    const state = stateFor();
    const pos = innerStart(state.doc, 'A') + 1;
    const withSel = state.apply(state.tr.setSelection(TextSelection.create(state.doc, pos)));
    const next = withSel.apply(withSel.tr.insertText('z', pos));
    expect(next).not.toBe(withSel);
  });
});
