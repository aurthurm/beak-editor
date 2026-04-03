/**
 * TableRow node specification - A row within a table.
 *
 * A tableRow contains multiple tableCell nodes.
 *
 * @example
 * ```json
 * {
 *   "type": "tableRow",
 *   "attrs": { "id": "row-1" },
 *   "content": [
 *     { "type": "tableCell", "content": [...] },
 *     { "type": "tableCell", "content": [...] }
 *   ]
 * }
 * ```
 *
 * @module
 */

import { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/**
 * TableRow node spec for ProseMirror.
 *
 * Represents a row within a table.
 */
export const tableRowNode: NodeSpec = {
  content: '(tableCell | tableHeader)+',
  tableRole: 'row',

  attrs: {
    /** Unique block identifier */
    id: { default: null },
  },

  parseDOM: [
    {
      tag: 'tr',
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
      class: 'ob-table-row',
    };

    if (node.attrs.id) {
      attrs['data-block-id'] = node.attrs.id;
    }

    return ['tr', attrs, 0];
  },
};
