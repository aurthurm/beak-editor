import { describe, expect, it, vi } from 'vitest';
import { Plugin } from 'prosemirror-state';

import { createRevisionTrackingPlugin } from './trackChanges';
import { InMemoryRevisionStore } from './store';
import {
  acceptAll,
  acceptRevision,
  listPendingRevisions,
  proposeChange,
  rejectAll,
  rejectRevision,
} from './operations';
import { docFrom, endOf, para, rangeOf, createView, marksOn } from './testing/helpers';

const alice = { id: 'alice', name: 'Alice' };

function tracked(blocks = [para('p1', 'hello world'), para('p2', 'second')]) {
  const store = new InMemoryRevisionStore();
  const view = createView(docFrom(blocks), [createRevisionTrackingPlugin({ enabled: true, author: alice, store })]);
  return { view, store };
}

function insertAt(view: ReturnType<typeof createView>, text: string, after: string) {
  const pos = endOf(view.state.doc, after);
  view.dispatch(view.state.tr.insertText(text, pos));
}

function deleteText(view: ReturnType<typeof createView>, text: string) {
  const r = rangeOf(view.state.doc, text);
  view.dispatch(view.state.tr.delete(r.from, r.to));
}

describe('accept and reject', () => {
  it('does not record an acceptance when a document rule refuses the change', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const store = new InMemoryRevisionStore();
      let refusing = false;
      const refuseResolutions = new Plugin({ filterTransaction: () => !refusing });
      const view = createView(docFrom([para('p1', 'hello world')]), [
        createRevisionTrackingPlugin({ enabled: true, author: alice, store }),
        refuseResolutions,
      ]);
      insertAt(view, ' big', 'hello');
      const id = listPendingRevisions(view.state)[0]!.id;

      refusing = true;
      expect(acceptRevision(view, id, 'reviewer')).toBe(false);
      refusing = false;
      expect(view.state.doc.textContent).toContain('hello big world');
      expect(store.get(id)?.status).toBe('pending');
    } finally {
      warn.mockRestore();
    }
  });

  it('accepting an insertion removes the mark and keeps the text', () => {
    const { view, store } = tracked();
    insertAt(view, ' big', 'hello');
    const id = listPendingRevisions(view.state)[0]!.id;

    expect(acceptRevision(view, id, 'reviewer')).toBe(true);
    expect(view.state.doc.textContent).toContain('hello big world');
    expect(marksOn(view.state.doc, ' big')).toEqual([]);
    expect(store.get(id)).toMatchObject({ status: 'accepted', resolvedBy: 'reviewer' });
    expect(store.get(id)!.resolvedAt).toBeDefined();
  });

  it('rejecting an insertion removes the text', () => {
    const { view, store } = tracked();
    insertAt(view, ' big', 'hello');
    const id = listPendingRevisions(view.state)[0]!.id;

    rejectRevision(view, id, 'reviewer');
    expect(view.state.doc.textContent).toBe('hello worldsecond');
    expect(store.get(id)).toMatchObject({ status: 'rejected', resolvedBy: 'reviewer' });
  });

  it('accepting a deletion removes the text, and rejecting restores it unmarked', () => {
    const a = tracked();
    deleteText(a.view, 'world');
    acceptRevision(a.view, listPendingRevisions(a.view.state)[0]!.id, 'r');
    expect(a.view.state.doc.textContent).toBe('hello second');

    const b = tracked();
    deleteText(b.view, 'world');
    rejectRevision(b.view, listPendingRevisions(b.view.state)[0]!.id, 'r');
    expect(b.view.state.doc.textContent).toBe('hello worldsecond');
    expect(marksOn(b.view.state.doc, 'world')).toEqual([]);
  });

  it('acceptAll and rejectAll resolve every pending revision', () => {
    const a = tracked();
    insertAt(a.view, ' big', 'hello');
    deleteText(a.view, 'second');
    acceptAll(a.view, 'r');
    expect(listPendingRevisions(a.view.state)).toHaveLength(0);
    expect(a.view.state.doc.textContent).toBe('hello big world');

    const b = tracked();
    insertAt(b.view, ' big', 'hello');
    deleteText(b.view, 'second');
    rejectAll(b.view, 'r');
    expect(listPendingRevisions(b.view.state)).toHaveLength(0);
    expect(b.view.state.doc.textContent).toBe('hello worldsecond');
  });

  it('accepting one half of a replacement accepts the whole group', () => {
    const { view, store } = tracked();
    const r = rangeOf(view.state.doc, 'world');
    view.dispatch(view.state.tr.insertText('there', r.from, r.to));
    const pending = listPendingRevisions(view.state);
    expect(pending).toHaveLength(2);

    acceptRevision(view, pending[0]!.id, 'r');
    expect(listPendingRevisions(view.state)).toHaveLength(0);
    expect(view.state.doc.textContent).toBe('hello theresecond');
    expect(store.list().every((x) => x.status === 'accepted')).toBe(true);
  });

  it('removes a block whose entire text is rejected from an insertion', () => {
    const { view } = tracked([para('p1', 'one'), para('p2', 'two')]);
    const schema = view.state.schema;
    const newPara = schema.nodes.paragraph!.create({ id: 'p-new' }, schema.text('fresh'));
    view.dispatch(view.state.tr.insert(rangeOf(view.state.doc, 'one').to + 1, newPara));
    expect(view.state.doc.childCount).toBe(3);
    expect(marksOn(view.state.doc, 'fresh')).toEqual(['insertion']);

    const id = listPendingRevisions(view.state)[0]!.id;
    rejectRevision(view, id, 'r');
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.textContent).toBe('onetwo');
  });
});

describe('proposeChange', () => {
  it('proposes a tracked replacement with AI attribution and never auto-accepts', () => {
    const store = new InMemoryRevisionStore();
    const view = createView(docFrom([para('p1', 'hello world')]), [
      createRevisionTrackingPlugin({ enabled: false, author: alice, store }),
    ]);
    const r = rangeOf(view.state.doc, 'world');
    const result = proposeChange(view, {
      from: r.from,
      to: r.to,
      text: 'there',
      author: { id: 'ai', name: 'Assistant' },
      aiGenerated: true,
      note: 'Clearer wording',
    });

    expect(result.groupId).toBeTruthy();
    expect(result.deletionRevisionId).toBeTruthy();
    expect(result.insertionRevisionId).toBeTruthy();
    expect(marksOn(view.state.doc, 'world')).toEqual(['deletion']);
    expect(marksOn(view.state.doc, 'there')).toEqual(['insertion']);

    const pending = listPendingRevisions(view.state);
    expect(pending).toHaveLength(2);
    expect(pending.every((p) => p.aiGenerated && p.authorId === 'ai')).toBe(true);
    expect(store.list().every((x) => x.aiGenerated && x.note === 'Clearer wording')).toBe(true);
    expect(store.list().find((x) => x.kind === 'insert')?.groupId).toBe(result.groupId);
  });

  it('rejects an empty proposal and invalid ranges', () => {
    const view = createView(docFrom([para('p1', 'abc')]));
    expect(() => proposeChange(view, { from: 1, to: 1, text: '', author: alice })).toThrow(RangeError);
    expect(() => proposeChange(view, { from: 3, to: 1, text: 'x', author: alice })).toThrow(RangeError);
  });
});
