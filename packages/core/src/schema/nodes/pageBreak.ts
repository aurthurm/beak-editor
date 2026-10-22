/**
 * Page break node specification.
 *
 * A block-level atom that forces content onto a new page when printed or laid out.
 *
 * @module
 */

import type { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/**
 * Page break node spec (block atom, no attrs besides `id`).
 *
 * @example
 * ```typescript
 * // JSON block representation:
 * { id: 'pb-1', type: 'pageBreak', props: {} }
 * ```
 */
export const pageBreakNode: NodeSpec = {
  group: 'block',
  atom: true,
  selectable: true,
  attrs: {
    id: { default: null },
  },
  parseDOM: [
    {
      tag: 'div[data-beakblock-page-break]',
      getAttrs(dom: HTMLElement) {
        return { id: dom.getAttribute('data-block-id') };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    return [
      'div',
      {
        class: 'beakblock-page-break',
        'data-beakblock-page-break': 'true',
        'data-block-id': node.attrs.id,
        role: 'separator',
        'aria-label': 'Page break',
      },
    ];
  },
};
