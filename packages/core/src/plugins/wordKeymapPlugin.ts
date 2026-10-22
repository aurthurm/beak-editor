/**
 * Word-compatible keyboard behaviour (contracts §1.7).
 *
 * Registered by `createPlugins` when `wordBehaviour` is on (the default in
 * office and controlled modes). It sits ahead of the default keymaps so its
 * bindings win:
 *
 * - Mod-Enter: page break (followed by a new paragraph)
 * - Mod-Shift-v: paste as plain text
 * - Mod-Alt-1/2/3: Heading 1-3 (styleId `HeadingN`); Mod-Shift-n: Normal
 * - Tab / Shift-Tab: list level in list items. Outside lists and tables Tab
 *   inserts a `\t` character (paragraphs render it with `white-space: pre-wrap`);
 *   Shift-Tab does nothing there so focus can move.
 * - Enter on an empty list item lifts it out of the list
 * - Backspace at the start of a list item lifts it out of the list first; at
 *   the start of a heading it converts the heading to a paragraph
 * - Smart quotes and AutoCorrect as text input rules
 *
 * F4 repeat is owned by the command registry, not this plugin.
 *
 * @module
 */

import { Plugin, PluginKey, EditorState, Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Schema, NodeType } from 'prosemirror-model';
import { keydownHandler } from 'prosemirror-keymap';
import { liftListItem, sinkListItem } from 'prosemirror-schema-list';

/** Plugin key for the Word keymap plugin. */
export const WORD_KEYMAP_PLUGIN_KEY = new PluginKey('wordKeymap');

/**
 * Default AutoCorrect replacements. Keys are the typed trigger text; the
 * longest matching trigger wins.
 */
export const DEFAULT_AUTOCORRECT: Readonly<Record<string, string>> = Object.freeze({
  '(c)': '©',
  '(C)': '©',
  '(r)': '®',
  '(R)': '®',
  '(tm)': '™',
  '(TM)': '™',
  '--': '–',
  '...': '…',
  '->': '→',
  '<-': '←',
  '<->': '↔',
  '<=': '≤',
  '>=': '≥',
  '!=': '≠',
  '1/2': '½',
  '1/4': '¼',
  '3/4': '¾',
});

/**
 * Options for {@link createWordKeymapPlugin}.
 */
export interface WordKeymapOptions {
  /** The ProseMirror schema (node types are looked up by name). */
  schema: Schema;
  /**
   * AutoCorrect map (trigger to replacement). Pass `false` to disable.
   * @default DEFAULT_AUTOCORRECT
   */
  autocorrect?: Record<string, string> | false;
  /**
   * Convert straight quotes to typographic quotes.
   * @default true
   */
  smartQuotes?: boolean;
}

type Command = (state: EditorState, dispatch?: (tr: Transaction) => void, view?: EditorView) => boolean;

/** Returns the depth of the nearest ancestor of `type`, or -1. */
function ancestorDepth(state: EditorState, type: NodeType | undefined): number {
  if (!type) return -1;
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === type) return d;
  }
  return -1;
}

/** Whether the selection is inside a table cell. */
function inTable(state: EditorState): boolean {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.spec.tableRole === 'table') return true;
  }
  return false;
}

/**
 * Sets the type (and attrs) of every textblock touched by the selection.
 * Attrs not present on the target type are ignored by ProseMirror.
 */
function retypeTextblocks(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  type: NodeType,
  extra: Record<string, unknown>
): boolean {
  const { from, to } = state.selection;
  const targets: { pos: number; node: import('prosemirror-model').Node }[] = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock) {
      targets.push({ pos, node });
      return false;
    }
    return true;
  });
  if (!targets.length) return false;
  if (dispatch) {
    const tr = state.tr;
    for (const { pos, node } of targets) {
      if (node.type === type && Object.keys(extra).every((k) => node.attrs[k] === extra[k])) continue;
      tr.setNodeMarkup(pos, type, { ...node.attrs, ...extra });
    }
    dispatch(tr);
  }
  return true;
}

/**
 * Creates the Word-compatible keyboard plugin.
 *
 * @param options - Schema and optional AutoCorrect / smart quote settings
 * @returns A ProseMirror plugin to register before the default keymaps
 */
export function createWordKeymapPlugin(options: WordKeymapOptions): Plugin {
  const { schema } = options;
  const autocorrect = options.autocorrect === false
    ? null
    : { ...DEFAULT_AUTOCORRECT, ...(options.autocorrect ?? {}) };
  const smartQuotes = options.smartQuotes !== false;
  const triggers = autocorrect ? Object.keys(autocorrect).sort((a, b) => b.length - a.length) : [];

  const listItem = schema.nodes.listItem;
  const heading = schema.nodes.heading;
  const paragraph = schema.nodes.paragraph;
  const pageBreak = schema.nodes.pageBreak;
  const codeBlock = schema.nodes.codeBlock;
  const checkListItem = schema.nodes.checkListItem;

  /** Set by Mod-Shift-v when the Clipboard API is unavailable. */
  let plainPasteArmed = false;

  const insertPageBreak: Command = (state, dispatch) => {
    if (!pageBreak) return false;
    if (inTable(state)) return false;
    if (dispatch) {
      const tr = state.tr.replaceSelectionWith(pageBreak.create(), false);
      dispatch(tr.scrollIntoView());
    }
    return true;
  };

  const setHeading = (level: number): Command => (state, dispatch) => {
    if (!heading) return false;
    return retypeTextblocks(state, dispatch, heading, { level, styleId: `Heading${level}` });
  };

  const setNormal: Command = (state, dispatch) => {
    if (!paragraph) return false;
    return retypeTextblocks(state, dispatch, paragraph, { styleId: 'Normal' });
  };

  const pastePlain: Command = (_state, _dispatch, view) => {
    if (!view) return false;
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (clipboard && typeof clipboard.readText === 'function') {
      clipboard
        .readText()
        .then((text) => {
          if (text) view.pasteText(text);
        })
        .catch(() => {
          plainPasteArmed = true;
        });
      return true;
    }
    plainPasteArmed = true;
    return true;
  };

  const tab: Command = (state, dispatch) => {
    if (inTable(state)) return false;
    const { $from } = state.selection;
    if (checkListItem && ancestorDepth(state, checkListItem) >= 0) return false;
    if (codeBlock && $from.parent.type === codeBlock) return false;
    if (listItem && ancestorDepth(state, listItem) >= 0) {
      // Word does nothing when the item cannot be indented; consume the key.
      sinkListItem(listItem)(state, dispatch);
      return true;
    }
    if (dispatch) dispatch(state.tr.insertText('\t'));
    return true;
  };

  const shiftTab: Command = (state, dispatch) => {
    if (inTable(state)) return false;
    if (listItem && ancestorDepth(state, listItem) >= 0) {
      liftListItem(listItem)(state, dispatch);
      return true;
    }
    return false;
  };

  const enter: Command = (state, dispatch) => {
    if (!listItem) return false;
    const depth = ancestorDepth(state, listItem);
    if (depth < 0) return false;
    const { $from, empty } = state.selection;
    if (!empty || $from.depth !== depth + 1 || $from.parent.content.size !== 0) return false;
    return liftListItem(listItem)(state, dispatch);
  };

  const backspace: Command = (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty || $from.parentOffset !== 0 || !$from.parent.isTextblock) return false;

    const depth = ancestorDepth(state, listItem);
    if (depth >= 0 && $from.depth === depth + 1 && $from.index(depth) === 0) {
      return liftListItem(listItem!)(state, dispatch);
    }
    if (heading && $from.parent.type === heading && paragraph) {
      return retypeTextblocks(state, dispatch, paragraph, { styleId: 'Normal' });
    }
    return false;
  };

  const bindings: Record<string, Command> = {
    'Mod-Enter': insertPageBreak,
    'Mod-Shift-v': pastePlain,
    'Mod-Alt-1': setHeading(1),
    'Mod-Alt-2': setHeading(2),
    'Mod-Alt-3': setHeading(3),
    'Mod-Shift-n': setNormal,
    'Mod-Shift-N': setNormal,
    'Mod-Shift-V': pastePlain,
    Tab: tab,
    'Shift-Tab': shiftTab,
    Enter: enter,
    Backspace: backspace,
  };
  const handleKey = keydownHandler(bindings as never);

  return new Plugin({
    key: WORD_KEYMAP_PLUGIN_KEY,
    props: {
      handleKeyDown(view, event) {
        return handleKey(view, event);
      },

      handlePaste(view, event) {
        if (!plainPasteArmed) return false;
        plainPasteArmed = false;
        const text = event.clipboardData?.getData('text/plain');
        if (text === undefined) return false;
        view.pasteText(text, event);
        return true;
      },

      handleTextInput(view, from, to, text) {
        if (!smartQuotes && !autocorrect) return false;
        const $from = view.state.doc.resolve(from);
        if (!$from.parent.isTextblock) return false;
        const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');

        if (smartQuotes && (text === '"' || text === "'")) {
          const opening = before === '' || /[\s([{–—]$/.test(before);
          const quote = text === '"'
            ? (opening ? '“' : '”')
            : (opening ? '‘' : '’');
          view.dispatch(view.state.tr.insertText(quote, from, to));
          return true;
        }

        if (!autocorrect) return false;
        const full = before + text;
        for (const trigger of triggers) {
          if (!full.endsWith(trigger)) continue;
          const start = from - (trigger.length - text.length);
          if (start < $from.start()) continue;
          view.dispatch(view.state.tr.insertText(autocorrect[trigger]!, start, to));
          return true;
        }
        return false;
      },
    },
  });
}
