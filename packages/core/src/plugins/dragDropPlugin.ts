/**
 * Drag and Drop Plugin for BeakBlock.
 *
 * Enables block-level drag and drop with visual handles,
 * plus an "add block" button similar to Notion/BlockNote.
 * Uses a single floating side menu that positions on the hovered block.
 *
 * @module
 */

import { Plugin, PluginKey, EditorState, TextSelection } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { Node as PMNode } from 'prosemirror-model';
import { SLASH_MENU_PLUGIN_KEY } from './slashMenuPlugin';
import { COMPLIANCE_LOCK_BYPASS_META, nodeIsComplianceLocked } from './complianceLockPlugin';

/**
 * Plugin key for accessing drag/drop state.
 */
export const DRAG_DROP_PLUGIN_KEY = new PluginKey<DragDropState>('dragDrop');

/**
 * State for the drag/drop plugin.
 */
export interface DragDropState {
  /** Position of the block being dragged, or null if not dragging */
  dragging: number | null;
  /** Position where the block would be dropped */
  dropTarget: number | null;
  /** Position of the hovered block */
  hoveredBlockPos: number | null;
  /** Block ID being hovered (for showing handle) */
  hoveredBlockId: string | null;
}

/**
 * Configuration for the drag/drop plugin.
 */
export interface DragDropConfig {
  /**
   * Whether to show drag handles.
   * @default true
   */
  showHandles?: boolean;

  /**
   * Whether to show add block button.
   * @default true
   */
  showAddButton?: boolean;

  /**
   * CSS class for the side menu element.
   * @default 'ob-side-menu'
   */
  sideMenuClass?: string;

  /**
   * CSS class for the drag handle element.
   * @default 'ob-drag-handle'
   */
  handleClass?: string;

  /**
   * CSS class for the add button element.
   * @default 'ob-add-button'
   */
  addButtonClass?: string;

  /**
   * Callback when a block is dropped.
   */
  onDrop?: (fromPos: number, toPos: number) => void;

  /**
   * Callback when add button is clicked.
   * If not provided, opens the slash menu.
   */
  onAddClick?: (pos: number, view: EditorView) => void;

  /**
   * When false, the drag handle is hidden for compliance-locked blocks (`attrs.locked`).
   * @default true
   */
  allowLockedBlockDrag?: boolean;

  /**
   * Side-menu lock control beside the drag handle.
   * - `locked-only`: show for any compliance-locked block (default).
   * - `all-headings`: show for every heading (locked and unlocked); click toggles `attrs.locked`
   *   (uses {@link COMPLIANCE_LOCK_BYPASS_META}). Level-2 headings without `lockId` get one when locked.
   */
  headingLockBadge?: 'locked-only' | 'all-headings';
}

/**
 * Creates the drag/drop plugin.
 *
 * This plugin adds:
 * - A side menu with add button (+) and drag handle (6 dots) on each block
 * - Mouse event handling for drag operations
 * - Visual feedback during drag
 *
 * @example
 * ```typescript
 * import { createDragDropPlugin } from '@beakblock/core';
 *
 * const plugin = createDragDropPlugin({
 *   showHandles: true,
 *   showAddButton: true,
 *   onDrop: (from, to) => console.log(`Moved block from ${from} to ${to}`),
 * });
 * ```
 *
 * @param config - Plugin configuration
 * @returns A ProseMirror plugin
 */
export function createDragDropPlugin(config: DragDropConfig = {}): Plugin {
  const {
    showHandles = true,
    showAddButton = true,
    sideMenuClass = 'ob-side-menu',
    handleClass = 'ob-drag-handle',
    addButtonClass = 'ob-add-button',
    onAddClick,
    onDrop,
    allowLockedBlockDrag = true,
    headingLockBadge = 'locked-only',
  } = config;

  // Single side menu element that gets repositioned
  let sideMenuEl: HTMLElement | null = null;
  let editorView: EditorView | null = null;

  // Drag state
  let draggedBlockPos: number | null = null;

  /**
   * Create the side menu element once.
   */
  function createSideMenuElement(): HTMLElement {
    const menu = document.createElement('div');
    menu.className = sideMenuClass;
    menu.setAttribute('contenteditable', 'false');

    const lockBadge = document.createElement('span');
    lockBadge.className = 'ob-block-lock-badge';
    lockBadge.setAttribute('contenteditable', 'false');
    lockBadge.setAttribute('role', 'presentation');
    lockBadge.style.display = 'none';

    function svgIcon(parts: Array<{ tag: 'path' | 'rect'; d?: string; attrs?: Record<string, string> }>): SVGSVGElement {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '14');
      svg.setAttribute('height', '14');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      for (const p of parts) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', p.tag);
        if (p.tag === 'path' && p.d) {
          el.setAttribute('d', p.d);
        }
        if (p.attrs) {
          for (const [k, v] of Object.entries(p.attrs)) {
            el.setAttribute(k, v);
          }
        }
        svg.appendChild(el);
      }
      return svg;
    }

    const lockSvgLocked = svgIcon([
      { tag: 'path', d: 'M7 11V7a5 5 0 0 1 10 0v4' },
      {
        tag: 'rect',
        attrs: { x: '3', y: '11', width: '18', height: '11', rx: '2', ry: '2' },
      },
    ]);
    lockSvgLocked.classList.add('ob-block-lock-badge__icon--locked');

    const lockSvgUnlocked = svgIcon([
      { tag: 'path', d: 'M7 11V7a5 5 0 0 1 9.9-1' },
      {
        tag: 'rect',
        attrs: { x: '3', y: '11', width: '18', height: '11', rx: '2', ry: '2' },
      },
    ]);
    lockSvgUnlocked.classList.add('ob-block-lock-badge__icon--unlocked');
    lockSvgUnlocked.style.display = 'none';

    lockBadge.appendChild(lockSvgLocked);
    lockBadge.appendChild(lockSvgUnlocked);

    lockBadge.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (!lockBadge.classList.contains('ob-block-lock-badge--interactive')) return;
      e.preventDefault();
      e.stopPropagation();
      if (!editorView || !editorView.editable) return;
      const pos = parseInt(menu.dataset.blockPos || '-1', 10);
      if (pos < 0) return;
      const node = editorView.state.doc.nodeAt(pos);
      if (!node || node.type.name !== 'heading') return;

      const wasLocked = nodeIsComplianceLocked(node);
      const nextLocked = !wasLocked;
      const attrs = { ...(node.attrs as Record<string, unknown>) } as Record<string, unknown>;
      if (nextLocked) {
        attrs.locked = true;
        attrs.lockReason = attrs.lockReason ?? 'Required section heading (controlled document)';
        const level = Number(attrs.level);
        if (level >= 1 && level <= 3 && (!attrs.lockId || String(attrs.lockId).length === 0)) {
          attrs.lockId =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `lock-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }
      } else {
        attrs.locked = false;
      }

      const tr = editorView.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
      tr.setMeta(COMPLIANCE_LOCK_BYPASS_META, true);
      editorView.dispatch(tr);
    });

    menu.appendChild(lockBadge);

    // Add button (+)
    if (showAddButton) {
      const addBtn = document.createElement('button');
      addBtn.className = addButtonClass;
      addBtn.type = 'button';
      addBtn.setAttribute('tabindex', '-1');
      addBtn.setAttribute('aria-label', 'Add block');
      addBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
          <path d="M7 2v10M2 7h10"/>
        </svg>
      `;

      addBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!editorView) return;

        const pos = parseInt(menu.dataset.blockPos || '0', 10);

        if (onAddClick) {
          onAddClick(pos, editorView);
        } else {
          handleAddBlockClick(pos, editorView);
        }
      });

      menu.appendChild(addBtn);
    }

    // Drag handle (6 dots)
    if (showHandles) {
      const handle = document.createElement('div');
      handle.className = handleClass;
      handle.setAttribute('data-drag-handle', 'true');

      handle.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style="pointer-events: none;">
          <circle cx="4" cy="3" r="1.5"/>
          <circle cx="10" cy="3" r="1.5"/>
          <circle cx="4" cy="7" r="1.5"/>
          <circle cx="10" cy="7" r="1.5"/>
          <circle cx="4" cy="11" r="1.5"/>
          <circle cx="10" cy="11" r="1.5"/>
        </svg>
      `;

      // Use mouse events for custom drag implementation
      handle.addEventListener('mousedown', (e) => {
        // Only handle left click
        if (e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();

        if (!editorView) return;

        const pos = parseInt(menu.dataset.blockPos || '0', 10);
        draggedBlockPos = pos;

        // Hide side menu during drag
        sideMenuEl?.classList.remove(`${sideMenuClass}--visible`);

        // Add class to handle and body for cursor
        handle.classList.add(`${handleClass}--dragging`);
        document.body.style.cursor = 'grabbing';
      });

      menu.appendChild(handle);
    }

    return menu;
  }

  /**
   * Update side menu position based on hovered block.
   */
  function updateSideMenuPosition(view: EditorView, blockPos: number | null): void {
    if (!sideMenuEl) return;

    if (blockPos === null) {
      sideMenuEl.classList.remove(`${sideMenuClass}--visible`);
      return;
    }

    // Get the DOM node for the block
    const node = view.state.doc.nodeAt(blockPos);
    if (!node) {
      sideMenuEl.classList.remove(`${sideMenuClass}--visible`);
      return;
    }

    // Get the actual DOM element for this block to position correctly inside columns
    const blockId = node.attrs.id;
    const blockEl = blockId
      ? (view.dom.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null)
      : null;

    const editorRect = view.dom.getBoundingClientRect();
    let top: number;
    let left: number;

    const locked = nodeIsComplianceLocked(node);
    const isHeading = node.type.name === 'heading';
    const showLockBadge =
      (isHeading && headingLockBadge === 'all-headings') || (headingLockBadge === 'locked-only' && locked);
    const lockBadgeEl = sideMenuEl.querySelector('.ob-block-lock-badge') as HTMLElement | null;
    if (lockBadgeEl) {
      lockBadgeEl.style.display = showLockBadge ? 'flex' : 'none';
      const reason = node.attrs.lockReason;
      const headingInteractive = isHeading && (headingLockBadge === 'all-headings' || locked);
      if (headingInteractive) {
        lockBadgeEl.classList.add('ob-block-lock-badge--interactive');
        lockBadgeEl.setAttribute('role', 'button');
        lockBadgeEl.setAttribute('tabindex', '-1');
        lockBadgeEl.setAttribute(
          'aria-label',
          locked ? 'Unlock heading' : 'Lock heading'
        );
      } else {
        lockBadgeEl.classList.remove('ob-block-lock-badge--interactive');
        lockBadgeEl.setAttribute('role', 'presentation');
        lockBadgeEl.removeAttribute('tabindex');
        lockBadgeEl.removeAttribute('aria-label');
      }
      const lockedIcon = lockBadgeEl.querySelector('.ob-block-lock-badge__icon--locked') as SVGSVGElement | null;
      const unlockedIcon = lockBadgeEl.querySelector('.ob-block-lock-badge__icon--unlocked') as SVGSVGElement | null;
      if (headingLockBadge === 'all-headings' && isHeading && lockedIcon && unlockedIcon) {
        lockedIcon.style.display = locked ? '' : 'none';
        unlockedIcon.style.display = locked ? 'none' : '';
      } else if (lockedIcon && unlockedIcon) {
        lockedIcon.style.display = '';
        unlockedIcon.style.display = 'none';
      }
      if (showLockBadge) {
        lockBadgeEl.title = locked
          ? reason
            ? String(reason)
            : 'Read-only — click to unlock'
          : 'Click to lock this heading';
      } else {
        lockBadgeEl.title = '';
      }
    }

    if (showHandles) {
      const handleEl = sideMenuEl.querySelector(`.${handleClass}`) as HTMLElement | null;
      if (handleEl) {
        const canDrag = !locked || allowLockedBlockDrag;
        handleEl.style.display = canDrag ? '' : 'none';
      }
    }

    if (blockEl) {
      if (blockEl.closest('.ob-column')) {
        sideMenuEl.classList.remove(`${sideMenuClass}--visible`);
        return;
      }

      // Use the actual DOM element's position
      const blockRect = blockEl.getBoundingClientRect();
      top = blockRect.top - editorRect.top;

      // Check if block is inside a list (nested content)
      const listEl = blockEl.closest('ul, ol') as HTMLElement | null;
      const isNestedInList = listEl && !listEl.classList.contains('beakblock-checklist');

      const menuWidth = Math.ceil(sideMenuEl.getBoundingClientRect().width) || 40;

      if (isNestedInList) {
        // For blocks inside lists, position at the editor's left margin
        // Lists have padding-left which shifts content, so we position at the fixed left margin
        left = 8;
      } else {
        // For top-level blocks, position to the left of the block
        left = blockRect.left - editorRect.left - menuWidth - 4; // 4px gap between menu and text

        // Ensure menu stays within editor bounds (minimum 4px from left edge)
        left = Math.max(4, left);
      }
    } else {
      // Fallback to coords from position
      const coords = view.coordsAtPos(blockPos);
      top = coords.top - editorRect.top;
      // Default to left margin area
      left = 8;
    }

    sideMenuEl.style.top = `${top}px`;
    sideMenuEl.style.left = `${left}px`;
    sideMenuEl.dataset.blockPos = String(blockPos);
    sideMenuEl.classList.add(`${sideMenuClass}--visible`);
  }

  // Cache for block positions to avoid repeated doc.descendants calls
  const blockPosCache: Map<string, number> = new Map();
  let lastDocVersion: number = -1;

  /**
   * Update the block position cache when document changes.
   */
  function updateBlockPosCache(view: EditorView): void {
    const docVersion = view.state.doc.content.size;
    if (docVersion === lastDocVersion) return;

    lastDocVersion = docVersion;
    blockPosCache.clear();

    view.state.doc.descendants((node: PMNode, pos: number) => {
      if (node.attrs.id) {
        blockPosCache.set(node.attrs.id, pos);
      }
      return true;
    });
  }

  /**
   * Find block position from DOM element.
   * Uses a cached map to avoid repeated doc.descendants calls on mousemove.
   * Returns null if the block is inside a table (to hide side menu in tables).
   */
  function findBlockPos(view: EditorView, target: HTMLElement): { pos: number; id: string } | null {
    const blockEl = target.closest('[data-block-id]') as HTMLElement | null;
    if (!blockEl) return null;

    if (blockEl.closest('.ob-column')) {
      return null;
    }

    // Don't show side menu for blocks inside tables
    if (blockEl.closest('table, .ob-table, [data-node-type="table"]')) {
      return null;
    }

    const blockId = blockEl.getAttribute('data-block-id');
    if (!blockId) return null;

    // Use cached position if available
    const cachedPos = blockPosCache.get(blockId);
    if (cachedPos !== undefined) {
      return { pos: cachedPos, id: blockId };
    }

    // Fallback: update cache and try again
    updateBlockPosCache(view);
    const pos = blockPosCache.get(blockId);
    if (pos === undefined) return null;

    return { pos, id: blockId };
  }

  // Event handlers stored for cleanup
  let handleMouseMove: ((event: MouseEvent) => void) | null = null;
  let handleDragOver: ((event: DragEvent) => void) | null = null;
  let handleDrop: ((event: DragEvent) => void) | null = null;

  // Timer for delayed hiding of side menu
  let hideMenuTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Ensure side menu is created and attached to DOM.
   */
  function ensureSideMenu(view: EditorView): void {
    if (sideMenuEl) return;

    const parent = view.dom.parentElement;
    if (!parent) return;

    // Create and append the side menu
    sideMenuEl = createSideMenuElement();
    parent.appendChild(sideMenuEl);

    // Function to schedule hiding the menu with a delay
    const scheduleHideMenu = () => {
      if (hideMenuTimer) {
        clearTimeout(hideMenuTimer);
      }
      hideMenuTimer = setTimeout(() => {
        // Only dispatch if there's actually a hovered block to clear
        const currentState = DRAG_DROP_PLUGIN_KEY.getState(view.state);
        if (currentState?.hoveredBlockPos !== null) {
          view.dispatch(
            view.state.tr.setMeta(DRAG_DROP_PLUGIN_KEY, {
              hoveredBlockPos: null,
              hoveredBlockId: null,
            })
          );
        }
        hideMenuTimer = null;
      }, 150); // 150ms delay before hiding
    };

    // Function to cancel hiding
    const cancelHideMenu = () => {
      if (hideMenuTimer) {
        clearTimeout(hideMenuTimer);
        hideMenuTimer = null;
      }
    };

    // Add mousemove listener to the editor
    handleMouseMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check if we're over the side menu itself
      if (sideMenuEl?.contains(target)) {
        cancelHideMenu();
        return;
      }

      // Check if cursor is in the "menu zone" (left padding area where menu appears)
      // If so, keep the current hovered block to prevent menu from jumping
      const currentState = DRAG_DROP_PLUGIN_KEY.getState(view.state);
      if (currentState?.hoveredBlockId && sideMenuEl) {
        const menuRect = sideMenuEl.getBoundingClientRect();
        // Check if cursor is horizontally within or near the menu area
        // and vertically close to the current menu position
        const isInMenuZone =
          event.clientX < menuRect.right + 20 && // Within or to the left of menu + some margin
          event.clientY >= menuRect.top - 10 &&
          event.clientY <= menuRect.bottom + 10;

        if (isInMenuZone) {
          cancelHideMenu();
          return; // Keep current block, don't update
        }
      }

      const blockInfo = findBlockPos(view, target);

      if (blockInfo) {
        cancelHideMenu();
        if (currentState?.hoveredBlockPos !== blockInfo.pos) {
          view.dispatch(
            view.state.tr.setMeta(DRAG_DROP_PLUGIN_KEY, {
              hoveredBlockPos: blockInfo.pos,
              hoveredBlockId: blockInfo.id,
            })
          );
        }
      } else {
        // Not over a block, schedule hide
        scheduleHideMenu();
      }
    };

    view.dom.addEventListener('mousemove', handleMouseMove);

    // Keep menu visible when hovering over it
    sideMenuEl.addEventListener('mouseenter', cancelHideMenu);
    sideMenuEl.addEventListener('mouseleave', () => {
      scheduleHideMenu();
    });

    // Mouse move for drag - find drop target (custom drag implementation)
    handleDragOver = ((event: MouseEvent) => {
      if (draggedBlockPos === null) return;

      // Get position from coordinates
      const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
      if (!pos) return;

      // Find the block at this position
      const $pos = view.state.doc.resolve(pos.pos);
      let blockPos: number | null = null;
      let blockNode = null;

      // Find the nearest block that can be a drop target
      // Walk up from current depth to find a suitable block
      for (let depth = $pos.depth; depth >= 1; depth--) {
        const node = $pos.node(depth);
        const parentNode = depth > 1 ? $pos.node(depth - 1) : view.state.doc;

        // Skip inline nodes and column nodes (we want blocks inside columns, not columns themselves)
        if (!node.isBlock || node.type.name === 'column' || node.type.name === 'columnList') {
          continue;
        }

        // Check if parent allows block content (doc, column, blockquote, etc.)
        const parentName = parentNode.type.name;
        if (parentName === 'doc' || parentName === 'column' || parentName === 'blockquote' || parentName === 'listItem') {
          blockPos = $pos.before(depth);
          blockNode = node;
          break;
        }
      }

      if (blockPos === null || !blockNode) return;
      if (blockPos === draggedBlockPos) return; // Same block

      const draggedNode = view.state.doc.nodeAt(draggedBlockPos);
      if (!draggedNode) return;

      // Get coordinates of the target block to determine above/below
      const blockCoords = view.coordsAtPos(blockPos);
      const blockEndCoords = view.coordsAtPos(blockPos + blockNode.nodeSize);
      const midY = (blockCoords.top + blockEndCoords.bottom) / 2;
      const isAbove = event.clientY < midY;

      // Calculate drop position
      let dropTarget: number;
      if (isAbove) {
        dropTarget = blockPos;
      } else {
        dropTarget = blockPos + blockNode.nodeSize;
      }

      // Don't show indicator if dropping at same position
      const wouldMoveUp = dropTarget < draggedBlockPos;
      const wouldMoveDown = dropTarget > draggedBlockPos + draggedNode.nodeSize;

      if (wouldMoveUp || wouldMoveDown) {
        const currentState = DRAG_DROP_PLUGIN_KEY.getState(view.state);
        if (currentState?.dropTarget !== dropTarget) {
          view.dispatch(
            view.state.tr.setMeta(DRAG_DROP_PLUGIN_KEY, {
              dropTarget,
            })
          );
        }
      } else {
        // Clear drop target if same position
        const currentState = DRAG_DROP_PLUGIN_KEY.getState(view.state);
        if (currentState?.dropTarget !== null) {
          view.dispatch(
            view.state.tr.setMeta(DRAG_DROP_PLUGIN_KEY, {
              dropTarget: null,
            })
          );
        }
      }
    }) as unknown as (event: DragEvent) => void;

    // Mouse up - drop the block
    handleDrop = (() => {
      // Reset cursor
      document.body.style.cursor = '';

      if (draggedBlockPos === null) return;

      const currentState = DRAG_DROP_PLUGIN_KEY.getState(view.state);
      const dropTarget = currentState?.dropTarget;

      if (dropTarget != null && dropTarget !== draggedBlockPos) {
        // Call onDrop callback if provided
        if (onDrop) {
          onDrop(draggedBlockPos, dropTarget);
        }

        // Move the block
        moveBlock(view, draggedBlockPos, dropTarget);
      }

      // Clear state
      draggedBlockPos = null;
      view.dispatch(
        view.state.tr.setMeta(DRAG_DROP_PLUGIN_KEY, {
          dragging: null,
          dropTarget: null,
        })
      );

      // Remove dragging class from handle
      const dragHandle = sideMenuEl?.querySelector(`.${handleClass}`);
      dragHandle?.classList.remove(`${handleClass}--dragging`);
    }) as unknown as (event: DragEvent) => void;

    // Attach mouse event listeners to document for drag
    document.addEventListener('mousemove', handleDragOver as unknown as (event: MouseEvent) => void);
    document.addEventListener('mouseup', handleDrop as unknown as () => void);
  }

  return new Plugin<DragDropState>({
    key: DRAG_DROP_PLUGIN_KEY,

    view(view) {
      editorView = view;

      // Try to create side menu immediately if parent exists
      ensureSideMenu(view);

      // If parent wasn't available yet, try again after a frame
      if (!sideMenuEl) {
        requestAnimationFrame(() => {
          ensureSideMenu(view);
        });
      }

      return {
        update(view) {
          // Update block position cache when document changes
          updateBlockPosCache(view);

          // Ensure side menu exists (may not have been created if editor wasn't mounted)
          ensureSideMenu(view);

          const state = DRAG_DROP_PLUGIN_KEY.getState(view.state);
          updateSideMenuPosition(view, state?.hoveredBlockPos ?? null);
        },

        destroy() {
          if (handleMouseMove) {
            view.dom.removeEventListener('mousemove', handleMouseMove);
          }
          if (handleDragOver) {
            document.removeEventListener('mousemove', handleDragOver as unknown as (event: MouseEvent) => void);
          }
          if (handleDrop) {
            document.removeEventListener('mouseup', handleDrop as unknown as () => void);
          }
          if (hideMenuTimer) {
            clearTimeout(hideMenuTimer);
            hideMenuTimer = null;
          }
          sideMenuEl?.remove();
          sideMenuEl = null;
          editorView = null;
          handleMouseMove = null;
          handleDragOver = null;
          handleDrop = null;
          draggedBlockPos = null;
          blockPosCache.clear();
          lastDocVersion = -1;
        },
      };
    },

    state: {
      init(): DragDropState {
        return {
          dragging: null,
          dropTarget: null,
          hoveredBlockPos: null,
          hoveredBlockId: null,
        };
      },

      apply(tr, state): DragDropState {
        const meta = tr.getMeta(DRAG_DROP_PLUGIN_KEY);
        if (meta) {
          return { ...state, ...meta };
        }
        return state;
      },
    },

    props: {
      decorations(state: EditorState): DecorationSet | null {
        const pluginState = DRAG_DROP_PLUGIN_KEY.getState(state);
        const decorations: Decoration[] = [];

        // Add dragging class to the node being dragged
        if (pluginState?.dragging != null) {
          const node = state.doc.nodeAt(pluginState.dragging);
          if (node) {
            decorations.push(
              Decoration.node(pluginState.dragging, pluginState.dragging + node.nodeSize, {
                class: 'ob-block-dragging',
              })
            );
          }
        }

        // Add drop indicator
        if (pluginState?.dropTarget != null) {
          const dropIndicator = Decoration.widget(
            pluginState.dropTarget,
            () => createDropIndicator(),
            { side: -1, key: 'drop-indicator' }
          );
          decorations.push(dropIndicator);
        }

        if (decorations.length === 0) return null;
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

/**
 * Default handler for add button click.
 * Opens the slash menu next to the + button.
 * The actual block insertion happens when a menu item is selected.
 */
function handleAddBlockClick(pos: number, view: EditorView): void {
  const { state } = view;
  const node = state.doc.nodeAt(pos);

  if (!node) return;

  // Calculate position at the end of the current block's content
  // pos is the start of the block, pos + node.nodeSize - 1 is the end (before closing tag)
  const endOfBlockPos = pos + node.nodeSize - 1;

  // Set selection to the end of the block
  const tr = state.tr.setSelection(TextSelection.create(state.doc, endOfBlockPos));
  view.dispatch(tr);
  view.focus();

  // Open the slash menu at the START of the block (next to + button)
  // Store the block position so menu actions know where to insert
  setTimeout(() => {
    // Use block start position for menu coords (where the + button is)
    const coords = view.coordsAtPos(pos + 1); // +1 to get inside the block

    view.dispatch(
      view.state.tr.setMeta(SLASH_MENU_PLUGIN_KEY, {
        active: true,
        query: '',
        triggerPos: endOfBlockPos,
        coords: { left: coords.left, top: coords.top, bottom: coords.bottom },
        // Custom flag to indicate this was opened via add button
        insertAfterBlock: pos,
      })
    );
  }, 0);
}


/**
 * Creates a drop indicator DOM element.
 */
function createDropIndicator(): HTMLElement {
  const indicator = document.createElement('div');
  indicator.className = 'ob-drop-indicator';
  return indicator;
}

/**
 * Helper to get block position from a drag handle element.
 *
 * @param view - The editor view
 * @param handle - The drag handle element
 * @returns The position of the block, or null if not found
 */
export function getBlockPosFromHandle(
  view: EditorView,
  handle: HTMLElement
): number | null {
  const pos = view.posAtDOM(handle, 0);
  if (pos === null) return null;

  // Find the block node at this position
  const $pos = view.state.doc.resolve(pos);
  return $pos.before($pos.depth);
}

/**
 * Move a block from one position to another.
 *
 * @param view - The editor view
 * @param fromPos - Source block position
 * @param toPos - Target position
 */
export function moveBlock(
  view: EditorView,
  fromPos: number,
  toPos: number
): void {
  const { state } = view;
  const node = state.doc.nodeAt(fromPos);

  if (!node) return;

  const tr = state.tr;

  // If moving down, we need to adjust the target position
  // because deleting the source will shift positions
  const adjustedToPos = toPos > fromPos ? toPos - node.nodeSize : toPos;

  // Delete the block from its current position
  tr.delete(fromPos, fromPos + node.nodeSize);

  // Insert at the new position
  tr.insert(adjustedToPos, node);

  view.dispatch(tr);
}
