/**
 * Media Menu Plugin for BeakBlock.
 *
 * Detects when an image or embed node is selected and provides state
 * for rendering a floating edit menu.
 *
 * @module
 */

import { Plugin, PluginKey, EditorState, NodeSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node } from 'prosemirror-model';

/**
 * Plugin key for accessing media menu state.
 */
export const MEDIA_MENU_PLUGIN_KEY = new PluginKey<MediaMenuState>('mediaMenu');

/**
 * Types of media nodes that can be selected.
 */
export type MediaType = 'image' | 'embed';

/**
 * Attributes for an image node.
 */
export interface ImageAttrs {
  id: string | null;
  src: string;
  alt: string;
  caption: string;
  width: number | null;
  alignment: 'left' | 'center' | 'right';
}

/**
 * Attributes for an embed node.
 */
export interface EmbedAttrs {
  id: string | null;
  url: string;
  provider: string;
  embedId: string;
  caption: string;
  width: number | string | null;
  height: number | null;
  aspectRatio: string;
}

/**
 * State for the media menu plugin.
 */
export interface MediaMenuState {
  /** Whether the media menu should be visible */
  visible: boolean;
  /** The type of media node selected */
  mediaType: MediaType | null;
  /** Position of the selected node */
  nodePos: number | null;
  /** The selected node */
  node: Node | null;
  /** Attributes of the selected media node */
  attrs: ImageAttrs | EmbedAttrs | null;
  /** Screen coordinates for positioning the menu */
  coords: { left: number; top: number; right: number; bottom: number } | null;
}

/**
 * Check if a node is a media node.
 */
function isMediaNode(node: Node): MediaType | null {
  if (node.type.name === 'image') return 'image';
  if (node.type.name === 'embed') return 'embed';
  return null;
}

/**
 * Check if the selection is a media node selection.
 */
function getMediaSelection(state: EditorState): { mediaType: MediaType; pos: number; node: Node } | null {
  const { selection } = state;

  // Check for node selection
  if (selection instanceof NodeSelection) {
    const mediaType = isMediaNode(selection.node);
    if (mediaType) {
      return {
        mediaType,
        pos: selection.from,
        node: selection.node,
      };
    }
  }

  return null;
}

/**
 * Creates the media menu plugin.
 *
 * This plugin:
 * - Detects when an image or embed is selected
 * - Provides coordinates for menu positioning
 * - Tracks the selected node's attributes
 *
 * The actual menu UI is rendered by the framework adapter (React/Vue).
 *
 * @example
 * ```typescript
 * import { createMediaMenuPlugin, MEDIA_MENU_PLUGIN_KEY } from '@beakblock/core';
 *
 * const plugin = createMediaMenuPlugin();
 *
 * // In React component:
 * const state = MEDIA_MENU_PLUGIN_KEY.getState(editor.pm.state);
 * if (state?.visible) {
 *   // Render menu at state.coords
 * }
 * ```
 *
 * @returns A ProseMirror plugin
 */
export function createMediaMenuPlugin(): Plugin {
  return new Plugin<MediaMenuState>({
    key: MEDIA_MENU_PLUGIN_KEY,

    state: {
      init(): MediaMenuState {
        return {
          visible: false,
          mediaType: null,
          nodePos: null,
          node: null,
          attrs: null,
          coords: null,
        };
      },

      apply(tr, state, _oldEditorState, newEditorState): MediaMenuState {
        // Check for explicit meta commands
        const meta = tr.getMeta(MEDIA_MENU_PLUGIN_KEY);
        if (meta) {
          if (meta.hide) {
            return { ...state, visible: false, coords: null, node: null, attrs: null };
          }
          return { ...state, ...meta };
        }

        // Check if we have a media node selected
        const mediaSelection = getMediaSelection(newEditorState);

        if (!mediaSelection) {
          if (state.visible) {
            return {
              visible: false,
              mediaType: null,
              nodePos: null,
              node: null,
              attrs: null,
              coords: null,
            };
          }
          return state;
        }

        const { mediaType, pos, node } = mediaSelection;

        // Check if selection changed
        const selectionUnchanged = state.nodePos === pos && state.visible;
        const coords = selectionUnchanged ? state.coords : null;

        return {
          visible: true,
          mediaType,
          nodePos: pos,
          node,
          attrs: node.attrs as ImageAttrs | EmbedAttrs,
          coords,
        };
      },
    },

    view(editorView) {
      const updateCoords = () => {
        const state = MEDIA_MENU_PLUGIN_KEY.getState(editorView.state);
        if (!state?.visible || state.nodePos === null) return;

        // Get the DOM node for the selected media
        const domNode = editorView.nodeDOM(state.nodePos);
        if (!domNode || !(domNode instanceof HTMLElement)) return;

        const rect = domNode.getBoundingClientRect();
        const coords = {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        };

        if (
          !state.coords ||
          state.coords.left !== coords.left ||
          state.coords.top !== coords.top
        ) {
          editorView.dispatch(
            editorView.state.tr.setMeta(MEDIA_MENU_PLUGIN_KEY, { coords })
          );
        }
      };

      return {
        update(view) {
          const state = MEDIA_MENU_PLUGIN_KEY.getState(view.state);

          if (state?.visible && !state.coords) {
            // Use requestAnimationFrame to ensure DOM is updated
            requestAnimationFrame(updateCoords);
          }
        },

        destroy() {},
      };
    },

    props: {
      handleDOMEvents: {
        // Hide on blur (but allow clicks on menu)
        blur(view) {
          const state = MEDIA_MENU_PLUGIN_KEY.getState(view.state);
          if (state?.visible) {
            setTimeout(() => {
              const activeElement = document.activeElement;
              const isInMediaMenu = activeElement?.closest('.ob-media-menu');
              const isInMediaPopover = activeElement?.closest('.ob-media-url-popover');

              if (!view.hasFocus() && !isInMediaMenu && !isInMediaPopover) {
                view.dispatch(
                  view.state.tr.setMeta(MEDIA_MENU_PLUGIN_KEY, { hide: true })
                );
              }
            }, 150);
          }
          return false;
        },
      },
    },
  });
}

/**
 * Hide the media menu programmatically.
 *
 * @param view - The editor view
 */
export function hideMediaMenu(view: EditorView): void {
  view.dispatch(view.state.tr.setMeta(MEDIA_MENU_PLUGIN_KEY, { hide: true }));
}

/**
 * Update media node attributes.
 *
 * @param view - The editor view
 * @param pos - Position of the node
 * @param attrs - New attributes to apply
 */
export function updateMediaAttrs(
  view: EditorView,
  pos: number,
  attrs: Partial<ImageAttrs | EmbedAttrs>
): void {
  const node = view.state.doc.nodeAt(pos);
  if (!node) return;

  const tr = view.state.tr.setNodeMarkup(pos, undefined, {
    ...node.attrs,
    ...attrs,
  });

  view.dispatch(tr);
}

/**
 * Delete the selected media node.
 *
 * @param view - The editor view
 * @param pos - Position of the node
 */
export function deleteMediaNode(view: EditorView, pos: number): void {
  const node = view.state.doc.nodeAt(pos);
  if (!node) return;

  const tr = view.state.tr.delete(pos, pos + node.nodeSize);
  view.dispatch(tr);
}
