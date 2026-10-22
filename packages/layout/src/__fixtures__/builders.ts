/**
 * Hand-built IR documents for layout tests. They avoid the schema package so the layout
 * package type-checks on its own; the rich SOP fixture is covered in `fixtures.test.ts`.
 *
 * The default Normal style uses fixed 10pt exact lines (200 twips) so that heights are easy to
 * reason about, and {@link fixedMeasurer} charges 5pt per character at 10pt.
 *
 * @module
 */

import type {
  IRBlock,
  IRDocument,
  IRField,
  IRInline,
  IRParagraph,
  IRRun,
  IRSection,
  IRTable,
  IRTableCell,
  IRTableRow,

} from '@amusendame/beakblock-ir';

type StyleSheet = IRDocument['styles'];

import type { Measurer } from '../types';

/** A4 portrait with one-inch margins (842 x 595 pt page, 451 pt content width). */
export const PORTRAIT_SETUP: IRSection['pageSetup'] = {
  size: { widthTwips: 11906, heightTwips: 16838 },
  orientation: 'portrait',
  margins: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720, gutter: 0 },
};

/** A4 landscape with one-inch margins. */
export const LANDSCAPE_SETUP: IRSection['pageSetup'] = {
  size: { widthTwips: 16838, heightTwips: 11906 },
  orientation: 'landscape',
  margins: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720, gutter: 0 },
};

/** Fixed-line measurer: 5pt per character at 10pt, 10pt exact lines (200 twips). */
export const fixedMeasurer: Measurer = {
  measureText: (text, _run, sizePt) => (text.length * sizePt) / 2,
  lineHeightPt: (sizePt, spacing) => (spacing && spacing.lineRule === 'exact' ? spacing.line / 20 : sizePt * 1.2),
};

/** Minimal style sheet: Normal (10pt, exact 10pt lines), Heading1, Heading2, Caption, Quote. */
export function styleSheet(): StyleSheet {
  return {
    paragraph: {
      Normal: {
        id: 'Normal',
        name: 'Normal',
        basedOn: null,
        paraProps: { spacing: { beforePt: 0, afterPt: 0, line: 200, lineRule: 'exact' } },
        runProps: { font: 'Carlito', sizePt: 10 },
      },
      Heading1: {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        paraProps: { keepNext: true, keepLines: true, spacing: { beforePt: 6, afterPt: 0, line: 200, lineRule: 'exact' } },
        runProps: { bold: true, sizePt: 10 },
        outlineLevel: 0,
      },
      Heading2: {
        id: 'Heading2',
        name: 'Heading 2',
        basedOn: 'Heading1',
        paraProps: { keepNext: true },
        runProps: { sizePt: 10 },
        outlineLevel: 1,
      },
      Caption: { id: 'Caption', name: 'Caption', basedOn: 'Normal', runProps: { italic: true } },
      Quote: { id: 'Quote', name: 'Quote', basedOn: 'Normal', paraProps: { indent: { leftPt: 20 } } },
    },
    character: {},
    table: {
      TableGrid: {
        id: 'TableGrid',
        name: 'Table Grid',
        basedOn: null,
        cellPaddingPt: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    },
  };
}

/** Empty numbering definitions. */
export function emptyNumbering(): IRDocument['numbering'] {
  return { abstract: {}, instances: {} };
}

/** A paragraph with one plain run. */
export function para(text: string, props: IRParagraph['props'] = {}, id?: string): IRParagraph {
  const paragraph: IRParagraph = { type: 'paragraph', props, runs: [{ type: 'run', text, props: {} }] };
  if (id) paragraph.source = { blockType: 'paragraph', blockId: id };
  return paragraph;
}

/** A paragraph from explicit inline items. */
export function paraRuns(runs: IRInline[], props: IRParagraph['props'] = {}, id?: string): IRParagraph {
  const paragraph: IRParagraph = { type: 'paragraph', props, runs };
  if (id) paragraph.source = { blockType: 'paragraph', blockId: id };
  return paragraph;
}

/** A plain text run. */
export function run(text: string, props: IRRun['props'] = {}): IRInline {
  return { type: 'run', text, props };
}

/** A field inline. */
export function field(fieldType: IRField['fieldType'], name: string | null, cachedText = '', fallback: string | null = null): IRInline {
  const instr = fieldType === 'PAGE' || fieldType === 'NUMPAGES' ? fieldType : `${fieldType}${name ? ` ${name}` : ''}`;
  return { type: 'field', fieldType, instr, name, cachedText, fallback };
}

/** A page break inline. */
export function pageBreakRun(): IRInline {
  return { type: 'break', kind: 'page' };
}

/** A table row with one-line cells. */
export function row(texts: string[], props: IRTableRow['props'] = {}): IRTableRow {
  return {
    props,
    cells: texts.map((text): IRTableCell => ({ props: { gridSpan: 1 }, blocks: [para(text)] })),
  };
}

/** A table with the given grid (twips) and rows. */
export function table(grid: number[], rows: IRTableRow[], props: IRTable['props'] = {}): IRTable {
  return { type: 'table', props, grid, rows };
}

/** A section with a page setup, body and optional headers/footers. */
export function section(
  id: string,
  body: IRBlock[],
  extra: Partial<Pick<IRSection, 'pageSetup' | 'titlePage' | 'headers' | 'footers'>> = {}
): IRSection {
  return { id, pageSetup: extra.pageSetup ?? PORTRAIT_SETUP, body, ...(extra.titlePage !== undefined ? { titlePage: extra.titlePage } : {}), ...(extra.headers ? { headers: extra.headers } : {}), ...(extra.footers ? { footers: extra.footers } : {}) };
}

/** A document with the test style sheet. */
export function documentOf(sections: IRSection[], properties: IRDocument['properties'] = {}): IRDocument {
  return { irVersion: 1, id: 'doc-test', properties, styles: styleSheet(), numbering: emptyNumbering(), sections };
}

/** `count` paragraphs of `lines` lines each (fixed measurer: about 90 characters per line). */
export function bulkParagraphs(count: number, linesEach = 1, prefix = 'Paragraph'): IRParagraph[] {
  const charsPerLine = 80;
  return Array.from({ length: count }, (_value, index) =>
    para(`${prefix} ${index} ${'x'.repeat(Math.max(linesEach * charsPerLine - prefix.length - 12, 1))}`, {}, `b-${index}`)
  );
}
