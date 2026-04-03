/**
 * ProseMirror Public API
 *
 * This module exports the ProseMirrorAPI class and all related types.
 * Everything is PUBLIC - this is a core principle of BeakBlock.
 */

export { ProseMirrorAPI } from './ProseMirrorAPI';
export type {
  WidgetDecorationSpec,
  Coords,
  PosInfo,
  Command,
} from './ProseMirrorAPI';

// Re-export ProseMirror types for convenience
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
} from './ProseMirrorAPI';

export type { NodeView, NodeViewConstructor } from './ProseMirrorAPI';
