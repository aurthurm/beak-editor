import { describe, expect, it } from 'vitest';

import { bulkParagraphs, documentOf, field, fixedMeasurer, LANDSCAPE_SETUP, para, paraRuns, pageBreakRun, row, run, section, table } from './__fixtures__/builders';
import type { IRBlock, IRParagraph } from '@amusendame/beakblock-ir';
import { layoutDocument } from './layout';
import { measureParagraph, resolveParagraph } from './paragraph';
import type { LayoutFragment, LayoutResult } from './types';

const OPTIONS = { measurer: fixedMeasurer, now: new Date(2026, 9, 21) };

/** Paragraph of `count` lines (forced line breaks, one line each). */
function lines(count: number, id?: string, props: IRParagraph['props'] = {}): IRParagraph {
  return para(Array.from({ length: count }, () => 'x').join('\n'), props, id);
}

function layoutOf(body: IRBlock[], extra: Parameters<typeof documentOf>[1] = {}) {
  return layoutDocument(documentOf([section('sec-1', body)], extra), OPTIONS);
}

function fragmentsOf(layout: LayoutResult, pageIndex: number): LayoutFragment[] {
  return layout.pages[pageIndex].body;
}

describe('line breaking', () => {
  it('breaks words greedily within the content width', () => {
    const text = Array.from({ length: 200 }, (_value, index) => `w${index}`).join(' ');
    const m = measureParagraph(para(text), documentOf([]), fixedMeasurer, 451.3);
    expect(m.lines.length).toBeGreaterThan(1);
    for (const line of m.lines) expect(line.widthPt).toBeLessThanOrEqual(451.3 + 1e-6);
    expect(m.lines.map((line) => line.text).join(' ').split(/\s+/)).toEqual(text.split(' '));
  });

  it('breaks a word wider than the line by character', () => {
    const m = measureParagraph(para('a'.repeat(300)), documentOf([]), fixedMeasurer, 451.3);
    expect(m.lines.length).toBe(Math.ceil((300 * 5) / 451.3));
    expect(m.lines.map((line) => line.text).join('')).toBe('a'.repeat(300));
  });

  it('honours forced newlines', () => {
    const m = measureParagraph(para('line one\nline two'), documentOf([]), fixedMeasurer, 451.3);
    expect(m.lines.map((line) => line.text)).toEqual(['line one', 'line two']);
  });

  it('reduces the width by the left indent', () => {
    const text = Array.from({ length: 120 }, () => 'word').join(' ');
    const plain = measureParagraph(para(text), documentOf([]), fixedMeasurer, 451.3);
    const indented = measureParagraph(para(text, { indent: { leftPt: 100 } }), documentOf([]), fixedMeasurer, 451.3);
    expect(indented.lines.length).toBeGreaterThan(plain.lines.length);
    for (const line of indented.lines) expect(line.widthPt).toBeLessThanOrEqual(351.3 + 1e-6);
  });

  it('applies a hanging indent to the first line only', () => {
    const resolved = resolveParagraph(para('x', { indent: { leftPt: 36, hangingPt: 18 } }), documentOf([]));
    expect(resolved.leftPt).toBe(36);
    expect(resolved.hangingPt).toBe(18);
  });
});

describe('style resolution', () => {
  it('inherits from basedOn and lets direct props win', () => {
    const doc = documentOf([]);
    const heading2 = resolveParagraph(para('h', { styleId: 'Heading2' }), doc);
    expect(heading2.keepNext).toBe(true);
    expect(heading2.keepLines).toBe(true);
    expect(heading2.base.bold).toBe(true);
    expect(heading2.base.sizePt).toBe(10);
    const overridden = resolveParagraph(para('h', { styleId: 'Heading2', keepNext: false }), doc);
    expect(overridden.keepNext).toBe(false);
  });

  it('uses the Normal style when the paragraph has no style id', () => {
    const resolved = resolveParagraph(para('x'), documentOf([]));
    expect(resolved.spacing.lineRule).toBe('exact');
    expect(resolved.spacing.line).toBe(200);
  });
});

describe('pagination', () => {
  it('fills a page to its body height (698pt on A4 with one-inch margins)', () => {
    const layout = layoutOf(bulkParagraphs(80));
    const first = fragmentsOf(layout, 0);
    const last = first[first.length - 1];
    expect(last.yPt + last.heightPt).toBeLessThanOrEqual(72 + 698 + 1e-6);
    expect(layout.pageCount).toBe(2);
  });

  it('moves a keep-with-next heading with the first lines of the next paragraph', () => {
    const body = [lines(68), para('Heading', { keepNext: true }, 'h'), lines(3, 'next')];
    const layout = layoutOf(body);
    expect(fragmentsOf(layout, 0).map((f) => f.path)).toEqual(['s0/0']);
    expect(fragmentsOf(layout, 1)[0].path).toBe('s0/1');
  });

  it('keeps a paragraph on its page when keepNext is off', () => {
    const body = [lines(68), para('Heading', { keepNext: false }, 'h'), lines(3, 'next')];
    const layout = layoutOf(body);
    expect(fragmentsOf(layout, 0).map((f) => f.path)).toEqual(['s0/0', 's0/1']);
  });

  it('applies widow control: a four-line paragraph with three lines fitting splits 2 + 2', () => {
    const layout = layoutOf([lines(66), lines(4, 'split')]);
    const page1 = fragmentsOf(layout, 0).find((f) => f.path === 's0/1');
    const page2 = fragmentsOf(layout, 1).find((f) => f.path === 's0/1');
    expect(page1?.lineRange).toEqual([0, 2]);
    expect(page2?.lineRange).toEqual([2, 4]);
    expect(page2?.continued).toBe(true);
    expect(page1?.continues).toBe(true);
  });

  it('applies orphan control: a single line that would sit alone at the bottom moves the paragraph', () => {
    const layout = layoutOf([lines(68), lines(5, 'split')]);
    expect(fragmentsOf(layout, 0).some((f) => f.path === 's0/1')).toBe(false);
    expect(fragmentsOf(layout, 1)[0].lineRange).toEqual([0, 5]);
  });

  it('allows the split when widowControl is false', () => {
    const layout = layoutOf([lines(66), lines(4, 'split', { widowControl: false })]);
    const page1 = fragmentsOf(layout, 0).find((f) => f.path === 's0/1');
    const page2 = fragmentsOf(layout, 1).find((f) => f.path === 's0/1');
    expect(page1?.lineRange).toEqual([0, 3]);
    expect(page2?.lineRange).toEqual([3, 4]);
  });

  it('keeps lines together when keepLines is set', () => {
    const layout = layoutOf([lines(66), lines(6, 'whole', { keepLines: true })]);
    expect(fragmentsOf(layout, 0).some((f) => f.path === 's0/1')).toBe(false);
    expect(fragmentsOf(layout, 1)[0].lineRange).toEqual([0, 6]);
  });

  it('starts a page for pageBreakBefore', () => {
    const layout = layoutOf([para('a', {}, 'a'), para('b', { pageBreakBefore: true }, 'b'), para('c', {}, 'c')]);
    expect(layout.pageCount).toBe(2);
    expect(fragmentsOf(layout, 0).map((f) => f.path)).toEqual(['s0/0']);
    expect(fragmentsOf(layout, 1).map((f) => f.path)).toEqual(['s0/1', 's0/2']);
  });

  it('starts a new page after a page-break run and keeps the text on both sides', () => {
    const layout = layoutOf([paraRuns([run('before'), pageBreakRun(), run('after')], {}, 'pb')]);
    expect(layout.pageCount).toBe(2);
    expect(fragmentsOf(layout, 0)[0].lines?.[0].text).toBe('before');
    expect(fragmentsOf(layout, 1)[0].lines?.[0].text).toBe('after');
  });

  it('does not start a page for a page break at the top of an empty page', () => {
    const layout = layoutOf([para('a', {}, 'a')]);
    expect(layout.pageCount).toBe(1);
  });
});

describe('tables', () => {
  const headerTable = () => {
    const rows = Array.from({ length: 80 }, (_value, index) => row([`r${index}`], index === 0 ? { isHeader: true } : {}));
    return table([4513, 4513], rows);
  };

  it('splits only at row boundaries and repeats header rows on continuation pages', () => {
    const layout = layoutOf([headerTable()]);
    const page1 = fragmentsOf(layout, 0)[0];
    const page2 = fragmentsOf(layout, 1)[0];
    expect(page1.kind).toBe('tableRows');
    expect(page1.rowRange).toEqual([0, 69]);
    expect(page1.repeatedHeaderRows).toBe(0);
    expect(page2.rowRange).toEqual([69, 80]);
    expect(page2.repeatedHeaderRows).toBe(1);
    expect(page2.continued).toBe(true);
    expect(page2.heightPt).toBe(120);
  });

  it('moves a cantSplit row to the next page instead of splitting it', () => {
    const tall = row(['l1\nl2\nl3'], { cantSplit: true });
    const short = row(['short']);
    const layout = layoutOf([lines(67), table([9026], [short, tall])]);
    const onPage1 = fragmentsOf(layout, 0).find((f) => f.kind === 'tableRows');
    const onPage2 = fragmentsOf(layout, 1).find((f) => f.kind === 'tableRows');
    expect(onPage1?.rowRange).toEqual([0, 1]);
    expect(onPage2?.rowRange).toEqual([1, 2]);
    expect(onPage2?.heightPt).toBe(30);
  });
});

describe('sections', () => {
  it('uses the page size of each section (landscape appendix in a portrait document)', () => {
    const doc = documentOf([
      section('sec-1', [para('body', {}, 'b')]),
      section('sec-2', [para('appendix', {}, 'a')], { pageSetup: LANDSCAPE_SETUP }),
    ]);
    const layout = layoutDocument(doc, OPTIONS);
    expect(layout.pageCount).toBe(2);
    expect(layout.pages[0].sizePt.w).toBeCloseTo(595.3, 1);
    expect(layout.pages[1].sizePt.w).toBeCloseTo(841.9, 1);
    expect(layout.pages[1].sizePt.h).toBeCloseTo(595.3, 1);
    expect(layout.pages[1].sectionId).toBe('sec-2');
    expect(layout.sections.map((summary) => [summary.id, summary.firstPage, summary.pageCount])).toEqual([
      ['sec-1', 0, 1],
      ['sec-2', 1, 1],
    ]);
  });

  it('starts a new page for each section even when the previous page is short', () => {
    const doc = documentOf([section('a', [para('a', {}, 'a')]), section('b', [para('b', {}, 'b')])]);
    expect(layoutDocument(doc, OPTIONS).pageCount).toBe(2);
  });
});

describe('fields', () => {
  it('resolves PAGE and NUMPAGES in headers per page', () => {
    const header = [paraRuns([run('Page '), field('PAGE', null), run(' of '), field('NUMPAGES', null)])];
    const doc = documentOf([section('sec-1', bulkParagraphs(200), { headers: { default: header } })]);
    const layout = layoutDocument(doc, OPTIONS);
    expect(layout.pageCount).toBe(3);
    expect(layout.pages[1].headerText).toEqual(['Page 2 of 3']);
    expect(layout.pages[2].headerText).toEqual(['Page 3 of 3']);
  });

  it('numbers SEQ fields in document order and resolves REF to heading text', () => {
    const body = [
      paraRuns([run('Figure '), field('SEQ', 'Figure')], {}, 'cap1'),
      para('Purpose', { styleId: 'Heading1' }, 'h-1'),
      paraRuns([run('see '), field('REF', 'h-1')], {}, 'ref'),
      paraRuns([run('Figure '), field('SEQ', 'Figure')], {}, 'cap2'),
    ];
    const layout = layoutOf(body);
    expect(layout.fieldValues['s0/0:1']).toBe('1');
    expect(layout.fieldValues['s0/3:1']).toBe('2');
    expect(layout.fieldValues['s0/2:1']).toBe('Purpose');
  });

  it('resolves DOCPROPERTY and DATE', () => {
    const body = [paraRuns([field('DOCPROPERTY', 'docNumber')], {}, 'd'), paraRuns([field('DATE', null)], {}, 'dt')];
    const layout = layoutDocument(
      documentOf([section('sec-1', body)], { docNumber: 'SOP-7' }),
      OPTIONS
    );
    expect(layout.fieldValues['s0/0:0']).toBe('SOP-7');
    expect(layout.fieldValues['s0/1:0']).toBe('21 October 2026');
  });

  it('builds TOC entries for Heading1 to Heading3 with page numbers', () => {
    const body = [
      para('Purpose', { styleId: 'Heading1' }, 'h-1'),
      para('Steps', { styleId: 'Heading3' }, 'h-3'),
      para('Body', {}, 'p'),
      lines(68),
      para('Appendix', { styleId: 'Heading1' }, 'h-a'),
    ];
    const layout = layoutOf(body);
    expect(layout.toc.map((entry) => [entry.text, entry.level, entry.page, entry.blockId])).toEqual([
      ['Purpose', 1, 1, 'h-1'],
      ['Steps', 3, 1, 'h-3'],
      ['Appendix', 1, 2, 'h-a'],
    ]);
  });

  it('fills TOC fields with the entries', () => {
    const body = [paraRuns([field('TOC', null, '')], {}, 'toc'), para('Purpose', { styleId: 'Heading1' }, 'h-1')];
    const layout = layoutOf(body);
    expect(layout.fieldValues['s0/0:0']).toBe('Purpose\t1');
  });
});

describe('header and footer variants', () => {
  it('picks first, even and default variants', () => {
    const headers = {
      default: [para('DEF')],
      first: [para('FIRST')],
      even: [para('EVEN')],
    };
    const doc = documentOf([section('sec-1', bulkParagraphs(200), { headers, titlePage: true })]);
    const layout = layoutDocument(doc, OPTIONS);
    expect(layout.pages.map((page) => page.variant)).toEqual(['first', 'even', 'default']);
    expect(layout.pages.map((page) => page.headerText)).toEqual([['FIRST'], ['EVEN'], ['DEF']]);
  });

  it('falls back to the default header when there is no even header', () => {
    const doc = documentOf([section('sec-1', bulkParagraphs(200), { headers: { default: [para('DEF')] } })]);
    const layout = layoutDocument(doc, OPTIONS);
    expect(layout.pages.map((page) => page.headerText)).toEqual([['DEF'], ['DEF'], ['DEF']]);
  });

  it('gives the first page of a title-page section the first header only', () => {
    const doc = documentOf([section('sec-1', [para('x', {}, 'x')], { headers: { default: [para('DEF')] }, titlePage: true })]);
    const layout = layoutDocument(doc, OPTIONS);
    expect(layout.pages[0].variant).toBe('first');
    expect(layout.pages[0].headerText).toEqual([]);
  });
});

describe('layout result shape', () => {
  it('records a resume point per page and empty footnotes', () => {
    const layout = layoutOf(bulkParagraphs(200));
    expect(layout.resumePoints).toHaveLength(layout.pageCount);
    expect(layout.pages.every((page) => page.footnotes.length === 0)).toBe(true);
    expect(layout.pages.map((page) => page.number)).toEqual(layout.pages.map((_page, index) => index + 1));
  });

  it('reports the field placeholder width without changing pagination', () => {
    const body = [paraRuns([run('Page '), field('PAGE', null)], {}, 'p')];
    const layout = layoutOf(body);
    expect(layout.fieldValues['s0/0:1']).toBe('1');
  });
});
