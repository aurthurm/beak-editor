/**
 * Keeps form controls in step with the editor's editable state.
 *
 * Node views only re-sync when their node changes, so a change to
 * `editor.setEditable()` would otherwise leave controls enabled. This plugin
 * re-applies the disabled state whenever the view's editable flag changes.
 *
 * @module
 */

import { Plugin, PluginKey } from 'prosemirror-state';

/** Plugin key for the editable-state plugin. */
export const FORM_EDITABLE_PLUGIN_KEY = new PluginKey('beakblockFormEditable');

/**
 * Creates the plugin. Controls are disabled when the editor is read-only or the
 * control's field is marked read-only (`.beakblock-form-readonly`).
 */
export function createFormEditablePlugin(): Plugin {
  return new Plugin({
    key: FORM_EDITABLE_PLUGIN_KEY,
    view(view) {
      let last: boolean | null = null;
      const apply = () => {
        const editable = view.editable;
        if (editable === last) return;
        last = editable;
        view.dom.querySelectorAll<HTMLElement>('[data-form-field]').forEach((field) => {
          const readOnly = field.classList.contains('beakblock-form-readonly');
          field.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach((control) => {
            control.disabled = !editable || readOnly;
          });
        });
      };
      apply();
      return {
        update: () => apply(),
      };
    },
  });
}
