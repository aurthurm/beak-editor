/**
 * Body walker: converts `word/document.xml` (and header/footer parts) to IR.
 *
 * Paragraphs, runs, hyperlinks, fields, revisions, tables, content controls,
 * pictures and section properties are converted. Anything else is preserved as
 * an {@link IRPassthrough} block, with a loss report.
 *
 * @module
 */

import type {
  IRBlock,
  IRField,
  IRImageBlock,
  IRInline,
  IRInlineImage,
  IRLink,
  IRParagraph,
  IRPassthrough,
  IRRevision,
  IRRun,
  IRSdt,
  IRSection,
  IRTable,
  IRTableCell,
  IRTableRow,
} from '@amusendame/beakblock-ir';

import { addLoss, OOXML_PASSTHROUGH_TYPE, type PartContext } from './context';
import { anyAttr, child, childrenNamed, kids, onOff, parseXml, rAttr, serializeElement, textOf, wAttr, wNum } from './dom';
import type { LossCode } from './losses';
import { mimeForPath, readRelationships, readText, toDataUri } from './package';
import { parseBorder, parseParaProps, parseRunProps, parseShading } from './props';
import type { NumberingRef, PageSetup, ParagraphStyle, RunProps, StyleSheet, TableProps } from './model';

/** Revision date used when a revision carries no `w:date`. */
const EPOCH_ISO = '1970-01-01T00:00:00.000Z';

/** EMU per point. */
const EMU_PER_PT = 12700;

/** Elements that carry no inline content and are ignored inside paragraphs. */
const SKIP_INLINE = new Set([
  'pPr',
  'rPr',
  'bookmarkStart',
  'bookmarkEnd',
  'proofErr',
  'commentRangeStart',
  'commentRangeEnd',
  'commentReference',
  'permStart',
  'permEnd',
  'lastRenderedPageBreak',
  'sectPr',
  'tblPr',
  'trPr',
  'tcPr',
  'sdtPr',
  'fldData',
  'ffData',
  'tabs',
]);

/** Elements that are valid at block level but produce no IR. */
const SKIP_BLOCK = new Set(['pPr', 'rPr', 'tblPr', 'trPr', 'tcPr', 'tblGrid', 'sdtPr', 'sdtEndPr', 'bookmarkStart', 'bookmarkEnd', 'permStart', 'permEnd', 'proofErr', 'sectPr', 'commentRangeStart', 'commentRangeEnd']);

interface FieldFrame {
  phase: 'instr' | 'result';
  instr: string;
  items: IRInline[];
  props: RunProps | null;
}

interface InlineState {
  out: IRInline[];
  /** Block-level items (passthroughs) emitted after the paragraph. */
  extras: IRBlock[];
  fields: FieldFrame[];
  revision: IRRevision | null;
  link: IRLink | null;
}

/** Builds a passthrough block for an element the importer cannot model. */
export function passthroughBlock(
  ctx: PartContext,
  el: Element,
  preview: string,
  code: LossCode,
  message: string,
): IRPassthrough {
  addLoss(ctx, code, message, `p:${ctx.paragraphIndex}`);
  const xml = serializeElement(el);
  const blockId = ctx.shared.nextId('ooxml');
  return {
    type: 'passthrough',
    xml,
    preview,
    source: { blockType: OOXML_PASSTHROUGH_TYPE, blockId, props: { xml, preview } },
  };
}

function findDescendant(el: Element, local: string): Element | null {
  const all = el.getElementsByTagName('*');
  for (let i = 0; i < all.length; i += 1) {
    if (all[i].localName === local) return all[i];
  }
  return null;
}

function emptyParagraph(): IRParagraph {
  return { type: 'paragraph', props: {}, runs: [] };
}

/** Numbering reference from a paragraph style or its ancestors. `undefined` when no style defines one. */
function numberingFromStyles(styleId: string, styles: StyleSheet): NumberingRef | null | undefined {
  let id: string | null | undefined = styleId;
  for (let depth = 0; depth < 16 && id; depth += 1) {
    const style: ParagraphStyle | undefined = styles.paragraph[id];
    if (!style) return undefined;
    if (style.paraProps && style.paraProps.numbering !== undefined) return style.paraProps.numbering;
    id = style.basedOn;
  }
  return undefined;
}

function paragraphProps(pPr: Element | null, ctx: PartContext): IRParagraph['props'] {
  const props = parseParaProps(pPr);
  if (props.numbering === undefined && props.styleId) {
    const inherited = numberingFromStyles(props.styleId, ctx.shared.styles);
    if (inherited !== undefined) props.numbering = inherited ? { ...inherited } : null;
  }
  if (props.numbering && !ctx.shared.numbering.instances[props.numbering.numId]) {
    addLoss(ctx, 'numbering-missing', `Numbering instance ${props.numbering.numId} is not defined.`, `p:${ctx.paragraphIndex}`);
  }
  return props;
}

function sinkOf(st: InlineState): IRInline[] | null {
  const top = st.fields[st.fields.length - 1];
  if (!top) return st.out;
  return top.phase === 'result' ? top.items : null;
}

function emitInline(st: InlineState, item: IRInline): void {
  const target = sinkOf(st);
  if (target) target.push(item);
}

function makeRun(text: string, props: RunProps, st: InlineState): IRRun {
  const run: IRRun = { type: 'run', text, props: { ...props } };
  if (st.revision) run.revision = { ...st.revision };
  if (st.link) run.link = { ...st.link };
  return run;
}

function textOfInline(item: IRInline): string {
  if (item.type === 'run') return item.text;
  if (item.type === 'field') return item.cachedText;
  if (item.type === 'break' && item.kind === 'line') return '\n';
  return '';
}

/** Name prefix of the DOCVARIABLE that carries a LIMS field (see export-docx `LIMS_VARIABLE_PREFIX`). */
const LIMS_VARIABLE_PREFIX = 'beak.lims.';

/** Maps `DOCVARIABLE beak.lims.<name> [\* format]` back to a LIMS field, or `null` for other variables. */
function buildLimsField(instr: string, variable: string, cachedText: string): IRField | null {
  if (!variable.startsWith(LIMS_VARIABLE_PREFIX) || variable.length === LIMS_VARIABLE_PREFIX.length) return null;
  const name = variable.slice(LIMS_VARIABLE_PREFIX.length);
  const format = /\\\*\s+(\S+)/.exec(instr)?.[1] ?? null;
  const field: IRField = {
    type: 'field',
    fieldType: 'LIMS',
    instr: format ? `LIMS ${name} \\* ${format}` : `LIMS ${name}`,
    name,
    cachedText,
  };
  if (format) field.format = format;
  return field;
}

/** Builds a supported field from its instruction, or `null` for unsupported types. */
export function buildField(instr: string, cachedText: string): IRField | null {
  const trimmed = instr.trim();
  const tokens = (trimmed.match(/"[^"]*"|\S+/g) ?? []).map((t) => t.replace(/^"|"$/g, ''));
  const keyword = (tokens[0] ?? '').toUpperCase();
  const base = { type: 'field' as const, instr: trimmed, cachedText };
  switch (keyword) {
    case 'PAGE':
      return { ...base, fieldType: 'PAGE', name: null };
    case 'NUMPAGES':
      return { ...base, fieldType: 'NUMPAGES', name: null };
    case 'DOCPROPERTY':
      return { ...base, fieldType: 'DOCPROPERTY', name: tokens[1] ?? null };
    case 'SEQ':
      return { ...base, fieldType: 'SEQ', name: tokens[1] ?? null };
    case 'REF':
      return { ...base, fieldType: 'REF', name: tokens[1] ?? null };
    case 'DATE': {
      const match = /\\@\s*"([^"]*)"/.exec(trimmed);
      return { ...base, fieldType: 'DATE', name: null, format: match ? match[1] : null };
    }
    case 'TOC':
      return { ...base, fieldType: 'TOC', name: null };
    case 'DOCVARIABLE':
      return buildLimsField(trimmed, tokens[1] ?? '', cachedText);
    default:
      return null;
  }
}

function finishField(frame: FieldFrame, st: InlineState, ctx: PartContext): void {
  const cached = frame.items.map(textOfInline).join('');
  const field = buildField(frame.instr, cached);
  if (field) {
    emitInline(st, field);
    return;
  }
  const keyword = frame.instr.trim().split(/\s+/)[0] ?? '';
  if (keyword) {
    addLoss(ctx, 'field-unsupported', `Field "${keyword}" is not modelled; its cached result is kept as text.`, `p:${ctx.paragraphIndex}`);
  }
  if (cached) emitInline(st, makeRun(cached, frame.props ?? {}, st));
}

function handleFldChar(type: string | null, st: InlineState, ctx: PartContext, props: RunProps): void {
  if (type === 'begin') {
    st.fields.push({ phase: 'instr', instr: '', items: [], props: null });
  } else if (type === 'separate') {
    const top = st.fields[st.fields.length - 1];
    if (top && top.phase === 'instr') top.phase = 'result';
  } else if (type === 'end') {
    const frame = st.fields.pop();
    if (frame) {
      if (frame.props === null) frame.props = props;
      finishField(frame, st, ctx);
    }
  }
}

type DrawingResult = { kind: 'image'; image: IRInlineImage } | { kind: 'block'; block: IRPassthrough };

/** Converts a `w:drawing` element to an inline image or a passthrough block. */
function drawingResult(drawing: Element, ctx: PartContext): DrawingResult {
  const graphicData = findDescendant(drawing, 'graphicData');
  const uri = (graphicData ? anyAttr(graphicData, 'uri') : null) ?? '';
  const container = kids(drawing)[0] ?? null;
  const floating = container?.localName === 'anchor';

  if (uri.includes('drawingml/2006/diagram')) {
    return { kind: 'block', block: passthroughBlock(ctx, drawing, textOf(drawing), 'smartart-passthrough', 'SmartArt diagram preserved verbatim; it is not editable.') };
  }
  if (uri.includes('drawingml/2006/chart')) {
    return { kind: 'block', block: passthroughBlock(ctx, drawing, textOf(drawing), 'chart-passthrough', 'Chart preserved verbatim; it is not editable.') };
  }
  if (!uri.includes('picture')) {
    return { kind: 'block', block: passthroughBlock(ctx, drawing, textOf(drawing), 'drawing-passthrough', 'DrawingML shape preserved verbatim.') };
  }

  const blip = findDescendant(drawing, 'blip');
  const rid = blip ? rAttr(blip, 'embed') : null;
  const rel = rid ? ctx.rels.get(rid) : undefined;
  const data = rel ? ctx.shared.files[rel.target] : undefined;
  if (!rel || !data) {
    return { kind: 'block', block: passthroughBlock(ctx, drawing, '', 'image-missing', 'Picture relationship or media part is missing.') };
  }

  let src = ctx.shared.mediaCache.get(rel.target);
  if (src === undefined) {
    src = toDataUri(mimeForPath(rel.target), data);
    ctx.shared.mediaCache.set(rel.target, src);
  }

  const image: IRInlineImage = { type: 'image', src };
  const extent = findDescendant(drawing, 'extent');
  const cx = wNum(extent, 'cx');
  const cy = wNum(extent, 'cy');
  if (cx !== undefined) image.widthPt = cx / EMU_PER_PT;
  if (cy !== undefined) image.heightPt = cy / EMU_PER_PT;
  const docPr = findDescendant(drawing, 'docPr');
  const alt = docPr ? anyAttr(docPr, 'descr') || anyAttr(docPr, 'name') : null;
  if (alt) image.alt = alt;
  if (floating) {
    addLoss(ctx, 'float-converted', 'Floating picture converted to an inline image.', `p:${ctx.paragraphIndex}`);
  }
  return { kind: 'image', image };
}

function handleDrawing(drawing: Element, ctx: PartContext, st: InlineState): void {
  const result = drawingResult(drawing, ctx);
  if (result.kind === 'image') emitInline(st, result.image);
  else st.extras.push(result.block);
}

function handleAlternate(ac: Element, ctx: PartContext, st: InlineState): void {
  const choice = child(ac, 'Choice');
  const fallback = child(ac, 'Fallback');
  const drawing = choice ? findDescendant(choice, 'drawing') : null;
  const gd = drawing ? findDescendant(drawing, 'graphicData') : null;
  if (drawing && gd && (anyAttr(gd, 'uri') ?? '').includes('picture')) {
    handleDrawing(drawing, ctx, st);
    return;
  }
  st.extras.push(
    passthroughBlock(ctx, ac, textOf(fallback), 'alternate-content', 'mc:AlternateContent preserved verbatim; Fallback text is the preview.'),
  );
}

function processRun(run: Element, ctx: PartContext, st: InlineState): void {
  const props = parseRunProps(child(run, 'rPr'));
  let buf = '';

  const flush = (): void => {
    if (!buf) return;
    const target = sinkOf(st);
    if (target) {
      target.push(makeRun(buf, props, st));
      const top = st.fields[st.fields.length - 1];
      if (top && top.phase === 'result' && top.props === null) top.props = props;
    }
    buf = '';
  };

  for (const c of Array.from(run.children)) {
    switch (c.localName) {
      case 't':
      case 'delText':
        buf += c.textContent ?? '';
        break;
      case 'instrText':
      case 'delInstrText': {
        const top = st.fields[st.fields.length - 1];
        if (top && top.phase === 'instr') top.instr += c.textContent ?? '';
        break;
      }
      case 'tab':
        buf += '\t';
        break;
      case 'noBreakHyphen':
        buf += '‑';
        break;
      case 'sym': {
        const code = parseInt(wAttr(c, 'char') ?? '', 16);
        if (!Number.isNaN(code)) buf += String.fromCharCode(code >= 0xf000 ? code - 0xf000 : code);
        break;
      }
      case 'br': {
        flush();
        const type = wAttr(c, 'type');
        const kind = type === 'page' ? 'page' : type === 'column' ? 'column' : 'line';
        emitInline(st, { type: 'break', kind });
        break;
      }
      case 'cr':
        flush();
        emitInline(st, { type: 'break', kind: 'line' });
        break;
      case 'fldChar':
        flush();
        handleFldChar(wAttr(c, 'fldCharType'), st, ctx, props);
        break;
      case 'drawing':
        flush();
        handleDrawing(c, ctx, st);
        break;
      case 'pict':
        flush();
        st.extras.push(passthroughBlock(ctx, c, textOf(c), 'vml-passthrough', 'Legacy VML drawing preserved verbatim.'));
        break;
      case 'object':
        flush();
        st.extras.push(passthroughBlock(ctx, c, textOf(c), 'object-passthrough', 'Embedded object preserved verbatim.'));
        break;
      case 'footnoteReference':
      case 'endnoteReference': {
        flush();
        const isFootnote = c.localName === 'footnoteReference';
        addLoss(
          ctx,
          isFootnote ? 'footnote-ref' : 'endnote-ref',
          isFootnote ? 'Footnote reference kept; the footnote body is not imported.' : 'Endnote reference kept; the endnote body is not imported.',
          `p:${ctx.paragraphIndex}`,
        );
        emitInline(st, { type: 'footnoteRef', id: wAttr(c, 'id') ?? '' });
        break;
      }
      case 'AlternateContent':
        flush();
        handleAlternate(c, ctx, st);
        break;
      default:
        break;
    }
  }
  flush();
}

function walkInline(parent: Element, ctx: PartContext, st: InlineState): void {
  for (const c of Array.from(parent.children)) {
    const name = c.localName;
    if (SKIP_INLINE.has(name)) continue;
    switch (name) {
      case 'r':
        processRun(c, ctx, st);
        break;
      case 'hyperlink': {
        const prev = st.link;
        const rid = rAttr(c, 'id');
        const anchor = wAttr(c, 'anchor');
        const rel = rid ? ctx.rels.get(rid) : undefined;
        let href: string | null = rel ? rel.target : null;
        if (!href && anchor) href = `#${anchor}`;
        if (href) {
          const link: IRLink = { href };
          const title = anyAttr(c, 'tooltip');
          if (title) link.title = title;
          st.link = link;
        }
        walkInline(c, ctx, st);
        st.link = prev;
        break;
      }
      case 'fldSimple': {
        const frame: FieldFrame = { phase: 'result', instr: wAttr(c, 'instr') ?? '', items: [], props: null };
        st.fields.push(frame);
        walkInline(c, ctx, st);
        const popped = st.fields.pop();
        if (popped) finishField(popped, st, ctx);
        break;
      }
      case 'ins':
      case 'moveTo':
      case 'del':
      case 'moveFrom': {
        const prev = st.revision;
        const isDelete = name === 'del' || name === 'moveFrom';
        st.revision = {
          kind: isDelete ? 'delete' : 'insert',
          id: wAttr(c, 'id') ?? ctx.shared.nextId('rev'),
          at: wAttr(c, 'date') ?? EPOCH_ISO,
        };
        const author = wAttr(c, 'author');
        if (author) st.revision.author = author;
        walkInline(c, ctx, st);
        st.revision = prev;
        break;
      }
      case 'AlternateContent':
        handleAlternate(c, ctx, st);
        break;
      case 'oMath':
      case 'oMathPara':
        st.extras.push(passthroughBlock(ctx, c, textOf(c), 'math-passthrough', 'Office Math equation preserved verbatim.'));
        break;
      default:
        walkInline(c, ctx, st);
        break;
    }
  }
}

function hasVisibleContent(item: IRInline): boolean {
  if (item.type === 'run') return item.text.length > 0;
  return item.type !== 'image';
}

function mergeRuns(items: IRInline[]): IRInline[] {
  const out: IRInline[] = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (
      item.type === 'run' &&
      last &&
      last.type === 'run' &&
      JSON.stringify([last.props, last.revision, last.link]) === JSON.stringify([item.props, item.revision, item.link])
    ) {
      last.text += item.text;
      continue;
    }
    out.push(item);
  }
  return out;
}

/** Converts one `w:p` into a paragraph plus any images and passthroughs it contains. */
function paragraphBlocks(p: Element, ctx: PartContext): IRBlock[] {
  ctx.paragraphIndex += 1;
  const props = paragraphProps(child(p, 'pPr'), ctx);
  const st: InlineState = { out: [], extras: [], fields: [], revision: null, link: null };
  walkInline(p, ctx, st);

  while (st.fields.length > 0) {
    const frame = st.fields.pop() as FieldFrame;
    addLoss(ctx, 'field-spans-paragraphs', 'A field continues into another paragraph; its result is kept as text.', `p:${ctx.paragraphIndex}`);
    for (const item of frame.items) emitInline(st, item);
  }

  const merged = mergeRuns(st.out);
  const images = merged.filter((item): item is IRInlineImage => item.type === 'image');
  const runs = merged.filter((item) => item.type !== 'image');
  const blocks: IRBlock[] = [];
  const hasContent = runs.some(hasVisibleContent);
  if (hasContent || (images.length === 0 && st.extras.length === 0)) {
    blocks.push({ type: 'paragraph', props, runs });
  }
  for (const image of images) blocks.push({ ...image, type: 'image' } as IRImageBlock);
  blocks.push(...st.extras);
  return blocks;
}

function tableWidth(tblPr: Element | null): Pick<TableProps, 'widthMode' | 'widthValue'> {
  const tblW = child(tblPr, 'tblW');
  if (!tblW) return {};
  const type = wAttr(tblW, 'type') ?? 'auto';
  const value = wNum(tblW, 'w');
  if (type === 'dxa') return { widthMode: 'fixed', widthValue: value ?? null };
  if (type === 'pct') return { widthMode: 'pct', widthValue: value ?? null };
  return { widthMode: 'auto' };
}

function tableLook(tblPr: Element | null): NonNullable<TableProps['look']> | undefined {
  const look = child(tblPr, 'tblLook');
  if (!look) return undefined;
  const hex = wAttr(look, 'val');
  const bits = hex !== null ? parseInt(hex, 16) : 0;
  const flag = (attr: string, mask: number): boolean => {
    const named = anyAttr(look, attr);
    if (named !== null) return named === '1' || named === 'true';
    return hex !== null ? (bits & mask) !== 0 : false;
  };
  return {
    headerRow: flag('firstRow', 0x20),
    lastRow: flag('lastRow', 0x40),
    firstColumn: flag('firstColumn', 0x80),
    bandedRows: !(anyAttr(look, 'noHBand') === '1' || (hex !== null && (bits & 0x200) !== 0)),
  };
}

function tableCell(tc: Element, ctx: PartContext): IRTableCell {
  const tcPr = child(tc, 'tcPr');
  const gridSpan = wNum(child(tcPr, 'gridSpan'), 'val') ?? 1;
  const props: IRTableCell['props'] = { gridSpan };

  const vm = child(tcPr, 'vMerge');
  if (vm) props.vMerge = wAttr(vm, 'val') === 'restart' ? 'restart' : 'continue';

  const tcBorders = child(tcPr, 'tcBorders');
  if (tcBorders) {
    const borders: Record<string, unknown> = {};
    const edges: Array<[string, string]> = [
      ['top', 'top'],
      ['left', 'left'],
      ['start', 'left'],
      ['bottom', 'bottom'],
      ['right', 'right'],
      ['end', 'right'],
    ];
    for (const [tag, edge] of edges) {
      const el = child(tcBorders, tag);
      if (el) borders[edge] = parseBorder(el);
    }
    if (Object.keys(borders).length > 0) {
      props.borders = { top: null, right: null, bottom: null, left: null, ...borders };
    }
  }

  const shading = parseShading(child(tcPr, 'shd'));
  if (shading) props.shading = shading;

  const vAlign = wAttr(child(tcPr, 'vAlign') ?? tcPr ?? tc, 'val');
  if (vAlign === 'top' || vAlign === 'center' || vAlign === 'bottom') props.vAlign = vAlign;

  const tcW = child(tcPr, 'tcW');
  if (tcW && wAttr(tcW, 'type') === 'dxa') {
    const w = wNum(tcW, 'w');
    if (w !== undefined) props.widthTwips = w;
  }

  if (props.vMerge === 'continue') {
    return { props, blocks: [] };
  }
  const blocks = blockChildren(tc, ctx);
  return { props, blocks: blocks.length > 0 ? blocks : [emptyParagraph()] };
}

function tableRow(tr: Element, ctx: PartContext): IRTableRow {
  const trPr = child(tr, 'trPr');
  const props: IRTableRow['props'] = {};
  if (child(trPr, 'tblHeader')) props.isHeader = onOff(child(trPr, 'tblHeader')) !== false;
  const cant = onOff(child(trPr, 'cantSplit'));
  if (cant !== undefined) props.cantSplit = cant;
  const height = wNum(child(trPr, 'trHeight'), 'val');
  if (height !== undefined) props.heightTwips = height;
  return { props, cells: childrenNamed(tr, 'tc').map((tc) => tableCell(tc, ctx)) };
}

function tableBlock(tbl: Element, ctx: PartContext): IRTable {
  const tblPr = child(tbl, 'tblPr');
  const props: IRTable['props'] = { ...tableWidth(tblPr) };
  const style = child(tblPr, 'tblStyle');
  const styleId = style ? wAttr(style, 'val') : null;
  if (styleId) props.styleId = styleId;
  const look = tableLook(tblPr);
  if (look) props.look = look;

  const rows = childrenNamed(tbl, 'tr').map((tr) => tableRow(tr, ctx));
  let grid = childrenNamed(child(tbl, 'tblGrid'), 'gridCol').map((col) => wNum(col, 'w') ?? 0);

  const columns = Math.max(0, ...rows.map((row) => row.cells.reduce((sum, cell) => sum + cell.props.gridSpan, 0)));
  if (grid.length < columns) {
    const each = Math.round(9360 / Math.max(columns, 1));
    grid = Array.from({ length: columns }, (_, i) => grid[i] ?? each);
  }
  return { type: 'table', props, grid, rows };
}

function sdtBlock(sdt: Element, ctx: PartContext): IRBlock[] {
  const sdtPr = child(sdt, 'sdtPr');
  const tagValue = wAttr(child(sdtPr, 'tag') ?? sdtPr ?? sdt, 'val') ?? null;
  const content = child(sdt, 'sdtContent');
  const blocks = content ? blockChildren(content, ctx) : [];
  if (!tagValue) return blocks;

  const out: IRSdt = { type: 'sdt', tag: tagValue, blocks };
  const alias = wAttr(child(sdtPr, 'alias') ?? sdtPr ?? sdt, 'val');
  if (alias) out.alias = alias;
  const lock = wAttr(child(sdtPr, 'lock') ?? sdtPr ?? sdt, 'val');
  if (lock === 'sdtLocked' || lock === 'contentLocked' || lock === 'sdtContentLocked') out.lock = lock;
  else out.lock = null;
  return [out];
}

function blockElement(el: Element, ctx: PartContext): IRBlock[] {
  const name = el.localName;
  if (SKIP_BLOCK.has(name)) return [];
  switch (name) {
    case 'p':
      return paragraphBlocks(el, ctx);
    case 'tbl':
      return [tableBlock(el, ctx)];
    case 'sdt':
      return sdtBlock(el, ctx);
    case 'customXml':
      return blockChildren(el, ctx);
    case 'AlternateContent':
      return [passthroughBlock(ctx, el, textOf(child(el, 'Fallback')), 'alternate-content', 'mc:AlternateContent preserved verbatim; Fallback text is the preview.')];
    case 'altChunk':
      return [passthroughBlock(ctx, el, '', 'unknown-block', 'Embedded alternative chunk preserved verbatim.')];
    default:
      return [passthroughBlock(ctx, el, textOf(el), 'unknown-block', `Unrecognised element "${name}" preserved verbatim.`)];
  }
}

/** Converts the block-level children of a container (body, cell, header, content control). */
export function blockChildren(container: Element, ctx: PartContext): IRBlock[] {
  return kids(container).flatMap((el) => blockElement(el, ctx));
}

/** Page setup from a `w:sectPr` element, with A4 and 1-inch defaults. */
export function pageSetupOf(sectPr: Element | null): PageSetup {
  const pgSz = child(sectPr, 'pgSz');
  const width = wNum(pgSz, 'w') ?? 11906;
  const height = wNum(pgSz, 'h') ?? 16838;
  const orientation = pgSz && wAttr(pgSz, 'orient') === 'landscape' ? 'landscape' : 'portrait';
  const mar = child(sectPr, 'pgMar');
  const setup: PageSetup = {
    size: { widthTwips: width, heightTwips: height },
    orientation,
    margins: {
      top: wNum(mar, 'top') ?? 1440,
      right: wNum(mar, 'right') ?? 1440,
      bottom: wNum(mar, 'bottom') ?? 1440,
      left: wNum(mar, 'left') ?? 1440,
      header: wNum(mar, 'header') ?? 720,
      footer: wNum(mar, 'footer') ?? 720,
      gutter: wNum(mar, 'gutter') ?? 0,
    },
  };
  const cols = child(sectPr, 'cols');
  const count = wNum(cols, 'num');
  if (count !== undefined && count > 1) {
    setup.columns = { count, spaceTwips: wNum(cols, 'space') ?? 720 };
  }
  return setup;
}

/** Parses a header or footer part once and caches its blocks. */
export function partBlocks(path: string, ctx: PartContext): IRBlock[] | null {
  const cached = ctx.shared.partBlocks.get(path);
  if (cached) return cached;
  const xml = readText(ctx.shared.files, path);
  if (xml === null) return null;
  const doc = parseXml(xml, ctx.shared.parser);
  if (!doc) {
    ctx.shared.losses.push({ code: 'part-parse-error', severity: 'error', message: `Part ${path} is not well-formed XML.`, location: path });
    return null;
  }
  const sub: PartContext = {
    shared: ctx.shared,
    partPath: path,
    rels: readRelationships(ctx.shared.files, path, ctx.shared.parser),
    paragraphIndex: 0,
  };
  const blocks = blockChildren(doc.documentElement, sub);
  ctx.shared.partBlocks.set(path, blocks);
  return blocks;
}

type HeaderKind = 'headerReference' | 'footerReference';

function headerFooterSet(
  sectPr: Element | null,
  kind: HeaderKind,
  ctx: PartContext,
  prev: IRSection['headers'],
): IRSection['headers'] {
  const out: NonNullable<IRSection['headers']> = {};
  for (const ref of childrenNamed(sectPr, kind)) {
    const type = wAttr(ref, 'type') ?? 'default';
    const rel = ctx.rels.get(rAttr(ref, 'id') ?? '');
    if (!rel) continue;
    const blocks = partBlocks(rel.target, ctx);
    if (!blocks) continue;
    if (type === 'default' || type === 'first' || type === 'even') out[type] = blocks;
  }
  if (prev) {
    if (!out.default && prev.default) out.default = prev.default;
    if (!out.first && prev.first) out.first = prev.first;
    if (!out.even && prev.even) out.even = prev.even;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Parses the body of `word/document.xml` into sections. A section ends at a
 * paragraph carrying `w:sectPr` (and at the body-level `w:sectPr`).
 */
export function parseBodySections(body: Element, ctx: PartContext, newId: (prefix: string) => string): IRSection[] {
  const sections: IRSection[] = [];
  let pending: IRBlock[] = [];
  let prevHeaders: IRSection['headers'];
  let prevFooters: IRSection['footers'];

  const close = (sectPr: Element | null, blocks: IRBlock[]): void => {
    const section: IRSection = {
      id: newId('sec'),
      pageSetup: pageSetupOf(sectPr),
      body: blocks,
    };
    if (child(sectPr, 'titlePg')) section.titlePage = true;
    const headers = headerFooterSet(sectPr, 'headerReference', ctx, prevHeaders);
    const footers = headerFooterSet(sectPr, 'footerReference', ctx, prevFooters);
    if (headers) section.headers = headers;
    if (footers) section.footers = footers;
    prevHeaders = headers;
    prevFooters = footers;
    sections.push(section);
  };

  for (const el of kids(body)) {
    if (el.localName === 'sectPr') continue;
    if (el.localName === 'p' && child(child(el, 'pPr'), 'sectPr')) {
      pending.push(...paragraphBlocks(el, ctx));
      close(child(child(el, 'pPr'), 'sectPr'), pending);
      pending = [];
      continue;
    }
    pending.push(...blockElement(el, ctx));
  }

  const finalSect = child(body, 'sectPr');
  if (pending.length > 0 || sections.length === 0) close(finalSect, pending);
  return sections;
}

