/**
 * Strikethrough mark specification.
 *
 * @module
 */

import type { MarkSpec, DOMOutputSpec } from 'prosemirror-model';

/**
 * Strikethrough mark spec.
 *
 * Renders as `<s>` in HTML.
 *
 * @example
 * ```typescript
 * // In block content:
 * { type: 'text', text: 'Deleted text', styles: { strikethrough: true } }
 * ```
 */
export const strikethroughMark: MarkSpec = {
  parseDOM: [
    { tag: 's' },
    { tag: 'strike' },
    { style: 'text-decoration=line-through' },
  ],
  toDOM(): DOMOutputSpec {
    return ['s', 0];
  },
};
