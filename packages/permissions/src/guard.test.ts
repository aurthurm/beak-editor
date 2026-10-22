/**
 * @module
 */

import { describe, expect, it, vi } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { BEAKBLOCK_META_LOAD_DOCUMENT } from '@amusendame/beakblock-core';

import { createPermissionGuardPlugin, PERMISSION_GUARD_PLUGIN_KEY } from './guard';
import { docOf, para, paraPos, schema, section, signature } from './testing';
import type { PolicyContext, PolicyDecision } from './types';

const doc = () =>
  docOf(section('s1', 'S1', [para('p1', 'alpha'), para('p0', 'keep')]), section('s2', 'S2', [para('p2', 'beta')]));

function makeState(ctx: PolicyContext, onDenied?: (d: PolicyDecision[]) => void) {
  const plugin = createPermissionGuardPlugin({
    getContext: () => ctx,
    onDenied: onDenied ? (d) => onDenied(d) : undefined,
  });
  return EditorState.create({ doc: doc(), schema, plugins: [plugin] });
}

const editor: PolicyContext = {
  userId: 'u1',
  roles: ['author'],
  sectionGrants: { S1: ['section.editText'], S2: ['section.editText'] },
};

describe('createPermissionGuardPlugin', () => {
  it('allows a transaction the policy permits', () => {
    const state = makeState(editor);
    const pos = paraPos(state.doc, 'p1') + 1;
    const next = state.apply(state.tr.insertText('X', pos));
    expect(next.doc.textContent).toContain('Xalpha');
    expect(PERMISSION_GUARD_PLUGIN_KEY.get(next)).toBeDefined();
  });

  it('rejects a transaction the policy denies and reports decisions', () => {
    const denied: PolicyDecision[][] = [];
    const ctx = { ...editor, sectionGrants: { S2: ['section.editText'] } as PolicyContext['sectionGrants'] };
    const state = makeState(ctx, (d) => denied.push(d));
    const pos = paraPos(state.doc, 'p1') + 1;
    const next = state.apply(state.tr.insertText('X', pos));
    expect(next).toBe(state);
    expect(denied).toHaveLength(1);
    expect(denied[0]?.some((d) => !d.allowed && d.operation.sectionId === 'S1')).toBe(true);
  });

  it('never refuses silently: without onDenied it logs the denied operation and reason', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const ctx = { ...editor, sectionGrants: { S2: ['section.editText'] } as PolicyContext['sectionGrants'] };
      const state = makeState(ctx);
      const next = state.apply(state.tr.insertText('X', paraPos(state.doc, 'p1') + 1));
      expect(next).toBe(state);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('section "S1"');
    } finally {
      warn.mockRestore();
    }
  });

  it('rejects a locked section atomically, even when the rest of the transaction is allowed', () => {
    const ctx = { ...editor, lockedSections: ['S1'] };
    const state = makeState(ctx);
    const tr = state.tr;
    tr.insertText('X', paraPos(state.doc, 'p2') + 1);
    tr.insertText('Y', paraPos(state.doc, 'p1') + 1);
    const next = state.apply(tr);
    expect(next).toBe(state);
    expect(next.doc.textContent).toBe('alphakeepbeta');
  });

  it('rejects a drag that moves content from an allowed section into one without insert rights', () => {
    const ctx: PolicyContext = {
      userId: 'u1',
      roles: ['author'],
      sectionGrants: {
        S1: ['section.editText', 'section.move', 'section.moveContentOut', 'section.deleteBlock', 'section.insertBlock'],
        S2: ['section.editText'],
      },
    };
    const state = makeState(ctx);
    const p1Pos = paraPos(state.doc, 'p1');
    const p1 = state.doc.nodeAt(p1Pos)!;
    const tr = state.tr.delete(p1Pos, p1Pos + p1.nodeSize);
    // Insert before the first block of S2 (inside the section, before its paragraph).
    tr.insert(tr.mapping.map(state.doc.child(0).nodeSize + 1), p1);
    const next = state.apply(tr);
    expect(next).toBe(state);
  });

  it('allows the bypass meta only for the system role', () => {
    const user = makeState({ ...editor, sectionGrants: {}, roles: ['author'] });
    const tr = user.tr.insertText('X', paraPos(user.doc, 'p1') + 1).setMeta('beakblock-permissions-bypass', true);
    expect(user.apply(tr)).toBe(user);

    const system = makeState({ ...editor, sectionGrants: {}, roles: ['system'] });
    const sysTr = system.tr.insertText('X', paraPos(system.doc, 'p1') + 1).setMeta('beakblock-permissions-bypass', true);
    expect(system.apply(sysTr).doc.textContent).toContain('X');
  });

  it('ignores transactions that do not change the document', () => {
    const state = makeState({ ...editor, sectionGrants: {} });
    const tr = state.tr.setSelection(TextSelection.near(state.doc.resolve(3)));
    expect(state.apply(tr).selection.from).toBe(3);
  });

  describe('service-owned nodes', () => {
    const signedDoc = () =>
      docOf(section('s1', 'S1', [para('p1', 'alpha'), signature('sig1')]), section('s2', 'S2', [para('p2', 'beta')]));

    function stateWith(ctx: PolicyContext, documentNode = signedDoc()) {
      const plugin = createPermissionGuardPlugin({ getContext: () => ctx });
      return EditorState.create({ doc: documentNode, schema, plugins: [plugin] });
    }

    function signaturePos(state: EditorState): number {
      let found = -1;
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'signatureBlock') found = pos;
        return found === -1;
      });
      return found;
    }

    it('rejects a change to a signed block for an author, even with the section granted', () => {
      const state = stateWith(editor);
      const pos = signaturePos(state);
      const tr = state.tr.setNodeMarkup(pos, undefined, { ...state.doc.nodeAt(pos)!.attrs, signerName: 'Forger' });
      expect(state.apply(tr)).toBe(state);
    });

    const fullGrants: PolicyContext = {
      ...editor,
      sectionGrants: { S1: ['section.editText', 'section.insertBlock', 'section.deleteBlock'], S2: ['section.editText'] },
    };

    it('rejects inserting a pre-signed signature block for an author with insert rights', () => {
      const state = stateWith(fullGrants);
      const tr = state.tr.insert(paraPos(state.doc, 'p1') + 5, signature('sig-new'));
      expect(state.apply(tr)).toBe(state);
    });

    it('rejects deleting a signed block for an author with delete rights', () => {
      const state = stateWith(fullGrants);
      const pos = signaturePos(state);
      const tr = state.tr.delete(pos, pos + state.doc.nodeAt(pos)!.nodeSize);
      expect(state.apply(tr)).toBe(state);
    });

    it('still lets an author edit ordinary text next to a signed block', () => {
      const state = stateWith(editor);
      const next = state.apply(state.tr.insertText('X', paraPos(state.doc, 'p1') + 1));
      expect(next.doc.textContent).toContain('Xalpha');
    });

    it('lets the system role change a signed block', () => {
      const system: PolicyContext = { userId: 'signature-service', roles: ['system'], sectionGrants: {} };
      const state = stateWith(system);
      const pos = signaturePos(state);
      const tr = state.tr.setNodeMarkup(pos, undefined, { ...state.doc.nodeAt(pos)!.attrs, signerName: 'Signature service' });
      expect(state.apply(tr).doc.nodeAt(pos)!.attrs.signerName).toBe('Signature service');
    });
  });
});

describe('createPermissionGuardPlugin: trusted document load', () => {
  it('lets a trusted load replace the document with a signed signature block', () => {
    const denied: PolicyDecision[][] = [];
    const state = makeState({ userId: 'u2', roles: [], sectionGrants: {} }, (d) => denied.push(d));
    const loaded = docOf(section('s1', 'S1', [para('p1', 'alpha')]), signature('sig-1'));
    const tr = state.tr.replaceWith(0, state.doc.content.size, loaded.content).setMeta(BEAKBLOCK_META_LOAD_DOCUMENT, true);
    const next = state.apply(tr);
    expect(denied).toHaveLength(0);
    expect(next.doc.lastChild!.type.name).toBe('signatureBlock');
  });

  it('still denies the same replacement without the trusted-load meta', () => {
    const denied: PolicyDecision[][] = [];
    const state = makeState({ userId: 'u2', roles: [], sectionGrants: {} }, (d) => denied.push(d));
    const loaded = docOf(section('s1', 'S1', [para('p1', 'alpha')]), signature('sig-1'));
    const next = state.apply(state.tr.replaceWith(0, state.doc.content.size, loaded.content));
    expect(next).toBe(state);
    expect(denied).toHaveLength(1);
  });
});
