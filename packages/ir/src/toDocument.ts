/**
 * IR to document and block JSON conversion.
 *
 * Uses {@link IRSource} to restore original block props and identity, and IR
 * structure (runs, rows, cells, list items, sdt children) for content.
 *
 * @module
 */

import type { Block, InlineContent, TextStyles } from '@amusendame/beakblock-core';
import { cloneValue, createId } from '@amusendame/beakblock-schema';
import type { BeakDocument, DocumentSection, HeaderFooterSet, ParaProps, RunProps } from '@amusendame/beakblock-schema';

import type { BlockRegistryLike } from './fromDocument';
import type {
  IRBlock,
  IRCustomInline,
  IRDocument,
  IRField,
  IRHeaderFooterSet,
  IRImageBlock,
  IRInline,
  IRParagraph,
  IRRevision,
  IRSdt,
  IRSection,
  IRSource,
  IRTable,
  IRTableCell,
  IRTableRow,
} from './types';

/** Options for {@link irToDocument}. */
export interface IRToDocumentOptions {
  /** Block registry; `fromIR` is consulted for opaque blocks that carry no source. */
  registry?: BlockRegistryLike;
}

/** Block types whose text runs are not part of their content (they are fully described by props). */
const NO_TEXT_TYPES: ReadonlySet<string> = new Set(['divider', 'pageBreak', 'sectionBreak', 'tableOfContents', 'embed']);

/** Paragraph property keys mapped back to block props for `paragraph` sources. */
const PARA_PROP_KEYS = ['styleId', 'numbering', 'spacing', 'indent', 'keepNext', 'keepLines', 'pageBreakBefore', 'widowControl', 'tabs'] as const;

/** Points per pixel, the inverse of the forward conversion. */
const PX_PER_PT = 1 / 0.75;

interface ListFrame {
  level: number;
  containerId: string;
  childList: Block[];
  lastItem: Block | null;
}

function childrenOf(block: Block): Block[] {
  if (!block.children) block.children = [];
  return block.children;
}

function sourceOf(block: IRBlock): IRSource | undefined {
  return block.source;
}

/** Maps IR run properties and revision back to core TextStyles. */
export function runPropsToStyles(props: RunProps, revision?: IRRevision): TextStyles {
  const styles: Record<string, unknown> = {};
  if (props.bold) styles.bold = true;
  if (props.italic) styles.italic = true;
  if (props.underline) styles.underline = true;
  if (props.strike) styles.strikethrough = true;
  if (props.styleId === 'Code') styles.code = true;
  if (props.color !== undefined) styles.textColor = props.color;
  if (props.shading !== undefined) styles.backgroundColor = props.shading;
  if (props.sizePt !== undefined) styles.fontSize = props.sizePt;
  if (revision) {
    const mark: Record<string, unknown> = { kind: revision.kind, revisionId: revision.id, at: revision.at };
    if (revision.author !== undefined) mark.authorName = revision.author;
    if (revision.authorId !== undefined) mark.authorId = revision.authorId;
    if (revision.aiGenerated !== undefined) mark.aiGenerated = revision.aiGenerated;
    styles.revision = mark;
  }
  return styles as TextStyles;
}

/**
 * Converts IR inline items back to core inline content.
 *
 * Consecutive runs with an identical `link` are grouped into one link. `break`
 * (line) becomes a hard break; `icon` and `field` items are restored as-is.
 */
export function runsToInline(runs: readonly IRInline[]): InlineContent[] {
  const out: unknown[] = [];
  let openLink: { block: Record<string, unknown>; key: string } | null = null;

  const closeLink = () => {
    openLink = null;
  };

  for (const run of runs) {
    if (run.type === 'run') {
      const text = { type: 'text', text: run.text, styles: runPropsToStyles(run.props, run.revision) };
      if (run.link) {
        const key = JSON.stringify(run.link);
        if (openLink && openLink.key === key) {
          (openLink.block.content as unknown[]).push(text);
          continue;
        }
        const link: Record<string, unknown> = { type: 'link', href: run.link.href };
        if (run.link.title !== undefined) link.title = run.link.title;
        if (run.link.target !== undefined) link.target = run.link.target;
        link.content = [text];
        out.push(link);
        openLink = { block: link, key };
        continue;
      }
      closeLink();
      out.push(text);
    } else if (run.type === 'break') {
      closeLink();
      if (run.kind === 'line') out.push({ type: 'hardBreak' });
    } else if (run.type === 'icon') {
      closeLink();
      const icon: Record<string, unknown> = { type: 'icon', icon: run.icon, symbol: run.symbol };
      if (run.size !== undefined) icon.size = run.size;
      out.push(icon);
    } else if (run.type === 'field') {
      closeLink();
      out.push(fieldToInline(run));
    } else if (run.type === 'custom') {
      closeLink();
      out.push(customToInline(run));
    } else {
      closeLink();
    }
  }
  return out as InlineContent[];
}

function customToInline(custom: IRCustomInline): Record<string, unknown> {
  const inline: Record<string, unknown> = { type: custom.inlineType, props: cloneValue(custom.props) };
  if (custom.content !== undefined) inline.content = runsToInline(custom.content);
  return inline;
}

function fieldToInline(field: IRField): Record<string, unknown> {
  const inline: Record<string, unknown> = { type: 'field', fieldType: field.fieldType };
  if (field.name !== undefined) inline.name = field.name;
  if (field.format !== undefined) inline.format = field.format;
  // Imported fields keep their cached result as the fallback when no explicit fallback is set.
  const fallback = field.fallback ?? (field.cachedText || null);
  if (fallback !== null) inline.fallback = fallback;
  return inline;
}

function overlayParaProps(props: Record<string, unknown>, pp: ParaProps): void {
  if (pp.align !== undefined) props.textAlign = pp.align;
  const target = pp as Record<string, unknown>;
  for (const key of PARA_PROP_KEYS) {
    if (target[key] !== undefined) props[key] = cloneValue(target[key]);
  }
}

function reverseParagraph(block: IRParagraph): Block {
  const source = sourceOf(block);
  const type = source?.blockType ?? 'paragraph';
  const props: Record<string, unknown> = cloneValue(source?.props ?? {});

  if (!source || type === 'paragraph') {
    overlayParaProps(props, block.props);
  } else if (block.props.align !== undefined) {
    props.textAlign = block.props.align;
  }

  const out: Block = { id: source?.blockId || createId('blk'), type, props };

  if (!NO_TEXT_TYPES.has(type)) {
    const content = runsToInline(block.runs);
    if (content.length > 0) out.content = content;
  }
  if (source?.raw?.content !== undefined) {
    out.content = cloneValue(source.raw.content) as InlineContent[];
  }
  if (source?.raw?.children !== undefined) {
    out.children = cloneValue(source.raw.children) as Block[];
  }
  return out;
}

function reverseImage(image: IRImageBlock): Block {
  const source = sourceOf(image);
  const props: Record<string, unknown> = cloneValue(source?.props ?? {});
  props.src = image.src;
  if (image.alt !== undefined) props.alt = image.alt;
  if (image.widthPt !== undefined) props.width = image.widthPt * PX_PER_PT;
  return { id: source?.blockId || createId('blk'), type: source?.blockType ?? 'image', props };
}

function reverseSdt(sdt: IRSdt): Block {
  const source = sourceOf(sdt);
  const props: Record<string, unknown> = cloneValue(source?.props ?? {});
  props.sectionId = sdt.tag;
  const out: Block = {
    id: source?.blockId || createId('blk'),
    type: source?.blockType ?? 'controlledSection',
    props,
  };
  const children = reverseBlocks(sdt.blocks);
  if (children.length > 0) out.children = children;
  return out;
}

/**
 * Computes, for each `continue` placeholder, its row and grid column, so restart
 * cells can recover their `rowspan`.
 */
function continuationSlots(table: IRTable): Set<string> {
  const slots = new Set<string>();
  table.rows.forEach((row, rowIndex) => {
    let col = 0;
    for (const cell of row.cells) {
      if (cell.props.vMerge === 'continue') slots.add(`${rowIndex}:${col}`);
      col += cell.props.gridSpan;
    }
  });
  return slots;
}

function reverseColumnList(table: IRTable, source: IRSource): Block {
  const cells = table.rows[0]?.cells ?? [];
  const children: Block[] = cells.map((cell) => {
    const columnSource = cell.source;
    return {
      id: columnSource?.blockId || (cell.props.id as string | undefined) || createId('blk'),
      type: columnSource?.blockType ?? 'column',
      props: cloneValue(columnSource?.props ?? {}),
      children: reverseBlocks(cell.blocks),
    };
  });
  return {
    id: source.blockId,
    type: 'columnList',
    props: cloneValue(source.props ?? {}),
    children,
  };
}

function reverseTable(table: IRTable): Block {
  const source = sourceOf(table);
  if (source?.blockType === 'columnList') {
    return reverseColumnList(table, source);
  }

  const props: Record<string, unknown> = cloneValue(source?.props ?? {});
  if (table.props.styleId !== undefined) props.styleId = table.props.styleId;
  if (table.props.widthMode !== undefined) props.widthMode = table.props.widthMode;
  if (table.props.widthValue !== undefined) props.widthValue = table.props.widthValue;
  if (table.props.look !== undefined) props.look = cloneValue(table.props.look);

  const slots = continuationSlots(table);
  const rows: Block[] = table.rows.map((row, rowIndex) => reverseRow(row, rowIndex, slots));

  const out: Block = { id: source?.blockId || createId('blk'), type: source?.blockType ?? 'table', props };
  out.children = rows;
  return out;
}

function reverseRow(row: IRTableRow, rowIndex: number, slots: ReadonlySet<string>): Block {
  const children: Block[] = [];
  let col = 0;
  for (const cell of row.cells) {
    const span = cell.props.gridSpan;
    if (cell.props.vMerge !== 'continue') {
      children.push(reverseCell(cell, rowIndex, col, slots));
    }
    col += span;
  }
  const source = row.source;
  return {
    id: source?.blockId || row.props.id || createId('blk'),
    type: source?.blockType ?? 'tableRow',
    props: cloneValue(source?.props ?? {}),
    children,
  };
}

function reverseCell(cell: IRTableCell, rowIndex: number, col: number, slots: ReadonlySet<string>): Block {
  let rowspan = 1;
  if (cell.props.vMerge === 'restart') {
    while (slots.has(`${rowIndex + rowspan}:${col}`)) rowspan += 1;
  }
  const source = cell.source;
  const props: Record<string, unknown> = cloneValue(source?.props ?? {});
  props.colspan = cell.props.gridSpan;
  props.rowspan = rowspan;
  return {
    id: source?.blockId || cell.props.id || createId('blk'),
    type: source?.blockType ?? 'tableCell',
    props,
    children: reverseBlocks(cell.blocks),
  };
}

function reverseOne(block: IRBlock): Block | null {
  switch (block.type) {
    case 'paragraph':
      return reverseParagraph(block);
    case 'table':
      return reverseTable(block);
    case 'sdt':
      return reverseSdt(block);
    case 'image':
      return reverseImage(block);
    case 'passthrough': {
      const source = sourceOf(block);
      if (!source) return null;
      const out: Block = {
        id: source.blockId || createId('blk'),
        type: source.blockType,
        props: cloneValue(source.props ?? {}),
      };
      if (source.raw?.content !== undefined) out.content = cloneValue(source.raw.content) as InlineContent[];
      if (source.raw?.children !== undefined) out.children = cloneValue(source.raw.children) as Block[];
      return out;
    }
    default:
      return null;
  }
}

function buildListItem(block: IRParagraph): Block {
  const source = sourceOf(block);
  const item: Block = {
    id: source?.blockId || createId('blk'),
    type: source?.blockType ?? 'listItem',
    props: cloneValue(source?.props ?? {}),
  };
  const content = runsToInline(block.runs);
  if (content.length > 0) item.content = content;
  return item;
}

/**
 * Rebuilds a flat list of IR blocks into block JSON, nesting list items and
 * child blocks by their {@link IRSource.list} membership.
 */
export function reverseBlocks(blocks: readonly IRBlock[]): Block[] {
  const result: Block[] = [];
  const stack: ListFrame[] = [];

  for (const block of blocks) {
    const membership = sourceOf(block)?.list;

    if (membership?.role === 'item' && block.type === 'paragraph') {
      const level = membership.level;
      const containerId = membership.containerId ?? createId('list');
      while (stack.length > 0 && stack[stack.length - 1].level > level) stack.pop();
      let top = stack[stack.length - 1];
      if (top && top.level === level && top.containerId !== containerId) {
        stack.pop();
        top = stack[stack.length - 1];
      }

      const item = buildListItem(block);
      if (top && top.level === level) {
        top.childList.push(item);
        top.lastItem = item;
        continue;
      }

      const parent: Block[] = top?.lastItem ? childrenOf(top.lastItem) : result;
      const childList: Block[] = [item];
      parent.push({
        id: containerId,
        type: membership.containerType ?? 'bulletList',
        props: cloneValue(membership.containerProps ?? {}),
        children: childList,
      });
      stack.push({ level, containerId, childList, lastItem: item });
      continue;
    }

    if (membership?.role === 'childBlock') {
      while (stack.length > 0 && stack[stack.length - 1].level > membership.level) stack.pop();
      const built = reverseOne(block);
      if (!built) continue;
      const owner = stack[stack.length - 1]?.lastItem;
      if (owner) {
        childrenOf(owner).push(built);
      } else {
        result.push(built);
      }
      continue;
    }

    stack.length = 0;
    const built = reverseOne(block);
    if (built) result.push(built);
  }
  return result;
}

function reverseHeaderFooter(set: IRHeaderFooterSet | undefined): HeaderFooterSet | undefined {
  if (!set) return undefined;
  const out: HeaderFooterSet = {};
  if (set.default) out.default = reverseBlocks(set.default);
  if (set.first) out.first = reverseBlocks(set.first);
  if (set.even) out.even = reverseBlocks(set.even);
  return out;
}

/**
 * Converts the IR back to a schema v2 document.
 *
 * `documentToBlocks(irToDocument(documentToIR(doc)))` deep-equals
 * `documentToBlocks(doc)` for documents built from core block JSON.
 *
 * @example
 * ```typescript
 * const doc = irToDocument(ir);
 * ```
 */
export function irToDocument(ir: IRDocument, _options: IRToDocumentOptions = {}): BeakDocument {
  return {
    schemaVersion: 2,
    id: ir.id ?? createId('doc'),
    properties: cloneValue(ir.properties ?? {}),
    styles: cloneValue(ir.styles),
    numbering: cloneValue(ir.numbering),
    sections: ir.sections.map((section: IRSection): DocumentSection => {
      const out: DocumentSection = {
        id: section.id,
        pageSetup: cloneValue(section.pageSetup),
        blocks: reverseBlocks(section.body),
      };
      if (section.titlePage !== undefined) out.titlePage = section.titlePage;
      const headers = reverseHeaderFooter(section.headers);
      if (headers) out.headers = headers;
      const footers = reverseHeaderFooter(section.footers);
      if (footers) out.footers = footers;
      return out;
    }),
  };
}
