/**
 * Text color mark specification.
 *
 * @module
 */

import type { MarkSpec, DOMOutputSpec, Mark } from 'prosemirror-model';

/**
 * Text color mark spec.
 *
 * Renders as `<span style="color: ...">` in HTML.
 *
 * @example
 * ```typescript
 * // In block content:
 * {
 *   type: 'text',
 *   text: 'Red text',
 *   styles: {
 *     textColor: '#ff0000'
 *   }
 * }
 * ```
 */
export const textColorMark: MarkSpec = {
  attrs: {
    color: {},
  },
  parseDOM: [
    {
      style: 'color',
      getAttrs(value: string) {
        return { color: value };
      },
    },
    {
      tag: 'span[data-text-color]',
      getAttrs(dom: HTMLElement) {
        return { color: dom.getAttribute('data-text-color') };
      },
    },
  ],
  toDOM(mark: Mark): DOMOutputSpec {
    return [
      'span',
      {
        'data-text-color': mark.attrs.color,
        style: `color: ${mark.attrs.color}`,
      },
      0,
    ];
  },
};
