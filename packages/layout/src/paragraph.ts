/**
 * Paragraph property resolution and greedy line breaking.
 *
 * Property precedence is direct paragraph props, then numbering level indent (for
 * indent only), then the paragraph style chain (`basedOn`), then the defaults.
 *
 * @module
 */

import type { IRDocument, IRInline, IRParagraph, IRRun, IRSection } from '@amusendame/beakblock-ir';

import { lineHeightFor } from './measure';
import type { LayoutLine, Measurer, MeasureSpacing } from './types';

type ParaProps = IRParagraph['props'];
type RunProps = IRRun['props'];
type StyleSheet = IRDocument['styles'];
type Indent = NonNullable<ParaProps['indent']>;

/** Font used when no style or run sets one. */
export const DEFAULT_FONT = 'Carlito';
/** Size used when no style or run sets one. */
export const DEFAULT_SIZE_PT = 11;

const DEFAULT_SPACING: MeasureSpacing & { beforePt: number; afterPt: number } = {
  beforePt: 0,
  afterPt: 0,
  line: 240,
  lineRule: 'auto',
};

/** Effective run formatting used for measurement. */
export interface RunStyle {
  font: string;
  sizePt: number;
  bold: boolean;
  italic: boolean;
}

/** A paragraph with its properties resolved against styles and numbering. */
export interface ResolvedParagraph {
  beforePt: number;
  afterPt: number;
  spacing: MeasureSpacing;
  keepNext: boolean;
  keepLines: boolean;
  pageBreakBefore: boolean;
  widowControl: boolean;
  leftPt: number;
  /** Extra offset of the first line (positive pushes right, hanging gives negative effect). */
  firstLinePt: number;
  hangingPt: number;
  base: RunStyle;
}

/** Paragraph measurement: broken lines and their heights. */
export interface ParagraphMeasure {
  lines: LayoutLine[];
  heights: number[];
  beforePt: number;
  afterPt: number;
  keepNext: boolean;
  keepLines: boolean;
  pageBreakBefore: boolean;
  widowControl: boolean;
  /** Sum of line heights (without spacing). */
  linesHeightPt: number;
}

/** Returns the style chain from `styleId` up to the root, nearest first. */
export function styleChain(styles: StyleSheet, styleId: string | null | undefined): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | null | undefined = styleId;
  while (current && !seen.has(current) && Object.prototype.hasOwnProperty.call(styles.paragraph, current)) {
    seen.add(current);
    chain.push(current);
    current = styles.paragraph[current].basedOn ?? null;
  }
  return chain;
}

function definedOnly<T extends object>(value: T | null | undefined): Partial<T> {
  const out: Partial<T> = {};
  if (!value) return out;
  for (const key of Object.keys(value) as Array<keyof T>) {
    if (value[key] !== undefined && value[key] !== null) out[key] = value[key];
  }
  return out;
}

/** Looks up the numbering level referenced by a paragraph, if any. */
function numberingLevelIndent(doc: IRDocument, numbering: ParaProps['numbering']): Indent | null {
  if (!numbering) return null;
  const instance = doc.numbering.instances[numbering.numId];
  if (!instance) return null;
  const abstract = doc.numbering.abstract[instance.abstractId];
  const level = abstract?.levels.find((candidate) => candidate.level === numbering.level);
  if (!level?.indent) return null;
  const indent: Indent = { leftPt: level.indent.leftPt };
  if (level.indent.hangingPt !== undefined) indent.hangingPt = level.indent.hangingPt;
  return indent;
}

/** Resolves a paragraph's properties against its style chain, numbering and defaults. */
export function resolveParagraph(paragraph: IRParagraph, doc: IRDocument): ResolvedParagraph {
  const direct = paragraph.props;
  const chain = styleChain(doc.styles, direct.styleId ?? 'Normal');
  const styleParaProps: ParaProps = {};
  const styleRunProps: RunProps = {};
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const style = doc.styles.paragraph[chain[index]];
    Object.assign(styleParaProps, definedOnly(style.paraProps));
    Object.assign(styleRunProps, definedOnly(style.runProps));
  }

  const spacing = direct.spacing ?? styleParaProps.spacing ?? DEFAULT_SPACING;
  const indent =
    direct.indent ?? numberingLevelIndent(doc, direct.numbering) ?? styleParaProps.indent ?? null;

  return {
    beforePt: spacing.beforePt,
    afterPt: spacing.afterPt,
    spacing: { line: spacing.line, lineRule: spacing.lineRule },
    keepNext: direct.keepNext ?? styleParaProps.keepNext ?? false,
    keepLines: direct.keepLines ?? styleParaProps.keepLines ?? false,
    pageBreakBefore: direct.pageBreakBefore ?? styleParaProps.pageBreakBefore ?? false,
    widowControl: (direct.widowControl ?? styleParaProps.widowControl ?? true) !== false,
    leftPt: indent?.leftPt ?? 0,
    firstLinePt: indent?.firstLinePt ?? 0,
    hangingPt: indent?.hangingPt ?? 0,
    base: {
      font: styleRunProps.font ?? DEFAULT_FONT,
      sizePt: styleRunProps.sizePt ?? DEFAULT_SIZE_PT,
      bold: styleRunProps.bold === true,
      italic: styleRunProps.italic === true,
    },
  };
}

/** Effective formatting of a run: style, character style, then direct run props. */
export function runStyleOf(props: RunProps | undefined, base: RunStyle, doc: IRDocument): RunStyle {
  const character = props?.styleId ? doc.styles.character[props.styleId]?.runProps : undefined;
  const merged = { ...definedOnly(character), ...definedOnly(props) };
  return {
    font: merged.font ?? base.font,
    sizePt: merged.sizePt ?? base.sizePt,
    bold: merged.bold ?? base.bold,
    italic: merged.italic ?? base.italic,
  };
}

/** Text shown for a field inside a measured paragraph (value is resolved after layout). */
export function fieldPlaceholder(field: { cachedText?: string; fallback?: string | null }): string {
  if (field.cachedText) return field.cachedText;
  if (field.fallback) return field.fallback;
  return '00';
}

/** A measurable unit of text on a line: a word with the spaces that follow it. */
interface Token {
  word: string;
  width: number;
  trailing: string;
  trailingWidth: number;
  sizePt: number;
  font: string;
  imageHeightPt: number;
  /** Forced line break (newline or line break run). */
  force: boolean;
  /** Atom that cannot be joined with a following word (image, field, icon). */
  atom: boolean;
}

function forceToken(): Token {
  return { word: '', width: 0, trailing: '', trailingWidth: 0, sizePt: 0, font: DEFAULT_FONT, imageHeightPt: 0, force: true, atom: true };
}

/** Breaks the text of a paragraph into tokens, measuring each one. */
function tokenize(paragraph: IRParagraph, resolved: ResolvedParagraph, doc: IRDocument, measurer: Measurer): Token[] {
  const tokens: Token[] = [];

  const pushText = (text: string, style: RunStyle, joinable: boolean) => {
    const measure = (value: string) =>
      measurer.measureText(value, { font: style.font, bold: style.bold, italic: style.italic }, style.sizePt);
    const pieces = text.split('\n');
    pieces.forEach((piece, pieceIndex) => {
      if (pieceIndex > 0) tokens.push(forceToken());
      const parts = piece.split(/(\s+)/);
      parts.forEach((part, partIndex) => {
        if (part === '') return;
        const isSpace = /^\s+$/.test(part);
        const previous = tokens[tokens.length - 1];
        if (isSpace) {
          if (previous && !previous.force) {
            previous.trailing += part;
            previous.trailingWidth += measure(part);
          } else {
            tokens.push({ word: '', width: 0, trailing: part, trailingWidth: measure(part), sizePt: style.sizePt, font: style.font, imageHeightPt: 0, force: false, atom: false });
          }
          return;
        }
        if (
          partIndex === 0 &&
          joinable &&
          previous &&
          !previous.force &&
          !previous.atom &&
          previous.trailing === ''
        ) {
          previous.word += part;
          previous.width += measure(part);
          previous.sizePt = Math.max(previous.sizePt, style.sizePt);
          return;
        }
        tokens.push({ word: part, width: measure(part), trailing: '', trailingWidth: 0, sizePt: style.sizePt, font: style.font, imageHeightPt: 0, force: false, atom: false });
      });
    });
  };

  const pushAtom = (text: string, width: number, style: RunStyle, imageHeightPt = 0) => {
    tokens.push({ word: text, width, trailing: '', trailingWidth: 0, sizePt: style.sizePt, font: style.font, imageHeightPt, force: false, atom: true });
  };

  let previousWasText = false;
  for (const item of paragraph.runs as IRInline[]) {
    if (item.type === 'run') {
      const style = runStyleOf(item.props, resolved.base, doc);
      pushText(item.text, style, previousWasText);
      previousWasText = item.text.length > 0 && !/\s$/.test(item.text) && !item.text.includes('\n');
    } else {
      previousWasText = false;
      if (item.type === 'break') {
        if (item.kind === 'line') tokens.push(forceToken());
      } else if (item.type === 'field') {
        const style = resolved.base;
        const text = fieldPlaceholder(item);
        pushAtom(text, measurer.measureText(text, { font: style.font, bold: style.bold, italic: style.italic }, style.sizePt), style);
      } else if (item.type === 'image') {
        const width = item.widthPt ?? 24;
        pushAtom('', width, resolved.base, item.heightPt ?? 16);
      } else if (item.type === 'footnoteRef') {
        const style = resolved.base;
        pushAtom('1', measurer.measureText('1', { font: style.font }, style.sizePt * 0.7), { ...style, sizePt: style.sizePt * 0.7 });
      } else if (item.type === 'icon') {
        const size = item.size ?? resolved.base.sizePt;
        const style = { ...resolved.base, sizePt: size };
        pushAtom(item.symbol, measurer.measureText(item.symbol, { font: style.font }, size), style);
      }
    }
  }
  return tokens;
}

/**
 * Breaks a paragraph into lines that fit `widthPt`, honouring the first-line offset.
 * Words are broken greedily at spaces. A word wider than the line is broken by character.
 *
 * @param widthPt Content width of the paragraph (already reduced by the cell or page margins).
 */
export function measureParagraph(
  paragraph: IRParagraph,
  doc: IRDocument,
  measurer: Measurer,
  widthPt: number
): ParagraphMeasure {
  const resolved = resolveParagraph(paragraph, doc);
  const tokens = tokenize(paragraph, resolved, doc, measurer);

  const firstAvail = Math.max(widthPt - resolved.leftPt - resolved.firstLinePt + resolved.hangingPt, 1);
  const restAvail = Math.max(widthPt - resolved.leftPt, 1);

  const lines: LayoutLine[] = [];
  const heights: number[] = [];
  let text = '';
  let width = 0;
  let pendingText = '';
  let pendingWidth = 0;
  let hasContent = false;
  let maxSize = 0;
  let maxImage = 0;
  let font = resolved.base.font;

  const available = () => (lines.length === 0 ? firstAvail : restAvail);

  const flush = () => {
    const size = maxSize || resolved.base.sizePt;
    lines.push({ text, widthPt: width });
    heights.push(Math.max(lineHeightFor(size, resolved.spacing, font), maxImage));
    text = '';
    width = 0;
    pendingText = '';
    pendingWidth = 0;
    hasContent = false;
    maxSize = 0;
    maxImage = 0;
    font = resolved.base.font;
  };

  const append = (value: string, valueWidth: number, token: Token) => {
    if (hasContent) {
      text += pendingText;
      width += pendingWidth;
    }
    text += value;
    width += valueWidth;
    hasContent = true;
    pendingText = token.trailing;
    pendingWidth = token.trailingWidth;
    maxSize = Math.max(maxSize, token.sizePt);
    maxImage = Math.max(maxImage, token.imageHeightPt);
    font = token.font;
  };

  for (const token of tokens) {
    if (token.force) {
      flush();
      continue;
    }
    const joinWidth = hasContent ? pendingWidth + token.width : token.width;
    if (hasContent && width + joinWidth > available()) {
      flush();
    }
    if (width + (hasContent ? pendingWidth : 0) + token.width <= available() || token.atom) {
      append(token.word, token.width, token);
      continue;
    }
    // A word wider than the whole line: break it by character.
    const chars = Array.from(token.word);
    const charWidth = token.word.length > 0 ? token.width / token.word.length : 0;
    chars.forEach((char, index) => {
      const cw = charWidth;
      if (hasContent && width + (hasContent ? pendingWidth : 0) + cw > available()) flush();
      const isLast = index === chars.length - 1;
      append(char, cw, isLast ? token : { ...token, trailing: '', trailingWidth: 0 });
    });
  }
  if (hasContent || lines.length === 0) flush();

  const linesHeightPt = heights.reduce((sum, value) => sum + value, 0);
  return {
    lines,
    heights,
    beforePt: resolved.beforePt,
    afterPt: resolved.afterPt,
    keepNext: resolved.keepNext,
    keepLines: resolved.keepLines,
    pageBreakBefore: resolved.pageBreakBefore,
    widowControl: resolved.widowControl,
    linesHeightPt,
  };
}

/** Geometry of a section page, derived from its page setup (all in points). */
export interface SectionGeometry {
  widthPt: number;
  heightPt: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  header: number;
  footer: number;
  gutter: number;
  /** Width available for content (page minus left, gutter and right margins). */
  contentWidthPt: number;
}

/** Computes the point geometry of a section page. */
export function sectionGeometry(section: IRSection): SectionGeometry {
  const { size, margins } = section.pageSetup;
  const widthPt = size.widthTwips / 20;
  const heightPt = size.heightTwips / 20;
  const top = margins.top / 20;
  const right = margins.right / 20;
  const bottom = margins.bottom / 20;
  const left = margins.left / 20;
  const header = margins.header / 20;
  const footer = margins.footer / 20;
  const gutter = (margins.gutter ?? 0) / 20;
  return {
    widthPt,
    heightPt,
    top,
    right,
    bottom,
    left,
    header,
    footer,
    gutter,
    contentWidthPt: Math.max(widthPt - left - gutter - right, 1),
  };
}
