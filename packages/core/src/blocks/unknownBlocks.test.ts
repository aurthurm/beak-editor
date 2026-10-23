/**
 * Unregistered block and inline types are kept losslessly: they load as `unknownBlock` and
 * `unknownInline` atoms, serialise back to the original JSON, and are reported (never dropped).
 * Unknown props on a registered type are kept in the `unknownProps` attribute.
 *
 * @module
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSchema } from '../schema/createSchema';
import { blockToNode } from './blockToNode';
import { nodeToBlock } from './nodeToBlock';
import type { Block, InlineContent } from './types';

const schema = createSchema();

afterEach(() => {
  vi.restoreAllMocks();
});

const text = (value: string) => ({ type: 'text' as const, text: value, styles: {} });

describe('unregistered block types', () => {
  it('round-trips an unknown block with props and children to the original JSON', () => {
    const block: Block = {
      id: 'h-1',
      type: 'hologram',
      props: { depth: 2, mode: 'stereo' },
      children: [{ id: 'p-1', type: 'paragraph', props: {}, content: [text('Inner')] }],
    };

    const node = blockToNode(schema, block);
    expect(node.type.name).toBe('unknownBlock');
    expect(nodeToBlock(node)).toEqual(block);
  });

  it('round-trips an unknown block with inline content and no children', () => {
    const block: Block = {
      id: 't-1',
      type: 'telemetry',
      props: {},
      content: [{ type: 'text', text: 'Reading 4.2', styles: { bold: true } }],
    };

    expect(nodeToBlock(blockToNode(schema, block))).toEqual(block);
  });

  it('is an atom, so its contents cannot be edited', () => {
    const node = blockToNode(schema, { id: 'h-2', type: 'hologram', props: {} });
    expect(node.isAtom).toBe(true);
    expect(node.isLeaf).toBe(true);
    expect(node.childCount).toBe(0);
  });

  it('renders a visible, non-editable placeholder with an accessible label', () => {
    const node = blockToNode(schema, { id: 'h-3', type: 'hologram', props: {} });
    const [tag, attrs, label] = node.type.spec.toDOM!(node) as [string, Record<string, string>, string];
    expect(tag).toBe('div');
    expect(attrs.contenteditable).toBe('false');
    expect(attrs['aria-label']).toBe('Unsupported block: hologram');
    expect(label).toBe('Unsupported block: hologram');
  });
});

describe('unknown inline content', () => {
  it('keeps the unknown inline item as an atom between its siblings and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const block = {
      id: 'p-9',
      type: 'paragraph',
      props: {},
      content: [text('Before '), { type: 'mysteryInline', props: {} }, text('after')],
    } as unknown as Block;

    const node = blockToNode(schema, block);
    const inline = node.child(1);
    expect(inline.type.name).toBe('unknownInline');
    expect(inline.isAtom).toBe(true);
    // Atoms have no text content; the placeholder is shown through its DOM label instead.
    expect(node.textContent).toBe('Before after');
    const [, attrs] = inline.type.spec.toDOM!(inline) as [string, Record<string, string>];
    expect(attrs.contenteditable).toBe('false');
    expect(attrs['aria-label']).toBe('Unsupported inline: mysteryInline');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('round-trips an unknown inline item with props exactly', () => {
    const block: Block = {
      id: 'p-10',
      type: 'paragraph',
      props: { textAlign: 'left' },
      content: [
        text('Inline: '),
        { type: 'mystery', props: { code: 'X-9' } } as unknown as InlineContent,
        text(' continues.'),
      ],
    };

    expect(nodeToBlock(blockToNode(schema, block))).toEqual(block);
  });

  it('round-trips an unknown inline item with inline content and no props key', () => {
    const item = { type: 'wrapper', content: [text('inside')] };
    const block = { id: 'p-11', type: 'paragraph', props: { textAlign: 'left' }, content: [item] } as unknown as Block;

    expect(nodeToBlock(blockToNode(schema, block))).toEqual(block);
  });

  it('round-trips an unknown inline item whose props are null', () => {
    const block = {
      id: 'p-12',
      type: 'paragraph',
      props: { textAlign: 'left' },
      content: [{ type: 'nullish', props: null }],
    } as unknown as Block;

    expect(nodeToBlock(blockToNode(schema, block))).toEqual(block);
  });
});

describe('unknown props on a registered block type', () => {
  it('keeps an undeclared prop and returns it unchanged', () => {
    const block: Block = {
      id: 'p-20',
      type: 'paragraph',
      props: { textAlign: 'left', mystery: { nested: [1, 2, { deep: true }] } },
      content: [text('Unknown prop on a known type.')],
    };

    const node = blockToNode(schema, block);
    expect(node.type.name).toBe('paragraph');
    expect(nodeToBlock(node)).toEqual(block);
  });

  it('keeps declared props out of the unknownProps attribute', () => {
    const node = blockToNode(schema, {
      id: 'p-21',
      type: 'paragraph',
      props: { textAlign: 'center' },
      content: [text('x')],
    });
    expect(node.attrs.unknownProps).toBeNull();
  });
});

describe('schema', () => {
  it('registers unknownBlock and unknownInline as default nodes', () => {
    expect(schema.nodes.unknownBlock).toBeDefined();
    expect(schema.nodes.unknownInline).toBeDefined();
  });

  it('gives every block node an unknownProps attribute', () => {
    expect(schema.nodes.paragraph!.spec.attrs).toHaveProperty('unknownProps');
  });
});
