/**
 * Node specifications for the BeakBlock schema.
 *
 * @module
 */

// Core nodes
export { docNode } from './doc';
export { paragraphNode } from './paragraph';
export type { TextAlignment } from './paragraph';
export { headingNode } from './heading';
export { textNode } from './text';
export { hardBreakNode } from './hardBreak';
export { iconNode } from './icon';

// Block nodes
export { blockquoteNode } from './blockquote';
export { calloutNode } from './callout';
export type { CalloutType } from './callout';
export { codeBlockNode } from './codeBlock';
export { dividerNode } from './divider';

// List nodes
export { bulletListNode } from './bulletList';
export { orderedListNode } from './orderedList';
export { listItemNode } from './listItem';

// Column nodes
export { columnListNode } from './columnList';
export { columnNode } from './column';

// Table nodes
export { tableNode } from './table';
export { tableRowNode } from './tableRow';
export { tableCellNode, tableHeaderNode } from './tableCell';

// Media nodes
export { imageNode } from './image';
export type { ImageAlignment } from './image';

// Embed nodes
export { embedNode, getEmbedIframeSrc, normalizeEmbedAttrsFromUrl, parseEmbedUrl } from './embed';
export type { EmbedProvider } from './embed';

// Check list nodes
export { checkListNode, checkListItemNode } from './checkList';

// Unregistered blocks
export { unknownBlockNode } from './unknownBlock';
export { unknownInlineNode } from './unknownInline';
export { UNKNOWN_PROPS_ATTR, withUnknownPropsAttr } from './unknownProps';

// Table of contents
export { tableOfContentsNode } from './tableOfContents';
export type { TocHeadingItem } from './tableOfContents';

// Office nodes
export { pageBreakNode } from './pageBreak';
export { sectionBreakNode } from './sectionBreak';
export type { PageSetup } from './sectionBreak';
export { fieldNode, FIELD_TYPES } from './field';
export type { FieldType } from './field';
export { officeParagraphAttrs, OFFICE_PARAGRAPH_ATTR_NAMES } from './officeParagraph';
export type {
  OfficeParagraphProps,
  ParagraphNumbering,
  ParagraphSpacing,
  ParagraphIndent,
  ParagraphTab,
} from './officeParagraph';
