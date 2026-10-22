/**
 * Office-class table attributes, DOM rendering and parsing helpers.
 *
 * Units: twips for widths and heights (1pt = 20 twips), points for borders
 * and padding, CSS px for `colwidth` (prosemirror-tables). Contract §1.6.
 *
 * `null` means "unset" for every optional attribute, which keeps existing
 * documents unchanged. A `null` table `widthMode` means `auto`.
 *
 * @module
 */

import type { AttributeSpec, DOMOutputSpec } from 'prosemirror-model';

/** Table width mode. `null` on the node means `auto`. */
export type TableWidthMode = 'auto' | 'fixed' | 'pct';

/** Conditional table style parts. */
export interface TableLook {
  headerRow: boolean;
  bandedRows: boolean;
  firstColumn: boolean;
  lastRow: boolean;
}

/** Border style per edge. */
export type BorderStyle = 'single' | 'double' | 'dashed' | 'dotted' | 'none';

/** One cell border edge. */
export interface CellBorder {
  style: BorderStyle;
  sizePt: number;
  color: string;
}

/** Per-edge cell borders. `null` edges inherit from the table style. */
export interface CellBorders {
  top: CellBorder | null;
  right: CellBorder | null;
  bottom: CellBorder | null;
  left: CellBorder | null;
}

/** Cell padding in points. */
export interface CellPadding {
  topPt: number;
  rightPt: number;
  bottomPt: number;
  leftPt: number;
}

export type CellVAlign = 'top' | 'center' | 'bottom';
export type CellHAlign = 'left' | 'center' | 'right' | 'justify';

/** Twips per point. */
export const TWIPS_PER_PT = 20;
/** Twips per CSS px (96 px per inch, 1440 twips per inch). */
export const TWIPS_PER_PX = 15;

/** Converts twips to CSS px. */
export function twipsToPx(twips: number): number {
  return twips / TWIPS_PER_PX;
}

/** Converts CSS px to twips (rounded). */
export function pxToTwips(px: number): number {
  return Math.round(px * TWIPS_PER_PX);
}

/** Converts points to twips (rounded). */
export function ptToTwips(pt: number): number {
  return Math.round(pt * TWIPS_PER_PT);
}

/** Attribute specs for the table node (merged into the table spec). */
export const tableOfficeAttrs: Record<string, AttributeSpec> = {
  widthMode: { default: null },
  widthValue: { default: null },
  styleId: { default: null },
  look: { default: null },
};

/** Attribute specs for the table row node. */
export const tableRowOfficeAttrs: Record<string, AttributeSpec> = {
  isHeader: { default: null },
  cantSplit: { default: null },
  heightTwips: { default: null },
};

/** Attribute specs for table cells and header cells. */
export const tableCellOfficeAttrs: Record<string, AttributeSpec> = {
  widthTwips: { default: null },
  borders: { default: null },
  shading: { default: null },
  padding: { default: null },
  vAlign: { default: null },
  hAlign: { default: null },
};

/** Parses a JSON data attribute, returning null when absent or invalid. */
export function parseJsonDataAttr<T>(dom: HTMLElement, name: string): T | null {
  const raw = dom.getAttribute(name);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function parseIntAttr(raw: string | null): number | null {
  if (raw === null || raw === '') return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/** CSS border-style for a {@link BorderStyle}. */
export function borderCssStyle(style: BorderStyle): string {
  switch (style) {
    case 'double':
      return 'double';
    case 'dashed':
      return 'dashed';
    case 'dotted':
      return 'dotted';
    case 'none':
      return 'none';
    default:
      return 'solid';
  }
}

/** Parses `data-*` table attributes into node attrs. */
export function tableAttrsFromDom(dom: HTMLElement): Record<string, unknown> {
  const attrs: Record<string, unknown> = {
    id: dom.getAttribute('data-block-id') || null,
  };
  const mode = dom.getAttribute('data-width-mode');
  if (mode === 'fixed' || mode === 'pct' || mode === 'auto') attrs.widthMode = mode;
  const value = parseIntAttr(dom.getAttribute('data-width-value'));
  if (value !== null) attrs.widthValue = value;
  const styleId = dom.getAttribute('data-style-id');
  if (styleId) attrs.styleId = styleId;
  const look = parseJsonDataAttr<TableLook>(dom, 'data-look');
  if (look) attrs.look = look;
  return attrs;
}

/** Builds `data-*` attributes and inline style for a table node. */
export function tableDomAttrs(attrs: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = { class: 'ob-table' };
  if (attrs.id) out['data-block-id'] = String(attrs.id);
  if (attrs.widthMode) out['data-width-mode'] = String(attrs.widthMode);
  if (attrs.widthValue != null) out['data-width-value'] = String(attrs.widthValue);
  if (attrs.styleId) out['data-style-id'] = String(attrs.styleId);
  if (attrs.look) out['data-look'] = JSON.stringify(attrs.look);
  const widthCss = tableWidthCss(attrs);
  if (widthCss) out.style = widthCss;
  return out;
}

/** CSS width declaration for a table from its width attrs. */
export function tableWidthCss(attrs: Record<string, unknown>): string {
  const value = typeof attrs.widthValue === 'number' ? attrs.widthValue : null;
  if (value === null) return '';
  if (attrs.widthMode === 'fixed') return `width: ${twipsToPx(value)}px`;
  if (attrs.widthMode === 'pct') return `width: ${value / 50}%`;
  return '';
}

/** Parses `data-*` row attributes into node attrs. */
export function tableRowAttrsFromDom(dom: HTMLElement): Record<string, unknown> {
  const attrs: Record<string, unknown> = {
    id: dom.getAttribute('data-block-id') || null,
  };
  if (dom.getAttribute('data-is-header') === 'true') attrs.isHeader = true;
  if (dom.getAttribute('data-cant-split') === 'true') attrs.cantSplit = true;
  const height = parseIntAttr(dom.getAttribute('data-height-twips'));
  if (height !== null) attrs.heightTwips = height;
  return attrs;
}

/** Builds `data-*` attributes for a table row node. */
export function tableRowDomAttrs(attrs: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = { class: 'ob-table-row' };
  if (attrs.id) out['data-block-id'] = String(attrs.id);
  if (attrs.isHeader) out['data-is-header'] = 'true';
  if (attrs.cantSplit) out['data-cant-split'] = 'true';
  if (attrs.heightTwips != null) out['data-height-twips'] = String(attrs.heightTwips);
  const styles: string[] = [];
  if (attrs.cantSplit) styles.push('break-inside: avoid');
  if (attrs.heightTwips != null) styles.push(`height: ${twipsToPx(Number(attrs.heightTwips))}px`);
  if (styles.length) out.style = styles.join('; ');
  return out;
}

/** Parses `data-*` and legacy inline-style attributes of a cell into node attrs. */
export function tableCellAttrsFromDom(dom: HTMLElement): Record<string, unknown> {
  const colspan = parseIntAttr(dom.getAttribute('colspan')) ?? 1;
  const rowspan = parseIntAttr(dom.getAttribute('rowspan')) ?? 1;
  const colwidthRaw = dom.getAttribute('data-colwidth');
  const colwidth = colwidthRaw
    ? colwidthRaw.split(',').map((w) => parseInt(w, 10)).filter((n) => Number.isFinite(n))
    : null;
  const attrs: Record<string, unknown> = {
    id: dom.getAttribute('data-block-id') || null,
    colspan: Math.max(1, colspan),
    rowspan: Math.max(1, rowspan),
    colwidth: colwidth && colwidth.length ? colwidth : null,
    backgroundColor: dom.style.backgroundColor || null,
  };
  const widthTwips = parseIntAttr(dom.getAttribute('data-width-twips'));
  if (widthTwips !== null) attrs.widthTwips = widthTwips;
  const borders = parseJsonDataAttr<CellBorders>(dom, 'data-borders');
  if (borders) attrs.borders = borders;
  const shading = dom.getAttribute('data-shading') || dom.style.backgroundColor || null;
  if (shading) attrs.shading = shading;
  const padding = parseJsonDataAttr<CellPadding>(dom, 'data-padding');
  if (padding) attrs.padding = padding;
  const vAlign = dom.getAttribute('data-valign') ?? dom.style.verticalAlign;
  if (vAlign === 'top' || vAlign === 'center' || vAlign === 'bottom') attrs.vAlign = vAlign;
  const hAlign = dom.getAttribute('data-halign') ?? dom.style.textAlign;
  if (hAlign === 'left' || hAlign === 'center' || hAlign === 'right' || hAlign === 'justify') {
    attrs.hAlign = hAlign;
  }
  return attrs;
}

/** CSS declarations for cell borders, shading, padding and alignment. */
export function tableCellCss(attrs: Record<string, unknown>): string {
  const css: string[] = [];
  const width = Array.isArray(attrs.colwidth) && attrs.colwidth.length
    ? Number(attrs.colwidth[0])
    : attrs.widthTwips != null ? twipsToPx(Number(attrs.widthTwips)) : null;
  if (width !== null && Number.isFinite(width)) css.push(`width: ${width}px`);
  const borders = attrs.borders as CellBorders | null;
  if (borders) {
    for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
      const b = borders[edge];
      if (!b) continue;
      css.push(
        b.style === 'none'
          ? `border-${edge}: none`
          : `border-${edge}: ${b.sizePt}pt ${borderCssStyle(b.style)} ${b.color}`
      );
    }
  }
  const shading = (attrs.shading as string | null) || (attrs.backgroundColor as string | null);
  if (shading) css.push(`background-color: ${shading}`);
  const padding = attrs.padding as CellPadding | null;
  if (padding) {
    css.push(`padding: ${padding.topPt}pt ${padding.rightPt}pt ${padding.bottomPt}pt ${padding.leftPt}pt`);
  }
  if (attrs.vAlign) {
    const map: Record<string, string> = { top: 'top', center: 'middle', bottom: 'bottom' };
    css.push(`vertical-align: ${map[String(attrs.vAlign)] ?? 'top'}`);
  }
  if (attrs.hAlign) css.push(`text-align: ${String(attrs.hAlign)}`);
  return css.join('; ');
}

/** `data-*` attributes and inline CSS for a cell (td or th) node. */
export function tableCellDomAttrs(
  attrs: Record<string, unknown>,
  className: string
): Record<string, string> {
  const out: Record<string, string> = { class: className };
  if (attrs.id) out['data-block-id'] = String(attrs.id);
  if (Number(attrs.colspan) > 1) out.colspan = String(attrs.colspan);
  if (Number(attrs.rowspan) > 1) out.rowspan = String(attrs.rowspan);
  if (Array.isArray(attrs.colwidth) && attrs.colwidth.length) {
    out['data-colwidth'] = (attrs.colwidth as number[]).join(',');
  }
  if (attrs.widthTwips != null) out['data-width-twips'] = String(attrs.widthTwips);
  if (attrs.borders) out['data-borders'] = JSON.stringify(attrs.borders);
  if (attrs.shading) out['data-shading'] = String(attrs.shading);
  if (attrs.padding) out['data-padding'] = JSON.stringify(attrs.padding);
  if (attrs.vAlign) out['data-valign'] = String(attrs.vAlign);
  if (attrs.hAlign) out['data-halign'] = String(attrs.hAlign);
  const css = tableCellCss(attrs);
  if (css) out.style = css;
  return out;
}

/** Shared toDOM helper keeping the DOMOutputSpec shape for cells. */
export function cellDomSpec(tag: 'td' | 'th', attrs: Record<string, unknown>, className: string): DOMOutputSpec {
  return [tag, tableCellDomAttrs(attrs, className), 0];
}
