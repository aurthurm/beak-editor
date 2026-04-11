/**
 * Table of contents block — auto-filled list of document headings (see tableOfContentsPlugin).
 *
 * @module
 */

import type { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/**
 * One entry in the TOC, stored in attrs.itemsJson and in Block JSON as props.items.
 */
export type TocHeadingItem = {
  /** Heading block id (matches heading node attrs.id) */
  id: string;
  level: number;
  text: string;
};

export const tableOfContentsNode: NodeSpec = {
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  attrs: {
    id: { default: null },
    /** JSON-encoded TocHeadingItem[] */
    itemsJson: { default: '[]' },
  },
  parseDOM: [
    {
      tag: 'div.beakblock-toc[data-beakblock-toc]',
      getAttrs(dom) {
        const el = dom as HTMLElement;
        return {
          id: el.getAttribute('data-block-id'),
          itemsJson: el.getAttribute('data-items') || '[]',
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    return [
      'div',
      {
        class: 'beakblock-toc',
        'data-beakblock-toc': 'true',
        'data-block-id': node.attrs.id || '',
        'data-items': String(node.attrs.itemsJson ?? '[]'),
      },
    ];
  },
};
