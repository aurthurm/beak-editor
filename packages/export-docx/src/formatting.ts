/**
 * Paragraph, run, border and shading property serialisation.
 *
 * Child elements are emitted in the order mandated by the OOXML schema
 * (CT_PPrBase, CT_RPr, CT_TcPr and CT_TblPr), because Word rejects out-of-order content.
 *
 * @module
 */

import { DEFAULT_FONT_MAP } from './types';
import type { BorderSpec, ParaProps, RunProps } from './types';
import { element, hex, onOff, twips, valEl } from './xml';

/** Resolves font names through the font map and records which names were used. */
export interface FontResolver {
  /** Maps a font name to the name written into the package. */
  map(name: string): string;
  /** Every mapped font name written so far. */
  readonly used: Set<string>;
}

/** Creates a font resolver. `fontMap` is merged over {@link DEFAULT_FONT_MAP}. */
export function createFontResolver(fontMap?: Record<string, string>): FontResolver {
  const table = { ...DEFAULT_FONT_MAP, ...(fontMap ?? {}) };
  const used = new Set<string>();
  return {
    map(name: string): string {
      const mapped = Object.prototype.hasOwnProperty.call(table, name) ? table[name] : name;
      used.add(mapped);
      return mapped;
    },
    used,
  };
}

/** Wraps non-empty inner XML in `w:rPr`. */
export function rPr(inner: string): string {
  return inner ? `<w:rPr>${inner}</w:rPr>` : '';
}

/** Wraps non-empty inner XML in `w:pPr`. */
export function pPr(inner: string): string {
  return inner ? `<w:pPr>${inner}</w:pPr>` : '';
}

const JUSTIFICATION: Readonly<Record<string, string>> = {
  left: 'left',
  center: 'center',
  right: 'right',
  justify: 'both',
};

/** Named highlight colours available to `w:highlight`, keyed by hex value. */
const NAMED_HIGHLIGHTS: Readonly<Record<string, string>> = {
  FFFF00: 'yellow',
  '00FF00': 'green',
  '00FFFF': 'cyan',
  FF00FF: 'magenta',
  '0000FF': 'blue',
  FF0000: 'red',
  '000080': 'darkBlue',
  '008080': 'darkCyan',
  '008000': 'darkGreen',
  '800080': 'darkMagenta',
  '800000': 'darkRed',
  '808000': 'darkYellow',
  '808080': 'darkGray',
  C0C0C0: 'lightGray',
  '000000': 'black',
  FFFFFF: 'white',
};

/** A `w:shd` element filling with `fill`. */
export function shadingXml(fill: string): string {
  return element('w:shd', { 'w:val': 'clear', 'w:color': 'auto', 'w:fill': hex(fill) });
}

/** The `w:tabs` element for a list of tab stops, or an empty string. */
function tabsXml(tabs: ParaProps['tabs']): string {
  if (!tabs || tabs.length === 0) return '';
  const stops = tabs.map((tab) =>
    element('w:tab', { 'w:val': tab.kind, 'w:leader': tab.leader, 'w:pos': twips(tab.posPt) })
  );
  return `<w:tabs>${stops.join('')}</w:tabs>`;
}

/**
 * The `w:spacing` element. IR `line` is written as-is: OOXML 240ths for `auto`
 * (240 = single), twips for `exact` and `atLeast`.
 */
function spacingXml(spacing: ParaProps['spacing']): string {
  if (!spacing) return '';
  return element('w:spacing', {
    'w:before': twips(spacing.beforePt),
    'w:after': twips(spacing.afterPt),
    'w:line': Math.round(spacing.line),
    'w:lineRule': spacing.lineRule,
  });
}

/** The `w:ind` element. A hanging indent takes precedence over a first-line indent. */
function indentXml(indent: ParaProps['indent']): string {
  if (!indent) return '';
  const hanging = indent.hangingPt !== undefined ? twips(indent.hangingPt) : undefined;
  const firstLine =
    hanging === undefined && indent.firstLinePt !== undefined ? twips(indent.firstLinePt) : undefined;
  return element('w:ind', {
    'w:left': twips(indent.leftPt),
    'w:hanging': hanging,
    'w:firstLine': firstLine,
  });
}

/** Inner XML of a `w:pPr` (without `sectPr`), in schema order. */
export function paragraphPropsInner(
  props: ParaProps | undefined,
  extra: { pStyle?: string; numPr?: string; outlineLevel?: number } = {}
): string {
  const p = props ?? {};
  return [
    extra.pStyle ? valEl('w:pStyle', extra.pStyle) : '',
    onOff('w:keepNext', p.keepNext),
    onOff('w:keepLines', p.keepLines),
    onOff('w:pageBreakBefore', p.pageBreakBefore),
    onOff('w:widowControl', p.widowControl),
    extra.numPr ?? '',
    tabsXml(p.tabs),
    spacingXml(p.spacing),
    indentXml(p.indent),
    p.align ? valEl('w:jc', JUSTIFICATION[p.align] ?? 'left') : '',
    extra.outlineLevel !== undefined ? valEl('w:outlineLvl', extra.outlineLevel) : '',
  ].join('');
}

/** Inner XML of a `w:rPr`, in schema order. Records font usage on `fonts`. */
export function runPropsInner(
  props: RunProps | undefined,
  fonts: FontResolver,
  extra: { rStyle?: string } = {}
): string {
  const p = props ?? {};
  const highlightName = p.highlight ? NAMED_HIGHLIGHTS[hex(p.highlight)] : undefined;
  const fill = p.highlight && !highlightName ? p.highlight : p.shading;
  const sizeHalfPt = p.sizePt !== undefined ? Math.round(p.sizePt * 2) : undefined;
  let fontElement = '';
  if (p.font) {
    const name = fonts.map(p.font);
    fontElement = element('w:rFonts', {
      'w:ascii': name,
      'w:hAnsi': name,
      'w:cs': name,
      'w:eastAsia': name,
    });
  }
  return [
    extra.rStyle ? valEl('w:rStyle', extra.rStyle) : '',
    fontElement,
    onOff('w:b', p.bold),
    onOff('w:i', p.italic),
    onOff('w:strike', p.strike),
    p.color ? valEl('w:color', hex(p.color)) : '',
    sizeHalfPt !== undefined ? valEl('w:sz', sizeHalfPt) : '',
    sizeHalfPt !== undefined ? valEl('w:szCs', sizeHalfPt) : '',
    highlightName ? valEl('w:highlight', highlightName) : '',
    p.underline !== undefined ? valEl('w:u', p.underline ? 'single' : 'none') : '',
    fill ? shadingXml(fill) : '',
    p.vertAlign ? valEl('w:vertAlign', p.vertAlign) : '',
  ].join('');
}

/** A border element. `null` writes `nil`; `undefined` writes nothing. */
export function borderXml(
  name: string,
  spec: Partial<BorderSpec> | null | undefined
): string {
  if (spec === undefined) return '';
  if (spec === null || spec.style === 'none') return valEl(name, 'nil');
  return element(name, {
    'w:val': spec.style ?? 'single',
    'w:sz': Math.max(2, Math.round((spec.sizePt ?? 0.5) * 8)),
    'w:space': 0,
    'w:color': hex(spec.color ?? '000000'),
  });
}

/**
 * A `w:tblBorders` or `w:tcBorders` wrapper in schema order (top, left, bottom,
 * right, insideH, insideV). `start` and `end` are accepted as aliases of left and right.
 */
export function bordersXml(
  wrapper: 'w:tblBorders' | 'w:tcBorders',
  borders: Partial<Record<string, Partial<BorderSpec> | null>>
): string {
  const order: Array<[string, string]> = [
    ['top', 'w:top'],
    ['left', 'w:left'],
    ['bottom', 'w:bottom'],
    ['right', 'w:right'],
    ['insideH', 'w:insideH'],
    ['insideV', 'w:insideV'],
  ];
  const inner = order
    .map(([key, name]) => {
      const source = key === 'left' ? borders.left ?? borders.start : key === 'right' ? borders.right ?? borders.end : borders[key];
      return borderXml(name, source);
    })
    .join('');
  return inner ? `<${wrapper}>${inner}</${wrapper}>` : '';
}
