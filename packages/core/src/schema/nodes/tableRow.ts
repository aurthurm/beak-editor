/**
 * TableRow node specification - A row within an Office-class table.
 *
 * Row attrs (contract §1.6): `isHeader` (repeat as header row), `cantSplit`
 * (prevent splitting across pages) and `heightTwips`.
 *
 * @module
 */

import { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';
import { tableRowAttrsFromDom, tableRowDomAttrs, tableRowOfficeAttrs } from './tableOffice';

/**
 * TableRow node spec for ProseMirror.
 */
export const tableRowNode: NodeSpec = {
  content: '(tableCell | tableHeader)+',
  tableRole: 'row',

  attrs: {
    /** Unique block identifier */
    id: { default: null },
    ...tableRowOfficeAttrs,
  },

  parseDOM: [
    {
      tag: 'tr',
      getAttrs(dom: HTMLElement): Record<string, unknown> {
        return tableRowAttrsFromDom(dom);
      },
    },
  ],

  toDOM(node: PMNode): DOMOutputSpec {
    return ['tr', tableRowDomAttrs(node.attrs), 0];
  },
};
