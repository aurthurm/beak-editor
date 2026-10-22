/**
 * Table node specification - Office-class table container.
 *
 * A table contains tableRow nodes. Column structure, merges and selection are
 * handled by prosemirror-tables (`tableRole: 'table'`). Contract §1.6 adds
 * width mode/value, table style id and conditional look flags.
 *
 * @example
 * ```json
 * {
 *   "type": "table",
 *   "props": { "widthMode": "fixed", "widthValue": 9360, "styleId": "GridTable4", "look": { "headerRow": true } },
 *   "children": [{ "type": "tableRow", "props": {}, "children": [] }]
 * }
 * ```
 *
 * @module
 */

import { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';
import { tableAttrsFromDom, tableDomAttrs, tableOfficeAttrs } from './tableOffice';

/**
 * Table node spec for ProseMirror.
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
    ...tableOfficeAttrs,
  },

  parseDOM: [
    {
      tag: 'table',
      getAttrs(dom: HTMLElement): Record<string, unknown> {
        return tableAttrsFromDom(dom);
      },
    },
  ],

  toDOM(node: PMNode): DOMOutputSpec {
    return ['table', tableDomAttrs(node.attrs), ['tbody', 0]];
  },
};
