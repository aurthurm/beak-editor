import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import {
  createRevisionTrackingPlugin,
  getReviewState,
  isTrackChangesEnabled,
  setTrackChangesEnabledTransaction,
  REVIEW_META_SKIP,
} from './trackChanges';
import { InMemoryRevisionStore } from './store';
import { listPendingRevisions, rejectRevision, acceptRevision } from './operations';
import { docFrom, endOf, para, rangeOf, createView, marksOn, testSchema } from './testing/helpers';

const alice = { id: 'alice', name: 'Alice' };

function setup(enabled = true) {
  const store = new InMemoryRevisionStore();
  const plugin = createRevisionTrackingPlugin({ enabled, author: alice, store });
  const doc = docFrom([para('p1', 'hello world'), para('p2', 'second paragraph')]);
  const view = createView(doc, [plugin]);
  return { view, store };
}

describe('durable track changes', () => {
  it('marks inserted text with an insertion mark and records it', () => {
    const { view, store } = setup();
    const pos = endOf(view.state.doc, 'hello');
    view.dispatch(view.state.tr.insertText(' big', pos));

    expect(view.state.doc.textContent).toContain('hello big world');
    // The diff is character-granular, so the shared space before "big" stays plain.
    expect(marksOn(view.state.doc, 'big')).toEqual(['insertion']);
    const records = store.list();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      kind: 'insert',
      authorId: 'alice',
      authorName: 'Alice',
      status: 'pending',
      text: 'big ',
      blockId: 'p1',
      sectionId: null,
    });
    expect(listPendingRevisions(view.state)).toHaveLength(1);
  });

  it('keeps deleted text and marks it deleted', () => {
    const { view, store } = setup();
    const r = rangeOf(view.state.doc, 'world');
    view.dispatch(view.state.tr.delete(r.from, r.to));

    expect(view.state.doc.textContent).toContain('hello world');
    expect(marksOn(view.state.doc, 'world')).toEqual(['deletion']);
    expect(store.list()).toMatchObject([{ kind: 'delete', text: 'world', status: 'pending' }]);
  });

  it('turns a replacement into a deletion and an insertion sharing a group', () => {
    const { view, store } = setup();
    const r = rangeOf(view.state.doc, 'world');
    view.dispatch(view.state.tr.insertText('there', r.from, r.to));

    expect(marksOn(view.state.doc, 'world')).toEqual(['deletion']);
    expect(marksOn(view.state.doc, 'there')).toEqual(['insertion']);
    const records = store.list();
    expect(records.map((x) => x.kind).sort()).toEqual(['delete', 'insert']);
    expect(records[0]!.groupId).toBeDefined();
    expect(records[0]!.groupId).toBe(records[1]!.groupId);
  });

  it('removes the author own pending insertion for real when it is deleted', () => {
    const { view, store } = setup();
    const pos = endOf(view.state.doc, 'hello');
    view.dispatch(view.state.tr.insertText(' big', pos));
    const r = rangeOf(view.state.doc, 'big ');
    view.dispatch(view.state.tr.delete(r.from, r.to));

    expect(view.state.doc.textContent).toContain('hello world');
    expect(view.state.doc.textContent).not.toContain('big');
    expect(listPendingRevisions(view.state)).toHaveLength(0);
    expect(store.list()[0]).toMatchObject({ status: 'rejected', resolvedBy: 'alice' });
  });

  it('records format changes as format revisions without marking the text', () => {
    const { view, store } = setup();
    const r = rangeOf(view.state.doc, 'hello');
    view.dispatch(view.state.tr.addMark(r.from, r.to, testSchema.marks.bold!.create()));

    expect(marksOn(view.state.doc, 'hello')).toEqual(['bold']);
    expect(store.list()).toMatchObject([{ kind: 'format', status: 'pending', text: 'hello' }]);
    expect(listPendingRevisions(view.state, store).map((x) => x.kind)).toEqual(['format']);
  });

  it('does not track when disabled, and toggles via transaction meta', () => {
    const { view, store } = setup(false);
    expect(isTrackChangesEnabled(view.state)).toBe(false);
    const pos = endOf(view.state.doc, 'hello');
    view.dispatch(view.state.tr.insertText('X', pos));
    expect(marksOn(view.state.doc, 'X')).toEqual([]);
    expect(store.list()).toHaveLength(0);

    view.dispatch(setTrackChangesEnabledTransaction(view.state.tr, true));
    expect(getReviewState(view.state)?.enabled).toBe(true);
    const pos2 = endOf(view.state.doc, 'hello');
    view.dispatch(view.state.tr.insertText('Y', pos2));
    expect(marksOn(view.state.doc, 'Y')).toEqual(['insertion']);
  });

  it('skips tracking for transactions marked with the skip meta', () => {
    const { view } = setup();
    const pos = endOf(view.state.doc, 'hello');
    view.dispatch(view.state.tr.insertText('Z', pos).setMeta(REVIEW_META_SKIP, true));
    expect(marksOn(view.state.doc, 'Z')).toEqual([]);
  });

  it('keeps block-level deletions structurally valid and accepts them by removing the emptied block', () => {
    const { view } = setup();
    const from = rangeOf(view.state.doc, 'second paragraph').from;
    const to = rangeOf(view.state.doc, 'second paragraph').to;
    view.dispatch(view.state.tr.delete(from, to));

    expect(view.state.doc.childCount).toBe(2);
    expect(marksOn(view.state.doc, 'second paragraph')).toEqual(['deletion']);
    const deletion = listPendingRevisions(view.state)[0]!;
    expect(acceptRevision(view, deletion.id, 'alice')).toBe(true);
    expect(view.state.doc.childCount).toBe(1);
    expect(view.state.doc.textContent).toBe('hello world');
  });

  it('coalesces consecutive typing by one author into a single revision', () => {
    const { view } = setup();
    let pos = endOf(view.state.doc, 'hello');
    for (const ch of ['a', 'b', 'c']) {
      view.dispatch(view.state.tr.insertText(ch, pos));
      pos += 1;
    }
    expect(listPendingRevisions(view.state)).toHaveLength(1);
    expect(listPendingRevisions(view.state)[0]!.text).toBe('abc');
  });

  it('moves the cursor across already-deleted text instead of getting stuck in front of it', () => {
    const { view } = setup();
    const end = endOf(view.state.doc, 'world');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    // Backspace over "d": the struck text stays and the cursor moves in front of it.
    view.dispatch(view.state.tr.delete(end - 1, end));
    const cursor = view.state.selection.from;
    expect(cursor).toBe(end - 1);
    // Forward delete over the struck "d" must move the cursor past it rather than do nothing.
    view.dispatch(view.state.tr.delete(cursor, cursor + 1));
    expect(view.state.selection.from).toBe(cursor + 1);
    expect(view.state.doc.textContent).toContain('world');
  });

  it('nests an edit inside another author pending insertion, attributed to the new author', () => {
    const { view: viewA } = setup();
    const pos = endOf(viewA.state.doc, 'hello');
    viewA.dispatch(viewA.state.tr.insertText('AAA', pos));

    const storeB = new InMemoryRevisionStore();
    const bob = { id: 'bob', name: 'Bob' };
    const stateB = EditorState.create({
      doc: viewA.state.doc,
      schema: testSchema,
      plugins: [createRevisionTrackingPlugin({ enabled: true, author: bob, store: storeB })],
    });
    const view = new EditorView(document.createElement('div'), { state: stateB });
    const inside = endOf(view.state.doc, 'AA');
    view.dispatch(view.state.tr.insertText('B', inside));

    const pending = listPendingRevisions(view.state);
    const authors = pending.map((p) => p.authorId).sort();
    expect(authors).toEqual(['alice', 'bob']);
    expect(storeB.list()[0]).toMatchObject({ authorId: 'bob', kind: 'insert' });

    // Rejecting the outer insertion removes the text it contains, including the nested edit.
    const outer = pending.find((p) => p.authorId === 'alice')!;
    rejectRevision(view, outer.id, 'bob');
    expect(view.state.doc.textContent).not.toContain('AA');
    expect(view.state.doc.textContent).toContain('hello world');
  });
});
