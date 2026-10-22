/**
 * TableCell and TableHeader node specifications.
 *
 * Cells hold block content and carry Office-class formatting attrs (contract
 * §1.6): widths in twips, per-edge borders, shading, padding and alignment.
 * `backgroundColor` is a legacy alias kept for existing documents; rendering
 * prefers `shading`.
 *
 * @module
 */

import { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';
import {
  cellDomSpec,
  tableCellAttrsFromDom,
  tableCellOfficeAttrs,
} from './tableOffice';

/** Shared attrs for td and th. */
const cellAttrs = {
  /** Unique block identifier */
  id: { default: null },
  /** Number of columns this cell spans */
  colspan: { default: 1 },
  /** Number of rows this cell spans */
  rowspan: { default: 1 },
  /** Column widths in CSS px, one per spanned column (prosemirror-tables) */
  colwidth: { default: null },
  /** Legacy background colour (alias of `shading`) */
  backgroundColor: { default: null },
  ...tableCellOfficeAttrs,
};

/**
 * TableCell node spec for ProseMirror.
 */
export const tableCellNode: NodeSpec = {
  content: 'block+',
  tableRole: 'cell',
  isolating: true,

  attrs: cellAttrs,

  parseDOM: [
    {
      tag: 'td',
      getAttrs(dom: HTMLElement): Record<string, unknown> {
        return tableCellAttrsFromDom(dom);
      },
    },
  ],

  toDOM(node: PMNode): DOMOutputSpec {
    return cellDomSpec('td', node.attrs, 'ob-table-cell');
  },
};

/**
 * TableHeader node spec for ProseMirror.
 *
 * Represents a header cell within a table row (uses `<th>`).
 */
export const tableHeaderNode: NodeSpec = {
  content: 'block+',
  tableRole: 'header_cell',
  isolating: true,

  attrs: cellAttrs,

  parseDOM: [
    {
      tag: 'th',
      getAttrs(dom: HTMLElement): Record<string, unknown> {
        return tableCellAttrsFromDom(dom);
      },
    },
  ],

  toDOM(node: PMNode): DOMOutputSpec {
    return cellDomSpec('th', node.attrs, 'ob-table-header');
  },
};
