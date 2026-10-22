/**
 * Placeholder for a block whose type is not registered.
 *
 * The original type, props, content and children are kept as JSON so the block serialises back
 * to exactly the JSON it was loaded from. Nothing is rendered or edited inside it.
 *
 * @module
 */

import type { DOMOutputSpec, NodeSpec, Node as PMNode } from 'prosemirror-model';

/**
 * `unknownBlock`: an atom holding an unregistered block as JSON.
 *
 * Attrs: `originalType`, `propsJson`, `contentJson` and `childrenJson` (JSON text, `null` when the
 * original block had no such key).
 */
export const unknownBlockNode: NodeSpec = {
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    id: { default: null },
    originalType: { default: '' },
    propsJson: { default: '{}' },
    contentJson: { default: null },
    childrenJson: { default: null },
  },
  parseDOM: [
    {
      tag: 'div[data-unknown-block]',
      getAttrs(dom: HTMLElement) {
        return {
          id: dom.getAttribute('data-block-id'),
          originalType: dom.getAttribute('data-unknown-block') ?? '',
          propsJson: dom.getAttribute('data-props') ?? '{}',
          contentJson: dom.getAttribute('data-content'),
          childrenJson: dom.getAttribute('data-children'),
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const attrs: Record<string, string> = {
      class: 'beakblock-unknown-block',
      'data-unknown-block': String(node.attrs.originalType ?? ''),
      'data-props': String(node.attrs.propsJson ?? '{}'),
    };
    if (node.attrs.id) attrs['data-block-id'] = String(node.attrs.id);
    if (node.attrs.contentJson !== null) attrs['data-content'] = String(node.attrs.contentJson);
    if (node.attrs.childrenJson !== null) attrs['data-children'] = String(node.attrs.childrenJson);
    return ['div', attrs, `Unregistered block: ${String(node.attrs.originalType ?? '')}`];
  },
};
