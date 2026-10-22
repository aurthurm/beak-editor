/**
 * Section break node specification.
 *
 * A block-level atom that starts a new section with its own page setup
 * (size, orientation, margins, columns). Contract §1.2.
 *
 * @module
 */

import type { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/**
 * Page dimensions and margins for one section. All lengths in twips
 * (1pt = 20 twips, 1in = 1440 twips).
 */
export interface PageSetup {
  size: { widthTwips: number; heightTwips: number };
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    header: number;
    footer: number;
    gutter: number;
  };
  columns?: { count: number; spaceTwips: number };
}

/**
 * Section break node spec.
 *
 * Renders as a labelled separator. `pageSetup` is `null` when the section
 * inherits the document page setup.
 *
 * @example
 * ```typescript
 * // JSON block representation:
 * { id: 'sb-1', type: 'sectionBreak', props: { pageSetup: null } }
 * ```
 */
export const sectionBreakNode: NodeSpec = {
  group: 'block',
  atom: true,
  selectable: true,
  attrs: {
    id: { default: null },
    pageSetup: { default: null },
  },
  parseDOM: [
    {
      tag: 'div[data-beakblock-section-break]',
      getAttrs(dom: HTMLElement) {
        let pageSetup: PageSetup | null = null;
        const raw = dom.getAttribute('data-page-setup');
        if (raw) {
          try {
            pageSetup = JSON.parse(raw) as PageSetup;
          } catch {
            pageSetup = null;
          }
        }
        return { id: dom.getAttribute('data-block-id'), pageSetup };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const attrs: Record<string, string> = {
      class: 'beakblock-section-break',
      'data-beakblock-section-break': 'true',
      'data-block-id': node.attrs.id,
      role: 'separator',
      'aria-label': 'Section break',
    };
    if (node.attrs.pageSetup) {
      attrs['data-page-setup'] = JSON.stringify(node.attrs.pageSetup);
    }
    return ['div', attrs];
  },
};
