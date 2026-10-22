/**
 * Shared types and constants for office blocks.
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';

/** Values available to smart content (variables, computed values, conditions). */
export type OfficeVariables = Record<string, unknown>;

/** Caption label kinds, numbered independently in document order. */
export const CAPTION_LABELS = ['Figure', 'Table', 'Equation'] as const;
export type CaptionLabel = (typeof CAPTION_LABELS)[number];

/** What a cross-reference shows. `page` needs a resolver (layout knows pages). */
export const CROSS_REFERENCE_DISPLAYS = ['label', 'number', 'text', 'page'] as const;
export type CrossReferenceDisplay = (typeof CROSS_REFERENCE_DISPLAYS)[number];

/** Shape kinds supported by the `shape` block. */
export const SHAPE_KINDS = ['rect', 'ellipse', 'line', 'arrow'] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

/** Float modes for text boxes. */
export const TEXT_BOX_FLOATS = ['none', 'left', 'right'] as const;
export type TextBoxFloat = (typeof TEXT_BOX_FLOATS)[number];

/** Output formats for computed values. */
export const COMPUTED_FORMATS = ['number', 'currency', 'percent', 'text'] as const;
export type ComputedFormat = (typeof COMPUTED_FORMATS)[number];

/** Node names contributed by this package. */
export const OFFICE_NODE_NAMES = [
  'footnote',
  'endnote',
  'equation',
  'inlineEquation',
  'caption',
  'crossReference',
  'textBox',
  'shape',
  'variable',
  'conditional',
  'repeatingSection',
  'computedValue',
  'reusableContent',
] as const;
export type OfficeNodeName = (typeof OFFICE_NODE_NAMES)[number];

/**
 * Renders LaTeX to HTML. Return `null` or `undefined` to fall back to the
 * LaTeX source. The default uses `globalThis.katex.renderToString` when present.
 */
export type MathRenderer = (latex: string, displayMode: boolean) => string | null | undefined;

/** A target that cross-references can point at. */
export interface CrossReferenceTarget {
  id: string;
  kind: 'caption' | 'heading';
  blockType: string;
  /** Caption label (captions only). */
  label?: string;
  /** Caption sequence number (captions only). */
  number?: number;
  /** Caption: `Label N: text`. Heading: heading text. */
  text: string;
}

/**
 * Overrides or supplies cross-reference text. Return `null` or `undefined`
 * to use the built-in resolution. Use this for `page` references.
 */
export type CrossReferenceResolver = (
  targetId: string,
  display: CrossReferenceDisplay,
  target: CrossReferenceTarget | undefined
) => string | null | undefined;

/**
 * Returns the blocks for reusable content. `revision: null` means the
 * reference is unpinned (floating). Return `null` when not found.
 */
export type ReusableContentResolver = (
  contentId: string,
  revision: number | null
) => Block[] | null | undefined;

/** Options for {@link officeBlocksExtension}. */
export interface OfficeBlocksOptions {
  /** Variable values, or a function returning them (read on every render). */
  variables?: OfficeVariables | (() => OfficeVariables);
  /** Resolves reusable content for previews and print. */
  resolveReusableContent?: ReusableContentResolver;
  /** Renders LaTeX. Defaults to `globalThis.katex` when available. */
  renderMath?: MathRenderer;
  /** Overrides cross-reference text (required for `page`). */
  crossReferenceResolver?: CrossReferenceResolver;
  /**
   * Injects the office stylesheet (footnote marks, captions, conditional hiding) into the document
   * head once. Default `true`, matching the core editor. Set `false` to supply your own CSS.
   */
  injectStyles?: boolean;
}

/** A footnote or endnote in document order. */
export interface OfficeNote {
  kind: 'footnote' | 'endnote';
  id: string | null;
  /** Sequence number within its kind, starting at 1. */
  number: number;
  text: string;
}

/** Sequence number of a caption. */
export interface CaptionNumber {
  label: string;
  number: number;
}

// ---------------------------------------------------------------------------
// Inline JSON shapes (InlineContent items for these atoms)
// ---------------------------------------------------------------------------

/** Footnote reference (core `{ type, props }` inline form). */
export interface FootnoteContent {
  type: 'footnote';
  props: { id?: string | null; text: string };
}

/** Endnote reference. */
export interface EndnoteContent {
  type: 'endnote';
  props: { id?: string | null; text: string };
}

/** Inline equation. */
export interface InlineEquationContent {
  type: 'inlineEquation';
  props: { id?: string | null; latex: string };
}

/** Cross-reference to a caption or heading. */
export interface CrossReferenceContent {
  type: 'crossReference';
  props: { id?: string | null; targetId: string; display: CrossReferenceDisplay };
}

/** Variable reference. */
export interface VariableContent {
  type: 'variable';
  props: { id?: string | null; name: string; format?: string | null };
}

/** Computed value. */
export interface ComputedValueContent {
  type: 'computedValue';
  props: {
    id?: string | null;
    expression: string;
    format?: ComputedFormat;
    decimals?: number;
    unit?: string | null;
  };
}

/** Any inline atom contributed by this package. */
export type OfficeInlineContent =
  | FootnoteContent
  | EndnoteContent
  | InlineEquationContent
  | CrossReferenceContent
  | VariableContent
  | ComputedValueContent;
