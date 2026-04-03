/**
 * Table node specification - Container for table rows.
 *
 * A table contains multiple tableRow nodes that are displayed vertically.
 * Each row contains tableCell nodes.
 *
 * @example
 * ```json
 * {
 *   "type": "table",
 *   "attrs": { "id": "table-1" },
 *   "content": [
 *     { "type": "tableRow", "content": [...] },
 *     { "type": "tableRow", "content": [...] }
 *   ]
 * }
 * ```
 *
 * @module
 */

import { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/**
 * Table node spec for ProseMirror.
 *
 * Represents a table container.
 */
export const tableNode: NodeSpec = {
  group: 'block',
  content: 'tableRow+',
  tableRole: 'table',
  defining: true,
  isolating: true,

  attrs: {
    /** Unique block identifier */
    id: { default: null },
  },

  parseDOM: [
    {
      tag: 'table',
      getAttrs(dom: HTMLElement): Record<string, unknown> {
        const id = dom.getAttribute('data-block-id');
        return {
          id: id || null,
        };
      },
    },
  ],

  toDOM(node: PMNode): DOMOutputSpec {
    const attrs: Record<string, string> = {
      class: 'ob-table',
    };

    if (node.attrs.id) {
      attrs['data-block-id'] = node.attrs.id;
    }

    return ['table', attrs, ['tbody', 0]];
  },
};
