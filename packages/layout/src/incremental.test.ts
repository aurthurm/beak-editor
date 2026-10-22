import type { IRBlock, IRDocument } from '@amusendame/beakblock-ir';
import { describe, expect, it } from 'vitest';

import { documentOf, fixedMeasurer, para, row, section, table } from './__fixtures__/builders';
import { layoutDocument, relayout } from './layout';
import type { LayoutResult } from './types';

const OPTIONS = { measurer: fixedMeasurer, now: new Date(2026, 9, 21) };

/**
 * Builds a body of `count` top-level leaf blocks: mostly paragraphs of varying length,
 * with keep-with-next headings, tables, and page breaks. `overrides` replaces the text
 * of selected block indices, so an edit can be simulated.
 */
function buildBody(count: number, overrides: Map<number, string> = new Map()): IRBlock[] {
  const body: IRBlock[] = [];
  for (let index = 0; index < count; index += 1) {
    if (index % 37 === 0 && index > 0) {
      body.push(
        para(overrides.get(index) ?? `Heading ${index}`, { styleId: 'Heading1', keepNext: true }, `h-${index}`)
      );
      continue;
    }
    if (index % 53 === 0 && index > 0) {
      const rows = Array.from({ length: 6 }, (_value, r) => row([`cell ${index}-${r}`], r === 0 ? { isHeader: true } : {}));
      body.push(table([4513, 4513], rows));
      continue;
    }
    if (index % 91 === 0 && index > 0) {
      body.push(para(overrides.get(index) ?? `Break ${index}`, { pageBreakBefore: true }, `pb-${index}`));
      continue;
    }
    const lineCount = (index % 5) + 1;
    const text = overrides.get(index) ?? Array.from({ length: lineCount }, (_v, l) => `Block ${index} line ${l} ${'lorem ipsum dolor '.repeat(4)}`).join('\n');
    body.push(para(text, {}, `b-${index}`));
  }
  return body;
}

function docWith(body: IRBlock[], sections = 1): IRDocument {
  if (sections === 1) return documentOf([section('sec-1', body)]);
  const half = Math.floor(body.length / 2);
  return documentOf([
    section('sec-1', body.slice(0, half)),
    section('sec-2', body.slice(half), {
      pageSetup: {
        size: { widthTwips: 16838, heightTwips: 11906 },
        orientation: 'landscape',
        margins: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720, gutter: 0 },
      },
    }),
  ]);
}

/** Checks that relayout gives exactly the result of a full layout. */
function expectEquivalent(prev: LayoutResult, ir: IRDocument, from: number) {
  const incremental = relayout(prev, ir, from, OPTIONS);
  const full = layoutDocument(ir, OPTIONS);
  expect(incremental).toEqual(full);
  return incremental;
}

describe('incremental relayout', () => {
  const count = 400;
  const base = docWith(buildBody(count));
  const prev = layoutDocument(base, OPTIONS);

  it('produces the same result as a full layout for edits across the document', () => {
    for (const index of [0, 1, 36, 37, 52, 90, 150, 233, 300, 388, 399]) {
      const edited = docWith(buildBody(count, new Map([[index, `Edited ${index} ${'more text here '.repeat(index % 7 + 1)}`]])));
      expectEquivalent(prev, edited, index);
    }
  });

  it('keeps earlier pages as the same objects when the edit is late', () => {
    const edited = docWith(buildBody(count, new Map([[count - 3, 'A late edit to a paragraph.']])));
    const next = relayout(prev, edited, count - 3, OPTIONS);
    expect(next.pages.length).toBe(prev.pages.length);
    expect(next.pages[0].body).toBe(prev.pages[0].body);
    expect(next).toEqual(layoutDocument(edited, OPTIONS));
  });

  it('is equivalent when an edit makes a keep-with-next heading move', () => {
    // Heading at 37 is kept with block 38; lengthening 38 changes the heading's page.
    for (const index of [37, 38, 74, 75]) {
      const edited = docWith(buildBody(count, new Map([[index, 'x\n'.repeat(30)]])));
      expectEquivalent(prev, edited, index);
    }
  });

  it('is equivalent for multi-section documents', () => {
    const multi = docWith(buildBody(count), 2);
    const multiPrev = layoutDocument(multi, OPTIONS);
    const edited = docWith(buildBody(count, new Map([[300, 'Changed in the landscape section.']])), 2);
    expectEquivalent(multiPrev, edited, 300);
    expectEquivalent(multiPrev, docWith(buildBody(count, new Map([[10, 'Changed early.']])), 2), 10);
  });

  it('falls back to a full layout when the previous result is empty', () => {
    const empty: LayoutResult = { ...prev, pages: [], resumePoints: [] };
    expect(relayout(empty, base, 0, OPTIONS)).toEqual(prev);
  });
});

describe('incremental relayout with controlled sections', () => {
  it('matches a full layout when an sdt child changes', () => {
    const children: IRBlock[] = Array.from({ length: 30 }, (_value, index) => para(`child ${index} ${'text '.repeat(40)}`, {}, `c-${index}`));
    const body: IRBlock[] = [
      ...buildBody(120),
      { type: 'sdt', tag: 'sec-a', blocks: children, lock: 'sdtLocked' },
      ...buildBody(60).map((block, index) => ({ ...block, source: { blockType: 'paragraph', blockId: `tail-${index}` } }) as IRBlock),
    ];
    const ir = docWith(body);
    const prev = layoutDocument(ir, OPTIONS);
    const editedChildren = children.map((child, index) => (index === 12 ? para('changed child twelve', {}, 'c-12') : child));
    const edited = docWith([
      ...buildBody(120),
      { type: 'sdt', tag: 'sec-a', blocks: editedChildren, lock: 'sdtLocked' },
      ...buildBody(60).map((block, index) => ({ ...block, source: { blockType: 'paragraph', blockId: `tail-${index}` } }) as IRBlock),
    ]);
    // Block 120 is the first sdt child (block indices count sdt children in document order).
    expectEquivalent(prev, edited, 120 + 12);
    expect(layoutDocument(edited, OPTIONS).pages.some((page) => page.body.some((fragment) => fragment.kind === 'sdtStart'))).toBe(true);
  });
});
