/**
 * Unregistered block types are kept as `unknownBlock` atoms and serialise back to the original
 * block JSON. Unknown inline content is dropped with a warning.
 *
 * @module
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSchema } from '../schema/createSchema';
import { blockToNode } from './blockToNode';
import { nodeToBlock } from './nodeToBlock';
import type { Block } from './types';

const schema = createSchema();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('unregistered block types', () => {
  it('round-trips an unknown block with props and children to the original JSON', () => {
    const block: Block = {
      id: 'h-1',
      type: 'hologram',
      props: { depth: 2, mode: 'stereo' },
      children: [{ id: 'p-1', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Inner', styles: {} }] }],
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
});

describe('unknown inline content', () => {
  it('drops the unknown inline item, keeps its siblings, and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const block = {
      id: 'p-9',
      type: 'paragraph',
      props: {},
      content: [
        { type: 'text', text: 'Before ', styles: {} },
        { type: 'mysteryInline', props: {} },
        { type: 'text', text: 'after', styles: {} },
      ],
    } as unknown as Block;

    const node = blockToNode(schema, block);
    expect(node.textContent).toBe('Before after');
    expect(warn).toHaveBeenCalled();
  });
});
