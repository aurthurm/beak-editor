/**
 * ColumnList node specification - Container for multi-column layouts.
 *
 * A columnList contains multiple column nodes that are displayed side by side.
 * Each column can contain any block content.
 *
 * @example
 * ```json
 * {
 *   "type": "columnList",
 *   "content": [
 *     { "type": "column", "attrs": { "width": 50 }, "content": [...] },
 *     { "type": "column", "attrs": { "width": 50 }, "content": [...] }
 *   ]
 * }
 * ```
 *
 * @module
 */

import { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/**
 * ColumnList node spec for ProseMirror.
 *
 * Represents a horizontal container for columns.
 */
export const columnListNode: NodeSpec = {
  group: 'block',
  content: 'column+',
  defining: true,
  isolating: true,

  attrs: {
    /** Unique block identifier */
    id: { default: null },
    /** Gap between columns in pixels */
    gap: { default: 16 },
  },

  parseDOM: [
    {
      tag: 'div[data-column-list]',
      getAttrs(dom: HTMLElement): Record<string, unknown> {
        const gap = dom.getAttribute('data-gap');
        const id = dom.getAttribute('data-block-id');
        return {
          id: id || null,
          gap: gap ? parseInt(gap, 10) : 16,
        };
      },
    },
  ],

  toDOM(node: PMNode): DOMOutputSpec {
    const tracks = Array.from({ length: node.childCount }, (_child, index) => {
      const child = node.child(index);
      const width = Number(child.attrs?.width || 1);
      return `minmax(0, ${Math.max(width, 1)}fr)`;
    }).join(' ');

    const attrs: Record<string, string> = {
      'data-column-list': '',
      'data-gap': String(node.attrs.gap),
      class: 'ob-column-list',
      style: `display: grid; grid-template-columns: ${tracks}; gap: ${node.attrs.gap}px`,
    };

    if (node.attrs.id) {
      attrs['data-block-id'] = node.attrs.id;
    }

    return ['div', attrs, 0];
  },
};
