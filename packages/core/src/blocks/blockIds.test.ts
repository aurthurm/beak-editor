/**
 * Block ids must be stable: reading the same document twice, or round-tripping it through
 * JSON, must return the same ids. Comment anchors and version diffs key on these ids.
 *
 * @module
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Node as PMNode } from 'prosemirror-model';

import { BeakBlockEditor } from '../editor/Editor';
import { createSchema } from '../schema/createSchema';
import { blocksToDoc } from './blockToNode';
import { docToBlocks } from './nodeToBlock';
import type { Block, PartialBlock } from './types';

const schema = createSchema();

const text = (value: string) => ({ type: 'text' as const, text: value, styles: {} });

/** Every block id in a JSON tree, depth first. */
function blockIds(blocks: Block[]): string[] {
  const out: string[] = [];
  const walk = (list: Block[]) => {
    for (const block of list) {
      out.push(block.id);
      if (block.children) walk(block.children);
    }
  };
  walk(blocks);
  return out;
}

/** The `id` attr of every block node in a ProseMirror document that declares one. */
function nodeIds(doc: PMNode): Array<[string, unknown]> {
  const out: Array<[string, unknown]> = [];
  doc.descendants((node) => {
    if (node.isBlock && 'id' in node.attrs) out.push([node.type.name, node.attrs.id]);
    return true;
  });
  return out;
}

/** Explicit ids on every block, so the test controls the input and only generated ids can differ. */
const input = (): PartialBlock[] => [
  {
    id: 'p-intro',
    type: 'paragraph',
    props: {},
    content: [text('Intro')],
  },
  {
    id: 'tbl-1',
    type: 'table',
    props: {},
    children: [
      {
        id: 'row-1',
        type: 'tableRow',
        props: {},
        children: [
          {
            id: 'cell-1',
            type: 'tableCell',
            props: {},
            content: [text('Cell text')],
          },
          {
            id: 'cell-2',
            type: 'tableCell',
            props: {},
            children: [{ id: 'cell-2-p', type: 'paragraph', props: {}, content: [text('Nested')] }],
          },
        ],
      },
    ],
  },
  {
    id: 'list-1',
    type: 'bulletList',
    props: {},
    children: [
      {
        id: 'item-1',
        type: 'listItem',
        props: {},
        content: [text('First item')],
        children: [{ id: 'item-1-sub', type: 'paragraph', props: {}, content: [text('Sub')] }],
      },
      {
        id: 'item-2',
        type: 'listItem',
        props: {},
        content: [text('Second item')],
      },
    ],
  },
];

describe('block ids are stable', () => {
  it('docToBlocks called twice on the same document returns identical ids', () => {
    const doc = blocksToDoc(schema, input());
    const first = blockIds(docToBlocks(doc));
    const second = blockIds(docToBlocks(doc));
    expect(second).toEqual(first);
    expect(first.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
  });

  it('every block node in a loaded document has an id attr (table cell and list item paragraphs included)', () => {
    const doc = blocksToDoc(schema, input());
    const missing = nodeIds(doc).filter(([, id]) => id === null || id === undefined || id === '');
    expect(missing).toEqual([]);
  });

  it('loading the same blocks twice assigns the same ids to every node', () => {
    const a = nodeIds(blocksToDoc(schema, input()));
    const b = nodeIds(blocksToDoc(schema, input()));
    expect(b).toEqual(a);
  });

  it('blocksToDoc(getDocument()) round-trips ids exactly, including nested children', () => {
    const once = docToBlocks(blocksToDoc(schema, input()));
    const twice = docToBlocks(blocksToDoc(schema, once));
    expect(blockIds(twice)).toEqual(blockIds(once));
  });
});

describe('block ids through the editor', () => {
  let container: HTMLElement;
  let editor: BeakBlockEditor | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    container.remove();
  });

  it('getDocument twice with no edits returns identical ids', () => {
    editor = new BeakBlockEditor({ element: container, injectStyles: false });
    editor.setDocument(input());
    expect(blockIds(editor.getDocument())).toEqual(blockIds(editor.getDocument()));
  });

  it('ids survive an edit to a different block', () => {
    editor = new BeakBlockEditor({ element: container, injectStyles: false });
    editor.setDocument(input());
    const before = blockIds(editor.getDocument());
    // Insert text into the intro paragraph, which is a different block from the table and list.
    const pos = 1;
    editor.pm.dispatch(editor.pm.state.tr.insertText('X', pos + 1));
    expect(blockIds(editor.getDocument())).toEqual(before);
  });
});
