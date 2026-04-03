/**
 * Inline icon node specification.
 *
 * Represents a selected icon/symbol inside the document.
 *
 * @module
 */

import type { Node, NodeSpec } from 'prosemirror-model';

export const iconNode: NodeSpec = {
  inline: true,
  group: 'inline',
  atom: true,
  selectable: false,
  attrs: {
    icon: { default: '' },
    symbol: { default: '' },
    size: { default: 36 },
  },
  parseDOM: [
    {
      tag: 'span[data-beakblock-icon]',
      getAttrs(dom: HTMLElement) {
        return {
          icon: dom.getAttribute('data-icon') || '',
          symbol: dom.getAttribute('data-symbol') || dom.textContent || '',
          size: Number.parseFloat(dom.getAttribute('data-size') || '') || 36,
        };
      },
    },
  ],
  toDOM(node: Node) {
    const { icon, symbol, size } = node.attrs;
    return [
      'span',
      {
        'data-beakblock-icon': 'true',
        'data-icon': icon,
        'data-symbol': symbol,
        'data-size': String(size),
        style: `font-size: ${size}px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; vertical-align: middle;`,
      },
      symbol || '✦',
    ];
  },
};
