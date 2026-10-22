/**
 * Round trip: core block JSON -> IR -> DOCX (export-docx) -> IR (this importer).
 */

import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { exportDocx } from '@amusendame/beakblock-export-docx';
import { blocksToIR, type IRDocument, type IRField, type IRParagraph, type IRTable } from '@amusendame/beakblock-ir';

import { importDocx } from './importDocx';


function text(content: string) {
  return { type: 'text', text: content, styles: {} };
}

const sampleBlocks = [
  { id: 'h1', type: 'heading', props: { level: 1 }, content: [text('Purpose')] },
  { id: 'p1', type: 'paragraph', props: {}, content: [text('First paragraph.')] },
  {
    id: 't1',
    type: 'table',
    props: {},
    children: [
      {
        id: 'r1',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'c1', type: 'tableCell', props: {}, children: [{ id: 'cp1', type: 'paragraph', props: {}, content: [text('A1')] }] },
          { id: 'c2', type: 'tableCell', props: {}, children: [{ id: 'cp2', type: 'paragraph', props: {}, content: [text('B1')] }] },
        ],
      },
      {
        id: 'r2',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'c3', type: 'tableCell', props: {}, children: [{ id: 'cp3', type: 'paragraph', props: {}, content: [text('A2')] }] },
          { id: 'c4', type: 'tableCell', props: {}, children: [{ id: 'cp4', type: 'paragraph', props: {}, content: [text('B2')] }] },
        ],
      },
    ],
  },
  { id: 'p2', type: 'paragraph', props: {}, content: [text('Last paragraph.')] },
];

function paragraphTexts(blocks: IRDocument['sections'][number]['body']): string[] {
  return blocks
    .filter((b): b is IRParagraph => b.type === 'paragraph')
    .map((p) => p.runs.map((r) => (r.type === 'run' ? r.text : '')).join(''))
    .filter((t) => t.length > 0);
}

describe('round trip through export-docx', () => {
  it('preserves paragraph text and table shape', async () => {
    const ir = blocksToIR(sampleBlocks as unknown as Parameters<typeof blocksToIR>[0]);
    const bytes = await exportDocx(ir);
    const { ir: imported, losses } = await importDocx(bytes);

    expect(losses.filter((l) => l.severity === 'error')).toEqual([]);
    const body = imported.sections[0].body;
    expect(paragraphTexts(body)).toEqual(expect.arrayContaining(['Purpose', 'First paragraph.', 'Last paragraph.']));

    const table = body.find((b): b is IRTable => b.type === 'table');
    expect(table).toBeDefined();
    expect(table!.rows.map((row) => row.cells.length)).toEqual([2, 2]);
    const cellText = table!.rows.map((row) =>
      row.cells.map((cell) => cell.blocks.map((b) => (b.type === 'paragraph' ? b.runs.map((r) => (r.type === 'run' ? r.text : '')).join('') : '')).join('')),
    );
    expect(cellText).toEqual([
      ['A1', 'B1'],
      ['A2', 'B2'],
    ]);
  });
});

describe('LIMS fields through DOCX', () => {
  const limsBlocks = [
    {
      id: 'p-lims',
      type: 'paragraph',
      props: {},
      content: [
        text('Acceptance within '),
        { type: 'field', fieldType: 'LIMS', name: 'temperatureLimitPlusMinus', fallback: '0.5' },
        text(' degrees.'),
      ],
    },
  ];

  it('reads a LIMS field back as a LIMS field with its name and cached text', async () => {
    const ir = blocksToIR(limsBlocks as unknown as Parameters<typeof blocksToIR>[0]);
    const bytes = await exportDocx(ir);
    const { ir: imported } = await importDocx(bytes);

    const paragraph = imported.sections[0].body.find((b): b is IRParagraph => b.type === 'paragraph');
    const field = paragraph!.runs.find((r): r is IRField => r.type === 'field');
    expect(field).toMatchObject({
      fieldType: 'LIMS',
      name: 'temperatureLimitPlusMinus',
      instr: 'LIMS temperatureLimitPlusMinus',
      cachedText: '0.5',
    });
  });

  it('writes the LIMS field as a DOCVARIABLE complex field', async () => {
    const ir = blocksToIR(limsBlocks as unknown as Parameters<typeof blocksToIR>[0]);
    const bytes = await exportDocx(ir);
    const xml = strFromU8(unzipSync(bytes)['word/document.xml']);
    expect(xml).toContain('DOCVARIABLE beak.lims.temperatureLimitPlusMinus');
    expect(xml).toContain('<w:t xml:space="preserve">0.5</w:t>');
  });
});
