/**
 * Parsers for `word/styles.xml` and `word/numbering.xml`.
 *
 * @module
 */

import { child, childrenNamed, wAttr, wNum } from './dom';
import { parseBorder, parseParaProps, parseRunProps, parseShading, twipsToPt } from './props';
import type {
  AbstractNumbering,
  BorderSpec,
  CharacterStyle,
  NumberingDefinitions,
  NumberingLevel,
  ParagraphStyle,
  StyleSheet,
  TableStyle,
} from './model';
import { addLoss, type PartContext } from './context';
import type { TableEdge } from './model';

const EDGE_TAGS: Array<[string, TableEdge]> = [
  ['top', 'top'],
  ['left', 'left'],
  ['start', 'left'],
  ['bottom', 'bottom'],
  ['right', 'right'],
  ['end', 'right'],
  ['insideH', 'insideH'],
  ['insideV', 'insideV'],
];

const FORMATS: Record<string, NumberingLevel['format']> = {
  decimal: 'decimal',
  bullet: 'bullet',
  lowerLetter: 'lowerLetter',
  upperLetter: 'upperLetter',
  lowerRoman: 'lowerRoman',
  upperRoman: 'upperRoman',
  none: 'none',
};

function styleName(style: Element): string {
  return wAttr(child(style, 'name') ?? style, 'val') ?? '';
}

/** Parses `styles.xml`. Unknown style types are skipped. */
export function parseStyles(root: Element | null): StyleSheet {
  const sheet: StyleSheet = { paragraph: {}, character: {}, table: {} };
  if (!root) return sheet;

  for (const style of childrenNamed(root, 'style')) {
    const id = wAttr(style, 'styleId');
    const type = wAttr(style, 'type');
    if (!id) continue;
    const basedOn = wAttr(child(style, 'basedOn') ?? style, 'val');
    const name = styleName(style) || id;
    const pPr = child(style, 'pPr');
    const rPr = child(style, 'rPr');

    if (type === 'paragraph') {
      const entry: ParagraphStyle = { id, name };
      if (basedOn) entry.basedOn = basedOn;
      const next = wAttr(child(style, 'next') ?? style, 'val');
      if (next) entry.next = next;
      const paraProps = parseParaProps(pPr);
      if (Object.keys(paraProps).length > 0) entry.paraProps = paraProps;
      const runProps = parseRunProps(rPr);
      if (Object.keys(runProps).length > 0) entry.runProps = runProps;
      const outline = wNum(child(pPr, 'outlineLvl'), 'val');
      if (outline !== undefined) entry.outlineLevel = outline;
      sheet.paragraph[id] = entry;
    } else if (type === 'character') {
      const entry: CharacterStyle = { id, name };
      if (basedOn) entry.basedOn = basedOn;
      const runProps = parseRunProps(rPr);
      if (Object.keys(runProps).length > 0) entry.runProps = runProps;
      sheet.character[id] = entry;
    } else if (type === 'table') {
      sheet.table[id] = parseTableStyle(style, id, name, basedOn ?? undefined);
    }
  }
  return sheet;
}

function parseTableStyle(style: Element, id: string, name: string, basedOn: string | undefined): TableStyle {
  const entry: TableStyle = { id, name };
  if (basedOn) entry.basedOn = basedOn;
  const tblPr = child(style, 'tblPr');
  const borders = child(tblPr, 'tblBorders');
  if (borders) {
    const out: Partial<Record<TableEdge, BorderSpec | null>> = {};
    for (const [tag, edge] of EDGE_TAGS) {
      const el = child(borders, tag);
      if (el) out[edge] = parseBorder(el);
    }
    if (Object.keys(out).length > 0) entry.borders = out;
  }
  const mar = child(tblPr, 'tblCellMar');
  if (mar) {
    const padding: NonNullable<TableStyle['cellPaddingPt']> = {};
    const sides: Array<[string, 'top' | 'right' | 'bottom' | 'left']> = [
      ['top', 'top'],
      ['right', 'right'],
      ['end', 'right'],
      ['bottom', 'bottom'],
      ['left', 'left'],
      ['start', 'left'],
    ];
    for (const [tag, side] of sides) {
      const w = wNum(child(mar, tag), 'w');
      if (w !== undefined) padding[side] = twipsToPt(w);
    }
    if (Object.keys(padding).length > 0) entry.cellPaddingPt = padding;
  }
  const pPr = parseParaProps(child(style, 'pPr'));
  if (Object.keys(pPr).length > 0) entry.paraProps = pPr;
  const rPr = parseRunProps(child(style, 'rPr'));
  if (Object.keys(rPr).length > 0) entry.runProps = rPr;

  for (const part of childrenNamed(style, 'tblStylePr')) {
    const type = wAttr(part, 'type');
    if (!type || !['firstRow', 'lastRow', 'firstColumn', 'band1Horz'].includes(type)) continue;
    const shading = parseShading(child(child(part, 'tcPr'), 'shd'));
    const runProps = parseRunProps(child(part, 'rPr'));
    const cond: { shading?: string; runProps?: typeof runProps } = {};
    if (shading) cond.shading = shading;
    if (Object.keys(runProps).length > 0) cond.runProps = runProps;
    if (Object.keys(cond).length > 0) {
      entry.conditional = { ...(entry.conditional ?? {}), [type]: cond };
    }
  }
  return entry;
}

/** Parses `numbering.xml` into abstract definitions and numId instances. */
export function parseNumbering(root: Element | null, ctx: PartContext): NumberingDefinitions {
  const out: NumberingDefinitions = { abstract: {}, instances: {} };
  if (!root) return out;

  for (const abs of childrenNamed(root, 'abstractNum')) {
    const id = wAttr(abs, 'abstractNumId');
    if (id === null) continue;
    const mlt = wAttr(child(abs, 'multiLevelType') ?? abs, 'val');
    const multiLevelType: AbstractNumbering['multiLevelType'] =
      mlt === 'singleLevel' || mlt === 'hybridMultilevel' ? mlt : 'multilevel';
    const levels: NumberingLevel[] = [];
    for (const lvl of childrenNamed(abs, 'lvl')) {
      const level = wNum(lvl, 'ilvl') ?? levels.length;
      const fmtVal = wAttr(child(lvl, 'numFmt') ?? lvl, 'val') ?? 'decimal';
      let format = FORMATS[fmtVal];
      if (!format) {
        format = 'decimal';
        addLoss(ctx, 'numfmt-approximated', `Number format "${fmtVal}" approximated as decimal.`, `numbering:${id}:${level}`);
      }
      const entry: NumberingLevel = {
        level,
        format,
        text: wAttr(child(lvl, 'lvlText') ?? lvl, 'val') ?? '',
        start: wNum(child(lvl, 'start') ?? lvl, 'val') ?? 0,
      };
      const pStyle = wAttr(child(lvl, 'pStyle') ?? lvl, 'val');
      if (pStyle) entry.paraStyleId = pStyle;
      const pPr = parseParaProps(child(lvl, 'pPr'));
      if (pPr.indent) entry.indent = { leftPt: pPr.indent.leftPt, hangingPt: pPr.indent.hangingPt };
      const runProps = parseRunProps(child(lvl, 'rPr'));
      if (Object.keys(runProps).length > 0) entry.runProps = runProps;
      levels.push(entry);
    }
    out.abstract[id] = { id, multiLevelType, levels };
  }

  for (const num of childrenNamed(root, 'num')) {
    const numId = wAttr(num, 'numId');
    const abstractId = wAttr(child(num, 'abstractNumId') ?? num, 'val');
    if (numId === null || abstractId === null) continue;
    const instance: NumberingDefinitions['instances'][string] = { abstractId };
    for (const override of childrenNamed(num, 'lvlOverride')) {
      const ilvl = wNum(override, 'ilvl');
      const start = wNum(child(override, 'startOverride'), 'val');
      if (ilvl === undefined || start === undefined) continue;
      instance.overrides = { ...(instance.overrides ?? {}), [ilvl]: { startOverride: start } };
    }
    out.instances[numId] = instance;
  }
  return out;
}
