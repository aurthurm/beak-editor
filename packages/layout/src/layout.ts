/**
 * Public layout entry points: full layout and incremental relayout.
 *
 * @module
 */

import type { IRDocument } from '@amusendame/beakblock-ir';

import { createEngine, measureUnit, paginate } from './engine';
import type { EngineContext, PaginationOutput } from './engine';
import { resolveFields } from './fields';
import { createHeuristicMeasurer } from './measure';
import { firstUnitForBlock } from './units';
import type { LayoutOptions, LayoutPage, LayoutResult, LayoutSectionSummary, ResumePoint } from './types';

/** Start state of the first page of a document. */
const DOCUMENT_START: ResumePoint = {
  unitIndex: 0,
  lineOffset: 0,
  rowOffset: 0,
  sectionIndex: 0,
  sectionPageIndex: 0,
};

/** Builds the result from raw pages: resolves fields and summarises sections. */
function finalize(
  ctx: EngineContext,
  rawPages: LayoutPage[],
  resumePoints: ResumePoint[],
  options: LayoutOptions
): LayoutResult {
  const now = options.now ?? new Date();
  const resolved = resolveFields(ctx.sections, rawPages, ctx.doc, now);
  const sections: LayoutSectionSummary[] = ctx.sections.map((section, index) => {
    const pagesOfSection = resolved.pages.filter((page) => page.sectionIndex === index);
    return {
      id: section.id,
      index,
      firstPage: pagesOfSection.length > 0 ? pagesOfSection[0].index : 0,
      pageCount: pagesOfSection.length,
    };
  });
  return {
    pages: resolved.pages,
    pageCount: resolved.pages.length,
    fieldValues: resolved.fieldValues,
    toc: resolved.toc,
    sections,
    resumePoints,
  };
}

/**
 * Lays out an IR document into pages.
 *
 * Each section uses its own page setup. Paragraph styles are resolved through
 * `basedOn`, lines are broken greedily by the measurer, and pages are filled with
 * keep-with-next, keep-lines, widow and orphan control, page breaks, and
 * row-atomic table splitting with repeated header rows.
 *
 * @example
 * ```typescript
 * const layout = layoutDocument(ir);
 * layout.pageCount;
 * ```
 */
export function layoutDocument(ir: IRDocument, options: LayoutOptions = {}): LayoutResult {
  const measurer = options.measurer ?? createHeuristicMeasurer();
  const ctx = createEngine(ir, measurer);
  const output: PaginationOutput = paginate(ctx, DOCUMENT_START, 0);
  return finalize(ctx, output.pages, output.resumes, options);
}

/**
 * Incrementally re-lays out a document after an edit.
 *
 * Pages that finish before the first unit affected by the edit are reused as they are.
 * The layout restarts from the page that contains the edit (backed up over keep-with-next
 * chains and to the start of the section). The result is identical to a full
 * {@link layoutDocument} of the new IR.
 *
 * Contract: `ir` must differ from the IR that produced `prev` only in blocks at or after
 * `fromBlockIndex` (the global block index used by the IR paths). A changed page setup,
 * header or footer counts as a change: pass the index of the first block of that section.
 * Pass the same options as the original layout.
 *
 * @param fromBlockIndex Ordinal of the first changed IR leaf block (paragraph, table, image, passthrough).
 */
export function relayout(
  prev: LayoutResult,
  ir: IRDocument,
  fromBlockIndex: number,
  options: LayoutOptions = {}
): LayoutResult {
  const measurer = options.measurer ?? createHeuristicMeasurer();
  const ctx = createEngine(ir, measurer);
  if (prev.pages.length === 0 || prev.resumePoints.length !== prev.pages.length) {
    return layoutDocument(ir, options);
  }

  let v = Math.min(firstUnitForBlock(ctx.units, fromBlockIndex), ctx.units.length - 1);
  if (v < 0) v = 0;
  // Back up over keep-with-next chains: a paragraph kept with a changed unit may move.
  let changed = true;
  while (changed) {
    changed = false;
    let previous = v - 1;
    while (previous >= 0 && (ctx.units[previous].kind === 'sdtStart' || ctx.units[previous].kind === 'sdtEnd')) {
      previous -= 1;
    }
    if (previous >= 0 && ctx.units[previous].kind === 'paragraph' && measureUnit(ctx, previous).para?.keepNext) {
      v = previous;
      changed = true;
    }
  }
  // Reuse every page that starts strictly before the affected unit.
  let p = -1;
  for (let index = 0; index < prev.resumePoints.length; index += 1) {
    if (prev.resumePoints[index].unitIndex < v) p = index;
    else break;
  }
  if (p < 0) return layoutDocument(ir, options);

  const start = prev.resumePoints[p];
  const output = paginate(ctx, start, p);
  const pages = [...prev.pages.slice(0, p), ...output.pages];
  const resumes = [...prev.resumePoints.slice(0, p), ...output.resumes];
  return finalize(ctx, pages, resumes, options);
}
