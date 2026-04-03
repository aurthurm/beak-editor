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
  InlineContent,
  Block,
  PartialBlock,
  BlockIdentifier,
  BlockPlacement,
} from './types';

// Conversion functions
export { blockToNode, inlineContentToNodes, stylesToMarks, blocksToDoc } from './blockToNode';
export { nodeToBlock, marksToStyles, docToBlocks } from './nodeToBlock';
