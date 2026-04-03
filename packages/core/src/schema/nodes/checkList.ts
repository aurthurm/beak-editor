/**
 * Check list (todo list) node specifications.
 *
 * A list with checkable items for task tracking.
 *
 * @module
 */

import type { NodeSpec } from 'prosemirror-model';

/**
 * Check list container node.
 */
export const checkListNode: NodeSpec = {
  group: 'block',
  content: 'checkListItem+',
  attrs: {
    id: { default: null },
  },
  parseDOM: [
    {
      tag: 'ul.beakblock-checklist',
      getAttrs: (dom) => ({
        id: (dom as HTMLElement).getAttribute('data-block-id'),
      }),
    },
  ],
  toDOM: (node) => [
    'ul',
    {
      class: 'beakblock-checklist',
      'data-block-id': node.attrs.id || '',
    },
    0,
  ],
};

/**
 * Check list item node with a checkbox.
 */
export const checkListItemNode: NodeSpec = {
  content: 'inline*',
  attrs: {
    id: { default: null },
    checked: { default: false },
  },
  parseDOM: [
    {
      tag: 'li.beakblock-checklist-item',
      getAttrs: (dom) => {
        const element = dom as HTMLElement;
        const checkbox = element.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        return {
          id: element.getAttribute('data-block-id'),
          checked: checkbox?.checked || element.getAttribute('data-checked') === 'true',
        };
      },
    },
  ],
  toDOM: (node) => [
    'li',
    {
      class: `beakblock-checklist-item ${node.attrs.checked ? 'beakblock-checklist-item--checked' : ''}`,
      'data-block-id': node.attrs.id || '',
      'data-checked': String(node.attrs.checked),
    },
    [
      'label',
      { class: 'beakblock-checklist-label', contenteditable: 'false' },
      [
        'input',
        {
          type: 'checkbox',
          class: 'beakblock-checklist-checkbox',
          ...(node.attrs.checked ? { checked: 'checked' } : {}),
        },
      ],
    ],
    ['span', { class: 'beakblock-checklist-content' }, 0],
  ],
  // Allow dragging the entire item
  draggable: false,
};
