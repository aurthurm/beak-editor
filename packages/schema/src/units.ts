/**
 * Unit conversion helpers.
 *
 * Internal units are points and twips (ADR-5). Pixels only appear at render time
 * (96px = 72pt, so 1px = 15 twips).
 *
 * @module
 */

/** Twips per point. */
export const TWIPS_PER_PT = 20;

/** Twips per inch. */
export const TWIPS_PER_INCH = 1440;

/** Twips per CSS pixel (96 px per inch). */
export const TWIPS_PER_PX = 15;

/** Converts points to twips (rounded to the nearest twip). */
export function ptToTwips(pt: number): number {
  return Math.round(pt * TWIPS_PER_PT);
}

/** Converts twips to points. */
export function twipsToPt(twips: number): number {
  return twips / TWIPS_PER_PT;
}

/** Converts twips to CSS pixels (render-time only). */
export function twipsToPx(twips: number): number {
  return twips / TWIPS_PER_PX;
}

/** Converts CSS pixels to twips (rounded to the nearest twip). */
export function pxToTwips(px: number): number {
  return Math.round(px * TWIPS_PER_PX);
}

/** Converts millimetres to twips (rounded to the nearest twip). */
export function mmToTwips(mm: number): number {
  return Math.round((mm * TWIPS_PER_INCH) / 25.4);
}
