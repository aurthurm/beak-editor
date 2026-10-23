/**
 * @amusendame/beakblock-core
 *
 * A fully open-source, framework-agnostic rich text editor built on ProseMirror.
 * All APIs are PUBLIC - this is a core principle of BeakBlock.
 *
 * @example
 * ```typescript
 * import { BeakBlockEditor } from '@amusendame/beakblock-core';
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
export type { SetDocumentOptions } from './editor';
export type {
  EditorConfig,
  EditorEvents,
  EventHandler,
  CollaborationConfig,
  CollaborationSyncConfig,
  CollaborationSyncSource,
  CollaborationDocLike,
  CollaborationFragmentLike,
  CollaborationMapLike,
  TrackChangesConfig,
  ComplianceLockPluginOptions,
} from './editor';

// ===========================================================================
// NODE VIEWS
// ===========================================================================

export {
  codeBlockNodeView,
  CodeBlockNodeView,
  embedNodeView,
  EmbedNodeView,
  tableOfContentsNodeView,
  TableOfContentsNodeView,
} from './nodeviews';

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
  getEmbedIframeSrc,
  normalizeEmbedAttrsFromUrl,
  tableOfContentsNode,
  parseEmbedUrl,
} from './schema';
export type { CalloutType, ImageAlignment, EmbedProvider, TocHeadingItem } from './schema';

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

export { blockToNode, nodeToBlock, blocksToDoc, docToBlocks, normalizeBlock } from './blocks';
export type {
  Block,
  PartialBlock,
  BlockIdentifier,
  BlockPlacement,
  TextStyles,
  StyledText,
   LinkContent,
  IconContent,
  HardBreakContent,
  InlineContent,
  BuiltinInlineContent,
  CustomInlineContent,
CustomInlineContentRegistry,
UnknownInlineContent,
} from './blocks';
export { isBuiltinInline, isStyledText } from './blocks';

// ===========================================================================
// MARKDOWN
// ===========================================================================

export {
  markdownToBlocks,
  blocksToMarkdown,
  blocksToHtml,
  blocksToMdastRoot,
  mdastToBlocks,
  looksLikeMarkdown,
} from './markdown';
export type { MarkdownParseOptions, MarkdownSerializeOptions } from './markdown';

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
export {
  mergeCells,
  splitCell,
  setCellBorders,
  setCellShading,
  setCellPadding,
  setCellVerticalAlign,
  setCellHorizontalAlign,
  setTableWidth,
  setColumnWidthTwips,
  distributeColumns,
  toggleHeaderRow,
  toggleRowCantSplit,
  sortTableByColumn,
  setTableStyle,
  getColumnWidthsPx,
} from './commands';
export type { BorderEdge, SortDirection } from './commands';
export type {
  CellBorder,
  CellBorders,
  BorderStyle,
  CellPadding,
  CellVAlign,
  CellHAlign,
  TableLook,
  TableWidthMode,
} from './schema/nodes/tableOffice';

// ===========================================================================
// VERSIONING
// ===========================================================================

export type { DocumentVersion, VersioningAdapter } from './versioning';
export { InMemoryVersioningAdapter } from './versioning';

// ===========================================================================
// PLUGINS
// ===========================================================================

export {
  createPlugins,
  createBlockIdPlugin,
  BLOCK_ID_PLUGIN_KEY,
  createComplianceLockPlugin,
  COMPLIANCE_LOCK_BYPASS_META,
BEAKBLOCK_META_LOAD_DOCUMENT,
  nodeIsComplianceLocked,
  lockedBlockIdOrder,
  buildTableOfContentsRefreshTransaction,
  collectHeadingTocItems,
  createTableOfContentsPlugin,
  refreshAllTableOfContents,
  TABLE_OF_CONTENTS_PLUGIN_KEY,
  createMarkdownPastePlugin,
} from './plugins';
export type { CreatePluginsOptions, MarkdownPasteMode } from './plugins';

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
  selectionTouchesComplianceLocked,
} from './plugins';
export type { BubbleMenuConfig, BubbleMenuState, BlockTypeInfo, TextAlign } from './plugins';

// Table plugin
export { createTablePlugin, createTablePlugins, TABLE_PLUGIN_KEY } from './plugins';
export type { TablePluginConfig } from './plugins';

// Keyboard shortcuts
export { createKeyboardShortcutsPlugin, DEFAULT_KEYBOARD_SHORTCUTS } from './plugins';

// Word keyboard behaviour (contracts §1.7)
export { createWordKeymapPlugin, DEFAULT_AUTOCORRECT, WORD_KEYMAP_PLUGIN_KEY } from './plugins/wordKeymapPlugin';
export type { WordKeymapOptions } from './plugins/wordKeymapPlugin';

// Office paste (Word and Excel HTML)
export {
  createOfficePastePlugin,
  normaliseOfficeHtml,
  isOfficeHtml,
  cssLengthToPt,
  OFFICE_PASTE_PLUGIN_KEY,
} from './paste/officePaste';
export type { KeyboardShortcutsConfig, KeyboardShortcut } from './plugins';

// Checklist plugin
export { createChecklistPlugin } from './plugins';
export type { ChecklistPluginConfig } from './plugins';

// List enter handling
export { createListEnterPlugin } from './plugins';

// Link click handling
export { createLinkClickPlugin } from './plugins';

// Comments
export { createCommentPlugin, COMMENT_PLUGIN_KEY, InMemoryCommentStore } from './comments';
export type {
  CommentReaction,
  CommentEntry,
  CommentThread,
  CommentReactionInput,
  CommentStore,
  CommentStoreSnapshot,
  CommentStoreListener,
} from './comments';

// AI
export { buildAIContext, buildAIMessages, applyAIBlockOutput, parseAIBlockOutput, BUBBLE_AI_PRESETS, SLASH_AI_PRESETS, getAIPresets } from './ai';
export type {
  AIContext,
  AIEntryMode,
  AIPreset,
  AISelectionContext,
  AICursorContext,
  AIDocumentContext,
  AISchemaContext,
  AISchemaNodeSummary,
  AIRequest,
  AIBlockOutput,
  AIBlockOutputStrategy,
} from './ai';

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

// Track changes
export {
  createTrackChangesPlugin,
  TRACK_CHANGES_PLUGIN_KEY,
  getTrackChangesState,
  groupContiguousInsertTrackChanges,
  BEAKBLOCK_META_SKIP_TRACK_CHANGES,
  BEAKBLOCK_META_TRACK_CLEAR_LOG,
  BEAKBLOCK_META_TRACK_REMOVE,
} from './plugins';
export type {
  TrackedChangeRecord,
  TrackChangeKind,
  TrackChangesState,
  CreateTrackChangesPluginOptions,
} from './plugins';

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

// ===========================================================================
// OFFICE NODES AND REVISION MARKS (BeakBlock 2.0)
// ===========================================================================

export {
  pageBreakNode,
  sectionBreakNode,
  fieldNode,
  FIELD_TYPES,
  insertionMark,
  deletionMark,
  officeParagraphAttrs,
  OFFICE_PARAGRAPH_ATTR_NAMES,
} from './schema';
export type {
  PageSetup,
  FieldType,
  OfficeParagraphProps,
  ParagraphNumbering,
  ParagraphSpacing,
  ParagraphIndent,
  ParagraphTab,
} from './schema';
export type { FieldContent, RevisionStyle } from './blocks';
export { FieldNodeView, resolveFieldText } from './nodeviews';
export type { FieldResolver } from './nodeviews';

// ===========================================================================
// MODES, EXTENSIONS AND REVIEW VIEW
// ===========================================================================

export { EDITOR_MODES, REVIEW_VIEWS } from './editor';
export type { ReviewView } from './editor';
export { CHROME_DISABLED_MODES } from './extensions';
export type { EditorMode, BeakExtension, BeakExtensionContext } from './extensions';
export { createEditorModePlugin, getEditorMode, isBlockChromeEnabled, EDITOR_MODE_PLUGIN_KEY } from './plugins';

// ===========================================================================
// BLOCK REGISTRY
// ===========================================================================

export { BlockRegistry, createDefaultBlockRegistry } from './registry';
export type {
  BeakBlockDefinition,
  BlockPrintContext,
  BlockCapabilities,
  BlockFamily,
  BlockMigration,
  ValidationContext,
  ValidationIssue,
  ValidationSeverity,
} from './registry';

export { cloneJson } from './utils/cloneJson';
