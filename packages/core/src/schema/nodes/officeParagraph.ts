/**
 * Office paragraph properties shared by `paragraph` and `heading` nodes.
 *
 * These optional attributes mirror the OOXML-aligned `ParaProps` model
 * (contracts §1.1). All attributes default to `null` and are omitted from
 * serialized block props when unset, so existing documents are unchanged.
 *
 * Units: points (pt) for spacing and indent; `line` is in 240ths of a line
 * for `lineRule: 'auto'` and in twips for `exact` / `atLeast`.
 *
 * @module
 */

import type { AttributeSpec } from 'prosemirror-model';

/** Numbering reference (multilevel list definition). */
export interface ParagraphNumbering {
  numId: string;
  level: number;
}

/** Vertical spacing around and inside a paragraph. */
export interface ParagraphSpacing {
  beforePt: number;
  afterPt: number;
  line: number;
  lineRule: 'auto' | 'exact' | 'atLeast';
}

/** Horizontal indentation in points. */
export interface ParagraphIndent {
  leftPt: number;
  hangingPt?: number;
  firstLinePt?: number;
}

/** A tab stop. */
export interface ParagraphTab {
  posPt: number;
  kind: 'left' | 'center' | 'right' | 'decimal';
  leader?: 'dot' | 'none';
}

/**
 * Office paragraph properties (all optional, `null` when unset).
 */
export interface OfficeParagraphProps {
  styleId: string | null;
  numbering: ParagraphNumbering | null;
  spacing: ParagraphSpacing | null;
  indent: ParagraphIndent | null;
  keepNext: boolean | null;
  keepLines: boolean | null;
  pageBreakBefore: boolean | null;
  widowControl: boolean | null;
  tabs: ParagraphTab[] | null;
}

/** Names of the office paragraph attributes. */
export const OFFICE_PARAGRAPH_ATTR_NAMES = [
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

/** ProseMirror attribute specs to merge into paragraph and heading nodes. */
export const officeParagraphAttrs: Record<string, AttributeSpec> = {
  styleId: { default: null },
  numbering: { default: null },
  spacing: { default: null },
  indent: { default: null },
  keepNext: { default: null },
  keepLines: { default: null },
  pageBreakBefore: { default: null },
  widowControl: { default: null },
  tabs: { default: null },
};

function parseJsonAttr<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Reads office paragraph attributes back from rendered DOM.
 *
 * Complex values are read from JSON `data-*` attributes written by
 * {@link officeParagraphDomAttrs}; booleans come from `data-*` flags.
 *
 * @param dom - The element being parsed
 * @returns Partial attrs (only keys present in the DOM)
 */
export function officeParagraphParseAttrs(dom: HTMLElement): Partial<OfficeParagraphProps> {
  const out: Partial<OfficeParagraphProps> = {};

  const styleId = dom.getAttribute('data-style-id');
  if (styleId) out.styleId = styleId;

  const numbering = parseJsonAttr<ParagraphNumbering>(dom.getAttribute('data-numbering'));
  if (numbering) out.numbering = numbering;

  const spacing = parseJsonAttr<ParagraphSpacing>(dom.getAttribute('data-spacing'));
  if (spacing) out.spacing = spacing;

  const indent = parseJsonAttr<ParagraphIndent>(dom.getAttribute('data-indent'));
  if (indent) out.indent = indent;

  const tabs = parseJsonAttr<ParagraphTab[]>(dom.getAttribute('data-tabs'));
  if (tabs) out.tabs = tabs;

  const flag = (name: string): boolean | null => {
    const raw = dom.getAttribute(name);
    if (raw === null) return null;
    return raw === 'true';
  };

  const keepNext = flag('data-keep-next');
  if (keepNext !== null) out.keepNext = keepNext;
  const keepLines = flag('data-keep-lines');
  if (keepLines !== null) out.keepLines = keepLines;
  const pageBreakBefore = flag('data-page-break-before');
  if (pageBreakBefore !== null) out.pageBreakBefore = pageBreakBefore;
  const widowControl = flag('data-widow-control');
  if (widowControl !== null) out.widowControl = widowControl;

  return out;
}

/**
 * Builds the `data-*` attributes that carry office paragraph properties.
 * Null or undefined values are omitted.
 *
 * @param attrs - Node attrs (only office keys are read)
 */
export function officeParagraphDomAttrs(attrs: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  if (attrs.styleId) out['data-style-id'] = String(attrs.styleId);
  if (attrs.numbering) out['data-numbering'] = JSON.stringify(attrs.numbering);
  if (attrs.spacing) out['data-spacing'] = JSON.stringify(attrs.spacing);
  if (attrs.indent) out['data-indent'] = JSON.stringify(attrs.indent);
  if (attrs.tabs) out['data-tabs'] = JSON.stringify(attrs.tabs);
  if (attrs.keepNext != null) out['data-keep-next'] = String(attrs.keepNext);
  if (attrs.keepLines != null) out['data-keep-lines'] = String(attrs.keepLines);
  if (attrs.pageBreakBefore != null) out['data-page-break-before'] = String(attrs.pageBreakBefore);
  if (attrs.widowControl != null) out['data-widow-control'] = String(attrs.widowControl);
  return out;
}

/**
 * Builds inline CSS declarations for office paragraph properties.
 *
 * Spacing and indent are rendered in pt; page-break-before as a CSS break.
 *
 * @param attrs - Node attrs (only office keys are read)
 * @returns CSS declarations (no trailing semicolon), or empty string
 */
export function officeParagraphCss(attrs: Record<string, unknown>): string {
  const css: string[] = [];

  const spacing = attrs.spacing as ParagraphSpacing | null | undefined;
  if (spacing) {
    css.push(`margin-top: ${spacing.beforePt}pt`);
    css.push(`margin-bottom: ${spacing.afterPt}pt`);
    if (spacing.lineRule === 'auto') {
      // Canonical auto values are 240ths; values <= 10 are legacy multipliers.
      css.push(`line-height: ${spacing.line <= 10 ? spacing.line : spacing.line / 240}`);
    } else if (spacing.line) {
      css.push(`line-height: ${spacing.line / 20}pt`);
    }
  }

  const indent = attrs.indent as ParagraphIndent | null | undefined;
  if (indent) {
    if (indent.leftPt) css.push(`margin-left: ${indent.leftPt}pt`);
    if (indent.hangingPt) {
      css.push(`text-indent: -${indent.hangingPt}pt`);
    } else if (indent.firstLinePt) {
      css.push(`text-indent: ${indent.firstLinePt}pt`);
    }
  }

  if (attrs.pageBreakBefore === true) {
    css.push('page-break-before: always');
  }

  return css.join('; ');
}

/**
 * Combines text alignment and office paragraph CSS into one `style` value.
 *
 * @param textAlign - The existing `textAlign` attr
 * @param attrs - Node attrs
 * @returns Style string, or `undefined` when there is nothing to set
 */
export function combinedBlockStyle(textAlign: unknown, attrs: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  if (textAlign && textAlign !== 'left') parts.push(`text-align: ${String(textAlign)}`);
  const officeCss = officeParagraphCss(attrs);
  if (officeCss) parts.push(officeCss);
  return parts.length > 0 ? parts.join('; ') : undefined;
}
