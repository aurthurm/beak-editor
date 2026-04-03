/**
 * Column node specification - Individual column within a columnList.
 *
 * A column can contain any block content and has a configurable width.
 * Width is expressed as a percentage (0-100) or as a flex ratio.
 *
 * @example
 * ```json
 * {
 *   "type": "column",
 *   "attrs": { "width": 50 },
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
 * Column node spec for ProseMirror.
 *
 * Represents a single column within a columnList.
 */
export const columnNode: NodeSpec = {
  // Note: columns are not in the 'block' group to prevent them from being
  // inserted outside of a columnList
  content: 'block+',
  defining: true,
  isolating: true,

  attrs: {
    /** Unique block identifier */
    id: { default: null },
    /** Width as a percentage (1-100) */
    width: { default: 50 },
  },

  parseDOM: [
    {
      tag: 'div[data-column]',
      getAttrs(dom: HTMLElement): Record<string, unknown> {
        const width = dom.getAttribute('data-width');
        const id = dom.getAttribute('data-block-id');
        return {
          id: id || null,
          width: width ? parseInt(width, 10) : 50,
        };
      },
    },
  ],

  toDOM(node: PMNode): DOMOutputSpec {
    const attrs: Record<string, string> = {
      'data-column': '',
      'data-width': String(node.attrs.width),
      class: 'ob-column',
      style: 'min-width: 0;',
    };

    if (node.attrs.id) {
      attrs['data-block-id'] = node.attrs.id;
    }

    return ['div', attrs, 0];
  },
};
