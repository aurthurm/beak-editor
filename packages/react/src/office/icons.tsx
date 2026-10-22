/**
 * Minimal inline SVG icon set for the Office shell.
 *
 * Path data is shared with the Vue shell via `@amusendame/beakblock-commands`. Unknown names
 * fall back to the first letter of the name, so new commands still render something sensible.
 *
 * @module
 */

import React from 'react';
import { BUILTIN_ICON_PATHS, hasBuiltinIcon } from '@amusendame/beakblock-commands';

/** Props for {@link OfficeIcon}. */
export interface OfficeIconProps {
  /** Icon name, for example `bold`, `undo-2`, `heading`. */
  name?: string | null;
  /** Rendered size in px. Default 16. */
  size?: number;
  /** Accessible label. Omit for decorative icons. */
  label?: string;
}

/** Render a named icon as inline SVG, or the first letter of the name when unknown. */
export function OfficeIcon({ name, size = 16, label }: OfficeIconProps): React.ReactElement {
  const accessibility = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  if (!name || !hasBuiltinIcon(name)) {
    const letter = (name ?? '?').charAt(0).toUpperCase();
    return (
      <span className="bb-office-icon-letter" style={{ width: size, height: size }} {...accessibility}>
        {letter}
      </span>
    );
  }
  return (
    <svg
      className="bb-office-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...accessibility}
    >
      <path d={BUILTIN_ICON_PATHS[name]} />
    </svg>
  );
}

/** True when an icon name has a drawn glyph. */
export function hasOfficeIcon(name: string | null | undefined): boolean {
  return hasBuiltinIcon(name);
}
