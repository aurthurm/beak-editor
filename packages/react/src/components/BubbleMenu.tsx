/**
 * BubbleMenu - React component for the floating formatting toolbar.
 *
 * Renders a floating menu when text is selected, allowing users to
 * apply formatting (bold, italic, underline, etc.) to the selection.
 *
 * ## Basic Usage
 *
 * @example
 * ```tsx
 * import { useBeakBlock, BeakBlockView, BubbleMenu } from '@beakblock/react';
 *
 * function MyEditor() {
 *   const editor = useBeakBlock();
 *
 *   return (
 *     <BeakBlockView editor={editor}>
 *       <BubbleMenu editor={editor} />
 *     </BeakBlockView>
 *   );
 * }
 * ```
 *
 * ## Custom Items
 *
 * You can add custom buttons to the BubbleMenu using the `customItems` prop.
 * Each item needs an `id`, `label`, `icon`, and `action` function.
 *
 * @example Adding a translate button
 * ```tsx
 * import { BubbleMenu, BubbleMenuItem } from '@beakblock/react';
 *
 * // Define a custom "Translate" button
 * const translateItem: BubbleMenuItem = {
 *   id: 'translate',
 *   label: 'Translate to English',
 *   icon: (
 *     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
 *       <path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2v3M22 22l-5-10-5 10M14 18h6" />
 *     </svg>
 *   ),
 *   action: async (editor, state) => {
 *     // Get selected text
 *     const selectedText = editor.pm.state.doc.textBetween(state.from, state.to);
 *
 *     // Call your translation API
 *     const translated = await myTranslateAPI(selectedText, 'en');
 *
 *     // Replace the selection with translated text
 *     editor.pm.view.dispatch(
 *       editor.pm.state.tr.insertText(translated, state.from, state.to)
 *     );
 *     editor.pm.view.focus();
 *   },
 * };
 *
 * function MyEditor() {
 *   const editor = useBeakBlock();
 *
 *   return (
 *     <BeakBlockView editor={editor}>
 *       <BubbleMenu
 *         editor={editor}
 *         customItems={[translateItem]}
 *       />
 *     </BeakBlockView>
 *   );
 * }
 * ```
 *
 * ## Reordering Items
 *
 * Use `itemOrder` to control which items appear and in what order.
 * Use `'---'` to add dividers between groups.
 *
 * @example Custom order with dividers
 * ```tsx
 * <BubbleMenu
 *   editor={editor}
 *   customItems={[translateItem, aiRewriteItem]}
 *   itemOrder={[
 *     'bold', 'italic', 'underline',
 *     '---',
 *     'translate', 'aiRewrite',  // Custom items
 *     '---',
 *     'link', 'color',
 *   ]}
 * />
 * ```
 *
 * ## Hiding Default Items
 *
 * Use `hideItems` to remove default items you don't need.
 *
 * @example Minimal formatting menu
 * ```tsx
 * <BubbleMenu
 *   editor={editor}
 *   hideItems={['strikethrough', 'code', 'alignLeft', 'alignRight']}
 * />
 * ```
 *
 * ## Active State
 *
 * Custom items can show an active/pressed state using `isActive`:
 *
 * @example Item with active state
 * ```tsx
 * const highlightItem: BubbleMenuItem = {
 *   id: 'highlight',
 *   label: 'Highlight',
 *   icon: <HighlightIcon />,
 *   isActive: (state) => state.activeMarks.backgroundColor !== null,
 *   action: (editor) => {
 *     editor.toggleBackgroundColor('#ffeb3b');
 *     editor.pm.view.focus();
 *   },
 * };
 * ```
 *
 * ## Available Default Items
 *
 * The following item IDs are available by default:
 * - `blockType` - Block type selector (paragraph, heading, etc.)
 * - `alignLeft`, `alignCenter`, `alignRight` - Text alignment
 * - `bold`, `italic`, `underline`, `strikethrough` - Text formatting
 * - `code` - Inline code
 * - `link` - Link editor
 * - `color` - Text/background color picker
 *
 * @see {@link BUBBLE_MENU_ITEMS} for the full list of default items
 * @see {@link DEFAULT_BUBBLE_MENU_ORDER} for the default order
 */

import React, { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import {
  BeakBlockEditor,
  BUBBLE_MENU_PLUGIN_KEY,
  BubbleMenuState,
  BlockTypeInfo,
} from '@aurthurm/beakblock-core';
import { LinkPopover } from './LinkPopover';
import { ColorPicker } from './ColorPicker';

// ============================================================================
// Types
// ============================================================================

/**
 * A custom menu item for the BubbleMenu.
 */
export interface BubbleMenuItem {
  /** Unique identifier for the item */
  id: string;
  /** Display label (used for accessibility/title) */
  label: string;
  /** Icon as React node */
  icon: React.ReactNode;
  /**
   * Whether the item is currently active.
   * If not provided, the item is never shown as active.
   */
  isActive?: (state: BubbleMenuState, editor: BeakBlockEditor) => boolean;
  /**
   * Action to execute when the item is clicked.
   * Receives the editor and current menu state.
   */
  action: (editor: BeakBlockEditor, state: BubbleMenuState) => void;
}

/**
 * Props for BubbleMenu component.
 */
export interface BubbleMenuProps {
  /**
   * The BeakBlockEditor instance (can be null during initialization).
   */
  editor: BeakBlockEditor | null;

  /**
   * Custom items to add to the menu.
   * These can be referenced by their id in itemOrder.
   */
  customItems?: BubbleMenuItem[];

  /**
   * Order of items to display. Use item IDs and '---' for dividers.
   * If not provided, uses DEFAULT_BUBBLE_MENU_ORDER with custom items at the end.
   *
   * @example ['bold', 'italic', '---', 'myCustomItem', '---', 'link']
   */
  itemOrder?: string[];

  /**
   * Items to hide from the menu.
   * Use the item IDs (e.g., 'strikethrough', 'code', 'blockType').
   */
  hideItems?: string[];

  /**
   * Custom render function for the menu content.
   * If provided, replaces the default formatting buttons entirely.
   * Note: customItems, itemOrder, and hideItems are ignored when using children.
   */
  children?: (props: {
    editor: BeakBlockEditor;
    state: BubbleMenuState;
  }) => React.ReactNode;

  /**
   * Additional class name for the menu container.
   */
  className?: string;
}

// ============================================================================
// Icons
// ============================================================================

const Icons = {
  bold: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    </svg>
  ),
  italic: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M19 4h-9M14 20H5M15 4L9 20" />
    </svg>
  ),
  underline: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
      <path d="M4 20h16" />
    </svg>
  ),
  strikethrough: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M16 4c-1.5 0-3-.5-4.5-.5S8 4 6.5 5.5 5 9 6.5 10.5" />
      <path d="M8 20c1.5 0 3 .5 4.5.5s3.5-.5 5-2 1.5-4 0-5.5" />
      <path d="M4 12h16" />
    </svg>
  ),
  code: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </svg>
  ),
  link: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  alignLeft: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M4 6h16M4 12h10M4 18h14" />
    </svg>
  ),
  alignCenter: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M4 6h16M7 12h10M5 18h14" />
    </svg>
  ),
  alignRight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M4 6h16M10 12h10M6 18h14" />
    </svg>
  ),
};

// ============================================================================
// Default Menu Items
// ============================================================================

/**
 * Default bubble menu items.
 * These are the built-in formatting options available in the menu.
 */
export const BUBBLE_MENU_ITEMS: Record<string, BubbleMenuItem> = {
  bold: {
    id: 'bold',
    label: 'Bold (Cmd+B)',
    icon: Icons.bold,
    isActive: (state) => state.activeMarks.bold,
    action: (editor) => {
      editor.toggleBold();
      editor.pm.view.focus();
    },
  },
  italic: {
    id: 'italic',
    label: 'Italic (Cmd+I)',
    icon: Icons.italic,
    isActive: (state) => state.activeMarks.italic,
    action: (editor) => {
      editor.toggleItalic();
      editor.pm.view.focus();
    },
  },
  underline: {
    id: 'underline',
    label: 'Underline (Cmd+U)',
    icon: Icons.underline,
    isActive: (state) => state.activeMarks.underline,
    action: (editor) => {
      editor.toggleUnderline();
      editor.pm.view.focus();
    },
  },
  strikethrough: {
    id: 'strikethrough',
    label: 'Strikethrough',
    icon: Icons.strikethrough,
    isActive: (state) => state.activeMarks.strikethrough,
    action: (editor) => {
      editor.toggleStrikethrough();
      editor.pm.view.focus();
    },
  },
  code: {
    id: 'code',
    label: 'Inline code',
    icon: Icons.code,
    isActive: (state) => state.activeMarks.code,
    action: (editor) => {
      editor.toggleCode();
      editor.pm.view.focus();
    },
  },
  alignLeft: {
    id: 'alignLeft',
    label: 'Align left',
    icon: Icons.alignLeft,
    isActive: (state) => state.textAlign === 'left',
    action: (editor) => {
      editor.setTextAlign('left');
      editor.pm.view.focus();
    },
  },
  alignCenter: {
    id: 'alignCenter',
    label: 'Align center',
    icon: Icons.alignCenter,
    isActive: (state) => state.textAlign === 'center',
    action: (editor) => {
      editor.setTextAlign('center');
      editor.pm.view.focus();
    },
  },
  alignRight: {
    id: 'alignRight',
    label: 'Align right',
    icon: Icons.alignRight,
    isActive: (state) => state.textAlign === 'right',
    action: (editor) => {
      editor.setTextAlign('right');
      editor.pm.view.focus();
    },
  },
};

/**
 * Default order of items in the bubble menu.
 * Use '---' for dividers.
 * Special items: 'blockType', 'link', 'color' are rendered with custom components.
 */
export const DEFAULT_BUBBLE_MENU_ORDER: string[] = [
  'blockType',
  '---',
  'alignLeft',
  'alignCenter',
  'alignRight',
  '---',
  'bold',
  'italic',
  'underline',
  'strikethrough',
  '---',
  'code',
  'link',
  '---',
  'color',
];

// ============================================================================
// Internal Components
// ============================================================================

/**
 * Formatting button component.
 */
interface FormatButtonProps {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function FormatButton({ active, onClick, title, children }: FormatButtonProps) {
  return (
    <button
      type="button"
      className={`ob-bubble-menu-btn ${active ? 'ob-bubble-menu-btn--active' : ''}`}
      onClick={onClick}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

/**
 * Block type option definition.
 */
interface BlockTypeOption {
  type: string;
  label: string;
  props?: Record<string, unknown>;
  icon: React.ReactNode;
}

/**
 * Available block types for the selector.
 */
const BLOCK_TYPE_OPTIONS: BlockTypeOption[] = [
  {
    type: 'paragraph',
    label: 'Paragraph',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
  {
    type: 'heading',
    label: 'Heading 1',
    props: { level: 1 },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M4 12h8M4 6v12M12 6v12" />
        <path d="M20 8v8M17 8h6" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    type: 'heading',
    label: 'Heading 2',
    props: { level: 2 },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M4 12h8M4 6v12M12 6v12" />
        <path d="M16 12a3 3 0 1 1 6 0c0 1.5-3 3-3 3h3M16 18h6" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    type: 'heading',
    label: 'Heading 3',
    props: { level: 3 },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M4 12h8M4 6v12M12 6v12" />
        <path d="M16 9a2 2 0 1 1 4 1.5c-.5.5-2 1-2 1s1.5.5 2 1a2 2 0 1 1-4 1.5" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    type: 'blockquote',
    label: 'Quote',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" />
        <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v4z" />
      </svg>
    ),
  },
  {
    type: 'bulletList',
    label: 'Bullet List',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="4" cy="7" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="4" cy="17" r="1.5" fill="currentColor" stroke="none" />
        <path d="M9 7h11M9 12h11M9 17h11" />
      </svg>
    ),
  },
  {
    type: 'orderedList',
    label: 'Numbered List',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M10 7h10M10 12h10M10 17h10" />
        <path d="M4 7h2M4 17h2M5 11v3h2" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    type: 'codeBlock',
    label: 'Code Block',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="m9 9-3 3 3 3M15 9l3 3-3 3" />
      </svg>
    ),
  },
];

/**
 * Get display label for current block type.
 */
function getBlockTypeLabel(blockType: BlockTypeInfo): string {
  if (blockType.type === 'heading') {
    const level = blockType.props.level as number;
    return `Heading ${level}`;
  }

  const option = BLOCK_TYPE_OPTIONS.find((opt) => opt.type === blockType.type);
  return option?.label || 'Paragraph';
}

/**
 * Get icon for current block type.
 */
function getBlockTypeIcon(blockType: BlockTypeInfo): React.ReactNode {
  if (blockType.type === 'heading') {
    const level = blockType.props.level as number;
    const option = BLOCK_TYPE_OPTIONS.find(
      (opt) => opt.type === 'heading' && opt.props?.level === level
    );
    return option?.icon || BLOCK_TYPE_OPTIONS[0].icon;
  }

  const option = BLOCK_TYPE_OPTIONS.find((opt) => opt.type === blockType.type);
  return option?.icon || BLOCK_TYPE_OPTIONS[0].icon;
}

/**
 * Check if block type matches an option.
 */
function blockTypeMatches(blockType: BlockTypeInfo, option: BlockTypeOption): boolean {
  if (blockType.type !== option.type) return false;
  if (option.props?.level && blockType.props.level !== option.props.level) return false;
  return true;
}

/**
 * Block type selector dropdown component.
 */
interface BlockTypeSelectorProps {
  editor: BeakBlockEditor;
  blockType: BlockTypeInfo;
}

function BlockTypeSelector({ editor, blockType }: BlockTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Determine if dropdown should open upward based on available space
  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current || !dropdownRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = dropdownRef.current.offsetHeight || 300;
    const spaceBelow = window.innerHeight - buttonRect.bottom - 8;
    const spaceAbove = buttonRect.top - 8;

    setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
  }, [isOpen]);

  const handleSelect = useCallback(
    (option: BlockTypeOption) => {
      editor.setBlockType(option.type, option.props || {});
      editor.pm.view.focus();
      setIsOpen(false);
    },
    [editor]
  );

  return (
    <div className="ob-block-type-selector" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className="ob-block-type-selector-btn"
        onClick={() => setIsOpen(!isOpen)}
        onMouseDown={(e) => e.preventDefault()}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="ob-block-type-selector-icon">{getBlockTypeIcon(blockType)}</span>
        <span className="ob-block-type-selector-label">{getBlockTypeLabel(blockType)}</span>
        <svg
          className={`ob-block-type-selector-chevron ${isOpen ? 'ob-block-type-selector-chevron--open' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className={`ob-block-type-dropdown ${openUpward ? 'ob-block-type-dropdown--upward' : ''}`}
          role="listbox"
        >
          {BLOCK_TYPE_OPTIONS.map((option, index) => {
            const isActive = blockTypeMatches(blockType, option);
            return (
              <button
                key={`${option.type}-${option.props?.level || index}`}
                type="button"
                className={`ob-block-type-option ${isActive ? 'ob-block-type-option--active' : ''}`}
                onClick={() => handleSelect(option)}
                onMouseDown={(e) => e.preventDefault()}
                role="option"
                aria-selected={isActive}
              >
                <span className="ob-block-type-option-icon">{option.icon}</span>
                <span className="ob-block-type-option-label">{option.label}</span>
                {isActive && (
                  <svg
                    className="ob-block-type-option-check"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * BubbleMenu component.
 *
 * Renders a floating toolbar when text is selected for quick formatting access.
 * Supports custom items and reordering via props.
 */
export function BubbleMenu({
  editor,
  customItems = [],
  itemOrder,
  hideItems = [],
  children,
  className,
}: BubbleMenuProps): React.ReactElement | null {
  const [menuState, setMenuState] = useState<BubbleMenuState | null>(null);
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const linkButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const updateState = () => {
      const state = BUBBLE_MENU_PLUGIN_KEY.getState(editor.pm.state);
      setMenuState(state ?? null);
    };

    updateState();

    const unsubscribe = editor.on('transaction', updateState);
    return unsubscribe;
  }, [editor]);

  // Close link popover when menu hides
  useEffect(() => {
    if (!menuState?.visible) {
      setShowLinkPopover(false);
    }
  }, [menuState?.visible]);

  const handleLinkClick = useCallback(() => {
    setShowLinkPopover(true);
  }, []);

  const closeLinkPopover = useCallback(() => {
    setShowLinkPopover(false);
  }, []);

  if (!editor || editor.isDestroyed || !menuState?.visible || !menuState.coords) {
    return null;
  }

  const menuHeight = 36;
  const style: React.CSSProperties = {
    position: 'fixed',
    left: menuState.coords.left,
    top: menuState.coords.top - menuHeight - 8,
    zIndex: 1000,
  };

  // If children is provided, render custom content
  if (children) {
    return (
      <div className={`ob-bubble-menu ${className || ''}`} style={style}>
        {children({ editor, state: menuState })}
      </div>
    );
  }

  // Build the items map (default + custom)
  const allItems: Record<string, BubbleMenuItem> = { ...BUBBLE_MENU_ITEMS };
  for (const item of customItems) {
    allItems[item.id] = item;
  }

  // Determine the order to render
  const order = itemOrder || [
    ...DEFAULT_BUBBLE_MENU_ORDER,
    // Add custom items at the end if not in custom order
    ...(customItems.length > 0 ? ['---', ...customItems.map((i) => i.id)] : []),
  ];

  // Filter out hidden items
  const hiddenSet = new Set(hideItems);

  const { activeMarks, blockType } = menuState;

  // Render items
  const renderItem = (itemId: string, index: number): React.ReactNode => {
    // Divider
    if (itemId === '---') {
      return <span key={`divider-${index}`} className="ob-bubble-menu-divider" />;
    }

    // Skip hidden items
    if (hiddenSet.has(itemId)) {
      return null;
    }

    // Special items with custom rendering
    if (itemId === 'blockType') {
      return <BlockTypeSelector key="blockType" editor={editor} blockType={blockType} />;
    }

    if (itemId === 'link') {
      return (
        <button
          key="link"
          ref={linkButtonRef}
          type="button"
          className={`ob-bubble-menu-btn ${activeMarks.link ? 'ob-bubble-menu-btn--active' : ''}`}
          onClick={handleLinkClick}
          onMouseDown={(e) => e.preventDefault()}
          title={activeMarks.link ? 'Edit link' : 'Add link'}
        >
          {Icons.link}
        </button>
      );
    }

    if (itemId === 'color') {
      return (
        <ColorPicker
          key="color"
          editor={editor}
          currentTextColor={activeMarks.textColor}
          currentBackgroundColor={activeMarks.backgroundColor}
        />
      );
    }

    // Regular items (default or custom)
    const item = allItems[itemId];
    if (!item) {
      return null;
    }

    const isActive = item.isActive ? item.isActive(menuState, editor) : false;

    return (
      <FormatButton
        key={item.id}
        active={isActive}
        onClick={() => item.action(editor, menuState)}
        title={item.label}
      >
        {item.icon}
      </FormatButton>
    );
  };

  return (
    <div
      className={`ob-bubble-menu ${className || ''}`}
      style={style}
      role="toolbar"
      aria-label="Text formatting"
    >
      {order.map((itemId, index) => renderItem(itemId, index))}

      {showLinkPopover && linkButtonRef.current && (
        <LinkPopover
          editor={editor}
          currentUrl={activeMarks.link}
          onClose={closeLinkPopover}
          triggerRef={linkButtonRef}
          position={{
            left: linkButtonRef.current.getBoundingClientRect().left,
            top: linkButtonRef.current.getBoundingClientRect().bottom + 8,
          }}
        />
      )}
    </div>
  );
}
