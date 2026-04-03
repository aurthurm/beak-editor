/**
 * MediaMenu - React component for the floating media editing toolbar.
 *
 * Renders a floating menu when an image or embed is selected, allowing users to
 * modify attributes like alignment, URL, caption, or delete the media.
 *
 * @example
 * ```tsx
 * import { useBeakBlock, BeakBlockView, MediaMenu } from '@beakblock/react';
 *
 * function MyEditor() {
 *   const editor = useBeakBlock();
 *
 *   return (
 *     <BeakBlockView editor={editor}>
 *       <MediaMenu editor={editor} />
 *     </BeakBlockView>
 *   );
 * }
 * ```
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  BeakBlockEditor,
  MEDIA_MENU_PLUGIN_KEY,
  MediaMenuState,
  updateMediaAttrs,
  deleteMediaNode,
  ImageAttrs,
  EmbedAttrs,
} from '@aurthurm/beakblock-core';

/**
 * Props for MediaMenu component.
 */
export interface MediaMenuProps {
  /**
   * The BeakBlockEditor instance (can be null during initialization).
   */
  editor: BeakBlockEditor | null;

  /**
   * Additional class name for the menu container.
   */
  className?: string;
}

/**
 * Alignment button component.
 */
interface AlignmentButtonProps {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function AlignmentButton({ active, onClick, title, children }: AlignmentButtonProps) {
  return (
    <button
      type="button"
      className={`ob-media-menu-btn ${active ? 'ob-media-menu-btn--active' : ''}`}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      title={title}
    >
      {children}
    </button>
  );
}

/**
 * URL edit popover component.
 */
interface UrlEditPopoverProps {
  currentUrl: string;
  onSave: (url: string) => void;
  onClose: () => void;
  label: string;
}

function UrlEditPopover({ currentUrl, onSave, onClose, label }: UrlEditPopoverProps) {
  const [url, setUrl] = useState(currentUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(url);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="ob-media-url-popover"
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <form onSubmit={handleSubmit}>
        <label className="ob-media-url-label">{label}</label>
        <input
          ref={inputRef}
          type="url"
          className="ob-media-url-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
        />
        <div className="ob-media-url-actions">
          <button
            type="button"
            className="ob-media-url-btn ob-media-url-btn--cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="ob-media-url-btn ob-media-url-btn--save">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Caption edit popover component.
 */
interface CaptionEditPopoverProps {
  currentCaption: string;
  onSave: (caption: string) => void;
  onClose: () => void;
}

function CaptionEditPopover({ currentCaption, onSave, onClose }: CaptionEditPopoverProps) {
  const [caption, setCaption] = useState(currentCaption);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(caption);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="ob-media-url-popover"
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <form onSubmit={handleSubmit}>
        <label className="ob-media-url-label">Caption</label>
        <input
          ref={inputRef}
          type="text"
          className="ob-media-url-input"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Enter caption..."
        />
        <div className="ob-media-url-actions">
          <button
            type="button"
            className="ob-media-url-btn ob-media-url-btn--cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="ob-media-url-btn ob-media-url-btn--save">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * MediaMenu component.
 *
 * Renders a floating toolbar when an image or embed is selected.
 */
export function MediaMenu({ editor, className }: MediaMenuProps): React.ReactElement | null {
  const [menuState, setMenuState] = useState<MediaMenuState | null>(null);
  const [showUrlEdit, setShowUrlEdit] = useState(false);
  const [showCaptionEdit, setShowCaptionEdit] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Keep a stable reference to the last valid menu state for when popovers are open
  const lastValidStateRef = useRef<MediaMenuState | null>(null);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const updateState = () => {
      const state = MEDIA_MENU_PLUGIN_KEY.getState(editor.pm.state);
      // Only update if menu is visible, or if no popover is open
      if (state?.visible) {
        lastValidStateRef.current = state;
        setMenuState(state);
      } else if (!showUrlEdit && !showCaptionEdit) {
        lastValidStateRef.current = null;
        setMenuState(state ?? null);
      }
      // If a popover is open, keep the last valid state
    };

    updateState();

    const unsubscribe = editor.on('transaction', updateState);
    return unsubscribe;
  }, [editor, showUrlEdit, showCaptionEdit]);

  // Close popovers when menu truly hides (not when popover is open)
  useEffect(() => {
    if (!menuState?.visible && !showUrlEdit && !showCaptionEdit) {
      lastValidStateRef.current = null;
    }
  }, [menuState?.visible, showUrlEdit, showCaptionEdit]);

  // Hide menu on scroll
  useEffect(() => {
    if (!editor || !menuState?.visible) return;

    const handleScroll = () => {
      // Hide the menu by dispatching a transaction
      editor.pm.view.dispatch(
        editor.pm.view.state.tr.setMeta(MEDIA_MENU_PLUGIN_KEY, { hide: true })
      );
    };

    // Listen to scroll on the editor container and window
    const editorElement = editor.pm.view.dom;
    const scrollContainer = editorElement.closest('.beakblock-container') || editorElement.parentElement;

    window.addEventListener('scroll', handleScroll, true);
    scrollContainer?.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      scrollContainer?.removeEventListener('scroll', handleScroll);
    };
  }, [editor, menuState?.visible]);

  // Hide menu when clicking outside
  useEffect(() => {
    const isPopoverOpen = showUrlEdit || showCaptionEdit;
    if (!editor || (!menuState?.visible && !isPopoverOpen)) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't hide if clicking inside the menu or popovers
      if (target.closest('.ob-media-menu') || target.closest('.ob-media-url-popover')) {
        return;
      }
      // Don't hide if clicking on the media element itself
      if (target.closest('.beakblock-image') || target.closest('.beakblock-embed')) {
        return;
      }
      // Close popovers and hide menu
      setShowUrlEdit(false);
      setShowCaptionEdit(false);
      lastValidStateRef.current = null;
    };

    // Use mousedown to catch clicks before focus changes
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editor, menuState?.visible, showUrlEdit, showCaptionEdit]);

  // Get the current state to use (prefer current, fallback to last valid)
  const getActiveState = useCallback(() => {
    return menuState?.visible ? menuState : lastValidStateRef.current;
  }, [menuState]);

  const handleAlignmentChange = useCallback(
    (alignment: 'left' | 'center' | 'right') => {
      const state = getActiveState();
      if (!editor || state?.nodePos === null || state?.nodePos === undefined) return;
      updateMediaAttrs(editor.pm.view, state.nodePos, { alignment });
      editor.pm.view.focus();
    },
    [editor, getActiveState]
  );

  const handleUrlSave = useCallback(
    (url: string) => {
      const state = getActiveState();
      if (!editor || state?.nodePos === null || state?.nodePos === undefined) return;
      if (state.mediaType === 'image') {
        updateMediaAttrs(editor.pm.view, state.nodePos, { src: url });
      } else {
        updateMediaAttrs(editor.pm.view, state.nodePos, { url });
      }
      setShowUrlEdit(false);
      editor.pm.view.focus();
    },
    [editor, getActiveState]
  );

  const handleCaptionSave = useCallback(
    (caption: string) => {
      const state = getActiveState();
      if (!editor || state?.nodePos === null || state?.nodePos === undefined) return;
      updateMediaAttrs(editor.pm.view, state.nodePos, { caption });
      setShowCaptionEdit(false);
      editor.pm.view.focus();
    },
    [editor, getActiveState]
  );

  const handleDelete = useCallback(() => {
    const state = getActiveState();
    if (!editor || state?.nodePos === null || state?.nodePos === undefined) return;
    deleteMediaNode(editor.pm.view, state.nodePos);
    editor.pm.view.focus();
  }, [editor, getActiveState]);

  // Use the last valid state if a popover is open
  const isPopoverOpen = showUrlEdit || showCaptionEdit;
  const activeState = menuState?.visible ? menuState : (isPopoverOpen ? lastValidStateRef.current : null);

  if (!editor || editor.isDestroyed || !activeState || !activeState.coords) {
    return null;
  }

  const { mediaType, attrs, coords } = activeState;
  const isImage = mediaType === 'image';
  const imageAttrs = isImage ? (attrs as ImageAttrs) : null;
  const embedAttrs = !isImage ? (attrs as EmbedAttrs) : null;
  const alignment = imageAttrs?.alignment || 'center';
  const currentUrl = isImage ? imageAttrs?.src || '' : embedAttrs?.url || '';
  const currentCaption = attrs?.caption || '';

  // Position menu above the media element
  const menuHeight = 44;
  const style: React.CSSProperties = {
    position: 'fixed',
    left: coords.left + (coords.right - coords.left) / 2,
    top: coords.top - menuHeight - 8,
    transform: 'translateX(-50%)',
    zIndex: 1000,
  };

  return (
    <div
      ref={menuRef}
      className={`ob-media-menu ${className || ''}`}
      style={style}
      role="toolbar"
      aria-label={`${isImage ? 'Image' : 'Embed'} options`}
    >
      {/* Alignment buttons (for images) */}
      {isImage && (
        <>
          <AlignmentButton
            active={alignment === 'left'}
            onClick={() => handleAlignmentChange('left')}
            title="Align left"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="5" width="10" height="14" rx="1" />
              <path d="M17 8h4M17 12h4M17 16h4" />
            </svg>
          </AlignmentButton>
          <AlignmentButton
            active={alignment === 'center'}
            onClick={() => handleAlignmentChange('center')}
            title="Align center"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="7" y="5" width="10" height="14" rx="1" />
            </svg>
          </AlignmentButton>
          <AlignmentButton
            active={alignment === 'right'}
            onClick={() => handleAlignmentChange('right')}
            title="Align right"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="11" y="5" width="10" height="14" rx="1" />
              <path d="M3 8h4M3 12h4M3 16h4" />
            </svg>
          </AlignmentButton>
          <span className="ob-media-menu-divider" />
        </>
      )}

      {/* Edit URL button */}
      <button
        type="button"
        className={`ob-media-menu-btn ${showUrlEdit ? 'ob-media-menu-btn--active' : ''}`}
        onClick={() => {
          setShowUrlEdit(!showUrlEdit);
          setShowCaptionEdit(false);
        }}
        onMouseDown={(e) => e.preventDefault()}
        title={isImage ? 'Edit image URL' : 'Edit embed URL'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </button>

      {/* Edit Caption button */}
      <button
        type="button"
        className={`ob-media-menu-btn ${showCaptionEdit ? 'ob-media-menu-btn--active' : ''}`}
        onClick={() => {
          setShowCaptionEdit(!showCaptionEdit);
          setShowUrlEdit(false);
        }}
        onMouseDown={(e) => e.preventDefault()}
        title="Edit caption"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 15h10M7 11h4" />
        </svg>
      </button>

      <span className="ob-media-menu-divider" />

      {/* Delete button */}
      <button
        type="button"
        className="ob-media-menu-btn ob-media-menu-btn--danger"
        onClick={handleDelete}
        onMouseDown={(e) => e.preventDefault()}
        title="Delete"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>

      {/* URL Edit Popover */}
      {showUrlEdit && (
        <UrlEditPopover
          currentUrl={currentUrl}
          onSave={handleUrlSave}
          onClose={() => setShowUrlEdit(false)}
          label={isImage ? 'Image URL' : 'Embed URL'}
        />
      )}

      {/* Caption Edit Popover */}
      {showCaptionEdit && (
        <CaptionEditPopover
          currentCaption={currentCaption}
          onSave={handleCaptionSave}
          onClose={() => setShowCaptionEdit(false)}
        />
      )}
    </div>
  );
}
