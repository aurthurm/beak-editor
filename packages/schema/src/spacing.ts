/**
 * Line spacing normalisation.
 *
 * Canonical units for `spacing.line`:
 * - `lineRule: 'auto'` is OOXML 240ths of a line (240 = single, 276 = 1.15, 360 = 1.5).
 * - `lineRule: 'exact' | 'atLeast'` is twips.
 *
 * Earlier releases stored `auto` spacing as a multiplier (1.15). Values at or
 * below {@link LEGACY_LINE_MULTIPLIER_MAX} are read as legacy multipliers and
 * converted, so previously saved documents keep their layout.
 *
 * @module
 */

import type { SpacingProps, StyleSheet } from './types';

/** Single line spacing in OOXML 240ths. */
export const SINGLE_LINE_240THS = 240;

/** Largest `auto` value still read as a legacy multiplier. */
export const LEGACY_LINE_MULTIPLIER_MAX = 10;

/**
 * Returns spacing with `auto` line values expressed in 240ths.
 *
 * Legacy multipliers (`auto` with `line` in (0, 10]) are converted; everything
 * else is returned unchanged. The input is never mutated.
 *
 * @example
 * ```typescript
 * normalizeLineSpacing({ beforePt: 0, afterPt: 8, line: 1.15, lineRule: 'auto' }).line; // 276
 * ```
 */
export function normalizeLineSpacing<T extends Partial<SpacingProps>>(spacing: T): T;
export function normalizeLineSpacing<T extends Partial<SpacingProps>>(spacing: T | null | undefined): T | null | undefined;
export function normalizeLineSpacing<T extends Partial<SpacingProps>>(spacing: T | null | undefined): T | null | undefined {
  if (!spacing || typeof spacing !== 'object') return spacing;
  if (spacing.lineRule !== 'auto' || typeof spacing.line !== 'number') return spacing;
  if (!(spacing.line > 0 && spacing.line <= LEGACY_LINE_MULTIPLIER_MAX)) return spacing;
  return { ...spacing, line: Math.round(spacing.line * SINGLE_LINE_240THS) };
}

/** Recursively applies {@link normalizeLineSpacing} to `spacing` props of blocks (in place on a copy). */
export function normalizeBlockSpacing<T>(blocks: T[]): T[] {
  return blocks.map((block) => normalizeBlockNode(block) as T);
}

function normalizeBlockNode(block: unknown): unknown {
  if (!block || typeof block !== 'object') return block;
  const node = block as Record<string, unknown>;
  const next: Record<string, unknown> = { ...node };
  if (node.props && typeof node.props === 'object') {
    const props = node.props as Record<string, unknown>;
    if (props.spacing && typeof props.spacing === 'object') {
      next.props = { ...props, spacing: normalizeLineSpacing(props.spacing as Partial<SpacingProps>) };
    }
  }
  if (Array.isArray(node.children)) {
    next.children = node.children.map(normalizeBlockNode);
  }
  return next;
}

/** Returns a style sheet whose paragraph style spacing uses 240ths for `auto` lines. */
export function normalizeStyleSheet(styles: StyleSheet): StyleSheet {
  if (!styles || typeof styles !== 'object' || !styles.paragraph) return styles;
  const paragraph: StyleSheet['paragraph'] = {};
  for (const [id, style] of Object.entries(styles.paragraph)) {
    const spacing = style.paraProps?.spacing;
    paragraph[id] = spacing
      ? { ...style, paraProps: { ...style.paraProps, spacing: normalizeLineSpacing(spacing) } }
      : style;
  }
  return { ...styles, paragraph };
}
