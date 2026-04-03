/**
 * Italic mark specification.
 *
 * @module
 */

import type { MarkSpec, DOMOutputSpec } from 'prosemirror-model';

/**
 * Italic mark spec.
 *
 * Renders as `<em>` in HTML. Triggered by Cmd/Ctrl+I.
 *
 * @example
 * ```typescript
 * // In block content:
 * { type: 'text', text: 'Italic text', styles: { italic: true } }
 * ```
 */
export const italicMark: MarkSpec = {
  parseDOM: [
    { tag: 'em' },
    { tag: 'i' },
    { style: 'font-style=italic' },
  ],
  toDOM(): DOMOutputSpec {
    return ['em', 0];
  },
};
