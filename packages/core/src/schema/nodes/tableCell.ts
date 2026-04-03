/**
 * TableCell node specification - A cell within a table row.
 *
 * A tableCell can contain block content (paragraphs, lists, etc.)
 * and supports colspan/rowspan for merged cells.
 *
 * @example
 * ```json
 * {
 *   "type": "tableCell",
 *   "attrs": { "id": "cell-1", "colspan": 1, "rowspan": 1 },
 *   "content": [
 *     { "type": "paragraph", "content": [...] }
 *   ]
 * }
 * ```
 *
 * @module
 */

import { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/**
 * TableCell node spec for ProseMirror.
 *
 * Represents a cell within a table row.
 */
export const tableCellNode: NodeSpec = {
  content: 'block+',
  tableRole: 'cell',
  isolating: true,

  attrs: {
    /** Unique block identifier */
    id: { default: null },
    /** Number of columns this cell spans */
    colspan: { default: 1 },
    /** Number of rows this cell spans */
    rowspan: { default: 1 },
    /** Column width in pixels (null = auto) */
    colwidth: { default: null },
    /** Background color */
    backgroundColor: { default: null },
  },

  parseDOM: [
    {
      tag: 'td',
      getAttrs(dom: HTMLElement): Record<string, unknown> {
        const id = dom.getAttribute('data-block-id');
        const colspan = dom.getAttribute('colspan');
        const rowspan = dom.getAttribute('rowspan');
        const colwidth = dom.getAttribute('data-colwidth');
        const backgroundColor = dom.style.backgroundColor || null;

        return {
          id: id || null,
          colspan: colspan ? parseInt(colspan, 10) : 1,
          rowspan: rowspan ? parseInt(rowspan, 10) : 1,
          colwidth: colwidth ? colwidth.split(',').map((w) => parseInt(w, 10)) : null,
          backgroundColor,
        };
      },
    },
    {
      tag: 'th',
      getAttrs(dom: HTMLElement): Record<string, unknown> {
        const id = dom.getAttribute('data-block-id');
        const colspan = dom.getAttribute('colspan');
        const rowspan = dom.getAttribute('rowspan');
        const colwidth = dom.getAttribute('data-colwidth');
        const backgroundColor = dom.style.backgroundColor || null;

        return {
          id: id || null,
          colspan: colspan ? parseInt(colspan, 10) : 1,
          rowspan: rowspan ? parseInt(rowspan, 10) : 1,
          colwidth: colwidth ? colwidth.split(',').map((w) => parseInt(w, 10)) : null,
          backgroundColor,
        };
      },
    },
  ],

  toDOM(node: PMNode): DOMOutputSpec {
    const attrs: Record<string, string> = {
      class: 'ob-table-cell',
    };

    if (node.attrs.id) {
      attrs['data-block-id'] = node.attrs.id;
    }

    if (node.attrs.colspan > 1) {
      attrs.colspan = String(node.attrs.colspan);
    }

    if (node.attrs.rowspan > 1) {
      attrs.rowspan = String(node.attrs.rowspan);
    }

    if (node.attrs.colwidth) {
      attrs['data-colwidth'] = node.attrs.colwidth.join(',');
      attrs.style = `width: ${node.attrs.colwidth[0]}px`;
    }

    if (node.attrs.backgroundColor) {
      attrs.style = (attrs.style || '') + `background-color: ${node.attrs.backgroundColor}`;
    }

    return ['td', attrs, 0];
  },
};

/**
 * TableHeader node spec for ProseMirror.
 *
 * Represents a header cell within a table row.
 * Uses <th> instead of <td> for semantic HTML.
 */
export const tableHeaderNode: NodeSpec = {
  content: 'block+',
  tableRole: 'header_cell',
  isolating: true,

  attrs: {
    /** Unique block identifier */
    id: { default: null },
    /** Number of columns this cell spans */
    colspan: { default: 1 },
    /** Number of rows this cell spans */
    rowspan: { default: 1 },
    /** Column width in pixels (null = auto) */
    colwidth: { default: null },
    /** Background color */
    backgroundColor: { default: null },
  },

  parseDOM: [
    {
      tag: 'th',
      getAttrs(dom: HTMLElement): Record<string, unknown> {
        const id = dom.getAttribute('data-block-id');
        const colspan = dom.getAttribute('colspan');
        const rowspan = dom.getAttribute('rowspan');
        const colwidth = dom.getAttribute('data-colwidth');
        const backgroundColor = dom.style.backgroundColor || null;

        return {
          id: id || null,
          colspan: colspan ? parseInt(colspan, 10) : 1,
          rowspan: rowspan ? parseInt(rowspan, 10) : 1,
          colwidth: colwidth ? colwidth.split(',').map((w) => parseInt(w, 10)) : null,
          backgroundColor,
        };
      },
    },
  ],

  toDOM(node: PMNode): DOMOutputSpec {
    const attrs: Record<string, string> = {
      class: 'ob-table-header',
    };

    if (node.attrs.id) {
      attrs['data-block-id'] = node.attrs.id;
    }

    if (node.attrs.colspan > 1) {
      attrs.colspan = String(node.attrs.colspan);
    }

    if (node.attrs.rowspan > 1) {
      attrs.rowspan = String(node.attrs.rowspan);
    }

    if (node.attrs.colwidth) {
      attrs['data-colwidth'] = node.attrs.colwidth.join(',');
      attrs.style = `width: ${node.attrs.colwidth[0]}px`;
    }

    if (node.attrs.backgroundColor) {
      attrs.style = (attrs.style || '') + `background-color: ${node.attrs.backgroundColor}`;
    }

    return ['th', attrs, 0];
  },
};
