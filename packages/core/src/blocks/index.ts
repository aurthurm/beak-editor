/**
 * Blocks module for BeakBlock.
 *
 * Handles block types and conversion between JSON blocks and ProseMirror nodes.
 *
 * @module
 */

// Types
export type {
  TextStyles,
  StyledText,
  LinkContent,
  IconContent,
  HardBreakContent,
  FieldContent,
  RevisionStyle,
  InlineContent,
  BuiltinInlineContent,
  CustomInlineContent,
  CustomInlineContentRegistry,
  UnknownInlineContent,
  Block,
  PartialBlock,
  BlockIdentifier,
  BlockPlacement,
} from './types';

// Conversion functions
export { blockToNode, inlineContentToNodes, stylesToMarks, blocksToDoc, normalizeBlock } from './blockToNode';
export { nodeToBlock, marksToStyles, docToBlocks } from './nodeToBlock';

// Inline type guards
export { isBuiltinInline, isStyledText } from './inlineGuards';
