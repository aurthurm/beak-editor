/**
 * Bullet list node specification.
 *
 * An unordered list container that holds list items.
 *
 * @module
 */

import type { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/**
 * Bullet list node spec.
 *
 * Renders as a `<ul>` element. Contains one or more listItem nodes.
 * This node itself is a container - the actual content lives in listItem children.
 *
 * @example
 * ```typescript
 * // JSON block representation:
 * {
 *   id: 'list-1',
 *   type: 'bulletList',
 *   props: {},
 *   children: [
 *     { id: 'item-1', type: 'listItem', content: [{ type: 'text', text: 'First item', styles: {} }] },
 *     { id: 'item-2', type: 'listItem', content: [{ type: 'text', text: 'Second item', styles: {} }] },
 *   ]
 * }
 * ```
 */
export const bulletListNode: NodeSpec = {
  content: 'listItem+',
  group: 'block',
  attrs: {
    id: { default: null },
  },
  parseDOM: [{ tag: 'ul' }],
  toDOM(node: PMNode): DOMOutputSpec {
    return ['ul', { class: 'beakblock-bullet-list', 'data-block-id': node.attrs.id }, 0];
  },
};
