/**
 * Property parsers: `w:pPr`, `w:rPr`, borders and shading.
 *
 * Units: twips are converted to points (1pt = 20 twips); eighths of a point to
 * points for borders.
 *
 * @module
 */

import { child, childrenNamed, onOff, wAttr, wNum } from './dom';
import type { BorderSpec, ParaProps, RunProps, TabStop } from './model';

/** Converts twips to points. */
export function twipsToPt(twips: number): number {
  return twips / 20;
}

const ALIGN: Record<string, NonNullable<ParaProps['align']>> = {
  left: 'left',
  start: 'left',
  center: 'center',
  right: 'right',
  end: 'right',
  both: 'justify',
  distribute: 'justify',
};

/** Paragraph properties of a `w:pPr` element. Only present values are set. */
export function parseParaProps(pPr: Element | null | undefined): ParaProps {
  const out: ParaProps = {};
  if (!pPr) return out;

  const pStyle = child(pPr, 'pStyle');
  if (pStyle) {
    const id = wAttr(pStyle, 'val');
    if (id) out.styleId = id;
  }

  const numPr = child(pPr, 'numPr');
  if (numPr) {
    const numId = child(numPr, 'numId');
    const ilvl = child(numPr, 'ilvl');
    const id = numId ? wAttr(numId, 'val') : null;
    if (id === '0') {
      out.numbering = null;
    } else if (id !== null) {
      out.numbering = { numId: id, level: wNum(ilvl, 'val') ?? 0 };
    }
  }

  const jc = child(pPr, 'jc');
  const jcVal = jc ? wAttr(jc, 'val') : null;
  if (jcVal && ALIGN[jcVal]) out.align = ALIGN[jcVal];

  const spacing = child(pPr, 'spacing');
  if (spacing) {
    const before = wNum(spacing, 'before');
    const after = wNum(spacing, 'after');
    const line = wNum(spacing, 'line');
    const rule = wAttr(spacing, 'lineRule') ?? 'auto';
    if (before !== undefined || after !== undefined || line !== undefined) {
      const lineRule = rule === 'exact' || rule === 'atLeast' ? rule : 'auto';
      out.spacing = {
        beforePt: twipsToPt(before ?? 0),
        afterPt: twipsToPt(after ?? 0),
        line: line ?? 240,
        lineRule,
      };
    }
  }

  const ind = child(pPr, 'ind');
  if (ind) {
    const left = wNum(ind, 'left') ?? wNum(ind, 'start');
    const hanging = wNum(ind, 'hanging');
    const firstLine = wNum(ind, 'firstLine');
    if (left !== undefined || hanging !== undefined || firstLine !== undefined) {
      const indent: NonNullable<ParaProps['indent']> = { leftPt: twipsToPt(left ?? 0) };
      if (hanging !== undefined) indent.hangingPt = twipsToPt(hanging);
      if (firstLine !== undefined) indent.firstLinePt = twipsToPt(firstLine);
      out.indent = indent;
    }
  }

  const flags: Array<[keyof ParaProps, string]> = [
    ['keepNext', 'keepNext'],
    ['keepLines', 'keepLines'],
    ['pageBreakBefore', 'pageBreakBefore'],
    ['widowControl', 'widowControl'],
  ];
  for (const [key, tag] of flags) {
    const value = onOff(child(pPr, tag));
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }

  const tabsEl = child(pPr, 'tabs');
  if (tabsEl) {
    const tabs: TabStop[] = [];
    for (const tab of childrenNamed(tabsEl, 'tab')) {
      const kind = wAttr(tab, 'val') ?? 'left';
      const pos = wNum(tab, 'pos');
      if (pos === undefined) continue;
      const mapped = kind === 'start' ? 'left' : kind === 'end' ? 'right' : kind;
      if (!['left', 'center', 'right', 'decimal'].includes(mapped)) continue;
      const leader = wAttr(tab, 'leader');
      const stop: TabStop = { posPt: twipsToPt(pos), kind: mapped as TabStop['kind'] };
      if (leader !== null) stop.leader = leader === 'dot' ? 'dot' : 'none';
      tabs.push(stop);
    }
    if (tabs.length > 0) out.tabs = tabs;
  }
  return out;
}

/** Character properties of a `w:rPr` element. Only present values are set. */
export function parseRunProps(rPr: Element | null | undefined): RunProps {
  const out: RunProps = {};
  if (!rPr) return out;

  const rStyle = child(rPr, 'rStyle');
  if (rStyle) {
    const id = wAttr(rStyle, 'val');
    if (id) out.styleId = id;
  }

  const fonts = child(rPr, 'rFonts');
  if (fonts) {
    const face = wAttr(fonts, 'ascii') ?? wAttr(fonts, 'hAnsi');
    if (face) out.font = face;
  }

  const sz = wNum(child(rPr, 'sz'), 'val');
  if (sz !== undefined) out.sizePt = sz / 2;

  if (onOff(child(rPr, 'b'))) out.bold = true;
  if (onOff(child(rPr, 'i'))) out.italic = true;
  if (onOff(child(rPr, 'strike')) || onOff(child(rPr, 'dstrike'))) out.strike = true;

  const u = child(rPr, 'u');
  if (u) {
    const val = wAttr(u, 'val') ?? 'single';
    if (val !== 'none') out.underline = true;
  }

  const vert = child(rPr, 'vertAlign');
  const vertVal = vert ? wAttr(vert, 'val') : null;
  if (vertVal === 'superscript' || vertVal === 'subscript') out.vertAlign = vertVal;
  if (vertVal === 'baseline') out.vertAlign = 'baseline';

  const color = child(rPr, 'color');
  const colorVal = color ? wAttr(color, 'val') : null;
  if (colorVal && colorVal !== 'auto') out.color = `#${colorVal.replace(/^#/, '')}`;

  const highlight = child(rPr, 'highlight');
  const hlVal = highlight ? wAttr(highlight, 'val') : null;
  if (hlVal && hlVal !== 'none') out.highlight = hlVal;

  const shd = child(rPr, 'shd');
  const fill = shd ? wAttr(shd, 'fill') : null;
  if (fill && fill !== 'auto') out.shading = `#${fill.replace(/^#/, '')}`;

  return out;
}

const BORDER_STYLE: Record<string, BorderSpec['style']> = {
  nil: 'none',
  none: 'none',
  single: 'single',
  thick: 'single',
  double: 'double',
  dashed: 'dashed',
  dashSmallGap: 'dashed',
  dotted: 'dotted',
  dotDash: 'dashed',
  dotDotDash: 'dotted',
};

/** Parses a border element (`w:top`, `w:tcBorders/w:left`, ...). Returns `null` for absent or `none` borders. */
export function parseBorder(el: Element | null | undefined): BorderSpec | null {
  if (!el) return null;
  const val = wAttr(el, 'val') ?? 'single';
  const style = BORDER_STYLE[val] ?? 'single';
  if (style === 'none') return null;
  const sz = wNum(el, 'sz') ?? 4;
  const color = wAttr(el, 'color');
  return {
    style,
    sizePt: sz / 8,
    color: color && color !== 'auto' ? `#${color.replace(/^#/, '')}` : '#000000',
  };
}

/** Shading fill of a `w:shd` element, or `undefined` when absent or automatic. */
export function parseShading(shd: Element | null | undefined): string | undefined {
  const fill = shd ? wAttr(shd, 'fill') : null;
  if (!fill || fill === 'auto') return undefined;
  return `#${fill.replace(/^#/, '')}`;
}
