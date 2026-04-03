/**
 * Underline mark specification.
 *
 * @module
 */

import type { MarkSpec, DOMOutputSpec } from 'prosemirror-model';

/**
 * Underline mark spec.
 *
 * Renders as `<u>` in HTML. Triggered by Cmd/Ctrl+U.
 *
 * @example
 * ```typescript
 * // In block content:
 * { type: 'text', text: 'Underlined text', styles: { underline: true } }
 * ```
 */
export const underlineMark: MarkSpec = {
  parseDOM: [
    { tag: 'u' },
    { style: 'text-decoration=underline' },
  ],
  toDOM(): DOMOutputSpec {
    return ['u', 0];
  },
};
