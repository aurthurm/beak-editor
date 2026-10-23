import { describe, expect, it } from 'vitest';
import type { Block } from '@amusendame/beakblock-core';

import { InMemoryCommentThreadStore, parseMentions } from './store';
import { BeakBlockEditor } from '@amusendame/beakblock-core';
import { TextSelection } from 'prosemirror-state';

import { createCommentAnchor, createCommentAnchorFromSelection, reanchorComments } from './comments';
import type { AnchoredComment } from './types';
import { flattenBlocks } from './util';

const blocks: Block[] = [
  {
    id: 'sec',
    type: 'controlledSection',
    props: { sectionId: 'S-1' },
    children: [
      { id: 'p1', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Wear gloves at all times', styles: {} }] },
    ],
  },
  { id: 'p2', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Record the lot number.', styles: {} }] },
];

describe('comment store', () => {
  it('adds threads, parses mentions on reply, resolves and reopens', () => {
    const store = new InMemoryCommentThreadStore({ now: () => '2026-01-01T00:00:00.000Z' });
    const anchor = createCommentAnchor(blocks, 'p2', 11, 21);
    expect(anchor.quote).toBe('lot number');

    const c = store.add({ anchor, authorId: 'alice', authorName: 'Alice', body: 'Should this be a batch id?' });
    expect(c.status).toBe('open');
    expect(c.thread[0]).toMatchObject({ authorId: 'alice', mentions: [], at: '2026-01-01T00:00:00.000Z' });

    const replied = store.reply(c.id, { authorId: 'bob', body: 'Yes, cc @carol and @dave.' });
    expect(replied.thread[1]!.mentions).toEqual(['carol', 'dave']);

    const resolved = store.resolve(c.id, 'bob');
    expect(resolved).toMatchObject({ status: 'resolved', resolvedBy: 'bob' });
    expect(resolved.resolvedAt).toBeDefined();

    const reopened = store.reopen(c.id);
    expect(reopened.status).toBe('open');
    expect(reopened.resolvedBy).toBeUndefined();
    expect(store.list()).toHaveLength(1);
  });

  it('notifies subscribers and rejects unknown comment ids', () => {
    const store = new InMemoryCommentThreadStore();
    const seen: string[] = [];
    store.subscribe((c) => seen.push(c.id));
    const c = store.add({ anchor: createCommentAnchor(blocks, 'p2', 0, 6), authorId: 'a', body: 'hi' });
    expect(seen).toEqual([c.id]);
    expect(() => store.resolve('missing', 'a')).toThrow();
  });

  it('parses mentions without picking up e-mail addresses', () => {
    expect(parseMentions('ping @ana.li, not user@example.com')).toEqual(['ana.li']);
    expect(parseMentions('@x @x')).toEqual(['x']);
  });
});

describe('reanchorComments', () => {
  const base: AnchoredComment = {
    id: 'c1',
    anchor: { sectionId: null, blockId: 'p2', quote: 'lot number', offset: 11, length: 10 },
    thread: [],
    status: 'open',
  };

  it('leaves an intact anchor unchanged and refreshes its section', () => {
    const [out] = reanchorComments(blocks, [base]);
    expect(out!.orphaned).toBe(false);
    expect(out!.anchor.offset).toBe(11);
  });

  it('finds a moved quote in the anchored block and updates its offset', () => {
    const edited: Block[] = [
      blocks[0]!,
      { id: 'p2', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Please record the lot number.', styles: {} }] },
    ];
    const [out] = reanchorComments(edited, [base]);
    expect(out!.orphaned).toBe(false);
    expect(out!.anchor.offset).toBe(18);
    expect(out!.anchor.length).toBe(10);
  });

  it('orphans a comment whose quote was removed', () => {
    const edited: Block[] = [blocks[0]!, { id: 'p2', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Nothing here.', styles: {} }] }];
    const [out] = reanchorComments(edited, [base]);
    expect(out!.orphaned).toBe(true);
  });

  it('orphans a comment whose block was removed and finds blocks nested in sections', () => {
    const [gone] = reanchorComments([blocks[1]!], [{ ...base, anchor: { ...base.anchor, blockId: 'p1', quote: 'gloves', offset: 5, length: 6 } }]);
    expect(gone!.orphaned).toBe(true);

    const [nested] = reanchorComments(blocks, [{ ...base, anchor: { ...base.anchor, blockId: 'p1', quote: 'gloves', offset: 0, length: 6 } }]);
    expect(nested!.orphaned).toBe(false);
    expect(nested!.anchor.sectionId).toBe('S-1');
  });

  it('does not mutate the input comments', () => {
    const input = [{ ...base }];
    reanchorComments([], input);
    expect(input[0]!.orphaned).toBeUndefined();
  });
});

describe('createCommentAnchorFromSelection', () => {
  function editorWith(initialContent: Block[]): BeakBlockEditor {
    const element = document.createElement('div');
    document.body.appendChild(element);
    return new BeakBlockEditor({ element, injectStyles: false, initialContent });
  }

  function selectText(editor: BeakBlockEditor, needle: string): void {
    const { doc } = editor.pm.state;
    let from = -1;
    doc.descendants((node, pos) => {
      if (from >= 0 || !node.isText || !node.text) return;
      const idx = node.text.indexOf(needle);
      if (idx >= 0) from = pos + idx;
    });
    expect(from).toBeGreaterThanOrEqual(0);
    const tr = editor.pm.state.tr.setSelection(TextSelection.create(editor.pm.state.doc, from, from + needle.length));
    editor.pm.view.dispatch(tr);
  }

  it('anchors a selection inside a bullet list item to the list item block', () => {
    const content: Block[] = [
      {
        id: 'list',
        type: 'bulletList',
        props: {},
        children: [
          { id: 'item-1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Record the lot number', styles: {} }] },
        ],
      },
    ];
    const editor = editorWith(content);
    selectText(editor, 'lot number');

    // The editor paragraph inside the item has its own id, which is not a block id.
    const anchor = createCommentAnchorFromSelection(editor.getDocument(), editor.pm.state.selection);
    expect(anchor).toMatchObject({ blockId: 'item-1', quote: 'lot number', offset: 11, length: 10 });
    editor.destroy();
  });

  it('keeps anchoring paragraphs and returns null for an empty selection', () => {
    const paragraph: Block = { id: 'p2', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Record the lot number.', styles: {} }] };
    const editor = editorWith([paragraph]);
    expect(createCommentAnchorFromSelection(editor.getDocument(), editor.pm.state.selection)).toBeNull();
    selectText(editor, 'lot');
    expect(createCommentAnchorFromSelection(editor.getDocument(), editor.pm.state.selection)).toMatchObject({
      blockId: 'p2',
      quote: 'lot',
      offset: 11,
    });
    editor.destroy();
  });
});

describe('comment anchors across a block split', () => {
  it('a comment on p1 stays on the node that holds the original text after Enter at the start of the block', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      initialContent: [
        { id: 'p1', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Wear gloves at all times', styles: {} }] },
      ],
    });
    try {
      const anchor = createCommentAnchor(editor.getDocument(), 'p1', 5, 11);
      expect(anchor.quote).toBe('gloves');

      // Caret at the start of the paragraph: the original text moves to the second node.
      let contentStart = -1;
      editor.pm.doc.descendants((node, pos) => {
        if (contentStart < 0 && node.isTextblock) contentStart = pos + 1;
        return contentStart < 0;
      });
      editor.pm.dispatch(editor.pm.state.tr.split(contentStart));

      const blocks = editor.getDocument();
      expect(blocks.map((b) => b.id)[0]).not.toBe('p1');
      const [out] = reanchorComments(blocks, [{ id: 'c1', anchor, thread: [], status: 'open' }]);
      expect(out!.orphaned).toBe(false);
      expect(out!.anchor.blockId).toBe('p1');
      const kept = flattenBlocks(blocks).find((f) => f.block.id === 'p1');
      expect(kept?.block.content).toEqual([{ type: 'text', text: 'Wear gloves at all times', styles: {} }]);
    } finally {
      editor.destroy();
      container.remove();
    }
  });
});
