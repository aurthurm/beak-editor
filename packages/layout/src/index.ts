/**
 * @amusendame/beakblock-layout
 *
 * Layout tree, pagination and field resolution from BeakDoc IR. Browser layout is used
 * for interactive editing; the server rendition stays authoritative for released
 * artifacts (ADR-2).
 *
 * @example
 * ```typescript
 * import { layoutDocument, renderPrintHTML } from '@amusendame/beakblock-layout';
 *
 * const layout = layoutDocument(ir);
 * const html = renderPrintHTML(ir, layout);
 * ```
 *
 * @module
 */

export type {
  FragmentKind,
  LayoutFragment,
  LayoutLine,
  LayoutOptions,
  LayoutPage,
  LayoutResult,
  LayoutSectionSummary,
  MeasureRun,
  MeasureSpacing,
  Measurer,
  PageVariant,
  ResumePoint,
  TocEntry,
} from './types';

export { createDomMeasurer, createHeuristicMeasurer } from './measure';
export { layoutDocument, relayout } from './layout';
export { formatDate } from './fields';
export { renderPrintHTML, renderPrintToWindow, escapeHtml } from './print';
export type { PrintOptions } from './print';
export {
  createPaginationPlugin,
  computePageBreaks,
  contentHeightPx,
  paginationPluginKey,
} from './pagination-plugin';
export type { PaginationPluginOptions, PaginationState } from './pagination-plugin';
