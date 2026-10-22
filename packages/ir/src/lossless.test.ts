import type { Block } from '@amusendame/beakblock-core';
import { blocksToDocument, documentToBlocks } from '@amusendame/beakblock-schema';
import { describe, expect, it } from 'vitest';

import { documentToIR, irToDocument, validateIR, MAX_NUMBERING_LEVEL } from './index';
import type { IRBlock, IRParagraph, IRWarning } from './index';
import { cloneJson } from '@amusendame/beakblock-core';

const clone = <T>(value: T): T => cloneJson(value);

function roundTrip(blocks: Block[], options?: Parameters<typeof documentToIR>[1]) {
  const doc = blocksToDocument(clone(blocks));
  const ir = documentToIR(doc, options);
  return { ir, output: documentToBlocks(irToDocument(ir)) };
}

function para(id: string, text: string): Block {
  return { id, type: 'paragraph', props: {}, content: [{ type: 'text', text, styles: {} }] };
}

function paragraphsOf(blocks: IRBlock[]): IRParagraph[] {
  return blocks.filter((block): block is IRParagraph => block.type === 'paragraph');
}

describe('custom inline nodes', () => {
  const inlineBlock: Block = {
    id: 'p-inline',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'SOP-QA-0101 ', styles: {} },
      { type: 'documentIdentifier', props: { id: 'docid-1', property: 'docNumberRevision', fallback: 'SOP-QA-0101 r3' } },
      { type: 'footnote', props: { text: 'Vendor note' }, content: [{ type: 'text', text: 'see note', styles: {} }] },
      { type: 'inlineEquation', props: { latex: 'LOD = 3.3\\,\\sigma / S' } },
      { type: 'variable', props: { name: 'operatorName', format: null } },
      { type: 'mystery', props: { code: 'X-9' } },
      { type: 'text', text: ' end', styles: {} },
    ],
  };

  it('maps custom inline nodes to IR custom inlines with a plain-text fallback', () => {
    const { ir } = roundTrip([inlineBlock]);
    const runs = paragraphsOf(ir.sections[0].body)[0].runs;
    expect(runs.map((run) => run.type)).toEqual(['run', 'custom', 'custom', 'custom', 'custom', 'custom', 'run']);
    expect(runs[1]).toMatchObject({ type: 'custom', inlineType: 'documentIdentifier', text: 'SOP-QA-0101 r3', props: { id: 'docid-1' } });
    expect(runs[2]).toMatchObject({ type: 'custom', inlineType: 'footnote', text: 'see note' });
    expect(runs[3]).toMatchObject({ type: 'custom', inlineType: 'inlineEquation', text: '' });
    expect(runs[5]).toMatchObject({ type: 'custom', inlineType: 'mystery', props: { code: 'X-9' }, text: '' });
  });

  it('round-trips custom inline nodes exactly', () => {
    const { ir, output } = roundTrip([inlineBlock]);
    expect(output).toStrictEqual([inlineBlock]);
    expect(validateIR(ir).filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('keeps custom inline nodes through a JSON serialisation of the IR', () => {
    const doc = blocksToDocument(clone([inlineBlock]));
    const ir = JSON.parse(JSON.stringify(documentToIR(doc))) as ReturnType<typeof documentToIR>;
    expect(documentToBlocks(irToDocument(ir))).toStrictEqual([inlineBlock]);
  });

  it('keeps a custom inline node that sits inside a link', () => {
    const block: Block = {
      id: 'p-link',
      type: 'paragraph',
      props: {},
      content: [{ type: 'link', href: 'https://example.com', content: [{ type: 'text', text: 'a', styles: {} }] }],
    };
    expect(roundTrip([block]).output).toStrictEqual([block]);
  });
});

describe('empty list containers', () => {
  it('keeps an empty checkList block', () => {
    const input: Block[] = [para('p1', 'before'), { id: 'cl-empty', type: 'checkList', props: {}, children: [] }, para('p2', 'after')];
    expect(roundTrip(input).output).toStrictEqual(input);
  });

  it('keeps an empty bulletList and orderedList with their props', () => {
    const input: Block[] = [
      { id: 'ul-empty', type: 'bulletList', props: { tight: true }, children: [] },
      { id: 'ol-empty', type: 'orderedList', props: { start: 3 }, children: [] },
    ];
    expect(roundTrip(input).output).toStrictEqual(input);
  });

  it('keeps an empty nested list inside a list item', () => {
    const input: Block[] = [
      {
        id: 'ul-outer',
        type: 'bulletList',
        props: {},
        children: [
          {
            id: 'li-1',
            type: 'listItem',
            props: {},
            content: [{ type: 'text', text: 'parent', styles: {} }],
            children: [{ id: 'cl-nested', type: 'checkList', props: {}, children: [] }],
          },
          { id: 'li-2', type: 'listItem', props: {}, content: [{ type: 'text', text: 'sibling', styles: {} }] },
        ],
      },
    ];
    expect(roundTrip(input).output).toStrictEqual(input);
  });
});

describe('list depth', () => {
  function nested(depth: number): Block {
    const build = (level: number): Block => {
      const item: Block = {
        id: `li-${level}`,
        type: 'listItem',
        props: {},
        content: [{ type: 'text', text: `Level ${level}`, styles: {} }],
      };
      if (level < depth) item.children = [{ id: `ul-${level + 1}`, type: 'bulletList', props: {}, children: [build(level + 1)] }];
      return item;
    };
    return { id: 'ul-0', type: 'bulletList', props: {}, children: [build(1)] };
  }

  it('clamps numbering to the highest defined level and keeps the validated IR clean', () => {
    const { ir } = roundTrip([nested(12)]);
    const levels = paragraphsOf(ir.sections[0].body)
      .map((paragraph) => paragraph.props.numbering?.level)
      .filter((level): level is number => level !== undefined);
    expect(Math.max(...levels)).toBe(MAX_NUMBERING_LEVEL);
    expect(validateIR(ir).filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('keeps the true depth in the source so the round trip is lossless', () => {
    const input = [nested(12)];
    const { ir, output } = roundTrip(input);
    expect(output).toStrictEqual(input);
    const depths = paragraphsOf(ir.sections[0].body).map((paragraph) => paragraph.source?.list?.level);
    expect(Math.max(...(depths as number[]))).toBe(11);
  });

  it('reports each clamped list through onWarning', () => {
    const warnings: IRWarning[] = [];
    roundTrip([nested(12)], { onWarning: (warning) => warnings.push(warning) });
    expect(warnings.length).toBe(3);
    expect(warnings[0]).toMatchObject({ code: 'list-depth-clamped', depth: MAX_NUMBERING_LEVEL + 1, numberingLevel: MAX_NUMBERING_LEVEL });
  });

  it('does not report lists within the defined depth', () => {
    const warnings: IRWarning[] = [];
    roundTrip([nested(4)], { onWarning: (warning) => warnings.push(warning) });
    expect(warnings).toEqual([]);
  });
});
