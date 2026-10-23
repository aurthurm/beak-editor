/**
 * Editor Configuration.
 *
 * All configuration options for BeakBlockEditor.
 *
 * @module
 */

import type { Plugin } from 'prosemirror-state';
import type { NodeViewConstructor } from 'prosemirror-view';
import type { MarkSpec, NodeSpec, Node as ProseMirrorNode } from 'prosemirror-model';
import type { Block, PartialBlock } from '../blocks/types';
import type { InputRulesConfig } from '../plugins/inputRules';
import type { DocumentVersion, VersioningAdapter } from '../versioning/types';
import type { TrackedChangeRecord } from '../plugins/trackChangesPlugin';
import type { ComplianceLockPluginOptions } from '../plugins/complianceLockPlugin';
import type { DragDropConfig } from '../plugins/dragDropPlugin';
import type { BeakExtension, EditorMode } from '../extensions';

/** Review view for revision marks (track changes). */
export type ReviewView = 'markup' | 'final' | 'original';

/** All review view names. */
export const REVIEW_VIEWS: readonly ReviewView[] = ['markup', 'final', 'original'];

/** All editor mode names. */
export const EDITOR_MODES: readonly EditorMode[] = ['block', 'office', 'controlled'];

/**
 * Configuration for enabling real-time collaboration.
 *
 * @example
 * ```typescript
 * import { ySyncPlugin, yCursorPlugin, yUndoPlugin } from 'y-prosemirror';
 *
 * const config: CollaborationConfig = {
 *   plugins: [
 *     ySyncPlugin(fragment),
 *     yCursorPlugin(awareness),
 *     yUndoPlugin(),
 *   ],
 * };
 * ```
 */
/**
 * The part of a y-websocket (or compatible) provider that seeding needs.
 * `synced` is true once the provider has received the server's state.
 */
export interface CollaborationSyncSource {
  readonly synced?: boolean;
  on(event: 'sync', listener: (isSynced: boolean) => void): unknown;
  off(event: 'sync', listener: (isSynced: boolean) => void): unknown;
}

/** Minimal Y.Map surface used for the per-room seed marker. */
export interface CollaborationMapLike {
  has(key: string): boolean;
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
  observe(listener: () => void): void;
  unobserve(listener: () => void): void;
}

/** Minimal Y.XmlFragment surface used to detect and undo a lost seed race. */
export interface CollaborationFragmentLike {
  readonly length: number;
  toArray(): unknown[];
  delete(index: number, length?: number): void;
}

/** Minimal Y.Doc surface used for transactions and the seed marker map. */
export interface CollaborationDocLike {
  transact(fn: () => void, origin?: unknown): void;
  getMap(name: string): CollaborationMapLike;
}

/**
 * Sync-gated collaboration setup.
 *
 * When provided, collaboration plugins are not attached until the provider
 * has synced, so the editor never binds to a fragment that has not yet
 * received the room's state. If the room is empty after sync, `seed` writes
 * the editor's current document into the shared fragment, at most once per room.
 */
export interface CollaborationSyncConfig {
  /** Provider whose `sync` event signals that the room state has arrived. */
  provider: CollaborationSyncSource;
  /** The Y.Doc that owns `fragment`. */
  ydoc: CollaborationDocLike;
  /** The shared XML fragment that ySyncPlugin is bound to. */
  fragment: CollaborationFragmentLike;
  /**
   * Writes `doc` into `fragment`, typically
   * `(doc) => prosemirrorToYXmlFragment(doc, fragment)` from y-prosemirror.
   * Omit to never seed (the room starts empty when it is empty).
   */
  seed?: (doc: ProseMirrorNode) => void;
}

export interface CollaborationConfig {
  /**
   * ProseMirror plugins for collaboration (e.g., from y-prosemirror).
   * Typically includes ySyncPlugin, yCursorPlugin, and yUndoPlugin.
   */
  plugins: Plugin[];
  /**
   * Optional sync gate and seeding. Strongly recommended for any room that
   * may be shared by more than one client, including the first client to join.
   * See {@link CollaborationSyncConfig}.
   */
  sync?: CollaborationSyncConfig;
}

/**
 * Editor event types.
 */
export interface EditorEvents {
  /** Document changed */
  change: { blocks: Block[] };
  /** Selection changed */
  selectionChange: { blocks: Block[] };
  /** Editor focused */
  focus: undefined;
  /** Editor blurred */
  blur: undefined;
  /** Transaction applied */
  transaction: { transaction: unknown };
  /** A version snapshot was saved */
  versionSaved: { version: DocumentVersion };
  /** Document was restored from a saved version */
  versionRestored: { version: DocumentVersion };
  /** Track changes recorded an edit (only when track changes is enabled) */
  trackChange: { entry: TrackedChangeRecord };
  /** The editor mode changed (see {@link BeakBlockEditor.setMode}) */
  modeChange: { mode: EditorMode; previousMode: EditorMode };
}

/**
 * Optional track-changes mode at initialization.
 */
export type TrackChangesConfig =
  | boolean
  | {
      /** @default true when an object is passed */
      enabled?: boolean;
      authorId?: string;
    };

/**
 * Event handler type.
 */
export type EventHandler<T> = (data: T) => void;

/**
 * Configuration for the BeakBlock editor.
 *
 * @example
 * ```typescript
 * const config: EditorConfig = {
 *   element: document.getElementById('editor'),
 *   initialContent: [
 *     { type: 'paragraph', content: [{ type: 'text', text: 'Hello', styles: {} }] }
 *   ],
 *   editable: true,
 *   autoFocus: 'end',
 * };
 * ```
 */
export interface EditorConfig {
  /**
   * DOM element to mount the editor into.
   * If not provided, you must call editor.mount(element) later.
   */
  element?: HTMLElement;

  /**
   * Initial document content as blocks.
   * If not provided, starts with an empty paragraph.
   */
  initialContent?: PartialBlock[];

  /**
   * Whether the editor is editable.
   * @default true
   */
  editable?: boolean;

  /**
   * Auto-focus behavior when the editor mounts.
   * - true or 'end': Focus at end of document
   * - 'start': Focus at start of document
   * - false: Don't auto-focus
   * @default false
   */
  autoFocus?: boolean | 'start' | 'end';

  /**
   * Placeholder text to show when the editor is empty.
   * Can be a string or a function that returns a string based on the block.
   */
  placeholder?: string | ((block: Block) => string);

  /**
   * Whether to include the history (undo/redo) plugin.
   * Set to false to disable history at initialization (e.g., when using y.js).
   * Can also be toggled at runtime via editor.enableHistory() / editor.disableHistory().
   * @default true
   */
  history?: boolean;

  /**
   * Pluggable document versioning (snapshots and restore).
   * When set, use editor.saveVersion(), listVersions(), getVersion(), restoreVersion().
   */
  versioning?: {
    adapter: VersioningAdapter;
  };

  /**
   * Enable track changes when the editor is created.
   * Toggle at runtime with editor.enableTrackChanges() / editor.disableTrackChanges().
   */
  trackChanges?: TrackChangesConfig;

  /**
   * Compliance locks for blocks that declare `attrs.locked` (e.g. required headings).
   * Set to `false` to disable. When enabled, optional `allowReorder` controls drag
   * between locked sections; see {@link ComplianceLockPluginOptions}.
   */
  complianceLock?: false | ComplianceLockPluginOptions;

  /**
   * Drag-and-drop side menu (handles, add block) configuration.
   * Pass `false` to disable. Merged into the default plugin list from {@link createPlugins}.
   */
  dragDrop?: DragDropConfig | false;

  /**
   * Configuration for input rules (markdown-style shortcuts).
   *
   * Enable/disable specific shortcuts like:
   * - `# ` → Heading 1, `## ` → Heading 2, etc.
   * - `- `, `* ` → Bullet list
   * - `1. ` → Ordered list
   * - `> ` → Blockquote
   * - ``` → Code block
   * - `---` → Divider
   *
   * Set to false to disable all input rules.
   * @default true (all rules enabled)
   *
   * @example
   * ```typescript
   * // Enable only headings and lists
   * inputRules: { headings: true, bulletLists: true, orderedLists: true }
   *
   * // Disable all input rules
   * inputRules: false
   * ```
   */
  inputRules?: InputRulesConfig | false;

  /**
   * When the clipboard has `text/plain` but no `text/html`, treat the paste as Markdown.
   * - `'heuristic'` (default): only when the text looks like Markdown (`looksLikeMarkdown`)
   * - `true`: always parse plain text as Markdown
   * - `false`: disable (browser default)
   */
  markdownPaste?: boolean | 'heuristic';

  /**
   * Whether to auto-inject CSS styles into the document head.
   *
   * When true (default), BeakBlock will automatically inject all required
   * CSS styles, so you don't need to import any CSS files manually.
   *
   * Set to false if you want to provide your own styles or import the
   * CSS file manually.
   *
   * @default true
   */
  injectStyles?: boolean;

  /**
   * Custom node specifications to add to the schema.
   * Keys are node type names, values are ProseMirror NodeSpec objects.
   */
  customNodes?: Record<string, NodeSpec>;

  /**
   * Custom mark specifications to add to the schema.
   * Keys are mark names, values are ProseMirror MarkSpec objects.
   */
  customMarks?: Record<string, MarkSpec>;

  /**
   * Editor mode.
   * - `'block'`: drag handles and slash menu are active
   * - `'office'` / `'controlled'`: block chrome is disabled
   * @default 'block'
   */
  mode?: EditorMode;

  /**
   * Extensions that contribute nodes, marks, plugins, node views and block definitions.
   */
  extensions?: BeakExtension[];

  /**
   * Word-compatible keyboard behaviour (consumed by the Word keymap plugin).
   * @default mode !== 'block'
   */
  wordBehaviour?: boolean;

  /**
   * Direct ProseMirror configuration.
   * Use this for advanced customization.
   * ALL PROSEMIRROR OPTIONS ARE PUBLIC - this is BeakBlock's philosophy.
   */
  prosemirror?: {
    /** Additional ProseMirror plugins to load. */
    plugins?: Plugin[];
    /** Custom node views. */
    nodeViews?: Record<string, NodeViewConstructor>;
  };

  /**
   * Event callbacks.
   */
  onUpdate?: (blocks: Block[]) => void;
  onSelectionChange?: (blocks: Block[]) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

/**
 * Default configuration values.
 */
export const defaultConfig: Partial<EditorConfig> = {
  editable: true,
  autoFocus: false,
  injectStyles: true,
};
