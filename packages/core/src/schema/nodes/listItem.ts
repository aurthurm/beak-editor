/**
 * List item node specification.
 *
 * A single item within a bullet or ordered list.
 *
 * @module
 */

import type { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/**
 * List item node spec.
 *
 * Renders as an `<li>` element. Can contain inline content directly,
 * or nested block content (including nested lists).
 *
 * @example
 * ```typescript
 * // JSON block representation (simple):
 * {
 *   id: 'item-1',
 *   type: 'listItem',
 *   props: {},
 *   content: [{ type: 'text', text: 'List item text', styles: {} }]
 * }
 *
 * // With nested list:
 * {
 *   id: 'item-1',
 *   type: 'listItem',
 *   props: {},
 *   content: [{ type: 'text', text: 'Parent item', styles: {} }],
 *   children: [
 *     { type: 'bulletList', children: [...] }
 *   ]
 * }
 * ```
 */
export const listItemNode: NodeSpec = {
  // Can contain a paragraph followed by optional nested lists
  content: 'paragraph block*',
  attrs: {
    id: { default: null },
  },
  // Allow list items to define their own boundary for operations
  defining: true,
  parseDOM: [{ tag: 'li' }],
  toDOM(node: PMNode): DOMOutputSpec {
    return ['li', { class: 'beakblock-list-item', 'data-block-id': node.attrs.id }, 0];
  },
};
