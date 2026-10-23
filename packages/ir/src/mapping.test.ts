import type { Block } from '@amusendame/beakblock-core';
import { blocksToDocument, fixtures } from '@amusendame/beakblock-schema';
import { describe, expect, it } from 'vitest';

import {
  blocksToIR,
  documentToIR,
  fieldInstruction,
  irToDocument,
  validateIR,
  IR_VERSION,
} from './index';
import { runsToInline } from './toDocument';
import type { IRBlock, IRDocument, IRInline, IRParagraph, IRTable } from './index';
import { cloneJson } from '@amusendame/beakblock-core';

const clone = <T>(value: T): T => cloneJson(value);

function bodyOf(blocks: Block[]): IRBlock[] {
  return blocksToIR(clone(blocks)).sections[0].body;
}

function paragraphs(body: IRBlock[]): IRParagraph[] {
  return body.filter((block): block is IRParagraph => block.type === 'paragraph');
}

function runsOf(paragraph: IRParagraph): IRInline[] {
  return paragraph.runs;
}

function text(value: string) {
  return { type: 'text', text: value, styles: {} };
}

describe('IR_VERSION', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(IR_VERSION)).toBe(true);
    expect(IR_VERSION).toBeGreaterThanOrEqual(1);
  });
});

describe('field instructions', () => {
  it('builds the instruction text for each field type', () => {
    expect(fieldInstruction('PAGE')).toBe('PAGE');
    expect(fieldInstruction('NUMPAGES')).toBe('NUMPAGES');
    expect(fieldInstruction('DOCPROPERTY', 'docNumber')).toBe('DOCPROPERTY docNumber');
    expect(fieldInstruction('SEQ', 'Figure')).toBe('SEQ Figure \\* ARABIC');
    expect(fieldInstruction('SEQ', 'Table', 'ROMAN')).toBe('SEQ Table \\* ROMAN');
    expect(fieldInstruction('REF', 'h-purpose')).toBe('REF h-purpose \\h');
    expect(fieldInstruction('DATE', null, 'yyyy-MM-dd')).toBe('DATE \\@ "yyyy-MM-dd"');
    expect(fieldInstruction('TOC')).toBe('TOC \\o "1-3" \\h \\z \\u');
  });

  it('adds a format switch to PAGE and DOCPROPERTY when given', () => {
    expect(fieldInstruction('PAGE', null, 'ARABIC')).toBe('PAGE \\* ARABIC');
    expect(fieldInstruction('DOCPROPERTY', 'revision', 'Upper')).toBe('DOCPROPERTY revision \\* Upper');
  });

  it('emits the same instructions in the document IR', () => {
    const body = bodyOf(fixtures.richSopBlocks);
    const fields = paragraphs(body).flatMap((paragraph) => paragraph.runs).filter((inline) => inline.type === 'field');
    const instructions = fields.map((field) => (field.type === 'field' ? field.instr : ''));
    expect(instructions).toEqual(
      expect.arrayContaining([
        'DOCPROPERTY docNumber',
        'PAGE',
        'NUMPAGES',
        'SEQ Figure \\* ARABIC',
        'REF h-purpose \\h',
      ])
    );
  });

  it('keeps cached text from fallback and empty when absent', () => {
    const body = bodyOf([
      {
        id: 'p',
        type: 'paragraph',
        props: {},
        content: [
          { type: 'field', fieldType: 'DOCPROPERTY', name: 'docNumber', fallback: 'SOP-001' },
          { type: 'field', fieldType: 'PAGE', name: null },
        ] as unknown as Block['content'],
      },
    ]);
    const runs = runsOf(paragraphs(body)[0]);
    expect(runs[0]).toMatchObject({ type: 'field', cachedText: 'SOP-001', instr: 'DOCPROPERTY docNumber' });
    expect(runs[1]).toMatchObject({ type: 'field', cachedText: '', instr: 'PAGE', name: null });
  });

  it('keeps the cached result of an imported field when it has no fallback', () => {
    const inline = runsToInline([
      { type: 'field', fieldType: 'DOCPROPERTY', instr: 'DOCPROPERTY docNumber', name: 'docNumber', cachedText: 'SOP-001' },
    ] as IRInline[]);
    expect(inline[0]).toMatchObject({ type: 'field', fallback: 'SOP-001', name: 'docNumber' });
  });

  it('prefers an explicit fallback over the cached result', () => {
    const inline = runsToInline([
      { type: 'field', fieldType: 'PAGE', instr: 'PAGE', cachedText: '3', fallback: '1' },
    ] as IRInline[]);
    expect(inline[0]).toMatchObject({ type: 'field', fallback: '1' });
  });
});

describe('block mapping', () => {
  it('maps headings to paragraph styles', () => {
    const body = bodyOf(fixtures.richSopBlocks);
    const heading = body.find((block) => block.source?.blockId === 'h-steps') as IRParagraph;
    expect(heading.type).toBe('paragraph');
    expect(heading.props.styleId).toBe('Heading3');
    expect(heading.props.align).toBe('right');
    expect(heading.source?.props).toMatchObject({ level: 3, locked: true, lockId: 'lock-1' });
  });

  it('maps bullet and ordered lists to numbered paragraphs with nesting levels', () => {
    const body = bodyOf(fixtures.richSopBlocks);
    const byId = (id: string) => body.find((block) => block.source?.blockId === id) as IRParagraph;

    expect(byId('li-1').props.numbering).toEqual({ numId: '1', level: 0 });
    expect(byId('li-2').props.numbering).toEqual({ numId: '1', level: 1 });
    expect(byId('li-3').props.numbering).toEqual({ numId: '1', level: 0 });
    expect(byId('oli-1').props.numbering).toEqual({ numId: '2', level: 0 });
    expect(byId('oli-2a').props.numbering).toEqual({ numId: '2', level: 1 });
    expect(byId('cli-1').props.numbering).toEqual({ numId: '4', level: 0 });
    expect(byId('li-1').source?.list).toMatchObject({ role: 'item', containerId: 'bl-1', containerType: 'bulletList', level: 0 });
    expect(byId('p-child-1').source?.list).toEqual({ role: 'childBlock', level: 0 });
  });

  it('maps blockquote, callout, code and divider to styled paragraphs', () => {
    const body = bodyOf(fixtures.richSopBlocks);
    const byId = (id: string) => body.find((block) => block.source?.blockId === id) as IRParagraph;
    expect(byId('bq-1').props.styleId).toBe('Quote');
    expect(byId('co-1').props.styleId).toBe('CalloutWarning');
    expect(byId('co-1').source?.props).toMatchObject({ calloutType: 'warning' });
    expect(byId('cb-1').props.styleId).toBe('Code');
    expect(byId('dv-1').props.styleId).toBe('Divider');
  });

  it('maps page breaks to a paragraph containing a page break run', () => {
    const body = bodyOf(fixtures.richSopBlocks);
    const pageBreak = body.find((block) => block.source?.blockId === 'pb-1') as IRParagraph;
    expect(pageBreak.runs).toEqual([{ type: 'break', kind: 'page' }]);
  });

  it('maps images to image blocks with points width', () => {
    const body = bodyOf(fixtures.richSopBlocks);
    const image = body.find((block) => block.type === 'image');
    expect(image).toMatchObject({ type: 'image', src: 'https://example.com/diagram.png', widthPt: 240, alt: 'Diagram' });
  });

  it('maps columns to a borderless table with one cell per column', () => {
    const body = bodyOf(fixtures.richSopBlocks);
    const columns = body.find((block) => block.source?.blockId === 'cols-1') as IRTable;
    expect(columns.type).toBe('table');
    expect(columns.rows).toHaveLength(1);
    expect(columns.rows[0].cells).toHaveLength(2);
    expect(columns.grid).toHaveLength(2);
    expect(columns.grid.reduce((a, b) => a + b, 0)).toBeGreaterThan(8900);
  });

  it('maps the table of contents to a TOC field', () => {
    const body = bodyOf(fixtures.richSopBlocks);
    const toc = body.find((block) => block.source?.blockId === 'toc-1') as IRParagraph;
    expect(toc.runs[0]).toMatchObject({ type: 'field', fieldType: 'TOC', cachedText: 'Purpose' });
    expect(toc.source?.props).toEqual({ items: [{ id: 'h-purpose', level: 1, text: 'Purpose' }] });
  });

  it('maps revisions, links, icons and breaks onto runs', () => {
    const body = bodyOf(fixtures.richSopBlocks);
    const intro = body.find((block) => block.source?.blockId === 'p-intro') as IRParagraph;
    const runs = intro.runs;

    const inserted = runs.find((run) => run.type === 'run' && run.text === 'inserted');
    expect(inserted).toMatchObject({
      type: 'run',
      revision: { kind: 'insert', id: 'rev-1', author: 'Asha', authorId: 'u-1', at: '2026-01-02T10:00:00.000Z' },
    });
    const deleted = runs.find((run) => run.type === 'run' && run.text === 'deleted');
    expect(deleted).toMatchObject({ revision: { kind: 'delete', id: 'rev-2', aiGenerated: true } });

    const link = runs.find((run) => run.type === 'run' && run.text === 'the index');
    expect(link).toMatchObject({ link: { href: 'https://example.com/sop-index', title: 'SOP index', target: '_blank' } });

    expect(runs).toContainEqual({ type: 'break', kind: 'line' });
    expect(runs).toContainEqual(expect.objectContaining({ type: 'icon', icon: 'warning' }));

    const bold = runs.find((run) => run.type === 'run' && run.text === 'bold');
    expect(bold).toMatchObject({ props: { bold: true } });
    const code = runs.find((run) => run.type === 'run' && run.text === 'italic code');
    expect(code).toMatchObject({ props: { italic: true, styleId: 'Code' } });
    const coloured = runs.find((run) => run.type === 'run' && run.text === 'red');
    expect(coloured).toMatchObject({ props: { color: '#C00000' } });
  });

  it('maps paragraph properties through to ParaProps', () => {
    const body = bodyOf(fixtures.richSopBlocks);
    const styled = body.find((block) => block.source?.blockId === 'p-styled') as IRParagraph;
    expect(styled.props).toMatchObject({
      align: 'center',
      styleId: 'Normal',
      keepNext: true,
      indent: { leftPt: 18, firstLinePt: 9 },
      tabs: [{ posPt: 72, kind: 'left' }],
    });
    expect(styled.props).not.toHaveProperty('keepLines', true);
  });
});

describe('table mapping', () => {
  it('uses restart and continue cells for vertical merges', () => {
    const table = bodyOf(fixtures.richSopBlocks).find((block) => block.source?.blockId === 'tbl-1') as IRTable;
    expect(table.props).toMatchObject({ styleId: 'TableGrid', widthMode: 'pct', widthValue: 5000 });
    expect(table.grid).toHaveLength(2);

    const [header, row2, row3] = table.rows;
    expect(header.props).toMatchObject({ isHeader: true, cantSplit: true, heightTwips: 400 });
    expect(header.cells[0].props).toMatchObject({ gridSpan: 2, shading: '#D9E2F3' });
    expect(row2.cells[0].props).toMatchObject({ gridSpan: 1, vMerge: 'restart' });
    expect(row3.cells[0].props).toMatchObject({ vMerge: 'continue' });
    expect(row3.cells[0].blocks).toEqual([]);
    expect(row3.cells[1].props).toMatchObject({ gridSpan: 1 });
  });

  it('computes the grid from colwidth when every column width is known', () => {
    const blocks: Block[] = [
      {
        id: 't',
        type: 'table',
        props: {},
        children: [
          {
            id: 'r',
            type: 'tableRow',
            props: {},
            children: [
              { id: 'a', type: 'tableCell', props: { colspan: 1, rowspan: 1, colwidth: [100] }, children: [] },
              { id: 'b', type: 'tableCell', props: { colspan: 1, rowspan: 1, colwidth: [200] }, children: [] },
            ],
          },
        ],
      },
    ];
    const table = bodyOf(blocks)[0] as IRTable;
    expect(table.grid).toEqual([1500, 3000]);
  });

  it('falls back to an equal split of 9000 twips when widths are unknown', () => {
    const blocks: Block[] = [
      {
        id: 't',
        type: 'table',
        props: {},
        children: [
          {
            id: 'r',
            type: 'tableRow',
            props: {},
            children: [
              { id: 'a', type: 'tableCell', props: { colspan: 1, rowspan: 1 }, children: [] },
              { id: 'b', type: 'tableCell', props: { colspan: 1, rowspan: 1 }, children: [] },
              { id: 'c', type: 'tableCell', props: { colspan: 1, rowspan: 1 }, children: [] },
            ],
          },
        ],
      },
    ];
    const table = bodyOf(blocks)[0] as IRTable;
    expect(table.grid.reduce((a, b) => a + b, 0)).toBe(9000);
    expect(table.grid).toHaveLength(3);
  });

  it('keeps table props absent when they were absent in the source', () => {
    const blocks: Block[] = [
      { id: 't', type: 'table', props: {}, children: [] },
    ];
    const table = bodyOf(blocks)[0] as IRTable;
    expect(table.props).toEqual({});
    expect(table.grid).toEqual([]);
  });
});

describe('controlled sections', () => {
  it('maps controlledSection to an sdt tagged with the section id', () => {
    const body = bodyOf(fixtures.richSopBlocks);
    const sdt = body.find((block) => block.type === 'sdt');
    expect(sdt).toMatchObject({ type: 'sdt', tag: 'sec-scope-1', alias: 'Scope' });
    if (sdt?.type !== 'sdt') throw new Error('expected sdt');
    expect(sdt.blocks).toHaveLength(1);
    expect(sdt.source?.props).toMatchObject({ sectionId: 'sec-scope-1', templateSectionId: 'tpl-scope' });
  });

  it('restores the sectionId prop from the tag on reconstruction', () => {
    const doc = irToDocument(blocksToIR(clone(fixtures.richSopBlocks)));
    const section = doc.sections[0].blocks.find((block) => block.type === 'controlledSection');
    expect(section?.props).toMatchObject({ sectionId: 'sec-scope-1' });
  });

  it('uses the block id as the tag when no sectionId is given', () => {
    const body = bodyOf([{ id: 'cs', type: 'controlledSection', props: {}, children: [] }]);
    expect(body[0]).toMatchObject({ type: 'sdt', tag: 'cs' });
  });
});

describe('unknown block types', () => {
  const unknown: Block = {
    id: 'mystery-1',
    type: 'hologram',
    props: { depth: 3 },
    content: [text('projected')] as Block['content'],
  };

  it('keeps unknown blocks as a paragraph with source and never throws', () => {
    const body = bodyOf([unknown]);
    const paragraph = body[0] as IRParagraph;
    expect(paragraph.type).toBe('paragraph');
    expect(paragraph.runs).toEqual([expect.objectContaining({ type: 'run', text: 'projected' })]);
    expect(paragraph.source).toMatchObject({ blockType: 'hologram', blockId: 'mystery-1', props: { depth: 3 } });
    expect(paragraph.source?.unknown).toBe(true);
  });

  it('keeps an unknown inline item as a custom inline with its props and content', () => {
    const block = {
      id: 'p-mystery',
      type: 'paragraph',
      props: {},
      content: [
        text('Inline: '),
        { type: 'mystery', props: { code: 'X-9' } },
        text(' continues.'),
      ] as unknown as Block['content'],
    } as Block;
    const paragraph = bodyOf([block])[0] as IRParagraph;
    expect(paragraph.runs).toEqual([
      expect.objectContaining({ type: 'run', text: 'Inline: ' }),
      expect.objectContaining({ type: 'custom', inlineType: 'mystery', props: { code: 'X-9' } }),
      expect.objectContaining({ type: 'run', text: ' continues.' }),
    ]);
    expect(paragraph.source?.unknown).toBeUndefined();
  });

  it('reconstructs unknown blocks exactly', () => {
    const doc = blocksToDocument([clone(unknown)]);
    const back = irToDocument(documentToIR(doc));
    expect(back.sections[0].blocks).toStrictEqual([unknown]);
  });

  it('uses a registry toIR when provided', () => {
    const registry = {
      get: (type: string) =>
        type === 'hologram'
          ? {
              toIR: (block: Block) => ({
                type: 'passthrough',
                xml: `<holo depth="${String(block.props.depth)}"/>`,
                preview: 'hologram',
              }),
            }
          : undefined,
    };
    const doc = blocksToDocument([clone(unknown)]);
    const ir = documentToIR(doc, { registry });
    expect(ir.sections[0].body[0]).toMatchObject({
      type: 'passthrough',
      xml: '<holo depth="3"/>',
      source: { blockType: 'hologram', blockId: 'mystery-1' },
    });
  });

  it('falls back when the registry serializer throws', () => {
    const registry = {
      get: () => ({
        toIR: () => {
          throw new Error('boom');
        },
      }),
    };
    const ir = documentToIR(blocksToDocument([clone(unknown)]), { registry });
    expect(ir.sections[0].body[0].type).toBe('paragraph');
  });
});

describe('validateIR', () => {
  it('reports no errors for the rich fixture', () => {
    const issues = validateIR(blocksToIR(clone(fixtures.richSopBlocks)));
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('reports grid mismatches, unknown styles and numbering, and missing sdt tags', () => {
    const ir: IRDocument = blocksToIR(clone(fixtures.richSopBlocks));
    const table = ir.sections[0].body.find((block) => block.type === 'table' && block.source?.blockId === 'tbl-1') as IRTable;
    table.rows[1].cells.pop();
    const paragraph = ir.sections[0].body.find((block) => block.type === 'paragraph') as IRParagraph;
    paragraph.props.styleId = 'NoSuchStyle';
    paragraph.props.numbering = { numId: '404', level: 0 };
    ir.sections[0].body.push({ type: 'sdt', tag: '', blocks: [] });

    const codes = validateIR(ir).map((issue) => issue.code);
    expect(codes).toContain('grid-mismatch');
    expect(codes).toContain('unknown-style');
    expect(codes).toContain('unknown-numbering');
    expect(codes).toContain('sdt-missing-tag');
  });

  it('reports orphan continuation cells', () => {
    const ir = blocksToIR(clone(fixtures.richSopBlocks));
    const table = ir.sections[0].body.find((block) => block.type === 'table' && block.source?.blockId === 'tbl-1') as IRTable;
    table.rows[0].cells = [{ props: { gridSpan: 1, vMerge: 'continue' }, blocks: [] }, ...table.rows[0].cells];
    expect(validateIR(ir).map((issue) => issue.code)).toContain('orphan-continue-cell');
  });
});
