/**
 * LinkPopover - React component for link editing.
 *
 * Renders a compact popover for adding, editing, or removing links from selected text.
 * Used within the BubbleMenu as an alternative to browser prompt() dialogs.
 *
 * @example
 * ```tsx
 * <LinkPopover
 *   editor={editor}
 *   currentUrl={activeMarks.link}
 *   onClose={() => setShowLinkPopover(false)}
 *   position={{ left: 100, top: 200 }}
 * />
 * ```
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { BeakBlockEditor } from '@labbs/beakblock-core';

/**
 * Props for LinkPopover component.
 */
export interface LinkPopoverProps {
  /**
   * The BeakBlockEditor instance.
   */
  editor: BeakBlockEditor;

  /**
   * Current URL if text already has a link, null otherwise.
   */
  currentUrl: string | null;

  /**
   * Callback when popover is closed.
   */
  onClose: () => void;

  /**
   * Position for the popover.
   */
  position: { left: number; top: number };

  /**
   * Additional class name.
   */
  className?: string;

  /**
   * Reference to the trigger element (e.g., link button).
   * Clicks on this element won't close the popover.
   */
  triggerRef?: React.RefObject<HTMLElement>;
}

/**
 * Validates if a string is a valid URL.
 * Accepts URLs with or without protocol.
 */
function isValidUrl(url: string): boolean {
  if (!url.trim()) return false;

  // Add https:// if no protocol specified
  const urlToTest = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;

  try {
    new URL(urlToTest);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalizes URL by adding https:// if no protocol present.
 */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * LinkPopover component.
 *
 * A compact floating popover for managing links on selected text.
 */
export function LinkPopover({
  editor,
  currentUrl,
  onClose,
  position,
  className,
  triggerRef,
}: LinkPopoverProps): React.ReactElement {
  const [url, setUrl] = useState(currentUrl || '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Don't close if clicking on the popover itself
      if (popoverRef.current && popoverRef.current.contains(target)) {
        return;
      }

      // Don't close if clicking on the trigger button
      if (triggerRef?.current && triggerRef.current.contains(target)) {
        return;
      }

      onClose();
    };

    // Use requestAnimationFrame to ensure the popover is rendered before listening
    const frameId = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClickOutside);
    });

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, triggerRef]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!url.trim()) {
        setError('Please enter a URL');
        return;
      }

      if (!isValidUrl(url)) {
        setError('Please enter a valid URL');
        return;
      }

      const normalizedUrl = normalizeUrl(url);
      editor.setLink(normalizedUrl);
      editor.pm.view.focus();
      onClose();
    },
    [editor, url, onClose]
  );

  const handleRemove = useCallback(() => {
    editor.removeLink();
    editor.pm.view.focus();
    onClose();
  }, [editor, onClose]);

  const handleOpenLink = useCallback(() => {
    if (currentUrl) {
      window.open(currentUrl, '_blank', 'noopener,noreferrer');
    }
  }, [currentUrl]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setError(null);
  }, []);

  const isEditing = currentUrl !== null;

  return (
    <div
      ref={popoverRef}
      className={`ob-link-popover ${className || ''}`}
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        zIndex: 1001,
      }}
      role="dialog"
      aria-label={isEditing ? 'Edit link' : 'Add link'}
    >
      <form onSubmit={handleSubmit} className="ob-link-popover-form">
        <div className="ob-link-popover-input-row">
          <div className={`ob-link-popover-input-wrapper ${error ? 'ob-link-popover-input-wrapper--error' : ''}`}>
            <svg
              className="ob-link-popover-input-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="ob-link-popover-input"
              value={url}
              onChange={handleInputChange}
              placeholder="Enter URL..."
              aria-label="Link URL"
              aria-invalid={!!error}
            />
            {isEditing && (
              <>
                <button
                  type="button"
                  className="ob-link-popover-inline-btn"
                  onClick={handleOpenLink}
                  title="Open link"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="ob-link-popover-inline-btn ob-link-popover-inline-btn--danger"
                  onClick={handleRemove}
                  title="Remove link"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </>
            )}
            <button
              type="submit"
              className="ob-link-popover-inline-btn ob-link-popover-inline-btn--primary"
              title={isEditing ? 'Update link' : 'Add link'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </div>
        </div>
        {error && <p className="ob-link-popover-error">{error}</p>}
      </form>
    </div>
  );
}
