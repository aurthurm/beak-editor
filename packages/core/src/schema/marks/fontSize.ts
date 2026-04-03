/**
 * Font size mark specification.
 *
 * @module
 */

import type { DOMOutputSpec, Mark, MarkSpec } from 'prosemirror-model';

/**
 * Font size mark spec.
 *
 * Renders as a span with an explicit inline font size.
 */
export const fontSizeMark: MarkSpec = {
  attrs: {
    size: {},
  },
  parseDOM: [
    {
      style: 'font-size',
      getAttrs(value: string) {
        const parsed = Number.parseFloat(value);
        return { size: Number.isFinite(parsed) ? parsed : 16 };
      },
    },
    {
      tag: 'span[data-font-size]',
      getAttrs(dom: HTMLElement) {
        const raw = dom.getAttribute('data-font-size');
        const parsed = raw ? Number.parseFloat(raw) : NaN;
        return { size: Number.isFinite(parsed) ? parsed : 16 };
      },
    },
  ],
  toDOM(mark: Mark): DOMOutputSpec {
    return [
      'span',
      {
        'data-font-size': String(mark.attrs.size),
        style: `font-size: ${mark.attrs.size}px; line-height: 1; display: inline-block; vertical-align: middle;`,
      },
      0,
    ];
  },
};
