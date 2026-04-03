/**
 * Divider (horizontal rule) node specification.
 *
 * A visual separator between content sections.
 *
 * @module
 */

import type { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/**
 * Divider node spec.
 *
 * Renders as an `<hr>` element. This is a leaf node with no content.
 *
 * @example
 * ```typescript
 * // JSON block representation:
 * {
 *   id: 'divider-1',
 *   type: 'divider',
 *   props: {}
 * }
 * ```
 */
export const dividerNode: NodeSpec = {
  // No content - this is a leaf node
  group: 'block',
  attrs: {
    id: { default: null },
  },
  parseDOM: [{ tag: 'hr' }],
  toDOM(node: PMNode): DOMOutputSpec {
    return ['hr', { class: 'beakblock-divider', 'data-block-id': node.attrs.id }];
  },
};
