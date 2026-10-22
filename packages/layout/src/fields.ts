/**
 * Field resolution over a paginated layout.
 *
 * Pagination never depends on field values: fields are measured with placeholders
 * (see `fieldPlaceholder`), so one pagination pass followed by this resolution pass is
 * enough. The TOC and NUMPAGES values are computed after all pages are known.
 *
 * @module
 */

import type { IRBlock, IRDocument, IRField, IRInline, IRParagraph, IRSection } from '@amusendame/beakblock-ir';

import { bandBlocks } from './engine';
import type { LayoutPage, TocEntry } from './types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Formats a date with a Word-style pattern (`d`, `dd`, `M`, `MM`, `MMM`, `MMMM`, `yy`, `yyyy`). */
export function formatDate(date: Date, pattern: string): string {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const tokens: Record<string, string> = {
    yyyy: String(year),
    yy: String(year).slice(-2),
    MMMM: MONTHS[month],
    MMM: MONTHS[month].slice(0, 3),
    MM: String(month + 1).padStart(2, '0'),
    M: String(month + 1),
    dd: String(day).padStart(2, '0'),
    d: String(day),
  };
  return pattern.replace(/yyyy|yy|MMMM|MMM|MM|M|dd|d/g, (token) => tokens[token] ?? token);
}

/** Date format of a DATE field: the `\@ "..."` switch of its instruction, or the default. */
function dateFormat(field: IRField): string {
  const quoted = /\\@\s*"([^"]+)"/.exec(field.instr);
  return field.format ?? quoted?.[1] ?? 'd MMMM yyyy';
}

/** Context needed to resolve one field occurrence. */
export interface FieldContext {
  doc: IRDocument;
  now: Date;
  /** Display number of the page, for PAGE. */
  pageNumber?: number;
  /** Total number of pages, for NUMPAGES. */
  pageCount?: number;
}

/** Resolves a field that does not depend on other fields (not REF or TOC). */
export function resolveSimpleField(field: IRField, ctx: FieldContext): string {
  switch (field.fieldType) {
    case 'PAGE':
      return ctx.pageNumber !== undefined ? String(ctx.pageNumber) : field.cachedText;
    case 'NUMPAGES':
      return ctx.pageCount !== undefined ? String(ctx.pageCount) : field.cachedText;
    case 'DOCPROPERTY': {
      const name = field.name ?? '';
      const direct = (ctx.doc.properties as Record<string, unknown>)[name];
      if (typeof direct === 'string' && direct !== '') return direct;
      const custom = ctx.doc.properties.custom?.[name];
      if (custom !== undefined) return custom;
      return field.cachedText || field.fallback || '';
    }
    case 'DATE':
      return formatDate(ctx.now, dateFormat(field));
    default:
      return field.cachedText || field.fallback || '';
  }
}

/** Plain text of a paragraph with its fields replaced by their values. */
function plainText(paragraph: IRParagraph, path: string, values: Record<string, string>): string {
  return paragraph.runs
    .map((item, index) => {
      if (item.type === 'run') return item.text;
      if (item.type === 'field') return values[`${path}:${index}`] ?? (item.cachedText || item.fallback || '');
      if (item.type === 'break') return item.kind === 'line' ? ' ' : '';
      return '';
    })
    .join('');
}

/** Text of a header or footer block list, one entry per top-level paragraph. */
function bandText(blocks: readonly IRBlock[], ctx: FieldContext, out: string[]): void {
  for (const block of blocks) {
    if (block.type === 'paragraph') {
      out.push(
        block.runs
          .map((item: IRInline) => {
            if (item.type === 'run') return item.text;
            if (item.type === 'field') return resolveSimpleField(item, ctx);
            return '';
          })
          .join('')
      );
    } else if (block.type === 'table') {
      const cellTexts: string[] = [];
      for (const row of block.rows) {
        for (const cell of row.cells) {
          const inner: string[] = [];
          bandText(cell.blocks, ctx, inner);
          cellTexts.push(inner.join(' '));
        }
      }
      out.push(cellTexts.join(' | '));
    } else if (block.type === 'sdt') {
      bandText(block.blocks, ctx, out);
    }
  }
}

/** Heading level (1 to 3) of a paragraph, or null. */
function headingLevel(paragraph: IRParagraph): number | null {
  const match = /^Heading([1-3])$/.exec(paragraph.props.styleId ?? '');
  return match ? Number(match[1]) : null;
}

interface PendingField {
  key: string;
  field: IRField;
  page: number;
}

interface HeadingRecord {
  paragraph: IRParagraph;
  path: string;
  level: number;
  page: number;
}

interface TargetRecord {
  paragraph: IRParagraph;
  path: string;
  seqKey?: string;
}

/** Output of the resolution pass. */
export interface ResolvedFields {
  pages: LayoutPage[];
  fieldValues: Record<string, string>;
  toc: TocEntry[];
}

/**
 * Resolves fields and TOC entries for paginated pages.
 *
 * @param sections The IR sections, for body traversal.
 * @param pages Paginated pages (their fragments carry the paths used as keys).
 */
export function resolveFields(
  sections: readonly IRSection[],
  pages: readonly LayoutPage[],
  doc: IRDocument,
  now: Date
): ResolvedFields {
  const pageCount = pages.length;

  // First page and per-row page of every paragraph and table in the body.
  const firstPage = new Map<string, number>();
  const rowPages = new Map<string, number[]>();
  for (const page of pages) {
    for (const fragment of page.body) {
      if (fragment.kind === 'paragraph') {
        if (!firstPage.has(fragment.path)) firstPage.set(fragment.path, page.number);
      } else if (fragment.kind === 'tableRows' && fragment.rowRange) {
        const rows = rowPages.get(fragment.path) ?? [];
        for (let r = fragment.rowRange[0]; r < fragment.rowRange[1]; r += 1) {
          if (rows[r] === undefined) rows[r] = page.number;
        }
        rowPages.set(fragment.path, rows);
        if (!firstPage.has(fragment.path)) firstPage.set(fragment.path, page.number);
      }
    }
  }

  const fieldValues: Record<string, string> = {};
  const counters = new Map<string, number>();
  const pending: PendingField[] = [];
  const targets = new Map<string, TargetRecord>();
  const headings: HeadingRecord[] = [];

  const walk = (
    blocks: readonly IRBlock[],
    pathFor: (index: number) => string,
    pageFor: (index: number, path: string) => number
  ): void => {
    blocks.forEach((block, index) => {
      const path = pathFor(index);
      if (block.type === 'paragraph') {
        const page = pageFor(index, path);
        const level = headingLevel(block);
        if (level !== null) headings.push({ paragraph: block, path, level, page });
        let seqKey: string | undefined;
        block.runs.forEach((item, runIndex) => {
          if (item.type !== 'field') return;
          const key = `${path}:${runIndex}`;
          if (item.fieldType === 'SEQ') {
            const name = item.name || 'Figure';
            const next = (counters.get(name) ?? 0) + 1;
            counters.set(name, next);
            fieldValues[key] = String(next);
            if (seqKey === undefined) seqKey = key;
          } else if (item.fieldType === 'REF' || item.fieldType === 'TOC') {
            pending.push({ key, field: item, page });
          } else {
            fieldValues[key] = resolveSimpleField(item, {
              doc,
              now,
              pageNumber: page,
              pageCount,
            });
          }
        });
        if (block.source?.blockId) {
          targets.set(block.source.blockId, { paragraph: block, path, seqKey });
        }
      } else if (block.type === 'sdt') {
        const page = pageFor(index, path);
        walk(block.blocks, (child) => `${path}/${child}`, (_child, childPath) => firstPage.get(childPath) ?? page);
      } else if (block.type === 'table') {
        const page = pageFor(index, path);
        block.rows.forEach((row, rowIndex) => {
          row.cells.forEach((cell, cellIndex) => {
            const cellPage = rowPages.get(path)?.[rowIndex] ?? page;
            walk(cell.blocks, (child) => `${path}/r${rowIndex}c${cellIndex}.${child}`, () => cellPage);
          });
        });
      }
    });
  };

  sections.forEach((section, sectionIndex) => {
    const fallback = pages.find((page) => page.sectionIndex === sectionIndex)?.number ?? 1;
    walk(
      section.body,
      (index) => `s${sectionIndex}/${index}`,
      (_index, path) => firstPage.get(path) ?? fallback
    );
  });

  // REF targets, now that every paragraph has its values.
  for (const item of pending) {
    if (item.field.fieldType !== 'REF') continue;
    const target = item.field.name ? targets.get(item.field.name) : undefined;
    if (!target) {
      fieldValues[item.key] = item.field.cachedText || item.field.fallback || '';
    } else if (target.seqKey !== undefined && fieldValues[target.seqKey] !== undefined) {
      fieldValues[item.key] = fieldValues[target.seqKey];
    } else {
      fieldValues[item.key] = plainText(target.paragraph, target.path, fieldValues);
    }
  }

  const toc: TocEntry[] = headings.map((heading) => {
    const entry: TocEntry = {
      text: plainText(heading.paragraph, heading.path, fieldValues),
      level: heading.level,
      page: heading.page,
    };
    if (heading.paragraph.source?.blockId) entry.blockId = heading.paragraph.source.blockId;
    return entry;
  });

  const tocText = toc.map((entry) => `${entry.text}\t${entry.page}`).join('\n');
  for (const item of pending) {
    if (item.field.fieldType === 'TOC') fieldValues[item.key] = tocText;
  }

  const resolvedPages = pages.map((page): LayoutPage => {
    const section = sections[page.sectionIndex];
    const context: FieldContext = { doc, now, pageNumber: page.number, pageCount };
    const headerText: string[] = [];
    const footerText: string[] = [];
    if (section) {
      bandText(bandBlocks(section, 'header', page.variant), context, headerText);
      bandText(bandBlocks(section, 'footer', page.variant), context, footerText);
    }
    return { ...page, headerText, footerText };
  });

  return { pages: resolvedPages, fieldValues, toc };
}
