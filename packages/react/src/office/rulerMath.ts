/**
 * Pure geometry for the Office ruler: unit conversion, indent and tab stop edits,
 * and table column resizing. Kept free of React and ProseMirror so it can be unit tested.
 *
 * Units: points (pt) internally. Pixels are `pt * zoom * 96 / 72`.
 *
 * @module
 */

/** Pixels per point at 100% zoom (CSS px are 1/96 in, points are 1/72 in). */
export const PX_PER_PT = 96 / 72;

/** Smallest column width (pt) a column boundary drag may produce. */
export const MIN_COLUMN_WIDTH_PT = 18;

/** Indent values as stored in the `indent` paragraph attribute. */
export interface IndentValues {
  leftPt: number;
  hangingPt?: number;
  firstLinePt?: number;
}

/** A tab stop as stored in the `tabs` paragraph attribute. */
export interface TabStopValues {
  posPt: number;
  kind: 'left' | 'center' | 'right' | 'decimal';
  leader?: 'dot' | 'none';
}

/** The draggable indent markers on the horizontal ruler. */
export type IndentMarker = 'left' | 'firstLine';

/** Convert points to CSS pixels at the given zoom. */
export function ptToPx(pt: number, zoom = 1): number {
  return pt * zoom * PX_PER_PT;
}

/** Convert CSS pixels to points at the given zoom. */
export function pxToPt(px: number, zoom = 1): number {
  return px / (zoom * PX_PER_PT);
}

/** Round to a quarter point, the resolution the ruler snaps to. */
export function snapPt(value: number): number {
  return Math.round(value * 4) / 4;
}

/** Position (pt, relative to the left margin) of the first line. */
export function firstLinePosition(indent: IndentValues | null | undefined): number {
  const left = indent?.leftPt ?? 0;
  if (indent?.firstLinePt !== undefined) return left + indent.firstLinePt;
  return left - (indent?.hangingPt ?? 0);
}

/** Clamp a value into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Apply a drag of one indent marker to an `indent` value.
 *
 * Moving the left marker shifts the whole block and keeps the first-line offset, as Word does.
 * Moving the first-line marker changes only the first line, and becomes a hanging indent
 * when it is left of the left marker.
 *
 * @param indent Current indent, or null for none
 * @param marker Which marker is dragged
 * @param targetPt New marker position in pt, relative to the left margin
 * @param maxPt Largest allowed position (the text width)
 */
export function applyIndentDrag(
  indent: IndentValues | null | undefined,
  marker: IndentMarker,
  targetPt: number,
  maxPt: number
): IndentValues {
  const currentLeft = indent?.leftPt ?? 0;
  const relative = firstLinePosition(indent) - currentLeft;
  if (marker === 'left') {
    const leftPt = snapPt(clamp(targetPt, 0, maxPt));
    return buildIndent(leftPt, relative);
  }
  const firstPos = snapPt(clamp(targetPt, 0, maxPt));
  return buildIndent(currentLeft, firstPos - currentLeft);
}

function buildIndent(leftPt: number, relativeFirstLine: number): IndentValues {
  const indent: IndentValues = { leftPt };
  if (relativeFirstLine < 0) indent.hangingPt = snapPt(-relativeFirstLine);
  else if (relativeFirstLine > 0) indent.firstLinePt = snapPt(relativeFirstLine);
  return indent;
}

/** Add a tab stop at `posPt`, keeping the list sorted. Replaces a stop already at that position. */
export function addTabStop(tabs: TabStopValues[] | null | undefined, posPt: number, kind: TabStopValues['kind'] = 'left'): TabStopValues[] {
  const pos = snapPt(Math.max(0, posPt));
  const kept = (tabs ?? []).filter((tab) => Math.abs(tab.posPt - pos) > 0.25);
  return [...kept, { posPt: pos, kind }].sort((a, b) => a.posPt - b.posPt);
}

/** Move the tab stop at `index` to `posPt`, or remove it when `posPt` is null. */
export function moveTabStop(tabs: TabStopValues[], index: number, posPt: number | null): TabStopValues[] {
  const target = tabs[index];
  if (!target) return tabs;
  if (posPt === null) return tabs.filter((_, i) => i !== index);
  const moved = { ...target, posPt: snapPt(Math.max(0, posPt)) };
  return tabs
    .map((tab, i) => (i === index ? moved : tab))
    .sort((a, b) => a.posPt - b.posPt);
}

/** Cumulative right edges (pt, relative to the table's left edge) for column widths in pt. */
export function columnBoundaries(widthsPt: number[]): number[] {
  const edges: number[] = [];
  let total = 0;
  for (const width of widthsPt) {
    total += width;
    edges.push(total);
  }
  return edges;
}

/**
 * Move the boundary between column `index` and `index + 1` to `boundaryPt` (measured from the
 * table's left edge). Both neighbours keep at least MIN_COLUMN_WIDTH_PT. Other columns are unchanged.
 */
export function resizeColumn(widthsPt: number[], index: number, boundaryPt: number): number[] {
  const left = widthsPt[index];
  const right = widthsPt[index + 1];
  if (left === undefined || right === undefined) return widthsPt;
  const edges = columnBoundaries(widthsPt);
  const startOfLeft = index === 0 ? 0 : edges[index - 1]!;
  const pairEnd = edges[index + 1]!;
  const next = snapPt(clamp(boundaryPt, startOfLeft + MIN_COLUMN_WIDTH_PT, pairEnd - MIN_COLUMN_WIDTH_PT));
  const updated = [...widthsPt];
  updated[index] = next - startOfLeft;
  updated[index + 1] = pairEnd - next;
  return updated;
}

/** Convert CSS pixel column widths (as stored in `colwidth`) to points. */
export function pxWidthsToPt(widthsPx: Array<number | null | undefined>, fallbackTotalPt: number): number[] {
  const known = widthsPx.map((width) => (typeof width === 'number' && width > 0 ? width * 0.75 : null));
  const knownTotal = known.reduce<number>((sum, width) => sum + (width ?? 0), 0);
  const unknownCount = known.filter((width) => width === null).length;
  if (unknownCount === 0) return known as number[];
  const remaining = Math.max(0, fallbackTotalPt - knownTotal);
  const share = unknownCount > 0 ? remaining / unknownCount : 0;
  return known.map((width) => width ?? Math.max(MIN_COLUMN_WIDTH_PT, share));
}

/** Convert points back to CSS pixel column widths for the `colwidth` attribute. */
export function ptWidthsToPx(widthsPt: number[]): number[] {
  return widthsPt.map((width) => Math.round((width / 0.75) * 100) / 100);
}
