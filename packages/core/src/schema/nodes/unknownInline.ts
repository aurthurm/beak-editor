/**
 * Placeholder for an inline node whose type is not registered.
 *
 * The original type, props and inline content are kept as JSON so the item serialises back to
 * exactly the JSON it was loaded from. It is an atom: it can be selected and deleted, but its
 * contents cannot be edited.
 *
 * @module
 */

import type { DOMOutputSpec, NodeSpec, Node as PMNode } from 'prosemirror-model';

/**
 * `unknownInline`: an inline atom holding an unregistered inline item as JSON.
 *
 * Attrs: `originalType`, `propsJson`, `contentJson` (JSON text). `propsJson` and `contentJson` are
 * `null` when the original item had no such key, so the round trip does not add keys.
 */
export const unknownInlineNode: NodeSpec = {
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    originalType: { default: '' },
    propsJson: { default: null },
    contentJson: { default: null },
  },
  parseDOM: [
    {
      tag: 'span[data-unknown-inline]',
      getAttrs(dom: HTMLElement) {
        return {
          originalType: dom.getAttribute('data-unknown-inline') ?? '',
          propsJson: dom.getAttribute('data-props'),
          contentJson: dom.getAttribute('data-content'),
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const type = String(node.attrs.originalType ?? '');
    const attrs: Record<string, string> = {
      class: 'beakblock-unknown-inline',
      contenteditable: 'false',
      'data-unknown-inline': type,
      'aria-label': `Unsupported inline: ${type}`,
    };
    if (node.attrs.propsJson !== null) attrs['data-props'] = String(node.attrs.propsJson);
    if (node.attrs.contentJson !== null) attrs['data-content'] = String(node.attrs.contentJson);
    return ['span', attrs, `[${type}]`];
  },
};
