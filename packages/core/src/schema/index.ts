/**
 * Schema module for BeakBlock.
 *
 * Exports node specs, mark specs, and the schema factory.
 *
 * @module
 */

export { createSchema, DEFAULT_NODES, DEFAULT_MARKS } from './createSchema';

// Re-export individual node specs for extension authors
export {
  docNode,
  paragraphNode,
  headingNode,
  textNode,
  blockquoteNode,
  iconNode,
  calloutNode,
  codeBlockNode,
  dividerNode,
  bulletListNode,
  orderedListNode,
  listItemNode,
  columnListNode,
  columnNode,
  tableNode,
  tableRowNode,
  tableCellNode,
  tableHeaderNode,
  imageNode,
  checkListNode,
  checkListItemNode,
  embedNode,
  tableOfContentsNode,
  getEmbedIframeSrc,
  normalizeEmbedAttrsFromUrl,
  parseEmbedUrl,
} from './nodes';
export type {
  TextAlignment,
  CalloutType,
  ImageAlignment,
  EmbedProvider,
  TocHeadingItem,
} from './nodes';

// Re-export individual mark specs for extension authors
export {
  boldMark,
  italicMark,
  underlineMark,
  strikethroughMark,
  codeMark,
  linkMark,
  textColorMark,
  backgroundColorMark,
  fontSizeMark,
} from './marks';
