/**
 * Table plugin for BeakBlock.
 *
 * Provides Office-class table editing:
 * - prosemirror-tables editing (cell-range selection, arrow navigation,
 *   clearing selected cells) via `tableEditing()`
 * - column resizing with drag handles via `columnResizing()`
 * - Tab / Shift+Tab: next / previous cell (Tab in the last cell adds a row)
 * - Mod+Alt+ArrowUp/Down/Left/Right: add row or column
 * - Mod+Shift+Backspace: delete row
 *
 * Use {@link createTablePlugins} to register the full set. {@link createTablePlugin}
 * returns only the keymap for callers that compose their own table plugins.
 *
 * @module
 */

import { Plugin, PluginKey, EditorState, Transaction } from 'prosemirror-state';
import { keymap } from 'prosemirror-keymap';
import { tableEditing, columnResizing, goToNextCell as pmGoToNextCell } from 'prosemirror-tables';
import {
  goToNextCell,
  goToPreviousCell,
  addRowAfter,
  addRowBefore,
  addColumnAfter,
  addColumnBefore,
  deleteRow,
} from '../commands/tableCommands';

/**
 * Plugin key for the table plugin.
 */
export const TABLE_PLUGIN_KEY = new PluginKey('tablePlugin');

/**
 * ProseMirror command type.
 */
type Command = (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean;

/**
 * Configuration for the table plugin.
 */
export interface TablePluginConfig {
  /**
   * Whether Tab navigates between cells.
   * @default true
   */
  tabNavigation?: boolean;

  /**
   * Whether Tab in the last cell adds a new row.
   * @default true
   */
  addRowOnTab?: boolean;

  /**
   * Enable drag-to-resize for column borders.
   * @default true
   */
  columnResizing?: boolean | { cellMinWidth?: number; handleWidth?: number };
}

/**
 * Creates the table keymap plugin (keyboard shortcuts only).
 *
 * @param config - Plugin configuration
 * @returns A ProseMirror plugin
 */
export function createTablePlugin(config: TablePluginConfig = {}): Plugin {
  const { tabNavigation = true, addRowOnTab = true } = config;

  const keys: Record<string, Command> = {};

  if (tabNavigation) {
    keys['Tab'] = addRowOnTab ? goToNextCell : pmGoToNextCell(1);
    keys['Shift-Tab'] = goToPreviousCell;
  }

  // Row operations
  keys['Mod-Alt-ArrowDown'] = addRowAfter;
  keys['Mod-Alt-ArrowUp'] = addRowBefore;

  // Column operations
  keys['Mod-Alt-ArrowRight'] = addColumnAfter;
  keys['Mod-Alt-ArrowLeft'] = addColumnBefore;

  // Delete row with Mod+Shift+Backspace
  keys['Mod-Shift-Backspace'] = deleteRow;

  return keymap(keys);
}

/**
 * Creates the full Office-class table plugin set: prosemirror-tables
 * editing, optional column resizing, and the BeakBlock table keymap.
 *
 * @param config - Plugin configuration
 * @returns Plugins to register, in order
 */
export function createTablePlugins(config: TablePluginConfig = {}): Plugin[] {
  const plugins: Plugin[] = [];
  const resize = config.columnResizing ?? true;
  if (resize) {
    const options = typeof resize === 'object' ? resize : {};
    plugins.push(columnResizing({ cellMinWidth: options.cellMinWidth ?? 25, handleWidth: options.handleWidth ?? 5 }));
  }
  plugins.push(tableEditing());
  plugins.push(createTablePlugin(config));
  return plugins;
}
