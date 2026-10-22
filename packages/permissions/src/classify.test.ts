/**
 * @module
 */

import { describe, expect, it } from 'vitest';
import { EditorState } from 'prosemirror-state';

import { classifyTransaction } from './classify';
import { docOf, para, paraPos, posOf, schema, section, sectionPos } from './testing';

function stateOf(
  doc = docOf(section('s1', 'S1', [para('p1', 'alpha'), para('p0', 'keep')]), section('s2', 'S2', [para('p2', 'beta')]))
) {
  return EditorState.create({ doc, schema });
}

describe('classifyTransaction', () => {
  it('classifies text insertion inside a textblock as replaceText in the owning section', () => {
    const state = stateOf();
    const pos = paraPos(state.doc, 'p1') + 1;
    const ops = classifyTransaction(state.tr.insertText('X', pos));
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: 'replaceText', sectionId: 'S1', blockId: 'p1' });
  });

  it('classifies mark changes as formatText', () => {
    const state = stateOf();
    const start = paraPos(state.doc, 'p1') + 1;
    const tr = state.tr.addMark(start, start + 3, schema.marks.bold!.create());
    expect(classifyTransaction(tr)).toEqual([expect.objectContaining({ kind: 'formatText', sectionId: 'S1' })]);
  });

  it('classifies removing a whole controlled section as deleteSection with its required flag', () => {
    const doc = docOf(section('s1', 'S1', [para('p1', 'a')], { required: true }), section('s2', 'S2', [para('p2', 'b')]));
    const state = stateOf(doc);
    const pos = sectionPos(state.doc, 'S1');
    const ops = classifyTransaction(state.tr.delete(pos, pos + state.doc.child(0).nodeSize));
    expect(ops).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'deleteSection',
          sectionId: 'S1',
          details: expect.objectContaining({ required: true }),
        }),
      ])
    );
    // Nested blocks are checked against their own section too.
    expect(ops).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'deleteBlock', sectionId: 'S1', blockId: 'p1' })]));
  });

  it('classifies a title attribute change as renameSection and other attributes as editAttrs', () => {
    const state = stateOf();
    const pos = sectionPos(state.doc, 'S1');
    const renamed = classifyTransaction(state.tr.setNodeAttribute(pos, 'title', 'New title'));
    expect(renamed).toEqual([expect.objectContaining({ kind: 'renameSection', sectionId: 'S1' })]);

    const protectedAttr = classifyTransaction(state.tr.setNodeAttribute(pos, 'required', true));
    expect(protectedAttr).toEqual([
      expect.objectContaining({ kind: 'editAttrs', sectionId: 'S1', details: expect.objectContaining({ protected: true }) }),
    ]);
  });

  it('classifies a style change on a section as changeStyle', () => {
    const state = stateOf();
    const pos = sectionPos(state.doc, 'S1');
    expect(classifyTransaction(state.tr.setNodeAttribute(pos, 'styleId', 'Heading1'))).toEqual([
      expect.objectContaining({ kind: 'changeStyle', sectionId: 'S1' }),
    ]);
  });

  it('classifies inserting a block into a section as insertBlock', () => {
    const state = stateOf();
    const pos = paraPos(state.doc, 'p1') + 1 + 'alpha'.length + 1;
    const tr = state.tr.insert(pos, para('p9', 'new'));
    const ops = classifyTransaction(tr);
    expect(ops).toEqual([expect.objectContaining({ kind: 'insertBlock', sectionId: 'S1', blockId: 'p9' })]);
  });

  it('emits one operation per section for a range spanning two sections', () => {
    const state = stateOf();
    const from = paraPos(state.doc, 'p1') + 1;
    const to = paraPos(state.doc, 'p2') + 2;
    const ops = classifyTransaction(state.tr.addMark(from, to, schema.marks.italic!.create()));
    const sections = [...new Set(ops.map((o) => o.sectionId))].sort();
    expect(sections).toEqual(['S1', 'S2']);
  });

  it('pairs a removal and insertion of the same block across sections into moveBlock out and in', () => {
    const state = stateOf();
    const p1Pos = paraPos(state.doc, 'p1');
    const p1 = state.doc.nodeAt(p1Pos)!;
    const tr = state.tr.delete(p1Pos, p1Pos + p1.nodeSize);
    const s2 = sectionPos(tr.doc, 'S2');
    tr.insert(s2 + tr.doc.nodeAt(s2)!.nodeSize - 1, p1);
    const ops = classifyTransaction(tr);
    expect(ops).toEqual([
      expect.objectContaining({ kind: 'moveBlock', sectionId: 'S1', blockId: 'p1', details: expect.objectContaining({ direction: 'out', fromSection: 'S1', toSection: 'S2' }) }),
      expect.objectContaining({ kind: 'moveBlock', sectionId: 'S2', blockId: 'p1', details: expect.objectContaining({ direction: 'in', fromSection: 'S1', toSection: 'S2' }) }),
    ]);
  });

  it('classifies table cell text as updateTableCell and row insertion as changeTableStructure', () => {
    const table = schema.nodes.table!.create({ id: 't1' }, [
      schema.nodes.tableRow!.create({ id: 'r1' }, [
        schema.nodes.tableCell!.create({ id: 'c1' }, para('cp1', 'cell')),
      ]),
    ]);
    const doc = docOf(section('s1', 'S1', [table]));
    const state = EditorState.create({ doc, schema });
    const cellTextPos = paraPos(state.doc, 'cp1') + 1;
    expect(classifyTransaction(state.tr.insertText('!', cellTextPos))).toEqual([
      expect.objectContaining({ kind: 'updateTableCell', sectionId: 'S1', blockId: 'cp1' }),
    ]);

    const tablePos = posOf(state.doc, (n) => n.type.name === 'table');
    const tableNode = state.doc.nodeAt(tablePos)!;
    const row = schema.nodes.tableRow!.create({ id: 'r2' }, [schema.nodes.tableCell!.create({ id: 'c2' }, para('cp2'))]);
    const insertAt = tablePos + tableNode.nodeSize - 1;
    expect(classifyTransaction(state.tr.insert(insertAt, row))).toEqual([
      expect.objectContaining({ kind: 'changeTableStructure', sectionId: 'S1', blockId: 'r2' }),
    ]);
  });

  it('emits nothing for a transaction with no steps', () => {
    expect(classifyTransaction(stateOf().tr)).toEqual([]);
  });
});
