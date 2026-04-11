/**
 * Ensures JSON block serialization round-trips without losing structure or attrs.
 *
 * @module
 */

import { describe, expect, it } from 'vitest';

import { createSchema } from '../schema/createSchema';
import type { Block } from './types';
import { blocksToDoc, docToBlocks } from './index';

const schema = createSchema();

describe('docToBlocks / blocksToDoc round-trip', () => {
  it('preserves columnList gap and nested columns with blocks', () => {
    const blocks: Block[] = [
      {
        id: 'cl-1',
        type: 'columnList',
        props: { gap: 24 },
        children: [
          {
            id: 'col-a',
            type: 'column',
            props: { width: 40 },
            children: [
              {
                id: 'p-1',
                type: 'paragraph',
                props: { textAlign: 'left' },
                content: [{ type: 'text', text: 'Left', styles: {} }],
              },
            ],
          },
          {
            id: 'col-b',
            type: 'column',
            props: { width: 60 },
            children: [
              {
                id: 'p-2',
                type: 'paragraph',
                props: { textAlign: 'left' },
                content: [{ type: 'text', text: 'Right', styles: {} }],
              },
            ],
          },
        ],
      },
    ];

    const doc = blocksToDoc(schema, blocks);
    expect(docToBlocks(doc)).toEqual(blocks);
  });

  it('preserves hardBreak inside a paragraph', () => {
    const blocks: Block[] = [
      {
        id: 'p-1',
        type: 'paragraph',
        props: { textAlign: 'left' },
        content: [
          { type: 'text', text: 'a', styles: {} },
          { type: 'hardBreak' },
          { type: 'text', text: 'b', styles: {} },
        ],
      },
    ];

    const doc = blocksToDoc(schema, blocks);
    expect(docToBlocks(doc)).toEqual(blocks);
  });

  it('preserves embed props (atomic block)', () => {
    const blocks: Block[] = [
      {
        id: 'emb-1',
        type: 'embed',
        props: {
          url: 'https://youtu.be/dQw4w9WgXcQ',
          provider: 'youtube',
          embedId: 'dQw4w9WgXcQ',
          caption: 'Note',
          width: null,
          height: null,
          aspectRatio: '16:9',
        },
      },
    ];

    const doc = blocksToDoc(schema, blocks);
    expect(docToBlocks(doc)).toEqual(blocks);
  });

  it('preserves table cell colspan and tableOfContents items', () => {
    const blocks: Block[] = [
      {
        id: 't-1',
        type: 'table',
        props: {},
        children: [
          {
            id: 'tr-1',
            type: 'tableRow',
            props: {},
            children: [
              {
                id: 'th-1',
                type: 'tableHeader',
                props: { colspan: 2, rowspan: 1, colwidth: null, backgroundColor: null },
                children: [
                  {
                    id: 'p-h',
                    type: 'paragraph',
                    props: { textAlign: 'left' },
                    content: [{ type: 'text', text: 'H', styles: {} }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'toc-1',
        type: 'tableOfContents',
        props: {
          items: [{ id: 'hx', level: 2, text: 'Section' }],
        },
      },
    ];

    const doc = blocksToDoc(schema, blocks);
    expect(docToBlocks(doc)).toEqual(blocks);
  });
});
