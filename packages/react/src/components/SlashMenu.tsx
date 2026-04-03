/**
 * SlashMenu - React component for the "/" command palette.
 *
 * Renders a floating menu when the user types "/" at the start of a block.
 * Allows inserting various block types (headings, lists, quotes, etc.).
 *
 * ## Basic Usage
 *
 * @example
 * ```tsx
 * import { useBeakBlock, BeakBlockView, SlashMenu } from '@beakblock/react';
 *
 * function MyEditor() {
 *   const editor = useBeakBlock();
 *
 *   return (
 *     <BeakBlockView editor={editor}>
 *       <SlashMenu editor={editor} />
 *     </BeakBlockView>
 *   );
 * }
 * ```
 *
 * ## Custom Items
 *
 * Add custom commands to the slash menu using `customItems`.
 *
 * @example Adding an AI writing assistant
 * ```tsx
 * import { SlashMenu, SlashMenuItem } from '@beakblock/react';
 *
 * const aiWriteItem: SlashMenuItem = {
 *   id: 'ai-write',
 *   title: 'AI Write',
 *   description: 'Let AI continue writing',
 *   icon: 'sparkles',
 *   keywords: ['ai', 'write', 'generate', 'assistant'],
 *   group: 'ai',
 *   action: (view, state) => {
 *     // Your AI writing logic here
 *   },
 * };
 *
 * <SlashMenu
 *   editor={editor}
 *   customItems={[aiWriteItem]}
 * />
 * ```
 *
 * ## Hiding Default Items
 *
 * Use `hideItems` to remove specific default items.
 *
 * @example Hide embed and YouTube items
 * ```tsx
 * <SlashMenu
 *   editor={editor}
 *   hideItems={['embed', 'youtube', 'columns']}
 * />
 * ```
 *
 * ## Custom Item Order
 *
 * Use `itemOrder` to control which items appear and in what order.
 * Items not in the list will be hidden.
 *
 * @example Custom order with groups
 * ```tsx
 * <SlashMenu
 *   editor={editor}
 *   customItems={[aiWriteItem]}
 *   itemOrder={[
 *     'heading1', 'heading2', 'heading3',
 *     'paragraph',
 *     'bulletList', 'numberedList', 'checklist',
 *     'ai-write',  // Custom item
 *     'quote', 'codeBlock',
 *   ]}
 * />
 * ```
 *
 * ## Available Default Items
 *
 * Default item IDs include:
 * - `heading1`, `heading2`, `heading3` - Headings
 * - `paragraph` - Normal text
 * - `bulletList`, `numberedList` - Lists
 * - `checklist` - To-do list
 * - `quote` - Blockquote
 * - `codeBlock` - Code block
 * - `divider` - Horizontal rule
 * - `image` - Image block
 * - `table` - Table
 * - `columns` - Multi-column layout
 * - `callout-info`, `callout-warning`, `callout-success`, `callout-error` - Callouts
 * - `embed`, `youtube` - Embeds
 */

import React, { useEffect, useState, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import {
  BeakBlockEditor,
  SLASH_MENU_PLUGIN_KEY,
  SlashMenuState,
  SlashMenuItem,
  getDefaultSlashMenuItems,
  filterSlashMenuItems,
  executeSlashCommand,
  closeSlashMenu,
} from '@aurthurm/beakblock-core';

// Re-export SlashMenuItem for convenience
export type { SlashMenuItem } from '@aurthurm/beakblock-core';

/**
 * Props for SlashMenu component.
 */
export interface SlashMenuProps {
  /**
   * The BeakBlockEditor instance (can be null during initialization).
   */
  editor: BeakBlockEditor | null;

  /**
   * Replace all default items with custom items.
   * Use `customItems` instead if you want to add items while keeping defaults.
   */
  items?: SlashMenuItem[];

  /**
   * Custom items to add to the menu (merged with defaults).
   * These can be referenced by their id in `itemOrder`.
   */
  customItems?: SlashMenuItem[];

  /**
   * Order of items to display (by item ID).
   * If provided, only items in this list will be shown, in the specified order.
   * If not provided, shows all items (defaults + custom) in default order.
   */
  itemOrder?: string[];

  /**
   * Item IDs to hide from the menu.
   * Ignored if `itemOrder` is provided.
   */
  hideItems?: string[];

  /**
   * Custom render function for menu items.
   */
  renderItem?: (item: SlashMenuItem, isSelected: boolean) => React.ReactNode;

  /**
   * Additional class name for the menu container.
   */
  className?: string;
}

/**
 * Default icons for menu items (simple SVG components).
 */
const Icons: Record<string, React.FC<{ className?: string }>> = {
  heading1: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12h8M4 6v12M12 6v12M17 12l3-2v8" />
    </svg>
  ),
  heading2: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12h8M4 6v12M12 6v12M17 10c1.5-1 3 0 3 2s-3 3-3 5h3" />
    </svg>
  ),
  heading3: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12h8M4 6v12M12 6v12M17 10c1.5-1 3 0 3 1.5c0 1-1 1.5-1.5 1.5c.5 0 1.5.5 1.5 1.5c0 1.5-1.5 2.5-3 1.5" />
    </svg>
  ),
  list: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  listOrdered: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 6h11M10 12h11M10 18h11M3 5v3h2M3 10v1c0 1 2 2 2 2s-2 1-2 2v1h4M3 17v4h2l2-2" />
    </svg>
  ),
  quote: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v4" />
    </svg>
  ),
  code: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  ),
  minus: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14" />
    </svg>
  ),
  image: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  emoji: ({ className }) => (
    <span className={className} aria-hidden="true" style={{ fontSize: '15px', lineHeight: 1 }}>🙂</span>
  ),
  sparkles: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" />
      <path d="M19 14l.9 2.6L22.5 18l-2.6.9L19 21.5l-.9-2.6-2.6-.9 2.6-.9L19 14z" />
    </svg>
  ),
  checkSquare: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  callout: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  table: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
  embed: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  youtube: ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </svg>
  ),
};

/**
 * SlashMenu component.
 *
 * Renders when the user types "/" and shows a filterable list of block types to insert.
 */
export function SlashMenu({
  editor,
  items,
  customItems,
  itemOrder,
  hideItems,
  renderItem,
  className,
}: SlashMenuProps): React.ReactElement | null {
  const [menuState, setMenuState] = useState<SlashMenuState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [openUpward, setOpenUpward] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Build the list of all available items
  const allItems = useMemo(() => {
    if (!editor) return [];

    // If items prop is provided, use it directly (replaces all defaults)
    if (items) {
      return items;
    }

    // Get default items from schema
    const defaultItems = getDefaultSlashMenuItems(editor.pm.state.schema);

    // Merge with custom items
    const mergedItems = customItems ? [...defaultItems, ...customItems] : defaultItems;

    // Create a map for quick lookup
    const itemMap = new Map<string, SlashMenuItem>();
    mergedItems.forEach((item) => itemMap.set(item.id, item));

    // Apply itemOrder if provided
    if (itemOrder) {
      const orderedItems: SlashMenuItem[] = [];
      itemOrder.forEach((id) => {
        const item = itemMap.get(id);
        if (item) {
          orderedItems.push(item);
        }
      });
      return orderedItems;
    }

    // Apply hideItems if provided
    if (hideItems && hideItems.length > 0) {
      const hideSet = new Set(hideItems);
      return mergedItems.filter((item) => !hideSet.has(item.id));
    }

    return mergedItems;
  }, [editor, items, customItems, itemOrder, hideItems]);

  const filteredItems = menuState ? filterSlashMenuItems(allItems, menuState.query) : [];

  // Subscribe to plugin state changes
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const updateState = () => {
      const state = SLASH_MENU_PLUGIN_KEY.getState(editor.pm.state);
      setMenuState(state ?? null);
      setSelectedIndex(0); // Reset selection when menu opens/query changes
    };

    // Initial state
    updateState();

    // Subscribe to transactions
    const unsubscribe = editor.on('transaction', updateState);
    return unsubscribe;
  }, [editor]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!editor || editor.isDestroyed || !menuState?.active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          event.stopPropagation();
          setSelectedIndex((i) => Math.min(i + 1, filteredItems.length - 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          event.stopPropagation();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          event.preventDefault();
          event.stopPropagation();
          if (filteredItems[selectedIndex]) {
            handleSelect(filteredItems[selectedIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          event.stopPropagation();
          closeSlashMenu(editor.pm.view);
          break;
      }
    };

    // Use capture phase on editor element to intercept events BEFORE ProseMirror handles them
    const editorElement = editor.pm.view.dom;
    editorElement.addEventListener('keydown', handleKeyDown, true);
    return () => editorElement.removeEventListener('keydown', handleKeyDown, true);
  }, [menuState?.active, filteredItems, selectedIndex, editor]);

  // Handle item selection
  const handleSelect = useCallback(
    (item: SlashMenuItem) => {
      if (!editor || editor.isDestroyed || !menuState) return;
      executeSlashCommand(editor.pm.view, menuState, item.action);
      editor.pm.view.focus();
    },
    [editor, menuState]
  );

  // Determine if menu should open upward based on available space
  useLayoutEffect(() => {
    if (!menuState?.active || !menuState.coords || !menuRef.current) {
      return;
    }

    const menuHeight = menuRef.current.offsetHeight || 300; // Estimate if not yet rendered
    const spaceBelow = window.innerHeight - menuState.coords.bottom - 8;
    const spaceAbove = menuState.coords.top - 8;

    // Open upward if not enough space below but enough above
    setOpenUpward(spaceBelow < menuHeight && spaceAbove > spaceBelow);
  }, [menuState?.active, menuState?.coords, filteredItems.length]);

  // Don't render if menu is not active
  if (!menuState?.active || !menuState.coords) {
    return null;
  }

  // Position the menu - either below or above the cursor
  const style: React.CSSProperties = {
    position: 'fixed',
    left: menuState.coords.left,
    zIndex: 1000,
    ...(openUpward
      ? { bottom: window.innerHeight - menuState.coords.top + 4 }
      : { top: menuState.coords.bottom + 4 }),
  };

  return (
    <div
      ref={menuRef}
      className={`ob-slash-menu ${className || ''}`}
      style={style}
      role="listbox"
    >
      {filteredItems.length === 0 ? (
        <div className="ob-slash-menu-empty">No results</div>
      ) : (
        filteredItems.map((item, index) => {
          const isSelected = index === selectedIndex;
          const Icon = item.icon ? Icons[item.icon] : null;

          if (renderItem) {
            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                role="option"
                aria-selected={isSelected}
              >
                {renderItem(item, isSelected)}
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className={`ob-slash-menu-item ${isSelected ? 'ob-slash-menu-item--selected' : ''}`}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(index)}
              role="option"
              aria-selected={isSelected}
            >
              {Icon && (
                <span className="ob-slash-menu-item-icon">
                  <Icon />
                </span>
              )}
              <div className="ob-slash-menu-item-content">
                <span className="ob-slash-menu-item-title">{item.title}</span>
                {item.description && (
                  <span className="ob-slash-menu-item-description">{item.description}</span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
