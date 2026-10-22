/**
 * QMS atoms keep their block id and their domain `id` prop when loaded and saved.
 *
 * @module
 */

import { describe, expect, it } from 'vitest';
import { blockToNode, createSchema, nodeToBlock, type Block } from '@amusendame/beakblock-core';

import { QMS_NODE_SPECS } from './nodes';

const schema = createSchema(QMS_NODE_SPECS);

describe('QMS atom round-trip', () => {
  it('keeps props.id separate from the block id', () => {
    const block: Block = {
      id: 'block-1',
      type: 'acknowledgement',
      props: { id: 'ack-7', statement: 'Read.', required: true },
    };

    const node = blockToNode(schema, block);
    expect(node.attrs.id).toBe('block-1');
    expect(nodeToBlock(node)).toEqual(block);
  });
});
