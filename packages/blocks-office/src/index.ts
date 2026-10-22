/**
 * @amusendame/beakblock-blocks-office
 *
 * Office blocks: footnotes, endnotes, equations, captions, cross-references,
 * text boxes, shapes, and smart content (variables, conditions, repeating
 * sections, computed values, reusable content).
 *
 * Usage: pass `officeBlocksExtension(options)` in the editor's `extensions`.
 *
 * @example
 * ```typescript
 * import { BeakBlockEditor } from '@amusendame/beakblock-core';
 * import { officeBlocksExtension, injectOfficeBlocksStyles } from '@amusendame/beakblock-blocks-office';
 *
 * injectOfficeBlocksStyles();
 * const editor = new BeakBlockEditor({
 *   element,
 *   mode: 'office',
 *   extensions: [officeBlocksExtension({ variables: { procedureType: 'micro' } })],
 * });
 * ```
 *
 * @module
 */

export { officeBlocksExtension, officeSlashItems, refreshOfficeBlocks } from './extension';
export { createOfficeBlockDefinitions, validateOfficeContent, validateRepeatingSection } from './definitions';
export { createOfficeNodeSpecs } from './nodes';
export { createOfficeBlocksPlugin, OFFICE_BLOCKS_PLUGIN_KEY, OFFICE_REFRESH_META, buildOfficeDecorations, resolveDocument } from './plugin';
export {
  collectNotes,
  computeCaptionNumbers,
  isConditionVisible,
  blockPlainText,
  inlinePlainText,
  formatComputedValue,
  defaultCrossReferenceText,
  resolveCrossReferenceText,
  resolveOfficeItems,
  collectItemsFromBlocks,
  collectItemsFromDoc,
  readVariable,
} from './model';
export type { OfficeItem, OfficeItemKind, OfficeResolution, ResolvedOfficeItem } from './model';
export {
  ExpressionError,
  evaluateExpression,
  parseExpression,
  tryEvaluateExpression,
  validateExpression,
  MAX_EXPRESSION_LENGTH,
} from './expression';
export type { ExpressionNode } from './expression';
export { escapeHtml, defaultMathRenderer, shapeSvgMarkup } from './render';
export { OfficeAtomNodeView, EquationNodeView, ShapeNodeView, ReusableContentNodeView } from './nodeViews';
export { officeBlocksCSS, injectOfficeBlocksStyles, OFFICE_BLOCKS_STYLE_ID } from './styles';
export {
  CAPTION_LABELS,
  CROSS_REFERENCE_DISPLAYS,
  SHAPE_KINDS,
  TEXT_BOX_FLOATS,
  COMPUTED_FORMATS,
  OFFICE_NODE_NAMES,
} from './types';
export type {
  CaptionLabel,
  CaptionNumber,
  ComputedFormat,
  ComputedValueContent,
  CrossReferenceContent,
  CrossReferenceDisplay,
  CrossReferenceResolver,
  CrossReferenceTarget,
  EndnoteContent,
  FootnoteContent,
  InlineEquationContent,
  MathRenderer,
  OfficeBlocksOptions,
  OfficeInlineContent,
  OfficeNote,
  OfficeNodeName,
  OfficeVariables,
  ReusableContentResolver,
  ShapeKind,
  TextBoxFloat,
  VariableContent,
} from './types';
