/**
 * IR to WordprocessingML body writer.
 *
 * One {@link DocxWriter} run produces the document part, the header and footer
 * parts, the style, numbering, settings and font parts, and the media list. The
 * writer never throws on content it cannot represent; it records an
 * {@link ExportLoss} and writes the closest valid structure instead.
 *
 * @module
 */

import type {
  IRBlock,
  IRDocument,
  IRField,
  IRHeaderFooterSet,
  IRImageBlock,
  IRInline,
  IRIcon,
  IRLink,
  IRParagraph,
  IRPassthrough,
  IRRevision,
  IRRun,
  IRSdt,
  IRSection,
  IRTable,
  IRTableCell,
  IRTableLook,
  IRTableRow,
} from '@amusendame/beakblock-ir';

import {
  bordersXml,
  createFontResolver,
  paragraphPropsInner,
  pPr,
  rPr,
  runPropsInner,
  shadingXml,
} from './formatting';
import type { FontResolver } from './formatting';
import { decodeDataUri, intrinsicSize, SUPPORTED_IMAGE_TYPES } from './images';
import {
  numberingMaps,
  numberingXml,
  Rels,
  REL_TYPES,
  settingsXml,
  stylesXml,
  WORD_NS,
  XML_DECL,
  fontTableXml,
} from './parts';
import type { NumberingMaps } from './parts';
import type { BorderSpec, ExportLoss, ExportLossCode } from './types';
import { checkFragment, element, escapeXml, emu, valEl } from './xml';

/** A media part to write into the package (path relative to the package root). */
export interface MediaPart {
  path: string;
  data: Uint8Array;
  contentType: string;
}

/** A header or footer part. */
export interface HeaderFooterPart {
  path: string;
  xml: string;
  rels: Rels;
  kind: 'header' | 'footer';
}

/** Everything the writer produces for one document. */
export interface WriterOutput {
  document: string;
  documentRels: Rels;
  parts: HeaderFooterPart[];
  media: MediaPart[];
  styles: string;
  numbering: string;
  settings: string;
  fontTable: string;
  losses: ExportLoss[];
}

/** Options accepted by the writer. */
export interface WriterOptions {
  fontMap?: Record<string, string>;
}

/** Fallback page setup for documents without sections (A4, one-inch margins). */
const DEFAULT_SECTION: IRSection = {
  id: 'default',
  pageSetup: {
    size: { widthTwips: 11906, heightTwips: 16838 },
    orientation: 'portrait',
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720, gutter: 0 },
  },
  body: [],
};

/** Text width used for default-sized pictures, in points (A4 with one-inch margins). */
const MAX_DEFAULT_IMAGE_WIDTH_PT = 468;

/** Width of the default table when no grid is known, in twips. */
const DEFAULT_TABLE_WIDTH_TWIPS = 9000;

/** First SDT id; ids are sequential so output is deterministic. */
const FIRST_SDT_ID = 1001;

const NONE: BlockResult = { xml: '', paragraph: false, consumed: false };

interface BlockResult {
  xml: string;
  /** The last emitted element is a paragraph. */
  paragraph: boolean;
  /** The section properties were written into this block. */
  consumed: boolean;
}

interface MediaEntry {
  /** Target relative to `word/`. */
  target: string;
  data: Uint8Array;
}

/**
 * Converts a bookmark or block id to a name Word accepts: letters, digits and
 * underscores, starting with a letter, at most 40 characters.
 *
 * @example
 * ```typescript
 * bookmarkName('h-purpose'); // 'h_purpose'
 * ```
 */
export function bookmarkName(id: string): string {
  let name = id.replace(/[^A-Za-z0-9_]/g, '_');
  if (!/^[A-Za-z]/.test(name)) name = `bm_${name}`;
  return name.slice(0, 40);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function deriveGrid(rows: IRTableRow[]): number[] {
  const first = rows[0];
  const columns = first ? sum(first.cells.map((cell) => cell.props.gridSpan || 1)) : 0;
  if (columns === 0) return [];
  return Array.from({ length: columns }, () => Math.round(DEFAULT_TABLE_WIDTH_TWIPS / columns));
}

function tableWidthXml(table: IRTable, grid: number[]): string {
  const mode = table.props.widthMode ?? 'auto';
  const value = table.props.widthValue;
  if (mode === 'pct' && typeof value === 'number') {
    return element('w:tblW', { 'w:w': Math.round(value * 50), 'w:type': 'pct' });
  }
  if (mode === 'fixed') {
    return element('w:tblW', { 'w:w': Math.round(value ?? sum(grid)), 'w:type': 'dxa' });
  }
  return element('w:tblW', { 'w:w': 0, 'w:type': 'auto' });
}

/** The `w:tblLook` element. Defaults match Word's header-row and first-column look. */
function tableLookXml(look: IRTableLook | undefined): string {
  const flags = look ?? { headerRow: true, firstColumn: true, bandedRows: false };
  let value = 0x0400; // noVBand
  if (flags.headerRow) value |= 0x0020;
  if (flags.lastRow) value |= 0x0040;
  if (flags.firstColumn) value |= 0x0080;
  if (!flags.bandedRows) value |= 0x0200; // noHBand
  return element('w:tblLook', {
    'w:val': value.toString(16).toUpperCase().padStart(4, '0'),
    'w:firstRow': flags.headerRow ? 1 : 0,
    'w:lastRow': flags.lastRow ? 1 : 0,
    'w:firstColumn': flags.firstColumn ? 1 : 0,
    'w:lastColumn': 0,
    'w:noHBand': flags.bandedRows ? 0 : 1,
    'w:noVBand': 1,
  });
}

/**
 * Prefix of the DOCVARIABLE name that carries a LIMS field through DOCX. The importer
 * (packages/import-docx) maps `DOCVARIABLE beak.lims.<name>` back to a LIMS field.
 */
export const LIMS_VARIABLE_PREFIX = 'beak.lims.';

/** Rewrites a LIMS instruction (`LIMS <name> [\* format]`) as a DOCVARIABLE instruction. */
function limsInstruction(instr: string): string {
  const match = /^LIMS\s+(\S+)(.*)$/.exec(instr);
  return match ? `DOCVARIABLE ${LIMS_VARIABLE_PREFIX}${match[1]}${match[2]}` : instr;
}

/** Stable key identifying a hyperlink target. */
function linkKey(link: IRLink): string {
  return `${link.href}|${link.title ?? ''}|${link.target ?? ''}`;
}

/**
 * Serialises an IR document into OOXML parts.
 *
 * @example
 * ```typescript
 * const output = new DocxWriter(ir).run();
 * output.document; // word/document.xml as a string
 * ```
 */
export class DocxWriter {
  /** Losses recorded so far, in document order. */
  readonly losses: ExportLoss[] = [];

  private readonly fonts: FontResolver;
  private readonly maps: NumberingMaps;
  private readonly bodyRels = new Rels();
  private rels: Rels;
  private readonly media = new Map<string, MediaEntry>();
  private readonly mediaParts: MediaPart[] = [];
  private readonly parts: HeaderFooterPart[] = [];
  private readonly revisionIds = new Map<string, number>();
  /** Bookmark names available in the document (paragraphs with a source id). */
  private readonly anchors = new Set<string>();
  /** Bookmark names targeted by REF fields. */
  private readonly referenced = new Set<string>();
  private readonly emittedBookmarks = new Set<string>();
  private nextRevisionId = 1;
  private nextBookmarkId = 1;
  private nextSdtId = FIRST_SDT_ID;
  private nextDrawingId = 1;
  private headerCount = 0;
  private footerCount = 0;

  constructor(
    private readonly ir: IRDocument,
    options: WriterOptions = {}
  ) {
    this.fonts = createFontResolver(options.fontMap);
    this.maps = numberingMaps(ir.numbering);
    this.rels = this.bodyRels;
    for (const section of ir.sections) {
      this.scan(section.body);
      for (const set of [section.headers, section.footers]) {
        if (!set) continue;
        for (const blocks of [set.default, set.first, set.even]) {
          if (blocks) this.scan(blocks);
        }
      }
    }
  }

  /** Writes every part for the document. */
  run(): WriterOutput {
    const sections = this.ir.sections.length > 0 ? this.ir.sections : [DEFAULT_SECTION];
    let body = '';
    sections.forEach((section, index) => {
      const sectPr = this.sectPr(section);
      if (index === sections.length - 1) {
        body += this.blockSequence(section.body) + sectPr;
      } else {
        body += this.blockSequence(section.body, sectPr);
      }
    });
    const document = `${XML_DECL}<w:document ${WORD_NS}><w:body>${body}</w:body></w:document>`;
    const styles = stylesXml(this.ir.styles, this.fonts);
    const numbering = numberingXml(this.ir.numbering, this.maps, this.fonts);
    const evenAndOdd = sections.some(
      (section) => section.headers?.even !== undefined || section.footers?.even !== undefined
    );
    this.bodyRels.add(REL_TYPES.styles, 'styles.xml');
    this.bodyRels.add(REL_TYPES.numbering, 'numbering.xml');
    this.bodyRels.add(REL_TYPES.settings, 'settings.xml');
    this.bodyRels.add(REL_TYPES.fontTable, 'fontTable.xml');
    return {
      document,
      documentRels: this.bodyRels,
      parts: this.parts,
      media: this.mediaParts,
      styles,
      numbering,
      settings: settingsXml(evenAndOdd),
      fontTable: fontTableXml(new Set(['Calibri', ...this.fonts.used])),
      losses: this.losses,
    };
  }

  private loss(code: ExportLossCode, message: string, blockId?: string, severity?: 'info' | 'warning'): void {
    const entry: ExportLoss = { code, message };
    if (blockId) entry.blockId = blockId;
    if (severity) entry.severity = severity;
    this.losses.push(entry);
  }

  /** Records bookmark anchors and REF targets so bookmarks and references can be matched. */
  private scan(blocks: IRBlock[]): void {
    for (const block of blocks) {
      if (block.type === 'paragraph') {
        if (block.source?.blockId) this.anchors.add(bookmarkName(block.source.blockId));
        for (const item of block.runs) {
          if (item.type !== 'field' || item.fieldType !== 'REF') continue;
          const match = /^REF\s+(\S+)/.exec(item.instr);
          if (match) this.referenced.add(bookmarkName(match[1]));
        }
      } else if (block.type === 'table') {
        for (const row of block.rows) {
          for (const cell of row.cells) this.scan(cell.blocks);
        }
      } else if (block.type === 'sdt') {
        this.scan(block.blocks);
      }
    }
  }

  /**
   * Serialises a block list. Word requires a block container (body, cell, header,
   * content control) to end with a paragraph, so one is added when needed. When
   * `sectPr` is given it is written into the last paragraph, or into an empty
   * paragraph if the list does not end with one.
   */
  private blockSequence(blocks: IRBlock[], sectPr?: string): string {
    let xml = '';
    let endsWithParagraph = false;
    let consumed = false;
    blocks.forEach((block, index) => {
      const result = this.block(block, index === blocks.length - 1 ? sectPr : undefined);
      xml += result.xml;
      endsWithParagraph = result.paragraph;
      consumed = result.consumed;
    });
    if (sectPr !== undefined) {
      if (!consumed) xml += `<w:p>${pPr(sectPr)}</w:p>`;
    } else if (!endsWithParagraph) {
      xml += '<w:p/>';
    }
    return xml;
  }

  private block(block: IRBlock, sectPr?: string): BlockResult {
    switch (block.type) {
      case 'paragraph':
        return { xml: this.paragraph(block, sectPr), paragraph: true, consumed: sectPr !== undefined };
      case 'table':
        return { xml: this.table(block), paragraph: false, consumed: false };
      case 'sdt':
        return { xml: this.sdt(block), paragraph: false, consumed: false };
      case 'passthrough':
        return this.passthrough(block, sectPr);
      case 'image':
        return this.imageBlock(block, sectPr);
      default:
        return NONE;
    }
  }

  private paragraph(p: IRParagraph, sectPr?: string): string {
    const blockId = p.source?.blockId;
    const numPr = this.numPr(p.props.numbering, blockId);
    const inner = paragraphPropsInner(p.props, { pStyle: p.props.styleId, numPr });
    const bookmark = this.bookmark(blockId);
    return `<w:p>${pPr(inner + (sectPr ?? ''))}${bookmark.start}${this.inlines(p.runs)}${bookmark.end}</w:p>`;
  }

  private numPr(ref: IRParagraph['props']['numbering'], blockId?: string): string {
    if (!ref) return '';
    const numId = this.maps.instance.get(ref.numId);
    if (numId === undefined) {
      this.loss('unknown-numbering', `Numbering instance "${ref.numId}" is not defined`, blockId);
      return '';
    }
    return `<w:numPr>${valEl('w:ilvl', ref.level)}${valEl('w:numId', numId)}</w:numPr>`;
  }

  private bookmark(blockId?: string): { start: string; end: string } {
    if (!blockId) return { start: '', end: '' };
    const name = bookmarkName(blockId);
    if (!this.referenced.has(name) || !this.anchors.has(name) || this.emittedBookmarks.has(name)) {
      return { start: '', end: '' };
    }
    this.emittedBookmarks.add(name);
    const id = this.nextBookmarkId++;
    return {
      start: `<w:bookmarkStart w:id="${id}" w:name="${name}"/>`,
      end: `<w:bookmarkEnd w:id="${id}"/>`,
    };
  }

  /**
   * Serialises inline content. Consecutive runs with the same hyperlink form one
   * `w:hyperlink`, and consecutive runs with the same revision form one `w:ins` or `w:del`.
   */
  /**
   * Custom inline nodes have no DOCX form yet. Each is written as a run of its plain-text
   * fallback, taking the run formatting and link or revision of the nearest run, so the text
   * stays in the Word file. The degradation is reported at info level.
   */
  private inlinesAsRuns(items: IRInline[]): IRInline[] {
    return items.map((item, index) => {
      if (item.type !== 'custom') return item;
      this.loss(
        'inline-degraded',
        `Custom inline "${item.inlineType}" was written as its plain-text fallback`,
        undefined,
        'info',
      );
      const neighbour = (items.slice(0, index).reverse().find((i) => i.type === 'run') ??
        items.slice(index + 1).find((i) => i.type === 'run')) as IRRun | undefined;
      const run: IRRun = { type: 'run', text: item.text, props: { ...(neighbour?.props ?? {}) } };
      if (neighbour?.link) run.link = { ...neighbour.link };
      if (neighbour?.revision) run.revision = { ...neighbour.revision };
      return run;
    });
  }

  private inlines(items: IRInline[]): string {
    let out = '';
    let openLink: string | null = null;
    let openRevision: string | null = null;
    let revisionClose = '';
    const closeRevision = () => {
      if (openRevision === null) return;
      out += revisionClose;
      openRevision = null;
      revisionClose = '';
    };
    const closeLink = () => {
      if (openLink === null) return;
      out += '</w:hyperlink>';
      openLink = null;
    };

    for (const item of this.inlinesAsRuns(items)) {
      if (item.type === 'run') {
        const nextLink = item.link && item.link.href ? linkKey(item.link) : null;
        if (nextLink !== openLink) {
          closeRevision();
          closeLink();
          if (nextLink !== null && item.link) {
            out += this.hyperlinkOpen(item.link);
            openLink = nextLink;
          }
        }
        const nextRevision = item.revision ? `${item.revision.kind}|${item.revision.id}` : null;
        if (nextRevision !== openRevision) {
          closeRevision();
          if (item.revision) {
            const opened = this.revisionOpen(item.revision);
            out += opened.xml;
            openRevision = nextRevision;
            revisionClose = opened.close;
          }
        }
        out += this.runXml(item, item.revision?.kind === 'delete');
      } else {
        closeRevision();
        closeLink();
        out += this.inlineNonRun(item);
      }
    }
    closeRevision();
    closeLink();
    return out;
  }

  private hyperlinkOpen(link: IRLink): string {
    const title = link.title ? ` w:tooltip="${escapeXml(link.title)}"` : '';
    if (link.href.startsWith('#')) {
      return `<w:hyperlink w:anchor="${escapeXml(bookmarkName(link.href.slice(1)))}"${title}>`;
    }
    const rid = this.rels.add(REL_TYPES.hyperlink, link.href, true);
    return `<w:hyperlink r:id="${rid}"${title}>`;
  }

  private revisionOpen(revision: IRRevision): { xml: string; close: string } {
    const tag = revision.kind === 'insert' ? 'w:ins' : 'w:del';
    const id = this.revisionIds.get(revision.id) ?? this.nextRevisionId++;
    this.revisionIds.set(revision.id, id);
    const author = escapeXml(revision.author ?? revision.authorId ?? 'Unknown');
    const date = revision.at ? ` w:date="${escapeXml(revision.at.replace(/\.\d{3}Z$/, 'Z'))}"` : '';
    return {
      xml: `<${tag} w:id="${id}" w:author="${author}"${date}>`,
      close: `</${tag}>`,
    };
  }

  private runXml(run: IRRun, deleted = false): string {
    if (!run.text) return '';
    const props = rPr(runPropsInner(run.props, this.fonts, { rStyle: run.props.styleId }));
    const textTag = deleted ? 'w:delText' : 'w:t';
    const content = run.text
      .split(/(\t|\n)/)
      .map((piece) => {
        if (piece === '\t') return '<w:tab/>';
        if (piece === '\n') return '<w:br/>';
        if (!piece) return '';
        return `<${textTag} xml:space="preserve">${escapeXml(piece)}</${textTag}>`;
      })
      .join('');
    return `<w:r>${props}${content}</w:r>`;
  }

  private inlineNonRun(item: Exclude<IRInline, IRRun>): string {
    switch (item.type) {
      case 'field':
        return this.field(item);
      case 'break': {
        const type = item.kind === 'page' ? ' w:type="page"' : item.kind === 'column' ? ' w:type="column"' : '';
        return `<w:r><w:br${type}/></w:r>`;
      }
      case 'image': {
        const drawing = this.drawing(item.src, item.widthPt, item.heightPt, item.alt, undefined);
        return drawing ? `<w:r>${drawing}</w:r>` : '';
      }
      case 'footnoteRef':
        this.loss('footnote-unsupported', `Footnote ${item.id} was dropped (footnotes are not exported yet)`);
        return '';
      case 'icon':
        return this.iconXml(item);
      default:
        return '';
    }
  }

  private iconXml(icon: IRIcon): string {
    return this.runXml({ type: 'run', text: icon.symbol, props: icon.size ? { sizePt: icon.size } : {} });
  }

  /** A complex field: begin, instruction, separate, cached result, end. */
  private field(field: IRField): string {
    let instr = field.instr.trim();
    if (field.fieldType === 'LIMS') {
      instr = limsInstruction(instr);
    }
    if (field.fieldType === 'REF') {
      const match = /^REF\s+(\S+)/.exec(instr);
      if (match) {
        const name = bookmarkName(match[1]);
        instr = instr.replace(/^REF\s+\S+/, `REF ${name}`);
        if (!this.anchors.has(name)) {
          this.loss('field-target-missing', `REF target "${match[1]}" has no matching block bookmark`);
        }
      }
    }
    const cached = field.cachedText || field.fallback || '';
    return (
      '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      `<w:r><w:instrText xml:space="preserve"> ${escapeXml(instr)} </w:instrText></w:r>` +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
      (cached ? `<w:r><w:t xml:space="preserve">${escapeXml(cached)}</w:t></w:r>` : '') +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
    );
  }

  private table(table: IRTable): string {
    const rows = table.rows ?? [];
    const blockId = table.source?.blockId;
    if (rows.length === 0) {
      this.loss('empty-table', 'Table has no rows and was omitted', blockId);
      return '';
    }
    const grid = table.grid.length > 0 ? table.grid : deriveGrid(rows);
    const tblPr = [
      valEl('w:tblStyle', table.props.styleId ?? 'TableGrid'),
      tableWidthXml(table, grid),
      table.props.widthMode === 'fixed' ? element('w:tblLayout', { 'w:type': 'fixed' }) : '',
      tableLookXml(table.props.look),
    ].join('');
    const gridXml = grid.map((width) => element('w:gridCol', { 'w:w': Math.round(width) })).join('');
    const rowsXml = rows
      .map((row) => {
        const trPrInner = [
          row.props.cantSplit ? '<w:cantSplit/>' : '',
          row.props.heightTwips ? element('w:trHeight', { 'w:val': row.props.heightTwips as number, 'w:hRule': 'atLeast' }) : '',
          row.props.isHeader ? '<w:tblHeader/>' : '',
        ].join('');
        let column = 0;
        const cells = row.cells
          .map((cell) => {
            const xml = this.cell(cell, grid, column);
            column += cell.props.gridSpan || 1;
            return xml;
          })
          .join('');
        const trPr = trPrInner ? `<w:trPr>${trPrInner}</w:trPr>` : '';
        return `<w:tr>${trPr}${cells}</w:tr>`;
      })
      .join('');
    return `<w:tbl><w:tblPr>${tblPr}</w:tblPr><w:tblGrid>${gridXml}</w:tblGrid>${rowsXml}</w:tbl>`;
  }

  private cell(cell: IRTableCell, grid: number[], column: number): string {
    const span = Math.max(1, cell.props.gridSpan || 1);
    const width = cell.props.widthTwips ?? sum(grid.slice(column, column + span));
    const vMerge =
      cell.props.vMerge === 'restart' ? valEl('w:vMerge', 'restart') : cell.props.vMerge === 'continue' ? '<w:vMerge/>' : '';
    const tcPr = [
      element('w:tcW', { 'w:w': Math.round(width), 'w:type': 'dxa' }),
      span > 1 ? valEl('w:gridSpan', span) : '',
      vMerge,
      cell.props.borders
        ? bordersXml('w:tcBorders', cell.props.borders as Partial<Record<string, Partial<BorderSpec> | null>>)
        : '',
      cell.props.shading ? shadingXml(cell.props.shading) : '',
      cell.props.vAlign ? valEl('w:vAlign', cell.props.vAlign) : '',
    ].join('');
    return `<w:tc><w:tcPr>${tcPr}</w:tcPr>${this.blockSequence(cell.blocks)}</w:tc>`;
  }

  private sdt(block: IRSdt): string {
    const id = this.nextSdtId++;
    const pr = [
      block.alias !== undefined ? valEl('w:alias', block.alias) : '',
      valEl('w:tag', block.tag),
      valEl('w:id', id),
      block.lock ? valEl('w:lock', block.lock) : '',
    ].join('');
    return `<w:sdt><w:sdtPr>${pr}</w:sdtPr><w:sdtContent>${this.blockSequence(block.blocks)}</w:sdtContent></w:sdt>`;
  }

  private passthrough(block: IRPassthrough, sectPr?: string): BlockResult {
    const xml = block.xml.replace(/<\?xml[^>]*\?>/, '');
    if (!xml.trim()) return NONE;
    const problem = checkFragment(xml);
    if (problem === null) return { xml, paragraph: false, consumed: false };
    this.loss('passthrough-invalid', `Passthrough XML was replaced by a placeholder: ${problem}`, block.source?.blockId);
    const placeholder: IRParagraph = {
      type: 'paragraph',
      props: {},
      runs: [{ type: 'run', text: `[${block.preview ?? 'Unsupported content'}]`, props: { italic: true } }],
    };
    return { xml: this.paragraph(placeholder, sectPr), paragraph: true, consumed: sectPr !== undefined };
  }

  private imageBlock(block: IRImageBlock, sectPr?: string): BlockResult {
    const drawing = this.drawing(block.src, block.widthPt, block.heightPt, block.alt, block.source?.blockId);
    if (!drawing) return NONE;
    return {
      xml: `<w:p>${pPr(sectPr ?? '')}<w:r>${drawing}</w:r></w:p>`,
      paragraph: true,
      consumed: sectPr !== undefined,
    };
  }

  /** Registers an embedded image once and returns its media entry, or `null` with a loss. */
  private mediaFor(src: string, blockId?: string): MediaEntry | null {
    const existing = this.media.get(src);
    if (existing) return existing;
    if (!src.startsWith('data:')) {
      this.loss('image-remote', `Remote image was not embedded: ${src.slice(0, 120)}`, blockId);
      return null;
    }
    const decoded = decodeDataUri(src);
    if (!decoded) {
      this.loss('image-invalid', 'Image data URI could not be decoded', blockId);
      return null;
    }
    const type = SUPPORTED_IMAGE_TYPES[decoded.mime];
    if (!type) {
      this.loss('image-unsupported', `Image type ${decoded.mime} is not embedded`, blockId);
      return null;
    }
    const name = `image${this.mediaParts.length + 1}.${type.ext}`;
    this.mediaParts.push({ path: `word/media/${name}`, data: decoded.bytes, contentType: type.contentType });
    const entry: MediaEntry = { target: `media/${name}`, data: decoded.bytes };
    this.media.set(src, entry);
    return entry;
  }

  /** A `w:drawing` inline picture, or an empty string when the image cannot be embedded. */
  private drawing(
    src: string,
    widthPt: number | undefined,
    heightPt: number | undefined,
    alt: string | undefined,
    blockId: string | undefined
  ): string {
    const entry = this.mediaFor(src, blockId);
    if (!entry) return '';
    const rid = this.rels.add(REL_TYPES.image, entry.target);
    const intrinsic = intrinsicSize(entry.data);
    const ratio = intrinsic && intrinsic.width > 0 ? intrinsic.height / intrinsic.width : 0.75;
    let width = widthPt;
    let height = heightPt;
    if (width === undefined && height === undefined) {
      width = intrinsic ? Math.min(intrinsic.width * 0.75, MAX_DEFAULT_IMAGE_WIDTH_PT) : 240;
    }
    if (width === undefined) width = (height as number) / ratio;
    if (height === undefined) height = width * ratio;
    const cx = emu(width);
    const cy = emu(height);
    const id = this.nextDrawingId++;
    const name = `Picture ${id}`;
    const descr = escapeXml(alt ?? '');
    return (
      '<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
      `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
      `<wp:docPr id="${id}" name="${name}" descr="${descr}"/>` +
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      `<pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}" descr="${descr}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>' +
      '</a:graphicData></a:graphic></wp:inline></w:drawing>'
    );
  }

  /** Runs `fn` with a fresh relationships part, returning its XML and that part. */
  private capture(fn: () => string): { xml: string; rels: Rels } {
    const previous = this.rels;
    const rels = new Rels();
    this.rels = rels;
    try {
      return { xml: fn(), rels };
    } finally {
      this.rels = previous;
    }
  }

  private headerFooterRefs(kind: 'header' | 'footer', set: IRHeaderFooterSet | undefined): string[] {
    if (!set) return [];
    const refs: string[] = [];
    for (const type of ['default', 'first', 'even'] as const) {
      const blocks = set[type];
      if (!blocks) continue;
      const isHeader = kind === 'header';
      const number = isHeader ? ++this.headerCount : ++this.footerCount;
      const name = `${kind}${number}.xml`;
      const captured = this.capture(() => this.blockSequence(blocks));
      const tag = isHeader ? 'w:hdr' : 'w:ftr';
      this.parts.push({
        path: `word/${name}`,
        xml: `${XML_DECL}<${tag} ${WORD_NS}>${captured.xml}</${tag}>`,
        rels: captured.rels,
        kind,
      });
      const rid = this.bodyRels.add(isHeader ? REL_TYPES.header : REL_TYPES.footer, name);
      refs.push(`<w:${kind}Reference w:type="${type}" r:id="${rid}"/>`);
    }
    return refs;
  }

  /** The `w:sectPr` for a section, registering its header and footer parts. */
  private sectPr(section: IRSection): string {
    const refs = [
      ...this.headerFooterRefs('header', section.headers),
      ...this.headerFooterRefs('footer', section.footers),
    ];
    const page = section.pageSetup;
    const margins = page.margins;
    const size = element('w:pgSz', {
      'w:w': page.size.widthTwips,
      'w:h': page.size.heightTwips,
      'w:orient': page.orientation === 'landscape' ? 'landscape' : undefined,
    });
    const pgMar = element('w:pgMar', {
      'w:top': margins.top,
      'w:right': margins.right,
      'w:bottom': margins.bottom,
      'w:left': margins.left,
      'w:header': margins.header,
      'w:footer': margins.footer,
      'w:gutter': margins.gutter,
    });
    const cols = page.columns
      ? element('w:cols', { 'w:num': page.columns.count, 'w:space': Math.round(page.columns.spaceTwips) })
      : '';
    return `<w:sectPr>${refs.join('')}${size}${pgMar}${cols}${section.titlePage ? '<w:titlePg/>' : ''}</w:sectPr>`;
  }
}
