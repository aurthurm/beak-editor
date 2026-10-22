/**
 * Block props that share a name with a reserved node attr (for example a domain `id`) map to a
 * separate node attr, so both the block id and the domain value round-trip.
 *
 * @module
 */

import { describe, expect, it } from 'vitest';
import type { NodeSpec } from 'prosemirror-model';

import { createSchema } from '../schema/createSchema';
import { blockToNode } from './blockToNode';
import { nodeToBlock } from './nodeToBlock';
import type { Block } from './types';

const widget: NodeSpec = {
  group: 'block',
  atom: true,
  attrs: { id: { default: null }, domainId: { default: null }, label: { default: '' } },
  blockPropAliases: { id: 'domainId' },
  toDOM: () => ['div', 0],
};

const schema = createSchema({ widget });

describe('blockPropAliases', () => {
  it('keeps the block id and the aliased prop id separate', () => {
    const block: Block = { id: 'block-1', type: 'widget', props: { id: 'ack-7', label: 'Read' } };

    const node = blockToNode(schema, block);
    expect(node.attrs.id).toBe('block-1');
    expect(node.attrs.domainId).toBe('ack-7');

    expect(nodeToBlock(node)).toEqual(block);
  });
});
