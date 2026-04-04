/**
 * Bubble Menu Plugin for BeakBlock.
 *
 * Detects text selection and provides state for rendering a floating
 * formatting toolbar near the selected text.
 *
 * @module
 */

import { Plugin, PluginKey, EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

/**
 * Plugin key for accessing bubble menu state.
 */
export const BUBBLE_MENU_PLUGIN_KEY = new PluginKey<BubbleMenuState>('bubbleMenu');

/**
 * Block type info for the block type selector.
 */
export interface BlockTypeInfo {
  /** The ProseMirror node type name */
  type: string;
  /** Additional props like heading level */
  props: Record<string, unknown>;
}

/**
 * Text alignment type.
 */
export type TextAlign = 'left' | 'center' | 'right';

/**
 * State for the bubble menu plugin.
 */
export interface BubbleMenuState {
  /** Whether the bubble menu should be visible */
  visible: boolean;
  /** Selection start position */
  from: number;
  /** Selection end position */
  to: number;
  /** Screen coordinates for positioning the menu */
  coords: { left: number; top: number; bottom: number } | null;
  /** Currently active marks in selection */
  activeMarks: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
    code: boolean;
    link: string | null;
    textColor: string | null;
    backgroundColor: string | null;
  };
  /** Current block type at selection */
  blockType: BlockTypeInfo;
  /** Current text alignment */
  textAlign: TextAlign;
}

/**
 * Configuration for the bubble menu plugin.
 */
export interface BubbleMenuConfig {
  /**
   * Minimum selection length to show menu.
   * @default 1
   */
  minSelectionLength?: number;

  /**
   * Delay in ms before showing the menu after selection.
   * @default 0
   */
  showDelay?: number;

  /**
   * Whether to show menu on node selections (images, etc).
   * @default false
   */
  showOnNodeSelection?: boolean;
}

/**
 * Get the block type at the current selection.
 */
function getBlockType(state: EditorState): BlockTypeInfo {
  const { $from } = state.selection;

  // Walk up the tree to find the nearest block node
  // Skip listItem and paragraph inside lists - we want to report the list type
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.isBlock && node.type.name !== 'doc') {
      const type = node.type.name;

      // If we're at a paragraph inside a listItem, keep going up to find the list
      if (type === 'paragraph' || type === 'listItem') {
        continue;
      }

      const props: Record<string, unknown> = {};

      // Extract relevant props based on block type
      if (type === 'heading') {
        props.level = node.attrs.level;
      }

      return { type, props };
    }
  }

  // Default to paragraph
  return { type: 'paragraph', props: {} };
}

/**
 * Get the text alignment of the block at selection.
 */
function getTextAlign(state: EditorState): TextAlign {
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.isBlock && node.type.spec.attrs?.textAlign !== undefined) {
      return (node.attrs.textAlign as TextAlign) || 'left';
    }
  }

  return 'left';
}

/**
 * Get active marks from selection.
 */
function getActiveMarks(state: EditorState): BubbleMenuState['activeMarks'] {
  const { from, $from, to, empty } = state.selection;
  const marks = {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    code: false,
    link: null as string | null,
    textColor: null as string | null,
    backgroundColor: null as string | null,
  };

  if (empty) {
    // Check stored marks or marks at cursor
    const storedMarks = state.storedMarks || $from.marks();
    for (const mark of storedMarks) {
      if (mark.type.name === 'bold') marks.bold = true;
      if (mark.type.name === 'italic') marks.italic = true;
      if (mark.type.name === 'underline') marks.underline = true;
      if (mark.type.name === 'strikethrough') marks.strikethrough = true;
      if (mark.type.name === 'code') marks.code = true;
      if (mark.type.name === 'link') marks.link = mark.attrs.href;
      if (mark.type.name === 'textColor') marks.textColor = mark.attrs.color;
      if (mark.type.name === 'backgroundColor') marks.backgroundColor = mark.attrs.color;
    }
  } else {
    // Check marks in selection range
    state.doc.nodesBetween(from, to, (node) => {
      if (node.isText && node.marks) {
        for (const mark of node.marks) {
          if (mark.type.name === 'bold') marks.bold = true;
          if (mark.type.name === 'italic') marks.italic = true;
          if (mark.type.name === 'underline') marks.underline = true;
          if (mark.type.name === 'strikethrough') marks.strikethrough = true;
          if (mark.type.name === 'code') marks.code = true;
          if (mark.type.name === 'link') marks.link = mark.attrs.href;
          if (mark.type.name === 'textColor') marks.textColor = mark.attrs.color;
          if (mark.type.name === 'backgroundColor') marks.backgroundColor = mark.attrs.color;
        }
      }
    });
  }

  return marks;
}

/**
 * Check if selection should show bubble menu.
 */
function shouldShowMenu(
  state: EditorState,
  config: BubbleMenuConfig
): boolean {
  const { selection } = state;
  const { empty, from, to } = selection;
  const { minSelectionLength = 1, showOnNodeSelection = false } = config;

  // Don't show on empty selection
  if (empty) return false;

  // Check selection length
  if (to - from < minSelectionLength) return false;

  // Check if it's a node selection (image, embed, etc.)
  if (selection.constructor.name === 'NodeSelection') {
    if (!showOnNodeSelection) {
      return false;
    }
    // Even if showOnNodeSelection is true, exclude media nodes (they have their own menu)
    const node = (selection as { node?: { type?: { name?: string } } }).node;
    if (node?.type?.name === 'image' || node?.type?.name === 'embed') {
      return false;
    }
  }

  // Don't show in code blocks
  const $from = selection.$from;
  if ($from.parent.type.name === 'codeBlock') {
    return false;
  }

  // Don't show when cursor is inside an image or embed node
  // (in case of text selection that includes media)
  let hasMediaNode = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (node.type.name === 'image' || node.type.name === 'embed') {
      hasMediaNode = true;
      return false; // Stop iteration
    }
    return true;
  });
  if (hasMediaNode) {
    return false;
  }

  return true;
}

/**
 * Creates the bubble menu plugin.
 *
 * This plugin:
 * - Detects text selection
 * - Provides coordinates for menu positioning
 * - Tracks active formatting marks
 *
 * The actual menu UI is rendered by the framework adapter (React/Vue).
 *
 * @example
 * ```typescript
 * import { createBubbleMenuPlugin, BUBBLE_MENU_PLUGIN_KEY } from '@beakblock/core';
 *
 * const plugin = createBubbleMenuPlugin();
 *
 * // In React component:
 * const state = BUBBLE_MENU_PLUGIN_KEY.getState(editor.pm.state);
 * if (state?.visible) {
 *   // Render menu at state.coords
 * }
 * ```
 *
 * @param config - Plugin configuration
 * @returns A ProseMirror plugin
 */
export function createBubbleMenuPlugin(config: BubbleMenuConfig = {}): Plugin {
  return new Plugin<BubbleMenuState>({
    key: BUBBLE_MENU_PLUGIN_KEY,

    state: {
      init(): BubbleMenuState {
        return {
          visible: false,
          from: 0,
          to: 0,
          coords: null,
          activeMarks: {
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
            code: false,
            link: null,
            textColor: null,
            backgroundColor: null,
          },
          blockType: { type: 'paragraph', props: {} },
          textAlign: 'left',
        };
      },

      apply(tr, state, _oldEditorState, newEditorState): BubbleMenuState {
        // Check for explicit meta commands
        const meta = tr.getMeta(BUBBLE_MENU_PLUGIN_KEY);
        if (meta) {
          if (meta.hide) {
            return { ...state, visible: false, coords: null };
          }
          return { ...state, ...meta };
        }

        // Check if we should show the menu
        const shouldShow = shouldShowMenu(newEditorState, config);

        if (!shouldShow) {
          if (state.visible) {
            return { ...state, visible: false, coords: null };
          }
          return state;
        }

        const { from, to } = newEditorState.selection;
        const activeMarks = getActiveMarks(newEditorState);
        const blockType = getBlockType(newEditorState);
        const textAlign = getTextAlign(newEditorState);

        // Preserve coords if selection hasn't changed (e.g., when applying marks)
        const selectionUnchanged = state.from === from && state.to === to;
        const coords = selectionUnchanged ? state.coords : null;

        return {
          visible: true,
          from,
          to,
          coords,
          activeMarks,
          blockType,
          textAlign,
        };
      },
    },

    view(editorView) {
      let updateTimeout: ReturnType<typeof setTimeout> | null = null;
      const { showDelay = 0 } = config;

      const updateCoords = () => {
        const state = BUBBLE_MENU_PLUGIN_KEY.getState(editorView.state);
        if (!state?.visible) return;

        // Calculate position at the start of selection.
        // jsdom does not implement layout geometry, so skip positioning when unavailable.
        const { from } = editorView.state.selection;
        let start: { left: number; top: number; bottom: number } | null = null;
        try {
          start = editorView.coordsAtPos(from);
        } catch {
          start = null;
        }
        if (!start) return;

        // Position above selection, aligned to start
        const left = start.left;
        const top = start.top;
        const bottom = start.bottom;

        if (!state.coords || state.coords.left !== left || state.coords.top !== top) {
          editorView.dispatch(
            editorView.state.tr.setMeta(BUBBLE_MENU_PLUGIN_KEY, {
              coords: { left, top, bottom },
            })
          );
        }
      };

      return {
        update(view) {
          const state = BUBBLE_MENU_PLUGIN_KEY.getState(view.state);

          if (state?.visible && !state.coords) {
            if (showDelay > 0) {
              if (updateTimeout) clearTimeout(updateTimeout);
              updateTimeout = setTimeout(updateCoords, showDelay);
            } else {
              updateCoords();
            }
          }
        },

        destroy() {
          if (updateTimeout) clearTimeout(updateTimeout);
        },
      };
    },

    props: {
      handleDOMEvents: {
        // Hide on blur
        blur(view) {
          const state = BUBBLE_MENU_PLUGIN_KEY.getState(view.state);
          if (state?.visible) {
            // Use setTimeout to allow clicks on menu buttons
            setTimeout(() => {
              // Don't hide if focus moved to bubble menu, link popover, or color picker
              const activeElement = document.activeElement;
              const isInBubbleMenu = activeElement?.closest('.ob-bubble-menu');
              const isInLinkPopover = activeElement?.closest('.ob-link-popover');
              const isInColorPicker = activeElement?.closest('.ob-color-picker-dropdown');

              if (!view.hasFocus() && !isInBubbleMenu && !isInLinkPopover && !isInColorPicker) {
                view.dispatch(
                  view.state.tr.setMeta(BUBBLE_MENU_PLUGIN_KEY, { hide: true })
                );
              }
            }, 100);
          }
          return false;
        },
      },
    },
  });
}

/**
 * Hide the bubble menu programmatically.
 *
 * @param view - The editor view
 */
export function hideBubbleMenu(view: EditorView): void {
  view.dispatch(view.state.tr.setMeta(BUBBLE_MENU_PLUGIN_KEY, { hide: true }));
}

/**
 * Check if a mark is active in the current selection.
 *
 * @param state - Current bubble menu state
 * @param markName - Name of the mark to check
 * @returns Whether the mark is active
 */
export function isMarkActive(
  state: BubbleMenuState | undefined,
  markName: keyof BubbleMenuState['activeMarks']
): boolean {
  if (!state) return false;
  const value = state.activeMarks[markName];
  // For marks with string values (link, textColor, backgroundColor), check for null
  if (markName === 'link' || markName === 'textColor' || markName === 'backgroundColor') {
    return value !== null;
  }
  return Boolean(value);
}
