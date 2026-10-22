import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import type { Transaction } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { createSchema } from '@amusendame/beakblock-core';

import { createControlledSectionPlugin } from './plugin';
import { createQmsCommands } from './commands';
import type { QmsCommandDefinition } from './commands';
import { QMS_NODE_SPECS } from './nodes';

const schema = createSchema(QMS_NODE_SPECS);

function makeEditor(doc: PMNode) {
  const plugins = [createControlledSectionPlugin()];
  let state = EditorState.create({ doc, schema, plugins });
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 2)));
  const dispatched: Transaction[] = [];
  return {
    pm: {
      get state() {
        return state;
      },
      dispatch(tr: Transaction) {
        dispatched.push(tr);
        state = state.apply(tr);
      },
    },
    dispatched,
  };
}

function findAll(doc: PMNode, typeName: string): PMNode[] {
  const out: PMNode[] = [];
  doc.descendants((n) => {
    if (n.type.name === typeName) out.push(n);
    return true;
  });
  return out;
}

function command(id: string): QmsCommandDefinition {
  const found = createQmsCommands().find((c) => c.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function baseDoc(): PMNode {
  return schema.node('doc', null, [
    schema.nodes.controlledSection!.create(
      { id: 's-blk', sectionId: 'S1', title: 'Scope', workflowState: 'draft', allowedBlocks: null },
      [schema.nodes.paragraph!.create({ id: 'p1' }, schema.text('Text'))]
    ),
  ]);
}

describe('QMS commands', () => {
  it('exposes the six documented command ids in the QMS group', () => {
    const ids = createQmsCommands().map((c) => c.id);
    expect(ids).toEqual([
      'qms.insertSection',
      'qms.submitSection',
      'qms.lockSection',
      'qms.insertSignature',
      'qms.insertNotice',
      'qms.insertRevisionHistory',
    ]);
    expect(createQmsCommands().every((c) => c.group === 'QMS')).toBe(true);
  });

  it('qms.insertSection inserts a controlled section with the given attributes', () => {
    const editor = makeEditor(baseDoc());
    const ok = command('qms.insertSection').run({
      editor,
      args: { title: 'Procedure', sectionId: 'S2', required: true, allowedBlocks: ['paragraph'], ownerName: 'Ann' },
    });
    expect(ok).toBe(true);
    const sections = findAll(editor.pm.state.doc, 'controlledSection');
    expect(sections.map((s) => s.attrs.sectionId)).toEqual(['S1', 'S2']);
    const created = sections[1]!;
    expect(created.attrs.required).toBe(true);
    expect(created.attrs.allowedBlocks).toEqual(['paragraph']);
    expect(created.attrs.workflowState).toBe('draft');
  });

  it('qms.submitSection moves a draft section to submitted through the workflow meta', () => {
    const editor = makeEditor(baseDoc());
    expect(command('qms.submitSection').isEnabled!({ editor })).toBe(true);
    expect(command('qms.submitSection').run({ editor })).toBe(true);
    expect(editor.pm.state.doc.child(0).attrs.workflowState).toBe('submitted');
    expect(command('qms.submitSection').isEnabled!({ editor })).toBe(false);
  });

  it('qms.lockSection toggles the presentation lock', () => {
    const editor = makeEditor(baseDoc());
    command('qms.lockSection').run({ editor });
    expect(editor.pm.state.doc.child(0).attrs.locked).toBe(true);
    expect(command('qms.lockSection').isActive!({ editor })).toBe(true);
    command('qms.lockSection').run({ editor });
    expect(editor.pm.state.doc.child(0).attrs.locked).toBe(false);
  });

  it('qms.insertSignature inserts an unsigned placeholder', () => {
    const editor = makeEditor(baseDoc());
    expect(command('qms.insertSignature').run({ editor, args: { role: 'Reviewer', meaning: 'reviewed' } })).toBe(true);
    const [found] = findAll(editor.pm.state.doc, 'signatureBlock');
    expect(found).toBeDefined();
    expect(found!.attrs.role).toBe('Reviewer');
    expect(found!.attrs.signatureId).toBeNull();
    expect(found!.attrs.contentHash).toBeNull();
  });

  it('qms.insertNotice sets a copy number only for controlled copies', () => {
    const editor = makeEditor(baseDoc());
    command('qms.insertNotice').run({ editor, args: { kind: 'controlledCopy', copyNumber: 3 } });
    const [notice] = findAll(editor.pm.state.doc, 'controlledNotice');
    expect(notice).toBeDefined();
    expect(notice.attrs.copyNumber).toBe(3);
    expect(command('qms.insertNotice').run({ editor, args: { kind: 'nonsense' as never } })).toBe(false);
  });

  it('qms.insertRevisionHistory inserts a revisionHistory with entries', () => {
    const editor = makeEditor(baseDoc());
    command('qms.insertRevisionHistory').run({
      editor,
      args: { entries: [{ revision: '1', date: '2026-01-01', author: 'Ann', description: 'Initial' }] },
    });
    const [node] = findAll(editor.pm.state.doc, 'revisionHistory');
    expect((node!.attrs.entries as unknown[]).length).toBe(1);
  });
});
