/**
 * ProseMirrorAPI - The Public ProseMirror Interface
 *
 * This is THE KEY DIFFERENTIATOR of BeakBlock.
 * Unlike BlockNote/Tiptap where ProseMirror access is hidden behind private APIs,
 * BeakBlock exposes EVERYTHING publicly and with full TypeScript support.
 *
 * Usage:
 * ```typescript
 * const editor = new BeakBlockEditor(config);
 *
 * // Direct access - no more (editor as any).prosemirrorView!
 * editor.pm.view                          // EditorView
 * editor.pm.state                         // EditorState
 * editor.pm.doc                           // Document
 * editor.pm.setNodeAttrs(pos, { width: 2 })  // Modify node attributes
 * editor.pm.dispatch(tr)                  // Dispatch transaction
 * ```
 *
 * @module pm
 */

import {
  EditorView,
  Decoration,
  DecorationSet,
  DecorationAttrs,
} from 'prosemirror-view';
import type { DecorationSource, NodeView, NodeViewConstructor } from 'prosemirror-view';
import {
  EditorState,
  Transaction,
  Selection,
  TextSelection,
  NodeSelection,
  AllSelection,
  Plugin,
  PluginKey,
} from 'prosemirror-state';
import {
  Node as PMNode,
  Schema,
  Mark,
  MarkType,
  NodeType,
  ResolvedPos,
  Slice,
  Fragment,
} from 'prosemirror-model';
import { toggleMark } from 'prosemirror-commands';

import type { BeakBlockEditor } from '../editor/Editor';

/**
 * Widget decoration specification
 */
export interface WidgetDecorationSpec {
  side?: number;
  marks?: readonly Mark[];
  stopEvent?: (event: Event) => boolean;
  ignoreSelection?: boolean;
  key?: string;
}

/**
 * Coordinates returned by coordsAtPos
 */
export interface Coords {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Position info returned by posAtCoords
 */
export interface PosInfo {
  pos: number;
  inside: number;
}

/**
 * ProseMirror Command type
 */
export type Command = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
  view?: EditorView
) => boolean;

/**
 * ProseMirrorAPI - Public wrapper for all ProseMirror functionality
 *
 * This class provides typed, documented access to ProseMirror's powerful
 * but low-level APIs. Every method and property is PUBLIC by design.
 */
export class ProseMirrorAPI {
  constructor(private editor: BeakBlockEditor) {}

  // ===========================================================================
  // VIEW ACCESS
  // ===========================================================================

  /**
   * The ProseMirror EditorView instance
   *
   * This is the main view that renders the editor and handles user input.
   * Direct access - no private API hacking needed!
   */
  get view(): EditorView {
    return this.editor['_pmView'];
  }

  /**
   * The current EditorState
   *
   * Contains the document, selection, and all plugin states.
   */
  get state(): EditorState {
    return this.view.state;
  }

  /**
   * The ProseMirror Schema
   *
   * Defines the structure of the document (node types, marks, etc.)
   */
  get schema(): Schema {
    return this.state.schema;
  }

  /**
   * The current document
   *
   * The root node containing all content.
   */
  get doc(): PMNode {
    return this.state.doc;
  }

  /**
   * Whether the editor currently has focus
   */
  get hasFocus(): boolean {
    return this.view.hasFocus();
  }

  /**
   * The DOM element containing the editor
   */
  get dom(): HTMLElement {
    return this.view.dom;
  }

  // ===========================================================================
  // TRANSACTIONS
  // ===========================================================================

  /**
   * Create a new transaction
   *
   * Transactions are the way to modify the editor state.
   * ```typescript
   * const tr = editor.pm.createTransaction();
   * tr.insertText('Hello');
   * editor.pm.dispatch(tr);
   * ```
   */
  createTransaction(): Transaction {
    return this.state.tr;
  }

  /**
   * Dispatch a transaction to update the editor state
   *
   * This is the core method for making changes to the document.
   * @param tr - The transaction to apply
   */
  dispatch(tr: Transaction): void {
    this.view.dispatch(tr);
  }

  /**
   * Create and dispatch a transaction in one call
   *
   * Convenient for simple transformations:
   * ```typescript
   * editor.pm.dispatchWith(tr => tr.insertText('Hello'));
   * ```
   */
  dispatchWith(fn: (tr: Transaction) => Transaction): void {
    this.dispatch(fn(this.createTransaction()));
  }

  // ===========================================================================
  // POSITION UTILITIES
  // ===========================================================================

  /**
   * Resolve a position to get detailed information
   *
   * Returns a ResolvedPos with parent, depth, and other context.
   */
  resolve(pos: number): ResolvedPos {
    return this.doc.resolve(pos);
  }

  /**
   * Get screen coordinates for a document position
   *
   * Useful for positioning tooltips, menus, etc.
   */
  coordsAtPos(pos: number, side?: number): Coords {
    return this.view.coordsAtPos(pos, side);
  }

  /**
   * Get document position from screen coordinates
   *
   * The inverse of coordsAtPos. Returns null if outside the editor.
   */
  posAtCoords(coords: { left: number; top: number }): PosInfo | null {
    return this.view.posAtCoords(coords);
  }

  /**
   * Get document position from a DOM node and offset
   *
   * Useful when handling DOM events.
   */
  posAtDOM(node: Node, offset: number, bias?: number): number {
    return this.view.posAtDOM(node, offset, bias);
  }

  /**
   * Get the DOM node at a document position
   *
   * Returns null if no node is found.
   */
  nodeDOM(pos: number): Node | null {
    return this.view.nodeDOM(pos);
  }

  /**
   * Get the DOM element for a node at a position
   *
   * Convenience method that casts to HTMLElement.
   */
  domAtPos(pos: number): { node: Node; offset: number } {
    return this.view.domAtPos(pos);
  }

  // ===========================================================================
  // NODE OPERATIONS
  // ===========================================================================

  /**
   * Get the node at a specific position
   *
   * Returns null if there's no node at that position.
   */
  nodeAt(pos: number): PMNode | null {
    return this.doc.nodeAt(pos);
  }

  /**
   * Get a node type by name
   */
  getNodeType(name: string): NodeType {
    return this.schema.nodes[name];
  }

  /**
   * Get a mark type by name
   */
  getMarkType(name: string): MarkType {
    return this.schema.marks[name];
  }

  /**
   * Set attributes on a node
   *
   * This is one of the key methods that was hard to do in BlockNote!
   * ```typescript
   * // Resize a column
   * editor.pm.setNodeAttrs(columnPos, { ratio: 2 });
   * ```
   */
  setNodeAttrs(pos: number, attrs: Record<string, unknown>): void {
    const node = this.nodeAt(pos);
    if (!node) return;

    const tr = this.createTransaction();
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
    this.dispatch(tr);
  }

  /**
   * Replace a node with another node
   */
  replaceNode(pos: number, newNode: PMNode): void {
    const $pos = this.resolve(pos);
    const oldNode = $pos.nodeAfter;
    if (!oldNode) return;

    const tr = this.createTransaction();
    tr.replaceWith(pos, pos + oldNode.nodeSize, newNode);
    this.dispatch(tr);
  }

  /**
   * Delete a node at a position
   */
  deleteNode(pos: number): void {
    const $pos = this.resolve(pos);
    const node = $pos.nodeAfter;
    if (!node) return;

    const tr = this.createTransaction();
    tr.delete(pos, pos + node.nodeSize);
    this.dispatch(tr);
  }

  /**
   * Create a node from the schema
   */
  createNode(
    type: string | NodeType,
    attrs?: Record<string, unknown>,
    content?: PMNode | PMNode[] | Fragment,
    marks?: readonly Mark[]
  ): PMNode {
    const nodeType = typeof type === 'string' ? this.getNodeType(type) : type;
    return nodeType.create(attrs, content, marks);
  }

  /**
   * Create a text node
   */
  createTextNode(text: string, marks?: readonly Mark[]): PMNode {
    return this.schema.text(text, marks);
  }

  // ===========================================================================
  // SELECTION
  // ===========================================================================

  /**
   * The current selection
   */
  get selection(): Selection {
    return this.state.selection;
  }

  /**
   * Set the selection
   */
  setSelection(selection: Selection): void {
    const tr = this.createTransaction();
    tr.setSelection(selection);
    this.dispatch(tr);
  }

  /**
   * Create a text selection
   */
  createTextSelection(anchor: number, head?: number): TextSelection {
    return TextSelection.create(this.doc, anchor, head ?? anchor);
  }

  /**
   * Create a node selection
   */
  createNodeSelection(pos: number): NodeSelection {
    return NodeSelection.create(this.doc, pos);
  }

  /**
   * Create an all selection (selects entire document)
   */
  createAllSelection(): AllSelection {
    return new AllSelection(this.doc);
  }

  /**
   * Get the selected text as a string
   */
  getSelectedText(): string {
    const { from, to } = this.selection;
    return this.doc.textBetween(from, to);
  }

  /**
   * Check if there's an active text selection (not just a cursor)
   */
  hasSelection(): boolean {
    return !this.selection.empty;
  }

  // ===========================================================================
  // MARKS (Inline Formatting)
  // ===========================================================================

  /**
   * Get the active marks at the current selection
   */
  activeMarks(): readonly Mark[] {
    return this.state.storedMarks || this.selection.$from.marks();
  }

  /**
   * Check if a mark is active
   */
  isMarkActive(markType: string | MarkType): boolean {
    const type = typeof markType === 'string' ? this.getMarkType(markType) : markType;
    const { from, to, empty } = this.selection;

    if (empty) {
      return !!type.isInSet(this.activeMarks());
    }

    return this.doc.rangeHasMark(from, to, type);
  }

  /**
   * Toggle a mark on the current selection
   */
  toggleMark(markType: string | MarkType, attrs?: Record<string, unknown>): boolean {
    const type = typeof markType === 'string' ? this.getMarkType(markType) : markType;
    return toggleMark(type, attrs)(this.state, this.dispatch.bind(this));
  }

  /**
   * Add a mark to the current selection
   */
  addMark(markType: string | MarkType, attrs?: Record<string, unknown>): void {
    const type = typeof markType === 'string' ? this.getMarkType(markType) : markType;
    const { from, to } = this.selection;

    if (from === to) return;

    const tr = this.createTransaction();
    tr.addMark(from, to, type.create(attrs));
    this.dispatch(tr);
  }

  /**
   * Remove a mark from the current selection
   */
  removeMark(markType: string | MarkType): void {
    const type = typeof markType === 'string' ? this.getMarkType(markType) : markType;
    const { from, to } = this.selection;

    if (from === to) return;

    const tr = this.createTransaction();
    tr.removeMark(from, to, type);
    this.dispatch(tr);
  }

  // ===========================================================================
  // PLUGINS
  // ===========================================================================

  /**
   * Get the state of a plugin
   */
  getPluginState<T>(key: PluginKey<T>): T | undefined {
    return key.getState(this.state);
  }

  /**
   * Add a plugin dynamically
   *
   * This is another key feature that's hard in BlockNote!
   */
  addPlugin(plugin: Plugin): void {
    const plugins = [...this.state.plugins, plugin];
    const newState = this.state.reconfigure({ plugins });
    this.view.updateState(newState);
  }

  /**
   * Remove a plugin
   */
  removePlugin(pluginKey: PluginKey): void {
    const plugins = this.state.plugins.filter((p) => p.spec.key !== pluginKey);
    const newState = this.state.reconfigure({ plugins });
    this.view.updateState(newState);
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): readonly Plugin[] {
    return this.state.plugins;
  }

  // ===========================================================================
  // DECORATIONS
  // ===========================================================================

  /**
   * Decoration creation utilities
   *
   * Decorations are used to add visual elements that don't affect the document.
   * This is how resize handles, cursors, and other UI elements are implemented.
   */
  decorations = {
    /**
     * Create a widget decoration (inserts a DOM element at a position)
     */
    widget: (
      pos: number,
      toDOM: (view: EditorView, getPos: () => number | undefined) => Node,
      spec?: WidgetDecorationSpec
    ): Decoration => {
      return Decoration.widget(pos, toDOM, spec);
    },

    /**
     * Create an inline decoration (adds attributes to text)
     */
    inline: (from: number, to: number, attrs: DecorationAttrs): Decoration => {
      return Decoration.inline(from, to, attrs);
    },

    /**
     * Create a node decoration (adds attributes to a node)
     */
    node: (from: number, to: number, attrs: DecorationAttrs): Decoration => {
      return Decoration.node(from, to, attrs);
    },

    /**
     * Create a decoration set from decorations
     */
    set: (doc: PMNode, decorations: Decoration[]): DecorationSet => {
      return DecorationSet.create(doc, decorations);
    },

    /**
     * Create an empty decoration set
     */
    empty: DecorationSet.empty,
  };

  // ===========================================================================
  // COMMANDS
  // ===========================================================================

  /**
   * Run a ProseMirror command
   *
   * Commands are functions that can modify the editor state.
   */
  runCommand(command: Command): boolean {
    return command(this.state, this.dispatch.bind(this), this.view);
  }

  // ===========================================================================
  // SLICES AND FRAGMENTS
  // ===========================================================================

  /**
   * Create a slice from nodes
   */
  createSlice(content: PMNode | PMNode[] | Fragment, openStart = 0, openEnd = 0): Slice {
    const fragment = Array.isArray(content)
      ? Fragment.from(content)
      : content instanceof Fragment
        ? content
        : Fragment.from(content);
    return new Slice(fragment, openStart, openEnd);
  }

  /**
   * Create a fragment from nodes
   */
  createFragment(nodes: PMNode | PMNode[]): Fragment {
    return Fragment.from(nodes);
  }

  // ===========================================================================
  // CONTENT INSERTION
  // ===========================================================================

  /**
   * Insert text at the current cursor position
   */
  insertText(text: string): void {
    const tr = this.createTransaction();
    tr.insertText(text);
    this.dispatch(tr);
  }

  /**
   * Insert a native emoji at the current cursor position.
   *
   * This is a thin alias around text insertion, but it makes the intent
   * explicit for callers that are offering emoji selection UI.
   */
  insertEmoji(emoji: string): void {
    this.insertText(emoji);
  }

  /**
   * Insert an inline icon at the current cursor position.
   *
   * Icons are represented as a dedicated inline node so they can round-trip
   * through document JSON and stay visually larger than normal text.
   */
  insertIcon(icon: string, symbol: string, size = 36): void {
    const iconType = this.state.schema.nodes.icon;
    if (!iconType) {
      this.insertText(symbol);
      return;
    }

    const tr = this.createTransaction();
    tr.replaceSelectionWith(iconType.create({ icon, symbol, size }), false);
    this.dispatch(tr);
  }

  /**
   * Insert a node at the current cursor position
   */
  insertNode(node: PMNode): void {
    const tr = this.createTransaction();
    tr.replaceSelectionWith(node);
    this.dispatch(tr);
  }

  /**
   * Replace the selection with content
   */
  replaceSelection(content: PMNode | PMNode[] | Fragment | Slice): void {
    const tr = this.createTransaction();

    if (content instanceof Slice) {
      tr.replaceSelection(content);
    } else if (content instanceof Fragment) {
      tr.replaceSelection(new Slice(content, 0, 0));
    } else if (Array.isArray(content)) {
      tr.replaceSelection(new Slice(Fragment.from(content), 0, 0));
    } else {
      tr.replaceSelectionWith(content);
    }

    this.dispatch(tr);
  }

  // ===========================================================================
  // DOCUMENT TRAVERSAL
  // ===========================================================================

  /**
   * Iterate over all nodes in the document
   *
   * Callback receives node, position, parent, and index.
   */
  forEach(
    callback: (node: PMNode, pos: number, parent: PMNode | null, index: number) => boolean | void
  ): void {
    this.doc.descendants((node, pos, parent, index) => {
      return callback(node, pos, parent, index);
    });
  }

  /**
   * Find nodes matching a predicate
   */
  findNodes(
    predicate: (node: PMNode) => boolean
  ): Array<{ node: PMNode; pos: number }> {
    const result: Array<{ node: PMNode; pos: number }> = [];

    this.forEach((node, pos) => {
      if (predicate(node)) {
        result.push({ node, pos });
      }
    });

    return result;
  }

  /**
   * Find nodes by type
   */
  findNodesByType(type: string | NodeType): Array<{ node: PMNode; pos: number }> {
    const nodeType = typeof type === 'string' ? this.getNodeType(type) : type;
    return this.findNodes((node) => node.type === nodeType);
  }
}

// Re-export commonly used ProseMirror types for convenience
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
  DecorationSource,
  PMNode as Node,
  Schema,
  Mark,
  MarkType,
  NodeType,
  ResolvedPos,
  Slice,
  Fragment,
};

export type { NodeView, NodeViewConstructor };
