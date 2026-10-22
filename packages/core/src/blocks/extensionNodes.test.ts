/**
 * Extension nodes survive block serialization: unknown inline atoms and
 * container nodes (any non-textblock with block children).
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { NodeSpec } from 'prosemirror-model';
import { createSchema } from '../schema';
import { blocksToDoc, docToBlocks } from './index';
import type { Block } from './types';
import { BeakBlockEditor } from '../editor/Editor';

const mentionSpec: NodeSpec = {
  group: 'inline',
  inline: true,
  atom: true,
  attrs: { userId: { default: null }, label: { default: '' } },
  toDOM: () => ['span', { class: 'mention' }, 0],
};

const controlledSectionSpec: NodeSpec = {
  group: 'block',
  content: 'block+',
  defining: true,
  attrs: { id: { default: null }, title: { default: '' } },
  toDOM: () => ['section', { class: 'controlled' }, 0],
};

const schema = createSchema({ mention: mentionSpec, controlledSection: controlledSectionSpec });

const text = (t: string) => ({ type: 'text' as const, text: t, styles: {} });

const sample: Block[] = [
  {
    id: 'p1',
    type: 'paragraph',
    props: { textAlign: 'left' },
    content: [
      text('Hello '),
      { type: 'mention', props: { userId: 'u42', label: 'Ann' } },
      text(' bye'),
    ],
  },
  {
    id: 'cs1',
    type: 'controlledSection',
    props: { id: 'cs1', title: 'Scope' },
    children: [
      { id: 'p2', type: 'paragraph', props: { textAlign: 'left' }, content: [text('Inside')] },
      { id: 'p3', type: 'paragraph', props: { textAlign: 'left' }, content: [text('Second')] },
    ],
  },
];

describe('extension inline nodes', () => {
  it('serialize as { type, props } and rebuild from the schema', () => {
    const out = docToBlocks(blocksToDoc(schema, sample));
    expect(out[0]!.content).toEqual(sample[0]!.content);
  });

  it('drops inline nodes that are not in the schema', () => {
    const plain = createSchema();
    const blocks: Block[] = [
      {
        id: 'p',
        type: 'paragraph',
        props: {},
        content: [text('a'), { type: 'mention', props: { userId: 'x' } }, text('b')],
      },
    ];
    const out = docToBlocks(blocksToDoc(plain, blocks));
    expect(out[0]!.content).toEqual([text('ab')]);
  });
});

describe('extension container nodes', () => {
  it('keep block children through a round trip', () => {
    const out = docToBlocks(blocksToDoc(schema, sample));
    expect(out[1]!.type).toBe('controlledSection');
    expect(out[1]!.children).toEqual(sample[1]!.children);
  });

  it('built-in containers are unchanged', () => {
    const blocks: Block[] = [
      {
        id: 'ul',
        type: 'bulletList',
        props: {},
        children: [
          {
            id: 'li',
            type: 'listItem',
            props: {},
            content: [text('item')],
          },
        ],
      },
    ];
    const out = docToBlocks(blocksToDoc(schema, blocks));
    expect(out).toEqual(blocks);
  });
});

describe('extensions through the editor API', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('getDocument/setDocument round-trip an inline atom and a container', () => {
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      extensions: [
        {
          name: 'test-ext',
          nodes: {
            mention: mentionSpec,
            controlledSection: controlledSectionSpec,
          },
        },
      ],
    });
    editor.setDocument(sample);
    const out = editor.getDocument();
    expect(out[0]!.content).toEqual(sample[0]!.content);
    expect(out[1]!.children).toEqual(sample[1]!.children);
    editor.destroy();
  });
});
