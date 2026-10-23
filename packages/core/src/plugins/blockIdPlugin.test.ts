/**
 * Block id uniqueness. Splitting, pasting and loading can copy a block's `id` attr. The plugin must
 * leave every block with a unique id, keeping the id on the node that holds the original content.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PluginKey, TextSelection, type Transaction } from 'prosemirror-state';
import { splitBlock } from 'prosemirror-commands';
import { splitListItem } from 'prosemirror-schema-list';
import type { Node as PMNode } from 'prosemirror-model';
import { BeakBlockEditor } from '../editor/Editor';
import type { PartialBlock } from '../blocks/types';

const para = (id: string, text: string): PartialBlock => ({
  id,
  type: 'paragraph',
  props: {},
  content: [{ type: 'text', text, styles: {} }],
});

/** Every block-level node id in document order (the same nodes the plugin checks). */
function blockIds(doc: PMNode): string[] {
  const ids: string[] = [];
  doc.descendants((node) => {
    if (node.type.name !== 'doc' && (node.isBlock || node.type.name === 'column') && node.attrs.id) {
      ids.push(String(node.attrs.id));
    }
    return true;
  });
  return ids;
}

/** The id of the block-level node whose own text is `text` (first match). */
function idOfText(doc: PMNode, text: string): string | undefined {
  let found: string | undefined;
  doc.descendants((node) => {
    if (found === undefined && node.isTextblock && node.textContent === text) found = String(node.attrs.id);
    return found === undefined;
  });
  return found;
}

/** Places the caret at `offset` characters into the textblock whose text is `text`. */
function caretIn(editor: BeakBlockEditor, text: string, offset: number): void {
  let target = -1;
  editor.pm.doc.descendants((node, pos) => {
    if (target < 0 && node.isTextblock && node.textContent === text) target = pos + 1;
    return target < 0;
  });
  if (target < 0) throw new Error(`no textblock "${text}"`);
  editor.pm.dispatch(editor.pm.state.tr.setSelection(TextSelection.create(editor.pm.doc, target + offset)));
}

/** A bullet list block with list items. Each item's text is its implicit paragraph. */
function listOf(id: string, items: Array<{ id: string; text: string }>): PartialBlock {
  return {
    id,
    type: 'bulletList',
    props: {},
    children: items.map((item) => ({
      id: item.id,
      type: 'listItem',
      props: {},
      content: [{ type: 'text', text: item.text, styles: {} }],
    })),
  } as PartialBlock;
}

/** The meta key y-prosemirror uses for its sync plugin (`y-sync$` in ProseMirror's naming). */
function ySyncMetaKey(): string {
  return (new PluginKey('y-sync') as unknown as { key: string }).key;
}

function uniqueIds(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

describe('blockIdPlugin: unique block ids', () => {
  let container: HTMLElement;
  let editor: BeakBlockEditor;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    editor?.destroy();
    container.remove();
  });

  function make(blocks: PartialBlock[]): BeakBlockEditor {
    editor = new BeakBlockEditor({ element: container, injectStyles: false, initialContent: blocks });
    return editor;
  }

  it('Enter mid-paragraph gives the second half a new id and keeps p1 on the first half', () => {
    make([para('p1', 'Hello world')]);
    caretIn(editor, 'Hello world', 4);
    splitBlock(editor.pm.state, (tr: Transaction) => editor.pm.dispatch(tr));

    const ids = blockIds(editor.pm.doc);
    expect(ids).toHaveLength(2);
    expect(uniqueIds(ids)).toBe(true);
    expect(ids[0]).toBe('p1');
    expect(ids[1]).not.toBe('p1');
    expect(editor.getDocument().map((b) => b.id)).toEqual(['p1', ids[1]]);
  });

  it('Enter at the start of a paragraph keeps p1 on the node that holds the original text', () => {
    make([para('p1', 'Hello world')]);
    caretIn(editor, 'Hello world', 0);
    splitBlock(editor.pm.state, (tr: Transaction) => editor.pm.dispatch(tr));

    const ids = blockIds(editor.pm.doc);
    expect(uniqueIds(ids)).toBe(true);
    expect(idOfText(editor.pm.doc, 'Hello world')).toBe('p1');
  });

  it('Enter at the end of a paragraph keeps p1 on the original text', () => {
    make([para('p1', 'Hello world')]);
    caretIn(editor, 'Hello world', 11);
    splitBlock(editor.pm.state, (tr: Transaction) => editor.pm.dispatch(tr));

    const ids = blockIds(editor.pm.doc);
    expect(uniqueIds(ids)).toBe(true);
    expect(idOfText(editor.pm.doc, 'Hello world')).toBe('p1');
  });

  it('Enter mid-heading gives the new heading a unique id', () => {
    make([{ id: 'h1', type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Title text', styles: {} }] }]);
    caretIn(editor, 'Title text', 5);
    splitBlock(editor.pm.state, (tr: Transaction) => editor.pm.dispatch(tr));

    const ids = blockIds(editor.pm.doc);
    expect(ids).toHaveLength(2);
    expect(uniqueIds(ids)).toBe(true);
    expect(ids[0]).toBe('h1');
  });

  it('splitListItem gives the new list item and its implicit paragraph fresh ids', () => {
    make([listOf('list1', [{ id: 'li1', text: 'First item' }])]);
    const listItemType = editor.pm.state.schema.nodes.listItem!;
    caretIn(editor, 'First item', 4);
    splitListItem(listItemType)(editor.pm.state, (tr: Transaction) => editor.pm.dispatch(tr));

    const ids = blockIds(editor.pm.doc);
    expect(uniqueIds(ids)).toBe(true);
    expect(ids).toContain('li1');
    expect(idOfText(editor.pm.doc, 'Firs')).toBe('li1/p');
    // The second item's paragraph is an implicit paragraph of its own, so it is not `li1/p`.
    expect(ids.filter((id) => id === 'li1/p')).toHaveLength(1);
  });

  it('pasting a copy of a block already in the document gives the copy a new id', () => {
    make([para('p1', 'Hello'), para('p2', 'World')]);
    const original = editor.pm.doc.firstChild!;
    const copy = original.copy(original.content);
    editor.pm.dispatch(editor.pm.state.tr.insert(editor.pm.doc.content.size, copy));

    const ids = blockIds(editor.pm.doc);
    expect(ids).toHaveLength(3);
    expect(uniqueIds(ids)).toBe(true);
    expect(ids[0]).toBe('p1');
    expect(ids[2]).not.toBe('p1');
  });

  it('setDocument with duplicate ids dedupes them, keeping the first occurrence', () => {
    make([para('p1', 'One'), para('p2', 'Two')]);
    editor.setDocument([para('dup', 'First'), para('dup', 'Second'), para('dup', 'Third')]);

    const ids = blockIds(editor.pm.doc);
    expect(ids).toHaveLength(3);
    expect(uniqueIds(ids)).toBe(true);
    expect(ids[0]).toBe('dup');
  });

  it('does not re-id nodes in a transaction that originates from a remote Yjs update', () => {
    make([para('p1', 'Hello')]);
    // y-prosemirror tags remote changes with its sync key (name `y-sync`, possibly suffixed).
    const syncKey = ySyncMetaKey();
    const original = editor.pm.doc.firstChild!;
    const tr = editor.pm.state.tr.insert(editor.pm.doc.content.size, original.copy(original.content));
    tr.setMeta(syncKey, { isChangeOrigin: true });
    editor.pm.dispatch(tr);

    expect(blockIds(editor.pm.doc)).toEqual(['p1', 'p1']);
  });

  it('a later local edit re-ids a collision that a remote change left behind', () => {
    make([para('p1', 'Hello')]);
    const syncKey = ySyncMetaKey();
    const original = editor.pm.doc.firstChild!;
    const remote = editor.pm.state.tr.insert(editor.pm.doc.content.size, original.copy(original.content));
    remote.setMeta(syncKey, { isChangeOrigin: true });
    editor.pm.dispatch(remote);
    expect(blockIds(editor.pm.doc)).toEqual(['p1', 'p1']);

    // The local edit is this client's change, so it mints the id and syncs it out.
    editor.pm.dispatch(editor.pm.state.tr.insertText('!', 2));
    expect(uniqueIds(blockIds(editor.pm.doc))).toBe(true);
  });

  it('leaves implicit paragraph ids (ownerId/p) stable across unrelated edits', () => {
    make([listOf('list1', [{ id: 'li1', text: 'Alpha' }]), para('p2', 'Beta')]);
    expect(blockIds(editor.pm.doc)).toContain('li1/p');

    caretIn(editor, 'Beta', 4);
    editor.pm.dispatch(editor.pm.state.tr.insertText(' edited'));

    const after = blockIds(editor.pm.doc);
    expect(after).toContain('li1/p');
    expect(after.filter((id) => id === 'li1/p')).toHaveLength(1);
    expect(uniqueIds(after)).toBe(true);
  });
});
