/**
 * Ordered list node specification.
 *
 * A numbered list container that holds list items.
 *
 * @module
 */

import type { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/**
 * Ordered list node spec.
 *
 * Renders as an `<ol>` element. Contains one or more listItem nodes.
 * The `start` prop allows starting the numbering from a specific value.
 *
 * @example
 * ```typescript
 * // JSON block representation:
 * {
 *   id: 'list-1',
 *   type: 'orderedList',
 *   props: { start: 1 },
 *   children: [
 *     { id: 'item-1', type: 'listItem', content: [{ type: 'text', text: 'Step one', styles: {} }] },
 *     { id: 'item-2', type: 'listItem', content: [{ type: 'text', text: 'Step two', styles: {} }] },
 *   ]
 * }
 * ```
 */
export const orderedListNode: NodeSpec = {
  content: 'listItem+',
  group: 'block',
  attrs: {
    id: { default: null },
    start: { default: 1 },
  },
  parseDOM: [
    {
      tag: 'ol',
      getAttrs(node) {
        const ol = node as HTMLElement;
        return { start: ol.hasAttribute('start') ? parseInt(ol.getAttribute('start') ?? '1', 10) : 1 };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const attrs: Record<string, string> = {
      class: 'beakblock-ordered-list',
      'data-block-id': node.attrs.id,
    };
    if (node.attrs.start !== 1) {
      attrs.start = String(node.attrs.start);
    }
    return ['ol', attrs, 0];
  },
};
