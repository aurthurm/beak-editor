/**
 * Background color mark specification.
 *
 * @module
 */

import type { MarkSpec, DOMOutputSpec, Mark } from 'prosemirror-model';

/**
 * Background color mark spec.
 *
 * Renders as `<span style="background-color: ...">` in HTML.
 *
 * @example
 * ```typescript
 * // In block content:
 * {
 *   type: 'text',
 *   text: 'Highlighted text',
 *   styles: {
 *     backgroundColor: '#ffff00'
 *   }
 * }
 * ```
 */
export const backgroundColorMark: MarkSpec = {
  attrs: {
    color: {},
  },
  parseDOM: [
    {
      style: 'background-color',
      getAttrs(value: string) {
        return { color: value };
      },
    },
    {
      tag: 'span[data-background-color]',
      getAttrs(dom: HTMLElement) {
        return { color: dom.getAttribute('data-background-color') };
      },
    },
    {
      tag: 'mark',
      getAttrs(dom: HTMLElement) {
        const bgColor = dom.style.backgroundColor;
        return { color: bgColor || '#ffff00' };
      },
    },
  ],
  toDOM(mark: Mark): DOMOutputSpec {
    return [
      'span',
      {
        'data-background-color': mark.attrs.color,
        style: `background-color: ${mark.attrs.color}; border-radius: 2px; padding: 0 2px;`,
      },
      0,
    ];
  },
};
