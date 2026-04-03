/**
 * Keyboard shortcuts plugin for BeakBlock.
 *
 * Provides customizable keyboard shortcuts for formatting and block operations.
 *
 * @module
 */

import { Plugin, EditorState, Transaction } from 'prosemirror-state';
import { keymap } from 'prosemirror-keymap';
import { Schema } from 'prosemirror-model';
import { toggleMark, setBlockType, wrapIn, lift } from 'prosemirror-commands';
import { wrapInList, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { undo, redo } from 'prosemirror-history';
import { EditorView } from 'prosemirror-view';

/** ProseMirror command type */
type PMCommand = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
  view?: EditorView
) => boolean;

/**
 * A keyboard shortcut definition.
 */
export interface KeyboardShortcut {
  /** The keyboard shortcut (e.g., 'Mod-b', 'Mod-Shift-s') */
  key: string;
  /** Description of what the shortcut does */
  description: string;
  /** The action to perform - either a mark name, block type, or custom command */
  action: string | PMCommand;
}

/**
 * Configuration for keyboard shortcuts plugin.
 */
export interface KeyboardShortcutsConfig {
  /**
   * Custom shortcuts to add or override defaults.
   * Key is the shortcut (e.g., 'Mod-b'), value is the action.
   */
  shortcuts?: Record<string, string | PMCommand>;

  /**
   * Whether to include default formatting shortcuts.
   * @default true
   */
  includeDefaults?: boolean;

  /**
   * Disable specific default shortcuts.
   */
  disabledShortcuts?: string[];
}

/**
 * Default keyboard shortcuts for BeakBlock.
 */
export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // Text formatting
  { key: 'Mod-b', description: 'Bold', action: 'bold' },
  { key: 'Mod-i', description: 'Italic', action: 'italic' },
  { key: 'Mod-u', description: 'Underline', action: 'underline' },
  { key: 'Mod-Shift-s', description: 'Strikethrough', action: 'strikethrough' },
  { key: 'Mod-e', description: 'Inline code', action: 'code' },

  // Undo/redo
  { key: 'Mod-z', description: 'Undo', action: 'undo' },
  { key: 'Mod-y', description: 'Redo', action: 'redo' },
  { key: 'Mod-Shift-z', description: 'Redo', action: 'redo' },

  // Block types
  { key: 'Mod-Alt-0', description: 'Paragraph', action: 'paragraph' },
  { key: 'Mod-Alt-1', description: 'Heading 1', action: 'heading1' },
  { key: 'Mod-Alt-2', description: 'Heading 2', action: 'heading2' },
  { key: 'Mod-Alt-3', description: 'Heading 3', action: 'heading3' },
  { key: 'Mod-Shift-7', description: 'Ordered list', action: 'orderedList' },
  { key: 'Mod-Shift-8', description: 'Bullet list', action: 'bulletList' },
  { key: 'Mod-Shift-9', description: 'Checklist', action: 'checkList' },
  { key: 'Mod-Shift-b', description: 'Blockquote', action: 'blockquote' },
  { key: 'Mod-Shift-c', description: 'Code block', action: 'codeBlock' },

  // List operations
  { key: 'Tab', description: 'Indent list item', action: 'indentListItem' },
  { key: 'Shift-Tab', description: 'Outdent list item', action: 'outdentListItem' },
];

/**
 * Creates a keyboard shortcuts plugin.
 *
 * @param schema - The ProseMirror schema
 * @param config - Configuration options
 * @returns A ProseMirror keymap plugin
 */
export function createKeyboardShortcutsPlugin(
  schema: Schema,
  config: KeyboardShortcutsConfig = {}
): Plugin {
  const { shortcuts = {}, includeDefaults = true, disabledShortcuts = [] } = config;

  const keymapObj: Record<string, PMCommand> = {};

  // Add default shortcuts if enabled
  if (includeDefaults) {
    for (const shortcut of DEFAULT_KEYBOARD_SHORTCUTS) {
      if (disabledShortcuts.includes(shortcut.key)) continue;

      const command = resolveAction(schema, shortcut.action);
      if (command) {
        keymapObj[shortcut.key] = command;
      }
    }
  }

  // Add/override with custom shortcuts
  for (const [key, action] of Object.entries(shortcuts)) {
    if (typeof action === 'function') {
      keymapObj[key] = action;
    } else {
      const command = resolveAction(schema, action);
      if (command) {
        keymapObj[key] = command;
      }
    }
  }

  return keymap(keymapObj);
}

/**
 * Resolves an action string to a ProseMirror command.
 */
function resolveAction(
  schema: Schema,
  action: string | PMCommand
): PMCommand | null {
  if (typeof action === 'function') {
    return action;
  }

  // Mark toggles
  const markActions: Record<string, string> = {
    bold: 'bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'strikethrough',
    code: 'code',
  };

  if (markActions[action] && schema.marks[markActions[action]]) {
    return toggleMark(schema.marks[markActions[action]]);
  }

  // Block type actions
  switch (action) {
    case 'undo':
      return undo;
    case 'redo':
      return redo;

    case 'paragraph':
      if (schema.nodes.paragraph) {
        return setBlockType(schema.nodes.paragraph);
      }
      break;

    case 'heading1':
      if (schema.nodes.heading) {
        return setBlockType(schema.nodes.heading, { level: 1 });
      }
      break;

    case 'heading2':
      if (schema.nodes.heading) {
        return setBlockType(schema.nodes.heading, { level: 2 });
      }
      break;

    case 'heading3':
      if (schema.nodes.heading) {
        return setBlockType(schema.nodes.heading, { level: 3 });
      }
      break;

    case 'bulletList':
      if (schema.nodes.bulletList && schema.nodes.listItem) {
        return wrapInList(schema.nodes.bulletList);
      }
      break;

    case 'orderedList':
      if (schema.nodes.orderedList && schema.nodes.listItem) {
        return wrapInList(schema.nodes.orderedList);
      }
      break;

    case 'checkList':
      if (schema.nodes.checkList && schema.nodes.checkListItem) {
        return (state, dispatch) => {
          const { $from, $to } = state.selection;
          const range = $from.blockRange($to);
          if (!range) return false;

          const tr = state.tr;
          const checkListItem = schema.nodes.checkListItem.create({ checked: false }, $from.parent.content);
          const checkList = schema.nodes.checkList.create(null, [checkListItem]);
          tr.replaceRangeWith(range.start, range.end, checkList);

          if (dispatch) dispatch(tr);
          return true;
        };
      }
      break;

    case 'blockquote':
      if (schema.nodes.blockquote) {
        return wrapIn(schema.nodes.blockquote);
      }
      break;

    case 'codeBlock':
      if (schema.nodes.codeBlock) {
        return setBlockType(schema.nodes.codeBlock);
      }
      break;

    case 'indentListItem':
      if (schema.nodes.listItem) {
        return sinkListItem(schema.nodes.listItem);
      }
      break;

    case 'outdentListItem':
      if (schema.nodes.listItem) {
        return liftListItem(schema.nodes.listItem);
      }
      break;

    case 'lift':
      return lift;
  }

  return null;
}
