/**
 * Ensures empty inline text runs in block content do not crash conversion.
 *
 * @module
 */

import { describe, expect, it } from 'vitest';

import { createSchema } from '../schema/createSchema';
import type { Block } from './types';
import { blockToNode } from './blockToNode';

const schema = createSchema();

describe('blockToNode with empty inline text', () => {
  it('skips an empty text run among non-empty runs', () => {
    const block: Block = {
      id: 'p-1',
      type: 'paragraph',
      props: {},
      content: [
        { type: 'text', text: 'Hello ', styles: {} },
        { type: 'text', text: '', styles: { bold: true } },
        { type: 'text', text: 'world', styles: {} },
      ],
    };

    const node = blockToNode(schema, block);
    expect(node.textContent).toBe('Hello world');
  });

  it('creates an empty paragraph when the only text run is empty', () => {
    const block: Block = {
      id: 'p-2',
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: '', styles: {} }],
    };

    const node = blockToNode(schema, block);
    expect(node.type.name).toBe('paragraph');
    expect(node.textContent).toBe('');
    expect(node.childCount).toBe(0);
  });

  it('skips empty text runs inside link content', () => {
    const block: Block = {
      id: 'p-3',
      type: 'paragraph',
      props: {},
      content: [
        {
          type: 'link',
          href: 'https://example.com',
          content: [
            { type: 'text', text: '', styles: {} },
            { type: 'text', text: 'site', styles: {} },
          ],
        } as never,
      ],
    };

    const node = blockToNode(schema, block);
    expect(node.textContent).toBe('site');
  });
});

describe('blockToNode with inline content on a block-content node', () => {
  it('wraps inline content in a paragraph when the node holds blocks', () => {
    const block: Block = {
      id: 'col-1',
      type: 'column',
      props: {},
      content: [{ type: 'text', text: 'Keep me', styles: {} }],
    };

    const node = blockToNode(schema, block);
    expect(node.type.validContent(node.content)).toBe(true);
    expect(node.textContent).toBe('Keep me');
    expect(node.firstChild!.type.name).toBe('paragraph');
  });
});
