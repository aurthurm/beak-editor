/**
 * Inline code mark specification.
 *
 * @module
 */

import type { MarkSpec, DOMOutputSpec } from 'prosemirror-model';

/**
 * Inline code mark spec.
 *
 * Renders as `<code>` in HTML. For code blocks, use the codeBlock node instead.
 *
 * @example
 * ```typescript
 * // In block content:
 * { type: 'text', text: 'const x = 1', styles: { code: true } }
 * ```
 */
export const codeMark: MarkSpec = {
  parseDOM: [{ tag: 'code' }],
  toDOM(): DOMOutputSpec {
    return ['code', 0];
  },
};
