/**
 * Table plugin for BeakBlock.
 *
 * Provides keyboard shortcuts for table manipulation:
 * - Tab: Move to next cell (creates new row if at end)
 * - Shift+Tab: Move to previous cell
 * - Mod+Alt+ArrowUp: Add row above
 * - Mod+Alt+ArrowDown: Add row below
 * - Mod+Alt+ArrowLeft: Add column before
 * - Mod+Alt+ArrowRight: Add column after
 * - Mod+Backspace: Delete row (when in table)
 *
 * @module
 */

import { Plugin, PluginKey, EditorState, Transaction } from 'prosemirror-state';
import { keymap } from 'prosemirror-keymap';
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
   * Whether to add a new row when Tab is pressed in the last cell.
   * @default true
   */
  addRowOnTab?: boolean;
}

/**
 * Creates the table keymap plugin.
 *
 * @param config - Plugin configuration
 * @returns A ProseMirror plugin
 */
export function createTablePlugin(config: TablePluginConfig = {}): Plugin {
  const { tabNavigation = true } = config;

  const keys: Record<string, Command> = {};

  if (tabNavigation) {
    keys['Tab'] = goToNextCell;
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
