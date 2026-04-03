/**
 * Bold mark specification.
 *
 * @module
 */

import type { MarkSpec, DOMOutputSpec } from 'prosemirror-model';

/**
 * Bold mark spec.
 *
 * Renders as `<strong>` in HTML. Triggered by Cmd/Ctrl+B.
 *
 * @example
 * ```typescript
 * // In block content:
 * { type: 'text', text: 'Bold text', styles: { bold: true } }
 * ```
 */
export const boldMark: MarkSpec = {
  parseDOM: [
    { tag: 'strong' },
    { tag: 'b' },
    { style: 'font-weight=bold' },
    { style: 'font-weight=700' },
  ],
  toDOM(): DOMOutputSpec {
    return ['strong', 0];
  },
};
