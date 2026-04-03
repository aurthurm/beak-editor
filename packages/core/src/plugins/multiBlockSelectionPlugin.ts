/**
 * MultiBlockSelectionPlugin - Plugin for selecting multiple blocks at once.
 *
 * Enables users to select entire blocks by clicking in the margin or using
 * keyboard shortcuts, then perform operations on all selected blocks.
 *
 * @module
 */

import { Plugin, PluginKey, EditorState } from 'prosemirror-state';
import { EditorView, Decoration, DecorationSet } from 'prosemirror-view';
import { Node as PMNode } from 'prosemirror-model';

/**
 * State for multi-block selection.
 */
export interface MultiBlockSelectionState {
  /** Whether multi-block selection is active */
  active: boolean;
  /** Positions of selected blocks (start positions) */
  selectedBlocks: number[];
  /** Anchor position for range selection */
  anchorPos: number | null;
}

/**
 * Plugin key for multi-block selection state.
 */
export const MULTI_BLOCK_SELECTION_KEY = new PluginKey<MultiBlockSelectionState>(
  'multiBlockSelection'
);

/**
 * Get the block node and its position at a given document position.
 */
function getBlockAtPos(
  doc: PMNode,
  pos: number
): { node: PMNode; pos: number; depth: number } | null {
  const $pos = doc.resolve(pos);

  // Walk up to find the top-level block (depth 1 = direct child of doc)
  for (let depth = $pos.depth; depth >= 1; depth--) {
    const node = $pos.node(depth);
    if (node.isBlock && depth === 1) {
      return {
        node,
        pos: $pos.before(depth),
        depth,
      };
    }
  }

  return null;
}

/**
 * Get all top-level block positions in the document.
 */
function getAllBlockPositions(doc: PMNode): number[] {
  const positions: number[] = [];

  doc.forEach((_node, offset) => {
    positions.push(offset);
  });

  return positions;
}

/**
 * Get blocks between two positions (inclusive).
 */
function getBlocksInRange(doc: PMNode, from: number, to: number): number[] {
  const positions: number[] = [];
  const allBlocks = getAllBlockPositions(doc);

  // Ensure from <= to
  const start = Math.min(from, to);
  const end = Math.max(from, to);

  for (const pos of allBlocks) {
    if (pos >= start && pos <= end) {
      positions.push(pos);
    }
  }

  return positions;
}

/**
 * Create decorations for selected blocks.
 */
function createBlockSelectionDecorations(
  state: EditorState,
  selectedBlocks: number[]
): DecorationSet {
  const decorations: Decoration[] = [];

  for (const pos of selectedBlocks) {
    const node = state.doc.nodeAt(pos);
    if (node) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: 'ob-block-selected',
        })
      );
    }
  }

  return DecorationSet.create(state.doc, decorations);
}

/**
 * Configuration for multi-block selection plugin.
 */
export interface MultiBlockSelectionConfig {
  /** Allow selecting blocks by clicking in the left margin */
  marginClickSelect?: boolean;
  /** Margin width in pixels for click detection */
  marginWidth?: number;
}

const defaultConfig: Required<MultiBlockSelectionConfig> = {
  marginClickSelect: true,
  marginWidth: 40,
};

/**
 * Create the multi-block selection plugin.
 */
export function createMultiBlockSelectionPlugin(
  config: MultiBlockSelectionConfig = {}
): Plugin<MultiBlockSelectionState> {
  const finalConfig = { ...defaultConfig, ...config };

  return new Plugin<MultiBlockSelectionState>({
    key: MULTI_BLOCK_SELECTION_KEY,

    state: {
      init(): MultiBlockSelectionState {
        return {
          active: false,
          selectedBlocks: [],
          anchorPos: null,
        };
      },

      apply(tr, state, _oldEditorState, newEditorState): MultiBlockSelectionState {
        // Check for meta to update state
        const meta = tr.getMeta(MULTI_BLOCK_SELECTION_KEY);
        if (meta) {
          return meta;
        }

        // If document changed, try to map positions
        if (tr.docChanged && state.selectedBlocks.length > 0) {
          const mappedBlocks: number[] = [];
          for (const pos of state.selectedBlocks) {
            const mappedPos = tr.mapping.map(pos);
            // Verify block still exists at mapped position
            const node = newEditorState.doc.nodeAt(mappedPos);
            if (node && node.isBlock) {
              mappedBlocks.push(mappedPos);
            }
          }

          if (mappedBlocks.length !== state.selectedBlocks.length) {
            return {
              ...state,
              selectedBlocks: mappedBlocks,
              active: mappedBlocks.length > 0,
            };
          }

          return { ...state, selectedBlocks: mappedBlocks };
        }

        return state;
      },
    },

    props: {
      decorations(state): DecorationSet {
        const pluginState = MULTI_BLOCK_SELECTION_KEY.getState(state);
        if (!pluginState || !pluginState.active || pluginState.selectedBlocks.length === 0) {
          return DecorationSet.empty;
        }
        return createBlockSelectionDecorations(state, pluginState.selectedBlocks);
      },

      handleClick(view: EditorView, _pos: number, event: MouseEvent): boolean {
        // Clear selection on regular click without modifiers
        if (!event.shiftKey && !event.metaKey && !event.ctrlKey) {
          const state = MULTI_BLOCK_SELECTION_KEY.getState(view.state);
          if (state?.active) {
            view.dispatch(
              view.state.tr.setMeta(MULTI_BLOCK_SELECTION_KEY, {
                active: false,
                selectedBlocks: [],
                anchorPos: null,
              })
            );
          }
        }
        return false;
      },

      handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
        const state = MULTI_BLOCK_SELECTION_KEY.getState(view.state);

        // Escape clears multi-block selection
        if (event.key === 'Escape' && state?.active) {
          view.dispatch(
            view.state.tr.setMeta(MULTI_BLOCK_SELECTION_KEY, {
              active: false,
              selectedBlocks: [],
              anchorPos: null,
            })
          );
          return true;
        }

        // Cmd/Ctrl+A to select all blocks
        if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
          // If already has text selection spanning whole doc, select all blocks
          const { from, to } = view.state.selection;
          const docSize = view.state.doc.content.size;

          if (from === 0 && to === docSize) {
            const allBlocks = getAllBlockPositions(view.state.doc);
            view.dispatch(
              view.state.tr.setMeta(MULTI_BLOCK_SELECTION_KEY, {
                active: true,
                selectedBlocks: allBlocks,
                anchorPos: allBlocks[0] ?? null,
              })
            );
            return true;
          }
        }

        // Delete/Backspace removes selected blocks
        if ((event.key === 'Delete' || event.key === 'Backspace') && state?.active && state.selectedBlocks.length > 0) {
          deleteSelectedBlocks(view);
          return true;
        }

        return false;
      },

      handleDOMEvents: {
        mousedown(view: EditorView, event: MouseEvent): boolean {
          if (!finalConfig.marginClickSelect) return false;

          // Check if click is in the left margin
          const editorRect = view.dom.getBoundingClientRect();
          const clickX = event.clientX - editorRect.left;

          if (clickX > finalConfig.marginWidth) return false;

          // Get the block at this position
          const coords = { left: event.clientX, top: event.clientY };
          const posInfo = view.posAtCoords(coords);
          if (!posInfo) return false;

          const block = getBlockAtPos(view.state.doc, posInfo.pos);
          if (!block) return false;

          const state = MULTI_BLOCK_SELECTION_KEY.getState(view.state);

          if (event.shiftKey && state && state.anchorPos !== null) {
            // Range selection
            const blocks = getBlocksInRange(view.state.doc, state.anchorPos, block.pos);
            view.dispatch(
              view.state.tr.setMeta(MULTI_BLOCK_SELECTION_KEY, {
                active: true,
                selectedBlocks: blocks,
                anchorPos: state.anchorPos,
              })
            );
          } else if (event.metaKey || event.ctrlKey) {
            // Toggle selection
            const currentBlocks = state?.selectedBlocks || [];
            const isSelected = currentBlocks.includes(block.pos);
            const newBlocks = isSelected
              ? currentBlocks.filter((p) => p !== block.pos)
              : [...currentBlocks, block.pos];

            view.dispatch(
              view.state.tr.setMeta(MULTI_BLOCK_SELECTION_KEY, {
                active: newBlocks.length > 0,
                selectedBlocks: newBlocks,
                anchorPos: block.pos,
              })
            );
          } else {
            // Single block selection
            view.dispatch(
              view.state.tr.setMeta(MULTI_BLOCK_SELECTION_KEY, {
                active: true,
                selectedBlocks: [block.pos],
                anchorPos: block.pos,
              })
            );
          }

          event.preventDefault();
          return true;
        },
      },
    },
  });
}

/**
 * Delete all selected blocks.
 */
function deleteSelectedBlocks(view: EditorView): void {
  const state = MULTI_BLOCK_SELECTION_KEY.getState(view.state);
  if (!state || state.selectedBlocks.length === 0) return;

  // Sort positions in reverse order to delete from end to start
  const positions = [...state.selectedBlocks].sort((a, b) => b - a);

  let tr = view.state.tr;

  for (const pos of positions) {
    const node = tr.doc.nodeAt(pos);
    if (node) {
      tr = tr.delete(pos, pos + node.nodeSize);
    }
  }

  // Clear selection state
  tr = tr.setMeta(MULTI_BLOCK_SELECTION_KEY, {
    active: false,
    selectedBlocks: [],
    anchorPos: null,
  });

  view.dispatch(tr);
}

/**
 * Select a block programmatically.
 */
export function selectBlock(view: EditorView, pos: number, addToSelection = false): void {
  const block = getBlockAtPos(view.state.doc, pos);
  if (!block) return;

  const state = MULTI_BLOCK_SELECTION_KEY.getState(view.state);
  const currentBlocks = addToSelection ? state?.selectedBlocks || [] : [];

  view.dispatch(
    view.state.tr.setMeta(MULTI_BLOCK_SELECTION_KEY, {
      active: true,
      selectedBlocks: [...currentBlocks, block.pos],
      anchorPos: block.pos,
    })
  );
}

/**
 * Clear multi-block selection.
 */
export function clearBlockSelection(view: EditorView): void {
  view.dispatch(
    view.state.tr.setMeta(MULTI_BLOCK_SELECTION_KEY, {
      active: false,
      selectedBlocks: [],
      anchorPos: null,
    })
  );
}

/**
 * Get currently selected block positions.
 */
export function getSelectedBlocks(state: EditorState): number[] {
  const pluginState = MULTI_BLOCK_SELECTION_KEY.getState(state);
  return pluginState?.selectedBlocks || [];
}

/**
 * Check if multi-block selection is active.
 */
export function isMultiBlockSelectionActive(state: EditorState): boolean {
  const pluginState = MULTI_BLOCK_SELECTION_KEY.getState(state);
  return pluginState?.active || false;
}
