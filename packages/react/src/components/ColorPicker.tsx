/**
 * ColorPicker - React component for text and background color selection.
 *
 * Provides a unified dropdown with both text and background color options,
 * similar to Notion's color picker design.
 *
 * ## Basic Usage
 *
 * @example
 * ```tsx
 * <ColorPicker
 *   editor={editor}
 *   currentTextColor={state.activeMarks.textColor}
 *   currentBackgroundColor={state.activeMarks.backgroundColor}
 * />
 * ```
 *
 * ## Custom Color Palettes
 *
 * You can customize the available colors using `textColors` and `backgroundColors` props.
 *
 * @example Custom brand colors
 * ```tsx
 * const brandTextColors: ColorOption[] = [
 *   { value: '', label: 'Default' },
 *   { value: '#1a1a1a', label: 'Black' },
 *   { value: '#0066cc', label: 'Brand Blue' },
 *   { value: '#00994d', label: 'Brand Green' },
 * ];
 *
 * const brandBackgroundColors: ColorOption[] = [
 *   { value: '', label: 'Default' },
 *   { value: '#f0f7ff', label: 'Light Blue' },
 *   { value: '#f0fff5', label: 'Light Green' },
 * ];
 *
 * <ColorPicker
 *   editor={editor}
 *   currentTextColor={textColor}
 *   currentBackgroundColor={bgColor}
 *   textColors={brandTextColors}
 *   backgroundColors={brandBackgroundColors}
 * />
 * ```
 *
 * @module
 */

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { BeakBlockEditor } from '@amusendame/beakblock-core';

// ============================================================================
// Types
// ============================================================================

/**
 * Color option definition.
 */
export interface ColorOption {
  /** CSS color value (empty string for "Default"/remove color) */
  value: string;
  /** Display label for the color */
  label: string;
}

// ============================================================================
// Default Color Palettes
// ============================================================================

/**
 * Default text colors palette.
 * Use this as a base when creating custom palettes.
 */
export const DEFAULT_TEXT_COLORS: ColorOption[] = [
  { value: '', label: 'Default' },
  { value: '#374151', label: 'Gray' },
  { value: '#dc2626', label: 'Red' },
  { value: '#ea580c', label: 'Orange' },
  { value: '#ca8a04', label: 'Yellow' },
  { value: '#16a34a', label: 'Green' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#7c3aed', label: 'Purple' },
  { value: '#db2777', label: 'Pink' },
];

/**
 * Default background colors palette.
 * Use this as a base when creating custom palettes.
 */
export const DEFAULT_BACKGROUND_COLORS: ColorOption[] = [
  { value: '', label: 'Default' },
  { value: '#f3f4f6', label: 'Gray' },
  { value: '#fee2e2', label: 'Red' },
  { value: '#ffedd5', label: 'Orange' },
  { value: '#fef9c3', label: 'Yellow' },
  { value: '#dcfce7', label: 'Green' },
  { value: '#dbeafe', label: 'Blue' },
  { value: '#ede9fe', label: 'Purple' },
  { value: '#fce7f3', label: 'Pink' },
];

// ============================================================================
// Component
// ============================================================================

/**
 * Props for ColorPicker component.
 */
export interface ColorPickerProps {
  /**
   * The BeakBlockEditor instance.
   */
  editor: BeakBlockEditor;

  /**
   * Currently active text color (null if no color set).
   */
  currentTextColor: string | null;

  /**
   * Currently active background color (null if no color set).
   */
  currentBackgroundColor: string | null;

  /**
   * Custom text color palette.
   * If not provided, uses DEFAULT_TEXT_COLORS.
   */
  textColors?: ColorOption[];

  /**
   * Custom background color palette.
   * If not provided, uses DEFAULT_BACKGROUND_COLORS.
   */
  backgroundColors?: ColorOption[];

  /**
   * Label for the text color section.
   * @default "Color"
   */
  textColorLabel?: string;

  /**
   * Label for the background color section.
   * @default "Background"
   */
  backgroundColorLabel?: string;

  /**
   * Callback when color picker closes.
   */
  onClose?: () => void;
}

/**
 * ColorPicker component.
 *
 * Renders a unified dropdown with both text and background color options.
 */
export function ColorPicker({
  editor,
  currentTextColor,
  currentBackgroundColor,
  textColors = DEFAULT_TEXT_COLORS,
  backgroundColors = DEFAULT_BACKGROUND_COLORS,
  textColorLabel = 'Color',
  backgroundColorLabel = 'Background',
  onClose,
}: ColorPickerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ left: number; top?: number; bottom?: number }>({ left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasAnyColor = currentTextColor || currentBackgroundColor;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Determine if dropdown should open upward based on available space
  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current || !dropdownRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = dropdownRef.current.offsetHeight || 250;
    const spaceBelow = window.innerHeight - buttonRect.bottom - 8;
    const spaceAbove = buttonRect.top - 8;

    const shouldOpenUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

    setDropdownPosition({
      left: buttonRect.left + buttonRect.width / 2,
      ...(shouldOpenUpward
        ? { bottom: window.innerHeight - buttonRect.top + 8 }
        : { top: buttonRect.bottom + 8 }),
    });
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen]);

  const handleSelectTextColor = useCallback(
    (color: string) => {
      if (color === '') {
        editor.removeTextColor();
      } else {
        editor.setTextColor(color);
      }
      editor.pm.view.focus();
    },
    [editor]
  );

  const handleSelectBackgroundColor = useCallback(
    (color: string) => {
      if (color === '') {
        editor.removeBackgroundColor();
      } else {
        editor.setBackgroundColor(color);
      }
      editor.pm.view.focus();
    },
    [editor]
  );

  return (
    <div className="ob-color-picker" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`ob-bubble-menu-btn ${hasAnyColor ? 'ob-bubble-menu-btn--active' : ''}`}
        onClick={handleToggle}
        onMouseDown={(e) => e.preventDefault()}
        title="Colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {/* Color icon: "A" with colored underline */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M5 18h14"
            strokeWidth="3"
            stroke={currentTextColor || currentBackgroundColor || 'currentColor'}
          />
          <path d="M6 15l6-12 6 12" />
          <path d="M8.5 11h7" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="ob-color-picker-dropdown"
          role="listbox"
          style={{
            position: 'fixed',
            left: dropdownPosition.left,
            top: dropdownPosition.top,
            bottom: dropdownPosition.bottom,
            transform: 'translateX(-50%)',
          }}
        >
          {/* Text color section */}
          <div className="ob-color-picker-section">
            <div className="ob-color-picker-label">{textColorLabel}</div>
            <div className="ob-color-picker-grid">
              {textColors.map((color) => {
                const isActive = color.value === '' ? !currentTextColor : currentTextColor === color.value;
                return (
                  <button
                    key={`text-${color.value || 'default'}`}
                    type="button"
                    className={`ob-color-picker-option ${isActive ? 'ob-color-picker-option--active' : ''}`}
                    onClick={() => handleSelectTextColor(color.value)}
                    onMouseDown={(e) => e.preventDefault()}
                    role="option"
                    aria-selected={isActive}
                    title={color.label}
                  >
                    {color.value === '' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M4 4l16 16" />
                      </svg>
                    ) : (
                      <span className="ob-color-picker-swatch ob-color-picker-swatch--text">
                        <span style={{ color: color.value }}>A</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="ob-color-picker-divider" />

          {/* Background color section */}
          <div className="ob-color-picker-section">
            <div className="ob-color-picker-label">{backgroundColorLabel}</div>
            <div className="ob-color-picker-grid">
              {backgroundColors.map((color) => {
                const isActive = color.value === '' ? !currentBackgroundColor : currentBackgroundColor === color.value;
                return (
                  <button
                    key={`bg-${color.value || 'default'}`}
                    type="button"
                    className={`ob-color-picker-option ${isActive ? 'ob-color-picker-option--active' : ''}`}
                    onClick={() => handleSelectBackgroundColor(color.value)}
                    onMouseDown={(e) => e.preventDefault()}
                    role="option"
                    aria-selected={isActive}
                    title={color.label}
                  >
                    {color.value === '' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M4 4l16 16" />
                      </svg>
                    ) : (
                      <span
                        className="ob-color-picker-swatch"
                        style={{ backgroundColor: color.value }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
