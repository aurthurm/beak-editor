/**
 * Blockquote node specification.
 *
 * A block-level quotation element for cited or highlighted text.
 *
 * @module
 */

import type { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/**
 * Blockquote node spec.
 *
 * Renders as a `<blockquote>` element. Can contain inline content
 * with formatting marks.
 *
 * @example
 * ```typescript
 * // JSON block representation:
 * {
 *   id: 'quote-1',
 *   type: 'blockquote',
 *   props: {},
 *   content: [{ type: 'text', text: 'To be or not to be...', styles: { italic: true } }]
 * }
 * ```
 */
export const blockquoteNode: NodeSpec = {
  content: 'inline*',
  group: 'block',
  attrs: {
    id: { default: null },
  },
  parseDOM: [{ tag: 'blockquote' }],
  toDOM(node: PMNode): DOMOutputSpec {
    return ['blockquote', { class: 'beakblock-blockquote', 'data-block-id': node.attrs.id }, 0];
  },
};
