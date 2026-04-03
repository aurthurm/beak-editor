/**
 * Callout node specification.
 *
 * A highlighted block for important information, tips, warnings, or notes.
 * Similar to Notion's callout or GitHub's alert boxes.
 *
 * @module
 */

import type { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/**
 * Available callout types/variants.
 */
export type CalloutType = 'info' | 'warning' | 'success' | 'error' | 'note';

/**
 * Callout node spec.
 *
 * Renders as a `<div>` with callout styling. Can contain inline content
 * with formatting marks.
 *
 * @example
 * ```typescript
 * // JSON block representation:
 * {
 *   id: 'callout-1',
 *   type: 'callout',
 *   props: { calloutType: 'info' },
 *   content: [{ type: 'text', text: 'This is important!', styles: {} }]
 * }
 * ```
 */
export const calloutNode: NodeSpec = {
  content: 'inline*',
  group: 'block',
  attrs: {
    id: { default: null },
    calloutType: { default: 'info' as CalloutType },
  },
  parseDOM: [
    {
      tag: 'div.beakblock-callout',
      getAttrs(dom) {
        const element = dom as HTMLElement;
        return {
          calloutType: element.dataset.calloutType || 'info',
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const calloutType = node.attrs.calloutType as CalloutType;
    return [
      'div',
      {
        class: `beakblock-callout beakblock-callout--${calloutType}`,
        'data-block-id': node.attrs.id,
        'data-callout-type': calloutType,
      },
      0,
    ];
  },
};
