/**
 * Block measurement and the pagination loop.
 *
 * The paginator walks the flat unit list once. Its state at the start of every page
 * is a {@link ResumePoint}, which is what makes incremental relayout exact: a page
 * can be recomputed from its resume point alone.
 *
 * @module
 */

import type { IRBlock, IRDocument, IRImageBlock, IRSection, IRTable } from '@amusendame/beakblock-ir';

import { measureParagraph, sectionGeometry } from './paragraph';
import type { ParagraphMeasure, SectionGeometry } from './paragraph';
import { flattenSections } from './units';
import type { LayoutUnit } from './units';
import type { LayoutFragment, LayoutPage, Measurer, PageVariant, ResumePoint } from './types';

/** Height of a passthrough block (opaque XML) in points. */
export const PASSTHROUGH_HEIGHT_PT = 24;

/** Default cell padding (points) when the table style does not set one. */
const DEFAULT_CELL_PADDING = { top: 0, right: 5.4, bottom: 0, left: 5.4 };

/** Measured table: row heights and column widths in points. */
export interface TableMeasure {
  rowHeights: number[];
  headerCount: number;
  totalPt: number;
  colWidths: number[];
}

/** Measured body unit. */
interface UnitMeasure {
  para?: ParagraphMeasure;
  table?: TableMeasure;
  heightPt: number;
}

/** Engine state shared by one layout or relayout call. */
export interface EngineContext {
  doc: IRDocument;
  sections: IRSection[];
  geoms: SectionGeometry[];
  units: LayoutUnit[];
  measurer: Measurer;
  measureCache: Map<number, UnitMeasure>;
  bandCache: Map<string, { fragments: LayoutFragment[]; heightPt: number }>;
}

/** Creates the engine context for a document. */
export function createEngine(doc: IRDocument, measurer: Measurer): EngineContext {
  const sections = doc.sections.length > 0 ? doc.sections : [defaultSection()];
  return {
    doc,
    sections,
    geoms: sections.map((section) => sectionGeometry(section)),
    units: flattenSections(sections),
    measurer,
    measureCache: new Map(),
    bandCache: new Map(),
  };
}

function defaultSection(): IRSection {
  return {
    id: 'sec-1',
    pageSetup: {
      size: { widthTwips: 11906, heightTwips: 16838 },
      orientation: 'portrait',
      margins: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720, gutter: 0 },
    },
    body: [],
  };
}

/** Height of an image block, given the width available to it. */
export function imageHeight(image: IRImageBlock, widthPt: number): number {
  if (image.heightPt !== undefined) {
    if (image.widthPt !== undefined && image.widthPt > widthPt && image.widthPt > 0) {
      return image.heightPt * (widthPt / image.widthPt);
    }
    return image.heightPt;
  }
  const width = Math.min(image.widthPt ?? widthPt, widthPt);
  return width * 0.75;
}

/** Cell padding of a table, from its style or the default. */
function cellPadding(ctx: EngineContext, table: IRTable) {
  const style = table.props.styleId ? ctx.doc.styles.table[table.props.styleId] : undefined;
  const padding = style?.cellPaddingPt ?? ctx.doc.styles.table.TableGrid?.cellPaddingPt;
  return {
    top: padding?.top ?? DEFAULT_CELL_PADDING.top,
    right: padding?.right ?? DEFAULT_CELL_PADDING.right,
    bottom: padding?.bottom ?? DEFAULT_CELL_PADDING.bottom,
    left: padding?.left ?? DEFAULT_CELL_PADDING.left,
  };
}

/** Height of a list of blocks laid out at `widthPt` with no page splitting. */
export function blocksHeight(ctx: EngineContext, blocks: readonly IRBlock[], widthPt: number): number {
  let total = 0;
  for (const block of blocks) {
    if (block.type === 'paragraph') {
      const m = measureParagraph(block, ctx.doc, ctx.measurer, widthPt);
      total += m.beforePt + m.linesHeightPt + m.afterPt;
    } else if (block.type === 'table') {
      total += measureTable(ctx, block, widthPt).totalPt;
    } else if (block.type === 'image') {
      total += imageHeight(block, widthPt);
    } else if (block.type === 'passthrough') {
      total += PASSTHROUGH_HEIGHT_PT;
    } else if (block.type === 'sdt') {
      total += blocksHeight(ctx, block.blocks, widthPt);
    }
  }
  return total;
}

/**
 * Measures a table at `widthPt`: column widths from the grid (scaled to the table width)
 * and row heights from the tallest cell in each row.
 */
export function measureTable(ctx: EngineContext, table: IRTable, widthPt: number): TableMeasure {
  const gridPt = table.grid.map((twips) => twips / 20);
  const gridTotal = gridPt.reduce((sum, value) => sum + value, 0);
  let targetWidth = Math.min(gridTotal || widthPt, widthPt);
  if (table.props.widthMode === 'pct' && table.props.widthValue) {
    targetWidth = (widthPt * table.props.widthValue) / 5000;
  }
  const scale = gridTotal > 0 ? targetWidth / gridTotal : 1;
  const colWidths = gridPt.map((value) => value * scale);
  const padding = cellPadding(ctx, table);

  const rowHeights = table.rows.map((row) => {
    let rowHeight = (row.props.heightTwips ?? 0) / 20;
    let column = 0;
    for (const cell of row.cells) {
      const span = Math.max(cell.props.gridSpan, 1);
      const cellWidth =
        colWidths.length > 0
          ? colWidths.slice(column, column + span).reduce((sum, value) => sum + value, 0)
          : (cell.props.widthTwips ?? widthPt * 20) / 20;
      column += span;
      if (cell.props.vMerge === 'continue') continue;
      const inner = Math.max(cellWidth - padding.left - padding.right, 1);
      const content = blocksHeight(ctx, cell.blocks, inner) + padding.top + padding.bottom;
      rowHeight = Math.max(rowHeight, content);
    }
    return rowHeight;
  });

  let headerCount = 0;
  while (headerCount < table.rows.length && table.rows[headerCount].props.isHeader) headerCount += 1;
  const totalPt = rowHeights.reduce((sum, value) => sum + value, 0);
  return { rowHeights, headerCount, totalPt, colWidths };
}

/** Measures a body unit at its section's content width. */
export function measureUnit(ctx: EngineContext, index: number): UnitMeasure {
  const cached = ctx.measureCache.get(index);
  if (cached) return cached;
  const unit = ctx.units[index];
  const geom = ctx.geoms[unit.section];
  const width = geom.contentWidthPt;
  let measure: UnitMeasure = { heightPt: 0 };
  if (unit.kind === 'paragraph' && unit.paragraph) {
    const para = measureParagraph(unit.paragraph, ctx.doc, ctx.measurer, width);
    measure = { para, heightPt: para.beforePt + para.linesHeightPt + para.afterPt };
  } else if (unit.kind === 'table' && unit.table) {
    const table = measureTable(ctx, unit.table, width);
    measure = { table, heightPt: table.totalPt };
  } else if (unit.kind === 'image' && unit.image) {
    const maxHeight = Math.max(geom.heightPt - geom.top - geom.bottom, 1);
    measure = { heightPt: Math.min(imageHeight(unit.image, width), maxHeight) };
  } else if (unit.kind === 'passthrough') {
    measure = { heightPt: PASSTHROUGH_HEIGHT_PT };
  }
  ctx.measureCache.set(index, measure);
  return measure;
}

/** Block variant chosen for a page. */
export function pickVariant(section: IRSection, sectionPageIndex: number, number: number): PageVariant {
  if (section.titlePage && sectionPageIndex === 0) return 'first';
  return number % 2 === 0 ? 'even' : 'default';
}

/**
 * Blocks of a header or footer for a variant, with fallbacks: `first` falls back to an
 * empty set when the section has no first-page header, and `even` to the default set.
 */
export function bandBlocks(section: IRSection, kind: 'header' | 'footer', variant: PageVariant): IRBlock[] {
  const set = kind === 'header' ? section.headers : section.footers;
  if (variant === 'first') return section.titlePage ? set?.first ?? [] : set?.default ?? [];
  if (variant === 'even') return set?.even ?? set?.default ?? [];
  return set?.default ?? [];
}

/**
 * Lays out a header or footer band. Header bands start at the header distance from the
 * top; footer bands end at the footer distance from the bottom.
 */
function buildBand(ctx: EngineContext, sectionIndex: number, kind: 'header' | 'footer', variant: PageVariant) {
  const key = `${sectionIndex}:${kind}:${variant}`;
  const cached = ctx.bandCache.get(key);
  if (cached) return cached;
  const section = ctx.sections[sectionIndex];
  const geom = ctx.geoms[sectionIndex];
  const blocks = bandBlocks(section, kind, variant);
  const width = geom.contentWidthPt;

  const items: Array<{ block: IRBlock; path: string; heightPt: number }> = [];
  const collect = (list: readonly IRBlock[], prefix: string) => {
    list.forEach((block, index) => {
      const path = `s${sectionIndex}/${kind}/${variant}/${prefix}${index}`;
      if (block.type === 'sdt') {
        collect(block.blocks, `${prefix}${index}.`);
        return;
      }
      items.push({ block, path, heightPt: blocksHeight(ctx, [block], width) });
    });
  };
  collect(blocks, '');

  const heightPt = items.reduce((sum, item) => sum + item.heightPt, 0);
  const startY = kind === 'header' ? geom.header : geom.heightPt - geom.footer - heightPt;
  let cursor = startY;
  const fragments: LayoutFragment[] = [];
  for (const item of items) {
    const block = item.block;
    const base = { blockIndex: -1, path: item.path, yPt: cursor, heightPt: item.heightPt, continued: false, continues: false };
    if (block.type === 'paragraph') {
      const m = measureParagraph(block, ctx.doc, ctx.measurer, width);
      fragments.push({
        ...base,
        kind: 'paragraph',
        lines: m.lines.map((line) => ({ text: line.text, widthPt: line.widthPt })),
        lineRange: [0, m.lines.length],
      });
    } else if (block.type === 'table') {
      fragments.push({ ...base, kind: 'tableRows', rowRange: [0, block.rows.length], repeatedHeaderRows: 0 });
    } else if (block.type === 'image') {
      fragments.push({ ...base, kind: 'image' });
    } else {
      fragments.push({ ...base, kind: 'passthrough' });
    }
    cursor += item.heightPt;
  }
  const band = { fragments, heightPt };
  ctx.bandCache.set(key, band);
  return band;
}

/** A page under construction, with its body region. */
interface PageFrame {
  page: LayoutPage;
  bodyTop: number;
  bodyBottom: number;
}

/** Creates an empty page for a section and index, with header and footer laid out. */
function startPage(ctx: EngineContext, sectionIndex: number, sectionPageIndex: number, index: number): PageFrame {
  const section = ctx.sections[sectionIndex];
  const geom = ctx.geoms[sectionIndex];
  const number = index + 1;
  const variant = pickVariant(section, sectionPageIndex, number);
  const header = buildBand(ctx, sectionIndex, 'header', variant);
  const footer = buildBand(ctx, sectionIndex, 'footer', variant);
  const bodyTop = Math.max(geom.top, geom.header + header.heightPt);
  const bodyBottom = Math.max(
    Math.min(geom.heightPt - geom.bottom, geom.heightPt - geom.footer - footer.heightPt),
    bodyTop + 1
  );
  const page: LayoutPage = {
    index,
    number,
    sectionId: section.id,
    sectionIndex,
    sizePt: { w: geom.widthPt, h: geom.heightPt },
    marginsPt: {
      top: geom.top,
      right: geom.right,
      bottom: geom.bottom,
      left: geom.left,
      header: geom.header,
      footer: geom.footer,
      gutter: geom.gutter,
    },
    header: header.fragments,
    footer: footer.fragments,
    body: [],
    footnotes: [],
    variant,
    headerText: [],
    footerText: [],
  };
  return { page, bodyTop, bodyBottom };
}

/** Index of the next unit after `index` that is not a sdt marker, or -1. */
function nextRealUnit(units: readonly LayoutUnit[], index: number): number {
  let next = index + 1;
  while (next < units.length && (units[next].kind === 'sdtStart' || units[next].kind === 'sdtEnd')) next += 1;
  return next < units.length ? next : -1;
}

/** Whether a unit is a paragraph with keep-with-next set. */
function keepsWithNext(ctx: EngineContext, index: number): boolean {
  const unit = ctx.units[index];
  return unit.kind === 'paragraph' && measureUnit(ctx, index).para?.keepNext === true;
}

/** Full height of a unit, including its spacing. */
function fullHeight(ctx: EngineContext, index: number): number {
  return measureUnit(ctx, index).heightPt;
}

/** Smallest chunk of a unit that can start a page (first lines, header plus first row). */
function firstChunk(ctx: EngineContext, index: number): number {
  const unit = ctx.units[index];
  const measure = measureUnit(ctx, index);
  if (unit.kind === 'paragraph' && measure.para) {
    const m = measure.para;
    const count = m.keepLines ? m.lines.length : Math.min(m.lines.length, m.widowControl ? 2 : 1);
    return m.beforePt + m.heights.slice(0, count).reduce((sum, value) => sum + value, 0);
  }
  if (unit.kind === 'table' && measure.table) {
    const t = measure.table;
    const headRows = t.rowHeights.slice(0, t.headerCount + 1);
    return headRows.reduce((sum, value) => sum + value, 0);
  }
  if (unit.kind === 'image' || unit.kind === 'passthrough') return measure.heightPt;
  return 0;
}

/**
 * Height a paragraph must keep together with the start of the next content: its own
 * height plus the first chunk of the next unit, following keep-with-next chains.
 */
function keepNeed(ctx: EngineContext, index: number, depth: number): number {
  const self = fullHeight(ctx, index);
  if (!keepsWithNext(ctx, index) || depth >= 8) return self;
  const next = nextRealUnit(ctx.units, index);
  if (next < 0) return self;
  const nextKeeps = keepsWithNext(ctx, next);
  const tail = nextKeeps ? keepNeed(ctx, next, depth + 1) : firstChunk(ctx, next);
  return self + tail;
}

/** Output of one pagination run. */
export interface PaginationOutput {
  pages: LayoutPage[];
  resumes: ResumePoint[];
}

/**
 * Paginates units from `start`. The first page gets index `firstIndex`. Pages are
 * returned without resolved field text.
 */
export function paginate(ctx: EngineContext, start: ResumePoint, firstIndex: number): PaginationOutput {
  const units = ctx.units;
  const pages: LayoutPage[] = [];
  const resumes: ResumePoint[] = [];

  let curSection = start.sectionIndex;
  let curSpi = start.sectionPageIndex;
  let frame = startPage(ctx, curSection, curSpi, firstIndex);
  let cursor = frame.bodyTop;
  let contentCount = 0;
  resumes.push({ ...start });

  let u = start.unitIndex;
  let lineOff = start.lineOffset;
  let rowOff = start.rowOffset;

  const avail = () => frame.bodyBottom - cursor;

  /** Finishes the current page and starts the next one at the given resume state. */
  const moveTo = (unitIndex: number, lo: number, ro: number, section: number) => {
    pages.push(frame.page);
    const spi = section === curSection ? curSpi + 1 : 0;
    curSection = section;
    curSpi = spi;
    const resume: ResumePoint = { unitIndex, lineOffset: lo, rowOffset: ro, sectionIndex: section, sectionPageIndex: spi };
    frame = startPage(ctx, section, spi, firstIndex + pages.length);
    cursor = frame.bodyTop;
    contentCount = 0;
    resumes.push(resume);
    u = unitIndex;
    lineOff = lo;
    rowOff = ro;
  };

  const place = (fragment: LayoutFragment) => {
    frame.page.body.push(fragment);
    contentCount += 1;
  };

  while (u < units.length) {
    const unit = units[u];
    switch (unit.kind) {
      case 'sectionStart': {
        if (contentCount > 0 || curSection !== unit.section) {
          moveTo(u + 1, 0, 0, unit.section);
        } else {
          u += 1;
        }
        break;
      }
      case 'pageBreak': {
        if (contentCount > 0) {
          moveTo(u + 1, 0, 0, curSection);
        } else {
          u += 1;
        }
        break;
      }
      case 'sdtStart':
      case 'sdtEnd': {
        frame.page.body.push({
          kind: unit.kind === 'sdtStart' ? 'sdtStart' : 'sdtEnd',
          blockIndex: -1,
          path: unit.path,
          yPt: cursor,
          heightPt: 0,
          continued: false,
          continues: false,
        });
        u += 1;
        break;
      }
      case 'paragraph': {
        const m = measureUnit(ctx, u).para as ParagraphMeasure;
        if (lineOff === 0 && m.pageBreakBefore && contentCount > 0) {
          moveTo(u, 0, 0, curSection);
          break;
        }
        if (lineOff === 0 && m.keepNext && contentCount > 0) {
          const need = keepNeed(ctx, u, 0);
          if (need > avail() && need <= frame.bodyBottom - frame.bodyTop) {
            moveTo(u, 0, 0, curSection);
            break;
          }
        }
        const n = m.lines.length;
        const rem = n - lineOff;
        const before = lineOff === 0 && contentCount > 0 ? m.beforePt : 0;
        const sumHeights = (from: number, to: number) => {
          let total = 0;
          for (let i = from; i < to; i += 1) total += m.heights[i];
          return total;
        };
        const fullH = before + sumHeights(lineOff, n) + m.afterPt;
        if (fullH <= avail()) {
          const from = lineOff;
          place(paragraphFragment(unit, m, cursor, before, m.afterPt, from, n));
          cursor += fullH;
          u += 1;
          lineOff = 0;
          break;
        }
        if (m.keepLines && lineOff === 0 && contentCount > 0) {
          moveTo(u, 0, 0, curSection);
          break;
        }
        let k = 0;
        let acc = before;
        while (k < rem && acc + m.heights[lineOff + k] <= avail()) {
          acc += m.heights[lineOff + k];
          k += 1;
        }
        if (k === rem) k = rem - 1;
        if (m.widowControl && k > 0 && k < rem) {
          if (rem - k < 2) k = rem - 2;
          if (k < 2) k = 0;
        }
        if (k === 0) {
          if (contentCount > 0) {
            moveTo(u, lineOff, 0, curSection);
            break;
          }
          k = 1;
        }
        const ends = lineOff + k === n;
        const after = ends ? m.afterPt : 0;
        const height = before + sumHeights(lineOff, lineOff + k) + after;
        place(paragraphFragment(unit, m, cursor, before, after, lineOff, lineOff + k));
        cursor += height;
        if (ends) {
          u += 1;
          lineOff = 0;
        } else {
          moveTo(u, lineOff + k, 0, curSection);
        }
        break;
      }
      case 'table': {
        const t = measureUnit(ctx, u).table;
        const rows = t?.rowHeights.length ?? 0;
        if (!t || rows === 0) {
          u += 1;
          rowOff = 0;
          break;
        }
        const repeated = rowOff > 0 && t.headerCount > 0 && rowOff >= t.headerCount ? t.headerCount : 0;
        let total = 0;
        for (let r = 0; r < repeated; r += 1) total += t.rowHeights[r];
        const repeatedH = total;
        let count = 0;
        while (rowOff + count < rows && total + t.rowHeights[rowOff + count] <= avail()) {
          total += t.rowHeights[rowOff + count];
          count += 1;
        }
        if (count === 0) {
          if (contentCount > 0) {
            moveTo(u, 0, rowOff, curSection);
            break;
          }
          count = 1;
          total = repeatedH + t.rowHeights[rowOff];
        }
        const from = rowOff;
        const to = rowOff + count;
        place({
          kind: 'tableRows',
          blockIndex: unit.blockIndex,
          path: unit.path,
          sourceBlockId: unit.sourceBlockId,
          yPt: cursor,
          heightPt: total,
          rowRange: [from, to],
          repeatedHeaderRows: repeated,
          continued: from > 0,
          continues: to < rows,
        });
        cursor += total;
        rowOff = to;
        if (rowOff >= rows) {
          u += 1;
          rowOff = 0;
        } else {
          moveTo(u, 0, rowOff, curSection);
        }
        break;
      }
      case 'image':
      case 'passthrough': {
        const h = measureUnit(ctx, u).heightPt;
        if (h <= avail() || contentCount === 0) {
          place({
            kind: unit.kind === 'image' ? 'image' : 'passthrough',
            blockIndex: unit.blockIndex,
            path: unit.path,
            sourceBlockId: unit.sourceBlockId,
            yPt: cursor,
            heightPt: h,
            continued: false,
            continues: false,
          });
          cursor += h;
          u += 1;
        } else {
          moveTo(u, 0, 0, curSection);
        }
        break;
      }
      default:
        u += 1;
        break;
    }
  }

  pages.push(frame.page);
  return { pages, resumes };
}

/** Builds a paragraph fragment for lines `[from, to)`. */
function paragraphFragment(
  unit: LayoutUnit,
  m: ParagraphMeasure,
  yPt: number,
  before: number,
  after: number,
  from: number,
  to: number
): LayoutFragment {
  let height = before + after;
  for (let i = from; i < to; i += 1) height += m.heights[i];
  const lines = m.lines.slice(from, to).map((line) => ({ text: line.text, widthPt: line.widthPt }));
  return {
    kind: 'paragraph',
    blockIndex: unit.blockIndex,
    path: unit.path,
    sourceBlockId: unit.sourceBlockId,
    yPt,
    heightPt: height,
    lines,
    lineRange: [from, to],
    continued: from > 0,
    continues: to < m.lines.length,
  };
}
