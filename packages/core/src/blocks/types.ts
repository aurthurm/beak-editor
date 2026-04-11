/**
 * Block type definitions for BeakBlock.
 *
 * Defines the JSON block format used for document serialization.
 *
 * @module
 */

/**
 * Text styles that can be applied to inline content.
 *
 * @example
 * ```typescript
 * const styles: TextStyles = { bold: true, italic: true };
 * ```
 */
export interface TextStyles {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  textColor?: string;
  backgroundColor?: string;
  fontSize?: number;
}

/**
 * Styled text content within a block.
 *
 * The basic unit of text with formatting applied.
 *
 * @example
 * ```typescript
 * const text: StyledText = {
 *   type: 'text',
 *   text: 'Hello world',
 *   styles: { bold: true }
 * };
 * ```
 */
export interface StyledText {
  type: 'text';
  text: string;
  styles: TextStyles;
}

/**
 * Link inline content.
 *
 * A hyperlink containing styled text.
 *
 * @example
 * ```typescript
 * const link: LinkContent = {
 *   type: 'link',
 *   href: 'https://example.com',
 *   content: [{ type: 'text', text: 'Click here', styles: {} }]
 * };
 * ```
 */
export interface LinkContent {
  type: 'link';
  href: string;
  title?: string;
  target?: '_blank' | '_self';
  content: StyledText[];
}

/**
 * Icon inline content.
 *
 * A large inline symbol inserted by the editor's icon picker.
 */
export interface IconContent {
  type: 'icon';
  icon: string;
  symbol: string;
  size?: number;
}

/**
 * Hard line break inside a text block (Shift+Enter).
 */
export interface HardBreakContent {
  type: 'hardBreak';
}

/**
 * Union of all inline content types.
 */
export type InlineContent = StyledText | LinkContent | IconContent | HardBreakContent;

/**
 * A block in the document.
 *
 * Blocks are the fundamental unit of content in BeakBlock.
 * Each block has a unique ID, type, properties, and optional content/children.
 *
 * @example
 * ```typescript
 * const paragraph: Block = {
 *   id: 'abc123',
 *   type: 'paragraph',
 *   props: {},
 *   content: [{ type: 'text', text: 'Hello', styles: {} }]
 * };
 *
 * const heading: Block<'heading', { level: number }> = {
 *   id: 'xyz789',
 *   type: 'heading',
 *   props: { level: 2 },
 *   content: [{ type: 'text', text: 'Title', styles: {} }]
 * };
 * ```
 */
export interface Block<
  TType extends string = string,
  TProps extends Record<string, unknown> = Record<string, unknown>
> {
  /** Unique identifier for the block */
  id: string;
  /** Block type (paragraph, heading, etc.) */
  type: TType;
  /** Block-specific properties */
  props: TProps;
  /** Inline content (for blocks with text) */
  content?: InlineContent[];
  /** Child blocks (for container blocks like columns) */
  children?: Block[];
}

/**
 * Partial block for insertion/updates (id is optional).
 *
 * Used when creating new blocks - the ID will be auto-generated if not provided.
 */
export type PartialBlock<
  TType extends string = string,
  TProps extends Record<string, unknown> = Record<string, unknown>
> = Omit<Block<TType, TProps>, 'id'> & { id?: string };

/**
 * Block identifier - can be a block ID string or block object.
 *
 * Used in API methods that accept either format.
 */
export type BlockIdentifier = string | Block;

/**
 * Placement for block insertion.
 */
export type BlockPlacement = 'before' | 'after' | 'nested';
