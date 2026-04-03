/**
 * @labbs/beakblock-core
 *
 * A fully open-source, framework-agnostic rich text editor built on ProseMirror.
 * All APIs are PUBLIC - this is a core principle of BeakBlock.
 *
 * @example
 * ```typescript
 * import { BeakBlockEditor } from '@labbs/beakblock-core';
 *
 * const editor = new BeakBlockEditor({
 *   element: document.getElementById('editor'),
 *   initialContent: [
 *     { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Hello', styles: {} }] },
 *     { type: 'paragraph', content: [{ type: 'text', text: 'World', styles: {} }] },
 *   ],
 * });
 *
 * // Access ProseMirror directly - no private API hacking!
 * editor.pm.view        // EditorView
 * editor.pm.state       // EditorState
 * editor.pm.dispatch(tr) // Dispatch transaction
 * ```
 *
 * @packageDocumentation
 */

// ===========================================================================
// EDITOR
// ===========================================================================

export { BeakBlockEditor, defaultConfig } from './editor';
export type { EditorConfig, EditorEvents, EventHandler, CollaborationConfig } from './editor';

// ===========================================================================
// PROSEMIRROR API - THE KEY DIFFERENTIATOR
// ===========================================================================

export { ProseMirrorAPI } from './pm';
export type { WidgetDecorationSpec, Coords, PosInfo, Command, NodeView, NodeViewConstructor } from './pm';

// Re-export ProseMirror classes for convenience
export {
  EditorView,
  EditorState,
  Transaction,
  Selection,
  TextSelection,
  NodeSelection,
  AllSelection,
  Plugin,
  PluginKey,
  Decoration,
  DecorationSet,
  Node,
  Schema,
  Mark,
  MarkType,
  NodeType,
  ResolvedPos,
  Slice,
  Fragment,
} from './pm';

// ===========================================================================
// SCHEMA
// ===========================================================================

export { createSchema, DEFAULT_NODES, DEFAULT_MARKS } from './schema';

// Node specs
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
  parseEmbedUrl,
} from './schema';
export type { CalloutType, ImageAlignment, EmbedProvider } from './schema';

// Mark specs
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
} from './schema';

// ===========================================================================
// BLOCKS
// ===========================================================================

export { blockToNode, nodeToBlock, blocksToDoc, docToBlocks } from './blocks';
export type {
  Block,
  PartialBlock,
  BlockIdentifier,
  BlockPlacement,
  TextStyles,
  StyledText,
  LinkContent,
  IconContent,
  InlineContent,
} from './blocks';

// ===========================================================================
// COMMANDS
// ===========================================================================

export {
  addRowAfter,
  addRowBefore,
  deleteRow,
  addColumnAfter,
  addColumnBefore,
  deleteColumn,
  deleteTable,
  goToNextCell,
  goToPreviousCell,
  isInTable,
  getTableInfo,
  findTableContext,
  addRowAtIndex,
  addColumnAtIndex,
  deleteRowAtIndex,
  deleteColumnAtIndex,
} from './commands';
export type { TableContext } from './commands';

// ===========================================================================
// PLUGINS
// ===========================================================================

export { createPlugins, createBlockIdPlugin, BLOCK_ID_PLUGIN_KEY } from './plugins';
export type { CreatePluginsOptions } from './plugins';

// Input rules
export {
  createInputRulesPlugin,
  headingRule,
  bulletListRule,
  orderedListRule,
  blockquoteRule,
  codeBlockRule,
  dividerRule,
  boldRule,
  italicRule,
  inlineCodeRule,
  strikethroughRule,
} from './plugins';
export type { InputRulesConfig } from './plugins';

// Drag & drop
export {
  createDragDropPlugin,
  DRAG_DROP_PLUGIN_KEY,
  getBlockPosFromHandle,
  moveBlock,
} from './plugins';
export type { DragDropConfig, DragDropState } from './plugins';

// Slash menu
export {
  createSlashMenuPlugin,
  SLASH_MENU_PLUGIN_KEY,
  closeSlashMenu,
  executeSlashCommand,
  getDefaultSlashMenuItems,
  filterSlashMenuItems,
} from './plugins';
export type { SlashMenuConfig, SlashMenuState, SlashMenuItem } from './plugins';

// Bubble menu
export {
  createBubbleMenuPlugin,
  BUBBLE_MENU_PLUGIN_KEY,
  hideBubbleMenu,
  isMarkActive,
} from './plugins';
export type { BubbleMenuConfig, BubbleMenuState, BlockTypeInfo, TextAlign } from './plugins';

// Table plugin
export { createTablePlugin, TABLE_PLUGIN_KEY } from './plugins';
export type { TablePluginConfig } from './plugins';

// Keyboard shortcuts
export { createKeyboardShortcutsPlugin, DEFAULT_KEYBOARD_SHORTCUTS } from './plugins';
export type { KeyboardShortcutsConfig, KeyboardShortcut } from './plugins';

// Checklist plugin
export { createChecklistPlugin } from './plugins';
export type { ChecklistPluginConfig } from './plugins';

// List enter handling
export { createListEnterPlugin } from './plugins';

// Link click handling
export { createLinkClickPlugin } from './plugins';

// Media menu plugin
export {
  createMediaMenuPlugin,
  MEDIA_MENU_PLUGIN_KEY,
  hideMediaMenu,
  updateMediaAttrs,
  deleteMediaNode,
} from './plugins';
export type {
  MediaMenuState,
  MediaType,
  ImageAttrs,
  EmbedAttrs,
} from './plugins';

// History (undo/redo)
export { undo, redo } from './plugins';

// ===========================================================================
// TYPES (additional schema/extension types)
// ===========================================================================

export type {
  BlockSpec,
  MarkSpec,
  PropSpec,
  PropType,
  ContentType,
  Extension,
  CommandFn,
} from './types';

// ===========================================================================
// STYLES
// ===========================================================================

export { injectStyles, removeStyles, areStylesInjected } from './styles/injectStyles';
