/**
 * Image node specification.
 *
 * Represents an image block with src, alt, caption and alignment.
 *
 * @module
 */

import type { NodeSpec } from 'prosemirror-model';

export type ImageAlignment = 'left' | 'center' | 'right';

export const imageNode: NodeSpec = {
  group: 'block',
  // Image is atomic - no editable content inside
  atom: true,
  draggable: true,
  attrs: {
    id: { default: null },
    src: { default: '' },
    alt: { default: '' },
    caption: { default: '' },
    width: { default: null as number | null },
    alignment: { default: 'center' as ImageAlignment },
  },
  parseDOM: [
    {
      tag: 'figure.beakblock-image',
      getAttrs: (dom) => {
        const element = dom as HTMLElement;
        const img = element.querySelector('img');
        return {
          id: element.getAttribute('data-block-id'),
          src: img?.getAttribute('src') || '',
          alt: img?.getAttribute('alt') || '',
          caption: element.querySelector('figcaption')?.textContent || '',
          width: img?.getAttribute('data-width') ? parseInt(img.getAttribute('data-width') ?? '0') : null,
          alignment: element.getAttribute('data-alignment') || 'center',
        };
      },
    },
    {
      tag: 'img[src]',
      getAttrs: (dom) => {
        const element = dom as HTMLImageElement;
        return {
          src: element.getAttribute('src') || '',
          alt: element.getAttribute('alt') || '',
          width: element.width || null,
        };
      },
    },
  ],
  toDOM: (node) => {
    const { src, alt, caption, width, alignment, id } = node.attrs;

    const figureAttrs: Record<string, string> = {
      class: `beakblock-image beakblock-image--${alignment}`,
      'data-block-id': id || '',
      'data-alignment': alignment,
    };

    // If no src, show a placeholder
    if (!src) {
      const placeholderDiv = [
        'div',
        { class: 'beakblock-image-placeholder' },
        ['span', { class: 'beakblock-image-placeholder-icon' }],
        ['span', { class: 'beakblock-image-placeholder-text' }, 'Click to add an image'],
      ] as const;

      if (caption) {
        return ['figure', figureAttrs, placeholderDiv, ['figcaption', {}, caption]];
      }
      return ['figure', figureAttrs, placeholderDiv];
    }

    const imgAttrs: Record<string, string> = { src, alt };
    if (width) {
      imgAttrs['data-width'] = String(width);
      imgAttrs.style = `width: ${width}px`;
    }

    if (caption) {
      return [
        'figure',
        figureAttrs,
        ['img', imgAttrs],
        ['figcaption', {}, caption],
      ];
    }

    return ['figure', figureAttrs, ['img', imgAttrs]];
  },
};
