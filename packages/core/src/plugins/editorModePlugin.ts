/**
 * Editor mode plugin.
 *
 * Stores the current {@link EditorMode} in plugin state so other plugins
 * (slash menu, drag handles) can check it. Set the mode with
 * `tr.setMeta(EDITOR_MODE_PLUGIN_KEY, mode)`.
 *
 * @module
 */

import { Plugin, PluginKey, EditorState } from 'prosemirror-state';
import type { EditorMode } from '../extensions';
import { CHROME_DISABLED_MODES } from '../extensions';

/** Plugin key for the editor mode state. */
export const EDITOR_MODE_PLUGIN_KEY = new PluginKey<EditorMode>('beakblockEditorMode');

/**
 * Creates the editor mode plugin.
 *
 * @param mode - Initial mode
 */
export function createEditorModePlugin(mode: EditorMode): Plugin {
  return new Plugin<EditorMode>({
    key: EDITOR_MODE_PLUGIN_KEY,
    state: {
      init(): EditorMode {
        return mode;
      },
      apply(tr, current): EditorMode {
        const next = tr.getMeta(EDITOR_MODE_PLUGIN_KEY) as EditorMode | undefined;
        return next ?? current;
      },
    },
  });
}

/**
 * Returns the mode of an editor state. Defaults to `'block'` when the
 * mode plugin is not installed.
 *
 * @param state - The editor state
 */
export function getEditorMode(state: EditorState): EditorMode {
  return EDITOR_MODE_PLUGIN_KEY.getState(state) ?? 'block';
}

/**
 * Whether block chrome (drag handles, slash menu) is active for a state.
 *
 * @param state - The editor state
 */
export function isBlockChromeEnabled(state: EditorState): boolean {
  return !CHROME_DISABLED_MODES.includes(getEditorMode(state));
}
