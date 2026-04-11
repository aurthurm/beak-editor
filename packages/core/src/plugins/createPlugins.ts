/**
 * Default plugin factory for BeakBlock.
 *
 * @module
 */

import { Schema } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { history, undo, redo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';

import { createBlockIdPlugin } from './blockIdPlugin';
import { createInputRulesPlugin, InputRulesConfig } from './inputRules';
import { createDragDropPlugin, DragDropConfig } from './dragDropPlugin';
import { createSlashMenuPlugin, SlashMenuConfig } from './slashMenuPlugin';
import { createBubbleMenuPlugin, BubbleMenuConfig } from './bubbleMenuPlugin';
import { createMultiBlockSelectionPlugin, MultiBlockSelectionConfig } from './multiBlockSelectionPlugin';
import { createTablePlugin, TablePluginConfig } from './tablePlugin';
import { createKeyboardShortcutsPlugin, KeyboardShortcutsConfig } from './keyboardShortcutsPlugin';
import { createChecklistPlugin, ChecklistPluginConfig } from './checklistPlugin';
import { createListEnterPlugin } from './listEnterPlugin';
import { createLinkClickPlugin } from './linkClickPlugin';
import { createMediaMenuPlugin } from './mediaMenuPlugin';
import { createTableOfContentsPlugin } from './tableOfContentsPlugin';
import { createMarkdownPastePlugin, type MarkdownPasteMode } from './markdownPastePlugin';

/**
 * Options for creating plugins.
 */
export interface CreatePluginsOptions {
  /**
   * The ProseMirror schema.
   * Required for input rules to work correctly.
   */
  schema?: Schema;

  /**
   * Function to toggle a mark by name.
   * Used for formatting keyboard shortcuts.
   */
  toggleMark?: (markName: string) => boolean;

  /**
   * Whether to include the history (undo/redo) plugin.
   * Set to false to disable history (e.g., when using y.js collaboration).
   * Can be toggled at runtime via editor.enableHistory() / editor.disableHistory().
   * @default true
   */
  history?: boolean;

  /**
   * Configuration for input rules (markdown shortcuts).
   * Set to false to disable all input rules.
   * @default true (all rules enabled)
   */
  inputRules?: InputRulesConfig | false;

  /**
   * Configuration for drag & drop.
   * Set to false to disable drag & drop entirely.
   * @default true (enabled with default config)
   */
  dragDrop?: DragDropConfig | false;

  /**
   * Configuration for slash menu (/ command palette).
   * Set to false to disable the slash menu.
   * @default true (enabled with default config)
   */
  slashMenu?: SlashMenuConfig | false;

  /**
   * Configuration for bubble menu (formatting toolbar on selection).
   * Set to false to disable the bubble menu.
   * @default true (enabled with default config)
   */
  bubbleMenu?: BubbleMenuConfig | false;

  /**
   * Configuration for multi-block selection.
   * Set to false to disable multi-block selection.
   * @default true (enabled with default config)
   */
  multiBlockSelection?: MultiBlockSelectionConfig | false;

  /**
   * Configuration for table editing (Tab navigation, row/column shortcuts).
   * Set to false to disable table editing.
   * @default true (enabled with default config)
   */
  table?: TablePluginConfig | false;

  /**
   * Configuration for keyboard shortcuts.
   * Set to false to disable the default keyboard shortcuts plugin.
   * @default true (enabled with all default shortcuts)
   */
  keyboardShortcuts?: KeyboardShortcutsConfig | false;

  /**
   * Configuration for checklist interactions (checkbox clicks).
   * Set to false to disable the checklist plugin.
   * @default true (enabled with default config)
   */
  checklist?: ChecklistPluginConfig | false;

  /**
   * Whether to enable the media menu plugin (image/embed selection toolbar).
   * Set to false to disable the media menu.
   * @default true (enabled)
   */
  mediaMenu?: boolean;

  /**
   * Additional plugins to include.
   */
  additionalPlugins?: Plugin[];

  /**
   * Paste plain-text Markdown from the clipboard (`text/plain` without `text/html`).
   * @default 'heuristic' (parse when text looks like Markdown)
   */
  markdownPaste?: MarkdownPasteMode;
}

/**
 * Creates the default set of plugins for BeakBlock.
 *
 * Includes:
 * - History (undo/redo)
 * - Base keymap (standard editing commands)
 * - Formatting keymap (Mod-b, Mod-i, Mod-u)
 * - Input rules (markdown shortcuts like # for headings)
 * - Drag & drop (block-level drag with handles)
 * - Slash menu (/ command palette for inserting blocks)
 * - Bubble menu (formatting toolbar on text selection)
 * - Drop cursor (visual feedback during drag)
 * - Gap cursor (cursor at block boundaries)
 * - Block ID plugin (automatic ID assignment)
 *
 * @example
 * ```typescript
 * import { createPlugins } from '@beakblock/core';
 *
 * const plugins = createPlugins({
 *   schema: mySchema,
 *   toggleMark: (name) => editor.pm.toggleMark(name),
 *   inputRules: { headings: true, bulletLists: true },
 *   additionalPlugins: [myCustomPlugin],
 * });
 * ```
 *
 * @param options - Plugin creation options
 * @returns Array of ProseMirror plugins
 */
export function createPlugins(options: CreatePluginsOptions = {}): Plugin[] {
  const {
    schema,
    toggleMark,
    inputRules,
    dragDrop,
    slashMenu,
    bubbleMenu,
    multiBlockSelection,
    table,
    keyboardShortcuts,
    checklist,
    mediaMenu,
    additionalPlugins = [],
    markdownPaste,
  } = options;
  const includeHistory = options.history !== false;

  // Create slash menu plugin early so we can add it before baseKeymap
  const slashMenuPlugin = slashMenu !== false
    ? createSlashMenuPlugin(typeof slashMenu === 'object' ? slashMenu : {})
    : null;

  const plugins: Plugin[] = [
    // History for undo/redo (can be disabled for y.js collaboration)
    ...(includeHistory ? [history()] : []),

    // Slash menu plugin must come before baseKeymap to handle Enter when menu is active
    ...(slashMenuPlugin ? [slashMenuPlugin] : []),

    // Checklist plugin must come before baseKeymap to handle Enter/Shift+Enter in checklists
    ...(checklist !== false ? [createChecklistPlugin(typeof checklist === 'object' ? checklist : {})] : []),

    // List enter plugin must come before baseKeymap to split bullet/ordered list items on Enter
    ...(schema ? [createListEnterPlugin(schema)] : []),

    // Standard editing commands
    keymap(baseKeymap),

    // Drop cursor visual feedback
    dropCursor(),

    // Gap cursor for block boundaries
    gapCursor(),

    // Automatic block ID assignment
    createBlockIdPlugin(),

    // Sync table of contents blocks with heading outline (after IDs exist)
    ...(schema?.nodes.tableOfContents ? [createTableOfContentsPlugin()] : []),

    // Open links in a new tab/window when clicked inside the editor
    createLinkClickPlugin(),

    ...(schema && markdownPaste !== false
      ? [
          createMarkdownPastePlugin({
            schema,
            mode: markdownPaste === undefined ? 'heuristic' : markdownPaste,
          }),
        ]
      : []),
  ];

  // Add keyboard shortcuts plugin (includes formatting, undo/redo, block type shortcuts)
  if (schema && keyboardShortcuts !== false) {
    const keyboardConfig = typeof keyboardShortcuts === 'object' ? keyboardShortcuts : {};
    plugins.splice(2, 0, createKeyboardShortcutsPlugin(schema, keyboardConfig));
  } else if (toggleMark) {
    // Fallback: if no schema but toggleMark is provided, use the old formatting keymap
    plugins.splice(2, 0, keymap({
      'Mod-b': () => toggleMark('bold'),
      'Mod-i': () => toggleMark('italic'),
      'Mod-u': () => toggleMark('underline'),
    }));
    // Also add undo/redo if no keyboard shortcuts plugin
    plugins.splice(2, 0, keymap({
      'Mod-z': undo,
      'Mod-y': redo,
      'Mod-Shift-z': redo,
    }));
  }

  // Add input rules for markdown shortcuts (requires schema)
  if (schema && inputRules !== false) {
    const rulesConfig = typeof inputRules === 'object' ? inputRules : {};
    plugins.push(createInputRulesPlugin(schema, rulesConfig));
  }

  // Add drag & drop plugin
  if (dragDrop !== false) {
    const dragDropConfig = typeof dragDrop === 'object' ? dragDrop : {};
    plugins.push(createDragDropPlugin(dragDropConfig));
  }

  // Note: Slash menu plugin is added earlier in the plugin array
  // to ensure it handles Enter before baseKeymap

  // Add bubble menu plugin
  if (bubbleMenu !== false) {
    const bubbleMenuConfig = typeof bubbleMenu === 'object' ? bubbleMenu : {};
    plugins.push(createBubbleMenuPlugin(bubbleMenuConfig));
  }

  // Add multi-block selection plugin
  if (multiBlockSelection !== false) {
    const multiBlockConfig = typeof multiBlockSelection === 'object' ? multiBlockSelection : {};
    plugins.push(createMultiBlockSelectionPlugin(multiBlockConfig));
  }

  // Add table editing plugin
  if (table !== false) {
    const tableConfig = typeof table === 'object' ? table : {};
    plugins.push(createTablePlugin(tableConfig));
  }

  // Note: Checklist plugin is added earlier in the plugin array
  // to ensure it handles Enter/Shift+Enter before baseKeymap

  // Add media menu plugin (image/embed selection toolbar)
  if (mediaMenu !== false) {
    plugins.push(createMediaMenuPlugin());
  }

  // Add user plugins
  plugins.push(...additionalPlugins);

  return plugins;
}
