/**
 * Text measurers.
 *
 * {@link createHeuristicMeasurer} is deterministic and DOM-free. It uses per-character
 * advance widths for the sans (Helvetica/Arial metrics, as in Liberation Sans) and serif
 * (Times metrics, as in Liberation Serif) families, scaled to approximate Carlito
 * (Calibri-compatible, about 0.9 of Arial) and Caladea (Cambria-compatible, about 1.05 of
 * Times). These tables are approximations: the widths are not the exact font program
 * metrics, but they keep line breaks close to Office output for body text. The bundled
 * fonts (ADR-6) are the reference for exact results; use {@link createDomMeasurer} in a
 * browser to measure with the real canvas font.
 *
 * @module
 */

import type { Measurer, MeasureRun, MeasureSpacing } from './types';

/** Twips per point (exact and atLeast line values are twips). */
const TWIPS_PER_PT = 20;
const twipsToPt = (twips: number): number => twips / TWIPS_PER_PT;

/** Advance widths (1/1000 em) for ASCII 32..126, Helvetica (Arial metric-compatible). */
const SANS_WIDTHS: readonly number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** Advance widths (1/1000 em) for ASCII 32..126, Times (Liberation Serif metric-compatible). */
const SERIF_WIDTHS: readonly number[] = [
  250, 333, 408, 500, 500, 833, 778, 180, 333, 333, 500, 564, 250, 333, 250, 278,
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 278, 278, 564, 564, 564, 444,
  921, 722, 667, 667, 722, 611, 556, 722, 722, 333, 389, 722, 611, 889, 722, 722,
  556, 722, 667, 556, 611, 722, 722, 944, 722, 722, 611, 333, 278, 333, 469, 500,
  333, 444, 500, 444, 500, 444, 333, 500, 500, 278, 278, 500, 278, 778, 500, 500,
  500, 500, 333, 389, 278, 500, 500, 722, 500, 500, 444, 480, 200, 480, 541,
];

/** Fallback advance for characters outside ASCII (1/1000 em). */
const DEFAULT_SANS = 556;
const DEFAULT_SERIF = 500;
/** Monospace advance (1/1000 em) for every character. */
const MONO_WIDTH = 600;

/** Bold widens sans and serif glyphs by roughly this factor. */
const BOLD_FACTOR = { sans: 1.04, serif: 1.07 } as const;

type FamilyKind = 'sans' | 'serif' | 'mono';

interface FamilyMetrics {
  kind: FamilyKind;
  /** Scale applied to the base table. */
  scale: number;
  /** Ascent plus descent in em, used for line height. */
  lineFactor: number;
}

const FAMILIES: Readonly<Record<string, FamilyMetrics>> = {
  Carlito: { kind: 'sans', scale: 0.9, lineFactor: 1.22 },
  Calibri: { kind: 'sans', scale: 0.9, lineFactor: 1.22 },
  'Liberation Sans': { kind: 'sans', scale: 1, lineFactor: 1.15 },
  Arial: { kind: 'sans', scale: 1, lineFactor: 1.15 },
  Helvetica: { kind: 'sans', scale: 1, lineFactor: 1.15 },
  Caladea: { kind: 'serif', scale: 1.05, lineFactor: 1.17 },
  Cambria: { kind: 'serif', scale: 1.05, lineFactor: 1.17 },
  'Liberation Serif': { kind: 'serif', scale: 1, lineFactor: 1.15 },
  'Times New Roman': { kind: 'serif', scale: 1, lineFactor: 1.15 },
  Times: { kind: 'serif', scale: 1, lineFactor: 1.15 },
  'Liberation Mono': { kind: 'mono', scale: 1, lineFactor: 1.13 },
  'Courier New': { kind: 'mono', scale: 1, lineFactor: 1.13 },
  Courier: { kind: 'mono', scale: 1, lineFactor: 1.13 },
};

const DEFAULT_FAMILY: FamilyMetrics = { kind: 'sans', scale: 1, lineFactor: 1.2 };

/** Resolves a font name to its metrics. Unknown names use the sans table. */
export function familyMetrics(font: string | undefined): FamilyMetrics {
  if (!font) return FAMILIES.Carlito;
  return FAMILIES[font] ?? DEFAULT_FAMILY;
}

/** Width of one character in 1/1000 em for the given family. */
function glyphWidth(code: number, kind: FamilyKind, bold: boolean): number {
  let width: number;
  if (kind === 'mono') {
    width = MONO_WIDTH;
  } else {
    const table = kind === 'sans' ? SANS_WIDTHS : SERIF_WIDTHS;
    if (code >= 32 && code <= 126) {
      width = table[code - 32];
    } else {
      width = kind === 'sans' ? DEFAULT_SANS : DEFAULT_SERIF;
    }
    if (bold) width *= BOLD_FACTOR[kind];
  }
  return width;
}

/** Shared line height rule for both measurers. */
export function lineHeightFor(
  fontSizePt: number,
  spacing: MeasureSpacing | null | undefined,
  font: string | undefined
): number {
  const factor = familyMetrics(font).lineFactor;
  const natural = fontSizePt * factor;
  if (!spacing) return natural;
  if (spacing.lineRule === 'exact') return twipsToPt(spacing.line);
  if (spacing.lineRule === 'atLeast') return Math.max(twipsToPt(spacing.line), natural);
  return natural * autoMultiplier(spacing.line);
}

/**
 * Multiplier for an `auto` line value. Canonical values are OOXML 240ths (240 = single).
 * Values up to 10 are legacy multipliers (1.15) and are used as-is.
 */
export function autoMultiplier(line: number): number {
  return line <= 10 ? line : line / 240;
}

/**
 * Deterministic, DOM-free measurer. Same input always gives the same output, so layout
 * results are reproducible in Node, in workers, and in server renditions.
 *
 * @example
 * ```typescript
 * const measurer = createHeuristicMeasurer();
 * measurer.measureText('Hello', { font: 'Carlito' }, 11); // about 25pt
 * ```
 */
export function createHeuristicMeasurer(): Measurer {
  return {
    measureText(text: string, run: MeasureRun, sizePt: number): number {
      const metrics = familyMetrics(run.font);
      const bold = run.bold === true;
      let total = 0;
      for (let index = 0; index < text.length; index += 1) {
        total += glyphWidth(text.charCodeAt(index), metrics.kind, bold);
      }
      return (total * metrics.scale * sizePt) / 1000;
    },
    lineHeightPt(fontSizePt: number, spacing?: MeasureSpacing | null, font?: string): number {
      return lineHeightFor(fontSizePt, spacing, font);
    },
  };
}

/** Minimal canvas text measuring context. */
interface CanvasContextLike {
  font: string;
  measureText(text: string): { width: number };
}

/**
 * Measurer that uses the canvas `measureText` of a document when available, and falls
 * back to {@link createHeuristicMeasurer} when there is no canvas (Node, jsdom).
 *
 * Canvas measurements are per-browser and can differ slightly from the heuristic, so
 * use the heuristic when results must match the server rendition exactly.
 *
 * @param doc Document used to create the canvas. Defaults to the global `document`.
 */
export function createDomMeasurer(doc?: Document): Measurer {
  const fallback = createHeuristicMeasurer();
  const owner: Document | undefined =
    doc ?? (typeof document !== 'undefined' ? document : undefined);
  let context: CanvasContextLike | null = null;
  if (owner && typeof owner.createElement === 'function') {
    try {
      const canvas = owner.createElement('canvas');
      const ctx = canvas.getContext ? (canvas.getContext('2d') as CanvasContextLike | null) : null;
      context = ctx && typeof ctx.measureText === 'function' ? ctx : null;
    } catch {
      context = null;
    }
  }
  if (!context) return fallback;
  const canvasContext = context;

  return {
    measureText(text: string, run: MeasureRun, sizePt: number): number {
      const family = run.font ?? 'Carlito';
      const px = (sizePt * 96) / 72;
      canvasContext.font = `${run.italic ? 'italic ' : ''}${run.bold ? 'bold ' : ''}${px}px "${family}", sans-serif`;
      return (canvasContext.measureText(text).width * 72) / 96;
    },
    lineHeightPt(fontSizePt: number, spacing?: MeasureSpacing | null, font?: string): number {
      return lineHeightFor(fontSizePt, spacing, font);
    },
  };
}
