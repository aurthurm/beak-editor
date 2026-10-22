/**
 * Small builders for the synthetic conformance corpus.
 *
 * Every document is plain Block JSON (the v1 format that `migrateDocument` accepts), so the
 * same fixtures drive the schema, IR, DOCX, editor and security suites. Ids are generated per
 * document (`<prefix>-<kind>-<n>`) so failures point at a stable block.
 *
 * @module
 */

import type { Block, InlineContent, TextStyles } from '@amusendame/beakblock-core';

export type Inline = InlineContent | Record<string, unknown>;

export interface ListItemSpec {
  text: string | Inline[];
  children?: Block[];
}

export interface CellSpec {
  text?: string | Inline[];
  colspan?: number;
  rowspan?: number;
  header?: boolean;
  /** Extra block children (lists, nested tables, paragraphs). Replaces `text` when given. */
  children?: Block[];
  backgroundColor?: string | null;
  colwidth?: number[];
}

export interface DocBuilder {
  readonly prefix: string;
  id(kind: string): string;
  text(value: string, styles?: TextStyles): Inline;
  field(fieldType: string, name: string | null, extra?: Record<string, unknown>): Inline;
  revisionText(value: string, kind: 'insert' | 'delete', authorId: string, authorName: string, revisionId: string, at?: string, aiGenerated?: boolean): Inline;
  p(content: string | Inline[], props?: Record<string, unknown>): Block;
  h(level: number, content: string | Inline[], props?: Record<string, unknown>): Block;
  ul(items: (string | ListItemSpec)[], props?: Record<string, unknown>): Block;
  ol(items: (string | ListItemSpec)[], props?: Record<string, unknown>): Block;
  checklist(items: { text: string; checked: boolean }[]): Block;
  table(rows: CellSpec[][], props?: Record<string, unknown>): Block;
  block(type: string, props?: Record<string, unknown>, content?: Inline[], children?: Block[]): Block;
  divider(): Block;
  pageBreak(): Block;
  sectionBreak(pageSetup: Record<string, unknown>): Block;
  controlledSection(sectionId: string, title: string, children: Block[], props?: Record<string, unknown>): Block;
  variable(name: string): Inline;
}

const DEFAULT_HEADING_LOCK = { locked: false, lockReason: null, lockId: null };

function toInline(content: string | Inline[] | undefined): Inline[] {
  if (content === undefined) return [];
  if (typeof content === 'string') return content === '' ? [] : [{ type: 'text', text: content, styles: {} }];
  return content;
}

/** Creates a builder whose ids are unique within one document. */
export function docBuilder(prefix: string): DocBuilder {
  let n = 0;
  const id = (kind: string): string => {
    n += 1;
    return `${prefix}-${kind}-${n}`;
  };

  const block = (type: string, props: Record<string, unknown> = {}, content?: Inline[], children?: Block[]): Block => {
    const out: Block = { id: id(type), type, props };
    if (content !== undefined) out.content = content as InlineContent[];
    if (children !== undefined) out.children = children;
    return out;
  };

  const listBlock = (type: 'bulletList' | 'orderedList', items: (string | ListItemSpec)[], props: Record<string, unknown>): Block =>
    block(
      type,
      props,
      undefined,
      items.map((item) => {
        const spec: ListItemSpec = typeof item === 'string' ? { text: item } : item;
        const children = spec.children ?? [];
        return block('listItem', {}, toInline(spec.text), children.length ? children : undefined);
      })
    );

  const cellBlock = (spec: CellSpec): Block => {
    const cellType = spec.header ? 'tableHeader' : 'tableCell';
    const props: Record<string, unknown> = {
      colspan: spec.colspan ?? 1,
      rowspan: spec.rowspan ?? 1,
      colwidth: spec.colwidth ?? Array.from({ length: spec.colspan ?? 1 }, () => 200),
      backgroundColor: spec.backgroundColor ?? null,
    };
    if (spec.children) return block(cellType, props, undefined, spec.children);
    return block(cellType, props, undefined, [block('paragraph', { textAlign: 'left' }, toInline(spec.text ?? ''))]);
  };

  return {
    prefix,
    id,
    text: (value, styles = {}) => ({ type: 'text', text: value, styles }),
    field: (fieldType, name, extra = {}) => ({ type: 'field', fieldType, name, ...extra }),
    variable: (name) => ({ type: 'variable', props: { name, format: null } }),
    revisionText: (value, kind, authorId, authorName, revisionId, at = '2026-03-01T09:00:00.000Z', aiGenerated = false) => ({
      type: 'text',
      text: value,
      styles: { revision: { kind, revisionId, authorId, authorName, at, aiGenerated } },
    }),
    p: (content, props = {}) => block('paragraph', { textAlign: 'left', ...props }, toInline(content)),
    h: (level, content, props = {}) => block('heading', { level, textAlign: 'left', ...DEFAULT_HEADING_LOCK, ...props }, toInline(content)),
    ul: (items, props = {}) => listBlock('bulletList', items, props),
    ol: (items, props = {}) => listBlock('orderedList', items, { start: 1, ...props }),
    checklist: (items) =>
      block(
        'checkList',
        {},
        undefined,
        items.map((item) => block('checkListItem', { checked: item.checked }, toInline(item.text)))
      ),
    table: (rows, props = {}) =>
      block(
        'table',
        { widthMode: 'pct', widthValue: 5000, styleId: 'TableGrid', look: { headerRow: true, bandedRows: false, firstColumn: false, lastRow: false }, ...props },
        undefined,
        rows.map((cells) => block('tableRow', { isHeader: cells.length > 0 && cells.every((c) => c.header) }, undefined, cells.map(cellBlock)))
      ),
    block,
    divider: () => block('divider', {}),
    pageBreak: () => block('pageBreak', {}),
    sectionBreak: (pageSetup) => block('sectionBreak', { pageSetup }),
    controlledSection: (sectionId, title, children, props = {}) =>
      block(
        'controlledSection',
        {
          sectionId,
          title,
          templateSectionId: `tpl-${sectionId}`,
          policyRef: 'pol-sop',
          required: true,
          allowedBlocks: null,
          ownerName: null,
          workflowState: 'draft',
          locked: false,
          ...props,
        },
        undefined,
        children
      ),
  };
}
