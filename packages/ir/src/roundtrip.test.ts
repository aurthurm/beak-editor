import type { Block } from '@amusendame/beakblock-core';
import { blocksToDocument, documentToBlocks, fixtures, migrateDocument } from '@amusendame/beakblock-schema';
import { describe, expect, it } from 'vitest';

import { blocksToIR, documentToIR, irToDocument, validateIR } from './index';
import type { IRDocument, IRBlock } from './index';
import { cloneJson } from '@amusendame/beakblock-core';

const clone = <T>(value: T): T => cloneJson(value);

/** Blocks -> document -> IR -> document -> blocks. */
function roundTrip(blocks: Block[]): Block[] {
  const doc = blocksToDocument(blocks);
  const ir = documentToIR(doc);
  return documentToBlocks(irToDocument(ir));
}

describe('IR round trip', () => {
  it('reconstructs the rich single-section fixture exactly', () => {
    const input = clone(fixtures.richSopBlocks);
    const output = roundTrip(input);
    expect(output).toStrictEqual(input);
  });

  it('reconstructs the multi-section fixture (sectionBreak preserved)', () => {
    const input = clone(fixtures.richSopBlocksWithSections);
    const output = roundTrip(input);
    expect(output).toStrictEqual(input);
  });

  it('round-trips through migrateDocument for v1 input', () => {
    const input = clone(fixtures.richSopBlocks);
    const ir = documentToIR(migrateDocument(input));
    expect(documentToBlocks(irToDocument(ir))).toStrictEqual(input);
  });

  it('round-trips through blocksToIR', () => {
    const input = clone(fixtures.richSopBlocks);
    const ir = blocksToIR(input);
    expect(documentToBlocks(irToDocument(ir))).toStrictEqual(input);
  });

  it('keeps document metadata, styles and numbering', () => {
    const doc = blocksToDocument(clone(fixtures.richSopBlocks), {
      id: 'doc-42',
      properties: { docNumber: 'SOP-001', revision: '3', custom: { area: 'QC' } },
    });
    const back = irToDocument(documentToIR(doc));
    expect(back.id).toBe('doc-42');
    expect(back.properties).toEqual(doc.properties);
    expect(back.styles).toEqual(doc.styles);
    expect(back.numbering).toEqual(doc.numbering);
    expect(back.schemaVersion).toBe(2);
  });

  it('produces an IR that validates without errors', () => {
    const ir = blocksToIR(clone(fixtures.richSopBlocksWithSections));
    const errors = validateIR(ir).filter((issue) => issue.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('does not mutate the source document', () => {
    const blocks = clone(fixtures.richSopBlocks);
    const doc = blocksToDocument(blocks);
    const snapshot = clone(doc);
    const ir = documentToIR(doc);
    irToDocument(ir);
    expect(doc).toEqual(snapshot);
  });

  it('survives a JSON serialisation of the IR', () => {
    const input = clone(fixtures.richSopBlocks);
    const ir = JSON.parse(JSON.stringify(blocksToIR(input))) as IRDocument;
    expect(documentToBlocks(irToDocument(ir))).toStrictEqual(input);
  });
});

describe('IR round trip of list and table edge cases', () => {
  const para = (id: string, text: string): Block => ({
    id,
    type: 'paragraph',
    props: { textAlign: 'left' },
    content: [{ type: 'text', text, styles: {} }],
  });

  it('keeps separate adjacent lists apart and restores nesting', () => {
    const input: Block[] = [
      {
        id: 'a',
        type: 'bulletList',
        props: {},
        children: [
          { id: 'a1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'x', styles: {} }] },
        ],
      },
      {
        id: 'b',
        type: 'orderedList',
        props: { start: 4 },
        children: [
          {
            id: 'b1',
            type: 'listItem',
            props: {},
            content: [{ type: 'text', text: 'y', styles: {} }],
            children: [
              para('b1p', 'note under y'),
              {
                id: 'b2',
                type: 'bulletList',
                props: {},
                children: [
                  { id: 'b2a', type: 'listItem', props: {}, content: [{ type: 'text', text: 'deep', styles: {} }] },
                ],
              },
              para('b1q', 'trailing note'),
            ],
          },
        ],
      },
    ];
    expect(roundTrip(input)).toStrictEqual(input);
  });

  it('round-trips a table with row and column spans and nested lists in cells', () => {
    const input: Block[] = [
      {
        id: 't',
        type: 'table',
        props: {},
        children: [
          {
            id: 'r1',
            type: 'tableRow',
            props: {},
            children: [
              {
                id: 'c1',
                type: 'tableCell',
                props: { colspan: 2, rowspan: 1, colwidth: [100, 100], backgroundColor: '#EEEEEE' },
                children: [para('c1p', 'wide')],
              },
            ],
          },
          {
            id: 'r2',
            type: 'tableRow',
            props: {},
            children: [
              {
                id: 'c2',
                type: 'tableCell',
                props: { colspan: 1, rowspan: 2, colwidth: [100], backgroundColor: null },
                children: [para('c2p', 'tall')],
              },
              {
                id: 'c3',
                type: 'tableCell',
                props: { colspan: 1, rowspan: 1, colwidth: [100], backgroundColor: null },
                children: [
                  {
                    id: 'l',
                    type: 'bulletList',
                    props: {},
                    children: [{ id: 'l1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'in cell', styles: {} }] }],
                  },
                ],
              },
            ],
          },
          {
            id: 'r3',
            type: 'tableRow',
            props: {},
            children: [
              {
                id: 'c4',
                type: 'tableCell',
                props: { colspan: 1, rowspan: 1, colwidth: [100], backgroundColor: null },
                children: [para('c4p', 'row three')],
              },
            ],
          },
        ],
      },
    ];
    expect(roundTrip(input)).toStrictEqual(input);
  });

  it('round-trips an empty block list', () => {
    expect(roundTrip([])).toStrictEqual([]);
  });

  it('keeps a table grid consistent with the row spans', () => {
    const ir = blocksToIR(clone(fixtures.richSopBlocks));
    const table = ir.sections[0].body.find((block): block is Extract<IRBlock, { type: 'table' }> => block.type === 'table' && block.source?.blockId === 'tbl-1');
    expect(table).toBeDefined();
    expect(table?.grid).toHaveLength(2);
    for (const row of table?.rows ?? []) {
      const width = row.cells.reduce((sum, cell) => sum + cell.props.gridSpan, 0);
      expect(width).toBe(2);
    }
  });
});
