/**
 * BeakBlock Core Types.
 *
 * Re-exports types from various modules for convenience.
 * All types are PUBLIC - this is a core principle of BeakBlock.
 *
 * @module
 */

// Block types - re-export from blocks module
export type {
  TextStyles,
  StyledText,
  LinkContent,
  IconContent,
  HardBreakContent,
  InlineContent,
  Block,
  PartialBlock,
  BlockIdentifier,
  BlockPlacement,
} from '../blocks/types';

// Editor event types - re-export from editor module
export type { EditorEvents, EventHandler } from '../editor/EditorConfig';

// ===========================================================================
// SCHEMA TYPES
// These remain here as they're not yet extracted to their own modules
// ===========================================================================

/**
 * Property type specification.
 */
export type PropType = 'string' | 'number' | 'boolean' | 'enum' | 'object' | 'array';

/**
 * Property specification for block props.
 */
export interface PropSpec<T = unknown> {
  type: PropType;
  default: T;
  values?: T[];
  validate?: (value: T) => boolean;
}

/**
 * Content type for blocks.
 */
export type ContentType = 'inline' | 'block' | 'block+' | 'block*' | 'none';

/**
 * Block specification - defines a block type.
 *
 * Used when extending the editor with custom block types.
 */
export interface BlockSpec<
  TType extends string = string,
  TProps extends Record<string, PropSpec> = Record<string, PropSpec>
> {
  type: TType;
  propSchema: TProps;
  content: ContentType;
  canBeNested?: boolean;
  isContainer?: boolean;
  parseHTML?: () => Array<{
    tag?: string;
    getAttrs?: (node: HTMLElement) => Record<string, unknown> | false;
  }>;
  renderHTML?: (block: import('../blocks/types').Block<TType>) => {
    tag: string;
    attrs?: Record<string, string>;
  };
}

/**
 * Mark specification - defines an inline formatting mark.
 *
 * Used when extending the editor with custom marks.
 */
export interface MarkSpec<TType extends string = string> {
  type: TType;
  parseHTML?: () => Array<{
    tag?: string;
    style?: string;
    getAttrs?: (node: HTMLElement | string) => Record<string, unknown> | false;
  }>;
  renderHTML?: (attrs: Record<string, unknown>) => {
    tag: string;
    attrs?: Record<string, string>;
  };
  shortcut?: string;
}

// ===========================================================================
// EXTENSION TYPES
// ===========================================================================

/**
 * Command function type.
 */
export type CommandFn = () => boolean;

/**
 * Extension interface - defines how to extend the editor.
 *
 * Extensions can add blocks, marks, plugins, and commands.
 *
 * @example
 * ```typescript
 * const myExtension: Extension = {
 *   name: 'my-extension',
 *   blocks: [myBlockSpec],
 *   marks: [myMarkSpec],
 *   shortcuts: {
 *     'Mod-Shift-x': () => doSomething(),
 *   },
 * };
 * ```
 */
export interface Extension<TConfig = unknown, TStorage = unknown> {
  name: string;
  config?: TConfig;
  priority?: number;
  dependencies?: string[];
  blocks?: BlockSpec[];
  marks?: MarkSpec[];
  shortcuts?: Record<string, CommandFn>;
  storage?: TStorage;
  onCreate?: () => TStorage;
  onDestroy?: () => void;
}
