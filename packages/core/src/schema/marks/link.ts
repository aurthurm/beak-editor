/**
 * Link mark specification.
 *
 * @module
 */

import type { MarkSpec, DOMOutputSpec, Mark } from 'prosemirror-model';

/**
 * Link mark spec.
 *
 * Renders as `<a>` in HTML. Supports href, title, and target attributes.
 *
 * @example
 * ```typescript
 * // In block content:
 * {
 *   type: 'text',
 *   text: 'Click here',
 *   styles: {
 *     link: { href: 'https://example.com', title: 'Example' }
 *   }
 * }
 * ```
 */
export const linkMark: MarkSpec = {
  attrs: {
    href: {},
    title: { default: null },
    target: { default: null },
  },
  // Links don't extend to adjacent text typed at link boundaries
  inclusive: false,
  parseDOM: [
    {
      tag: 'a[href]',
      getAttrs(dom: HTMLElement) {
        return {
          href: dom.getAttribute('href'),
          title: dom.getAttribute('title'),
          target: dom.getAttribute('target'),
        };
      },
    },
  ],
  toDOM(mark: Mark): DOMOutputSpec {
    return [
      'a',
      {
        href: mark.attrs.href,
        title: mark.attrs.title,
        target: mark.attrs.target || '_blank',
        rel: 'noopener noreferrer',
      },
      0,
    ];
  },
};
