/**
 * Document and block JSON to IR conversion.
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';
import {
  NUMBERING_IDS,
  blocksToDocument,
  cloneValue,
  createId,
} from '@amusendame/beakblock-schema';
import type {
  Alignment,
  BeakDocument,
  FieldType,
  HeaderFooterSet,
  ParaProps,
  RunProps,
} from '@amusendame/beakblock-schema';

import { fieldInstruction } from './fieldInstr';
import type {
  IRBlock,
  IRCustomInline,
  IRDocument,
  IRField,
  IRHeaderFooterSet,
  IRIcon,
  IRImageBlock,
  IRInline,
  IRListMembership,
  IRParagraph,
  IRRevision,
  IRRun,
  IRSdt,
  IRSection,
  IRSource,
  IRTable,
  IRTableCell,
  IRTableRow,
  IRWarning,
} from './types';
import { IR_VERSION, MAX_NUMBERING_LEVEL } from './types';

/** The subset of a core block registry used during conversion. */
export interface BlockRegistryLike {
  get(type: string): BlockRegistryEntryLike | undefined;
}

/** The subset of a block definition used during conversion. */
export interface BlockRegistryEntryLike {
  toIR?: (block: Block, ctx: unknown) => unknown;
  fromIR?: (ir: unknown, ctx: unknown) => Block | null;
}

/** Options for {@link documentToIR} and {@link blocksToIR}. */
export interface DocumentToIROptions {
  /** Block registry consulted for unknown block types (`toIR`). */
  registry?: BlockRegistryLike;
  /**
   * Called for each non-fatal conversion issue, such as a list nested deeper than
   * the numbering levels OOXML defines. The conversion still succeeds.
   */
  onWarning?: (warning: IRWarning) => void;
}

/** Internal conversion context. */
export interface ConvertContext {
  registry?: BlockRegistryLike;
  onWarning?: (warning: IRWarning) => void;
}

/** Text width in twips for A4 with 1 inch margins. Used for column layouts. */
const TEXT_WIDTH_TWIPS = 9026;

/** Default table width in twips when no column widths are known. */
const DEFAULT_TABLE_WIDTH_TWIPS = 9000;

/** Pixels to points (96 px = 72 pt). */
const PT_PER_PX = 0.75;

/** Block types whose content is a list container. */
export const LIST_TYPES: ReadonlySet<string> = new Set(['bulletList', 'orderedList', 'checkList']);

/** Block types that are list items. */
export const LIST_ITEM_TYPES: ReadonlySet<string> = new Set(['listItem', 'checkListItem']);

/** Block types converted to a paragraph with a known style. */
export const PARAGRAPH_TYPES: ReadonlySet<string> = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'callout',
  'codeBlock',
  'divider',
  'pageBreak',
  'tableOfContents',
  'embed',
  'sectionBreak',
  'listItem',
  'checkListItem',
]);

/** Paragraph property keys copied one-to-one from `paragraph` block props. */
const PARA_PROP_KEYS = [
  'styleId',
  'numbering',
  'spacing',
  'indent',
  'keepNext',
  'keepLines',
  'pageBreakBefore',
  'widowControl',
  'tabs',
] as const;

/** Lock values accepted on `sdt` elements. */
const SDT_LOCKS: ReadonlySet<unknown> = new Set(['sdtLocked', 'contentLocked', 'sdtContentLocked']);

/** Converts a value to a clone, keeping undefined as undefined. */
export function cloneOptional<T>(value: T): T {
  return value === undefined ? value : cloneValue(value);
}

/** Returns a new object with keys whose value is `undefined` removed. */
export function compact<T extends object>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) out[key] = entry;
  }
  return out as T;
}

function clampHeadingLevel(level: unknown): number {
  const numeric = Number(level);
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 6 ? numeric : 1;
}

/** Plain text of inline content, used as the fallback text of custom inline nodes. */
function inlinePlainText(content: readonly unknown[] | undefined): string {
  return (content ?? [])
    .map((raw) => {
      const item = raw as Record<string, unknown>;
      if (item.type === 'text' && typeof item.text === 'string') return item.text;
      if (item.type === 'hardBreak') return '\n';
      if (Array.isArray(item.content)) return inlinePlainText(item.content);
      return typeof item.text === 'string' ? item.text : '';
    })
    .join('');
}

/**
 * Text shown by exporters for a custom inline node: its inline content if any,
 * otherwise its `fallback`, `display` or `text` prop.
 */
function customInlineText(item: Record<string, unknown>, props: Record<string, unknown>): string {
  if (Array.isArray(item.content) && item.content.length > 0) {
    return inlinePlainText(item.content as unknown[]);
  }
  for (const key of ['fallback', 'display', 'text']) {
    if (typeof props[key] === 'string') return props[key] as string;
  }
  return '';
}

function capitalise(value: string): string {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

/* -------------------------------------------------------------------------- */
/* Inline content                                                             */
/* -------------------------------------------------------------------------- */

interface RevisionStyle {
  kind: 'insert' | 'delete';
  revisionId: string;
  authorId?: string;
  authorName?: string;
  at: string;
  aiGenerated?: boolean;
}

interface StyledLike {
  text?: unknown;
  styles?: Record<string, unknown>;
}

/** Maps core TextStyles to run properties. */
export function stylesToRunProps(styles: Record<string, unknown>): RunProps {
  const props: RunProps = {};
  if (styles.bold === true) props.bold = true;
  if (styles.italic === true) props.italic = true;
  if (styles.underline === true) props.underline = true;
  if (styles.strikethrough === true) props.strike = true;
  if (styles.code === true) props.styleId = 'Code';
  if (styles.textColor !== undefined) props.color = String(styles.textColor);
  if (styles.backgroundColor !== undefined) props.shading = String(styles.backgroundColor);
  if (typeof styles.fontSize === 'number') props.sizePt = styles.fontSize;
  return props;
}

function revisionToIR(revision: RevisionStyle): IRRevision {
  return compact({
    kind: revision.kind,
    id: revision.revisionId,
    author: revision.authorName,
    authorId: revision.authorId,
    at: revision.at,
    aiGenerated: revision.aiGenerated,
  }) as IRRevision;
}

function styledToRun(item: StyledLike, link?: { href: string; title?: string; target?: string }): IRRun {
  const styles = (item.styles ?? {}) as Record<string, unknown>;
  const run: IRRun = {
    type: 'run',
    text: String(item.text ?? ''),
    props: stylesToRunProps(styles),
  };
  if (styles.revision && typeof styles.revision === 'object') {
    run.revision = revisionToIR(styles.revision as RevisionStyle);
  }
  if (link) {
    run.link = compact({
      href: link.href,
      title: link.title,
      target: link.target as '_blank' | '_self' | undefined,
    });
  }
  return run;
}

function fieldToIR(item: Record<string, unknown>): IRField {
  const fieldType = String(item.fieldType) as FieldType;
  const name = item.name as string | null | undefined;
  const format = item.format as string | null | undefined;
  const fallback = item.fallback as string | null | undefined;
  const field: IRField = {
    type: 'field',
    fieldType,
    instr: fieldInstruction(fieldType, name, format),
    cachedText: fallback ?? '',
  };
  if ('name' in item) field.name = name ?? null;
  if ('format' in item) field.format = format ?? null;
  if ('fallback' in item) field.fallback = fallback ?? null;
  return field;
}

/** Converts a custom inline node (any inline type that is not built in). */
function customInlineToIR(item: Record<string, unknown>): IRCustomInline {
  const props = cloneValue((item.props ?? {}) as Record<string, unknown>);
  const custom: IRCustomInline = {
    type: 'custom',
    inlineType: String(item.type),
    props,
    text: customInlineText(item, props),
  };
  if (Array.isArray(item.content)) {
    custom.content = inlineToRuns(item.content as readonly unknown[]);
  }
  return custom;
}

/**
 * Converts core inline content to IR inline items.
 *
 * Link content is flattened: each linked text item becomes a run carrying `link`.
 * Hard breaks become line breaks, icons and fields keep their data.
 */
export function inlineToRuns(content: readonly unknown[] | undefined): IRInline[] {
  const runs: IRInline[] = [];
  for (const raw of content ?? []) {
    const item = raw as Record<string, unknown>;
    switch (item.type) {
      case 'text':
        runs.push(styledToRun(item as StyledLike));
        break;
      case 'link': {
        const link = {
          href: String(item.href ?? ''),
          title: typeof item.title === 'string' ? item.title : undefined,
          target: typeof item.target === 'string' ? item.target : undefined,
        };
        for (const inner of (item.content as StyledLike[] | undefined) ?? []) {
          runs.push(styledToRun(inner, link));
        }
        break;
      }
      case 'hardBreak':
        runs.push({ type: 'break', kind: 'line' });
        break;
      case 'icon': {
        const icon: IRIcon = { type: 'icon', icon: String(item.icon ?? ''), symbol: String(item.symbol ?? '') };
        if (typeof item.size === 'number') icon.size = item.size;
        runs.push(icon);
        break;
      }
      case 'field':
        runs.push(fieldToIR(item));
        break;
      case undefined:
        if (typeof item.text === 'string') {
          runs.push(styledToRun(item as StyledLike));
        }
        break;
      default:
        runs.push(customInlineToIR(item));
        break;
    }
  }
  return runs;
}

/* -------------------------------------------------------------------------- */
/* Block conversion                                                           */
/* -------------------------------------------------------------------------- */

/** Converts a list of blocks. Lists are flattened into numbered paragraphs. */
export function convertBlocks(blocks: readonly Block[] | undefined, ctx: ConvertContext): IRBlock[] {
  const out: IRBlock[] = [];
  for (const block of blocks ?? []) {
    out.push(...convertBlock(block, ctx));
  }
  return out;
}

function convertBlock(block: Block, ctx: ConvertContext): IRBlock[] {
  if (LIST_TYPES.has(block.type)) {
    return convertList(block, 0, ctx);
  }
  switch (block.type) {
    case 'table':
      return [convertTable(block, ctx)];
    case 'columnList':
      return [convertColumnList(block, ctx)];
    case 'controlledSection':
      return [convertSdt(block, ctx)];
    case 'image':
      return [convertImage(block)];
    default:
      break;
  }
  if (PARAGRAPH_TYPES.has(block.type)) {
    return [convertParagraph(block)];
  }
  return [convertUnknown(block, ctx)];
}

function convertList(list: Block, level: number, ctx: ConvertContext): IRBlock[] {
  const numId =
    list.type === 'orderedList'
      ? NUMBERING_IDS.decimal
      : list.type === 'checkList'
        ? NUMBERING_IDS.checklist
        : NUMBERING_IDS.bullet;
  const containerType = list.type as IRListMembership['containerType'];
  const containerProps = (cloneValue(list.props ?? {}) as Record<string, unknown>);
  const numberingLevel = clampNumberingLevel(list, level, numId, ctx);

  const out: IRBlock[] = [];
  if ((list.children ?? []).length === 0) {
    // An empty container has no items to carry it, so it is kept as an empty paragraph
    // whose source names the container type. irToDocument restores the empty container.
    const source: IRSource = { blockType: list.type, blockId: list.id, props: containerProps, raw: { children: [] } };
    if (level > 0) {
      // Nested empty container: it belongs to the list item one level up, like other child blocks.
      source.list = { role: 'childBlock', level: level - 1 };
    }
    out.push({ type: 'paragraph', props: {}, runs: [], source });
  }
  for (const child of list.children ?? []) {
    if (!LIST_ITEM_TYPES.has(child.type)) {
      out.push(...convertBlock(child, ctx));
      continue;
    }
    const paragraph: IRParagraph = {
      type: 'paragraph',
      props: { styleId: 'ListParagraph', numbering: { numId, level: numberingLevel } },
      runs: inlineToRuns(child.content),
      source: {
        blockType: child.type,
        blockId: child.id,
        props: cloneValue(child.props ?? {}),
        list: {
          role: 'item',
          containerId: list.id,
          containerType,
          containerProps,
          level,
        },
      },
    };
    out.push(paragraph);
    out.push(...convertItemChildren(child.children, level, ctx));
  }
  return out;
}

/**
 * Clamps a list depth to the numbering levels its definition provides. Deeper items keep
 * their true depth in `source.list.level`, so the round trip stays lossless.
 */
function clampNumberingLevel(list: Block, depth: number, numId: string, ctx: ConvertContext): number {
  const maxLevel = numId === NUMBERING_IDS.checklist ? 0 : MAX_NUMBERING_LEVEL;
  if (depth <= maxLevel) return depth;
  ctx.onWarning?.({
    code: 'list-depth-clamped',
    message: `List nested ${depth + 1} levels deep; numbering is clamped to level ${maxLevel + 1}.`,
    blockId: list.id,
    depth,
    numberingLevel: maxLevel,
  });
  return maxLevel;
}

function convertItemChildren(children: readonly Block[] | undefined, level: number, ctx: ConvertContext): IRBlock[] {
  const out: IRBlock[] = [];
  for (const child of children ?? []) {
    if (LIST_TYPES.has(child.type)) {
      out.push(...convertList(child, level + 1, ctx));
      continue;
    }
    for (const ir of convertBlock(child, ctx)) {
      if (ir.source) {
        ir.source.list = { role: 'childBlock', level };
      }
      out.push(ir);
    }
  }
  return out;
}

function convertParagraph(block: Block): IRParagraph {
  const props = (block.props ?? {}) as Record<string, unknown>;
  const paraProps: Record<string, unknown> = {};
  const runs: IRInline[] = block.type === 'pageBreak'
    ? [{ type: 'break', kind: 'page' }]
    : inlineToRuns(block.content);

  switch (block.type) {
    case 'paragraph':
      for (const key of PARA_PROP_KEYS) {
        if (key in props) paraProps[key] = cloneValue(props[key]);
      }
      break;
    case 'heading':
      paraProps.styleId = typeof props.styleId === 'string' ? props.styleId : `Heading${clampHeadingLevel(props.level)}`;
      break;
    case 'blockquote':
      paraProps.styleId = 'Quote';
      break;
    case 'callout':
      paraProps.styleId = `Callout${capitalise(String(props.calloutType ?? 'info'))}`;
      break;
    case 'codeBlock':
      paraProps.styleId = 'Code';
      break;
    case 'divider':
      paraProps.styleId = 'Divider';
      break;
    default:
      break;
  }

  if (props.textAlign !== undefined) {
    paraProps.align = props.textAlign as Alignment;
  }

  const source: IRSource = {
    blockType: block.type,
    blockId: block.id,
    props: cloneValue(props),
  };
  if (block.children && block.children.length > 0) {
    source.raw = { children: cloneValue(block.children) };
  }

  if (block.type === 'tableOfContents') {
    const items = Array.isArray(props.items) ? (props.items as Array<{ text?: unknown }>) : [];
    runs.push({
      type: 'field',
      fieldType: 'TOC',
      instr: fieldInstruction('TOC'),
      name: null,
      cachedText: items.map((item) => String(item.text ?? '')).join('\n'),
    });
  }

  if (block.type === 'embed') {
    const url = String(props.url ?? '');
    if (url) {
      runs.push({ type: 'run', text: url, props: {}, link: { href: url } });
    }
  }

  return {
    type: 'paragraph',
    props: paraProps as ParaProps,
    runs,
    source,
  };
}

function convertImage(block: Block): IRImageBlock {
  const props = (block.props ?? {}) as Record<string, unknown>;
  const image: IRImageBlock = {
    type: 'image',
    src: String(props.src ?? ''),
    source: { blockType: block.type, blockId: block.id, props: cloneValue(props) },
  };
  if (typeof props.width === 'number' && props.width > 0) {
    image.widthPt = props.width * PT_PER_PX;
  }
  if (typeof props.alt === 'string') {
    image.alt = props.alt;
  }
  return image;
}

function convertSdt(block: Block, ctx: ConvertContext): IRSdt {
  const props = (block.props ?? {}) as Record<string, unknown>;
  const tag = typeof props.sectionId === 'string' && props.sectionId ? props.sectionId : block.id;
  const sdt: IRSdt = {
    type: 'sdt',
    tag,
    blocks: convertBlocks(block.children, ctx),
    source: { blockType: block.type, blockId: block.id, props: cloneValue(props) },
  };
  if (typeof props.title === 'string') {
    sdt.alias = props.title;
  }
  if (SDT_LOCKS.has(props.lock)) {
    sdt.lock = props.lock as IRSdt['lock'];
  } else if (props.lock === null) {
    sdt.lock = null;
  }
  return sdt;
}

function convertUnknown(block: Block, ctx: ConvertContext): IRBlock {
  const props = (block.props ?? {}) as Record<string, unknown>;
  const definition = ctx.registry?.get(block.type);
  if (definition?.toIR) {
    try {
      const result = definition.toIR(block, undefined);
      if (result && typeof result === 'object' && typeof (result as { type?: unknown }).type === 'string') {
        const ir = result as IRBlock;
        if (!ir.source) {
          ir.source = { blockType: block.type, blockId: block.id, props: cloneValue(props) };
        }
        return ir;
      }
    } catch {
      // A failing custom serializer must not break conversion; fall back below.
    }
  }

  const source: IRSource = {
    blockType: block.type,
    blockId: block.id,
    props: cloneValue(props),
  };
  const raw: NonNullable<IRSource['raw']> = {};
  if (block.content !== undefined) raw.content = cloneValue(block.content);
  if (block.children !== undefined) raw.children = cloneValue(block.children);
  source.raw = raw;
  source.unknown = true;

  return {
    type: 'paragraph',
    props: {},
    runs: inlineToRuns(block.content),
    source,
  };
}

/* -------------------------------------------------------------------------- */
/* Tables                                                                     */
/* -------------------------------------------------------------------------- */

function rowProps(row: Block): IRTableRow['props'] {
  const props = (row.props ?? {}) as Record<string, unknown>;
  return compact({
    isHeader: typeof props.isHeader === 'boolean' ? props.isHeader : undefined,
    cantSplit: typeof props.cantSplit === 'boolean' ? props.cantSplit : undefined,
    heightTwips: typeof props.heightTwips === 'number' ? props.heightTwips : undefined,
    id: row.id || undefined,
  });
}

function convertCell(cell: Block, span: number, rowspan: number, colwidth: number[] | undefined, ctx: ConvertContext): IRTableCell {
  const props = (cell.props ?? {}) as Record<string, unknown>;
  const cellProps: IRTableCell['props'] = { gridSpan: span };
  if (rowspan > 1) cellProps.vMerge = 'restart';
  if (typeof props.backgroundColor === 'string' && props.backgroundColor) {
    cellProps.shading = props.backgroundColor;
  }
  if (colwidth && colwidth.length > 0) {
    cellProps.widthTwips = Math.round(colwidth.reduce((sum, px) => sum + px, 0) * 15);
  }
  if (cell.id) cellProps.id = cell.id;
  return {
    props: cellProps,
    blocks: convertBlocks(cell.children, ctx),
    source: { blockType: cell.type, blockId: cell.id, props: cloneValue(props) },
  };
}

/** Builds a grid in twips: from known column widths (px) if all are known, else an equal split. */
function computeGrid(columnCount: number, widthsPx: Array<number | undefined>): number[] {
  if (columnCount === 0) return [];
  const known = Array.from({ length: columnCount }, (_value, index) => widthsPx[index]);
  if (known.every((width) => typeof width === 'number' && width > 0)) {
    return known.map((px) => Math.round((px as number) * 15));
  }
  const base = Math.floor(DEFAULT_TABLE_WIDTH_TWIPS / columnCount);
  const grid = Array.from({ length: columnCount }, () => base);
  grid[columnCount - 1] += DEFAULT_TABLE_WIDTH_TWIPS - base * columnCount;
  return grid;
}

/**
 * Converts a core table to an IR table, computing the grid and vertical merges.
 *
 * A cell with `rowspan` > 1 becomes a `restart` cell; every grid column it covers
 * in the following rows gets a `continue` placeholder, so each row's grid spans
 * add up to the table's column count.
 */
export function convertTable(table: Block, ctx: ConvertContext): IRTable {
  const remain: number[] = [];
  const widthsPx: Array<number | undefined> = [];
  const rows: IRTableRow[] = [];
  let columnCount = 0;

  for (const row of table.children ?? []) {
    const cells: IRTableCell[] = [];
    const own = row.children ?? [];
    let col = 0;
    let index = 0;

    for (;;) {
      if ((remain[col] ?? 0) > 0) {
        cells.push({ props: { gridSpan: 1, vMerge: 'continue' }, blocks: [] });
        col += 1;
        continue;
      }
      if (index >= own.length) break;

      const cell = own[index];
      index += 1;
      const props = (cell.props ?? {}) as Record<string, unknown>;
      const span = Math.max(1, Number(props.colspan ?? 1) || 1);
      const rowspan = Math.max(1, Number(props.rowspan ?? 1) || 1);
      const colwidth = Array.isArray(props.colwidth) ? (props.colwidth as number[]) : undefined;

      cells.push(convertCell(cell, span, rowspan, colwidth, ctx));
      for (let offset = 0; offset < span; offset += 1) {
        remain[col + offset] = rowspan;
        const width = colwidth?.[offset];
        if (typeof width === 'number') widthsPx[col + offset] = width;
      }
      col += span;
    }

    for (let slot = 0; slot < remain.length; slot += 1) {
      if (remain[slot] > 0) remain[slot] -= 1;
    }

    columnCount = Math.max(columnCount, col);
    rows.push({
      props: rowProps(row),
      cells,
      source: { blockType: row.type, blockId: row.id, props: cloneValue(row.props ?? {}) },
    });
  }

  const props = (table.props ?? {}) as Record<string, unknown>;
  const tableProps: IRTable['props'] = compact({
    styleId: typeof props.styleId === 'string' ? props.styleId : undefined,
    widthMode: typeof props.widthMode === 'string' ? (props.widthMode as IRTable['props']['widthMode']) : undefined,
    widthValue: typeof props.widthValue === 'number' || props.widthValue === null ? (props.widthValue as number | null) : undefined,
    look: props.look && typeof props.look === 'object' ? (cloneValue(props.look) as IRTable['props']['look']) : undefined,
  });

  return {
    type: 'table',
    props: tableProps,
    grid: computeGrid(columnCount, widthsPx),
    rows,
    source: { blockType: table.type, blockId: table.id, props: cloneValue(props) },
  };
}

/**
 * Converts a `columnList` to a borderless one-row IR table with one cell per column.
 * Column widths are proportional shares of the text width.
 */
function convertColumnList(list: Block, ctx: ConvertContext): IRTable {
  const columns = list.children ?? [];
  const widths = columns.map((column) => {
    const width = Number(((column.props ?? {}) as Record<string, unknown>).width ?? 50);
    return Number.isFinite(width) && width > 0 ? width : 50;
  });
  const total = widths.reduce((sum, width) => sum + width, 0);
  const grid = widths.map((width) =>
    total > 0 ? Math.round((TEXT_WIDTH_TWIPS * width) / total) : Math.floor(TEXT_WIDTH_TWIPS / Math.max(1, columns.length))
  );
  const cells: IRTableCell[] = columns.map((column, index) => ({
    props: { gridSpan: 1, widthTwips: grid[index], id: column.id },
    blocks: convertBlocks(column.children, ctx),
    source: { blockType: column.type, blockId: column.id, props: cloneValue(column.props ?? {}) },
  }));
  return {
    type: 'table',
    props: {},
    grid,
    rows: [{ props: {}, cells }],
    source: { blockType: list.type, blockId: list.id, props: cloneValue(list.props ?? {}) },
  };
}

/* -------------------------------------------------------------------------- */
/* Sections and documents                                                     */
/* -------------------------------------------------------------------------- */

function convertHeaderFooter(set: HeaderFooterSet, ctx: ConvertContext): IRHeaderFooterSet {
  const out: IRHeaderFooterSet = {};
  if (set.default) out.default = convertBlocks(set.default, ctx);
  if (set.first) out.first = convertBlocks(set.first, ctx);
  if (set.even) out.even = convertBlocks(set.even, ctx);
  return out;
}

/**
 * Converts a schema v2 document to the IR.
 *
 * Never throws for unknown block types: they are passed through `registry`
 * (`toIR`) when available, or kept as a paragraph with their original JSON in
 * `source.raw`.
 *
 * @example
 * ```typescript
 * const ir = documentToIR(doc);
 * const back = irToDocument(ir); // same blocks as doc
 * ```
 */
export function documentToIR(doc: BeakDocument, options: DocumentToIROptions = {}): IRDocument {
  const ctx: ConvertContext = { registry: options.registry, onWarning: options.onWarning };
  return {
    irVersion: IR_VERSION,
    id: doc.id,
    properties: cloneValue(doc.properties),
    styles: cloneValue(doc.styles),
    numbering: cloneValue(doc.numbering),
    sections: doc.sections.map((section): IRSection => {
      const out: IRSection = {
        id: section.id,
        pageSetup: cloneValue(section.pageSetup),
        body: convertBlocks(section.blocks, ctx),
      };
      if (section.titlePage !== undefined) out.titlePage = section.titlePage;
      if (section.headers) out.headers = convertHeaderFooter(section.headers, ctx);
      if (section.footers) out.footers = convertHeaderFooter(section.footers, ctx);
      return out;
    }),
  };
}

/**
 * Convenience: builds a single-section document from flat blocks and converts it to IR.
 *
 * @example
 * ```typescript
 * const ir = blocksToIR(blocks, { registry });
 * ```
 */
export function blocksToIR(blocks: Block[], options: DocumentToIROptions & { id?: string } = {}): IRDocument {
  const doc = blocksToDocument(blocks, { id: options.id });
  return documentToIR(doc, options);
}

/** Generates an id for IR-created blocks that lack one. */
export function ensureId(id: string | undefined | null): string {
  return id && id.length > 0 ? id : createId('blk');
}
