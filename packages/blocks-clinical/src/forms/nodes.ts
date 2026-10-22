/**
 * Node specifications for form controls.
 *
 * Fields are block atoms rather than inline atoms: core's `nodeToBlock` only
 * serialises text, icon, hard break and field inline content, so inline controls
 * would be dropped by `getDocument()`. Sections and rows are block containers.
 *
 * @module
 */

import type { DOMOutputSpec, NodeSpec, Node as PMNode } from 'prosemirror-model';
import { attrsToDataAttr, displayValue, readDataAttrs } from '../dom';

/** Field node types that hold a value. */
export const FORM_FIELD_TYPES: ReadonlySet<string> = new Set([
  'formText',
  'formNumber',
  'formDate',
  'formDropdown',
  'formCheckbox',
  'formRadio',
  'formCalculated',
]);

/** Container node types whose children are form fields. */
export const FORM_CONTAINER_TYPES: ReadonlySet<string> = new Set(['formRepeatableRow', 'validatedFormSection']);

/** Attributes shared by every form field. */
const commonFieldAttrs = {
  id: { default: null },
  name: { default: null },
  label: { default: '' },
  required: { default: false },
  readOnly: { default: false },
  placeholder: { default: '' },
};

/** Renders a form field as a labelled block for DOM serialisation. */
function fieldDom(node: PMNode, type: string): DOMOutputSpec {
  const attrs = node.attrs as Record<string, unknown>;
  const value = attrs.value;
  const shown =
    typeof value === 'boolean' ? (value ? 'Yes' : 'No') : displayValue(value);
  return [
    'div',
    {
      class: `beakblock-form-field beakblock-form-${type}`,
      'data-form-field': type,
      'data-attrs': attrsToDataAttr(attrs),
      'data-block-id': attrs.id ? String(attrs.id) : '',
    },
    ['span', { class: 'beakblock-form-label' }, String(attrs.label || attrs.name || type)],
    ' ',
    ['span', { class: 'beakblock-form-value' }, shown],
  ];
}

/** Builds a field spec: a block atom with shared attrs plus type-specific attrs. */
function fieldSpec(
  type: string,
  valueDefault: unknown,
  extraAttrs: Record<string, { default: unknown }> = {}
): NodeSpec {
  return {
    group: 'block',
    atom: true,
    selectable: true,
    draggable: false,
    attrs: {
      ...commonFieldAttrs,
      value: { default: valueDefault },
      ...extraAttrs,
    },
    parseDOM: [{ tag: `div[data-form-field="${type}"]`, getAttrs: readDataAttrs('data-attrs') }],
    toDOM: (node) => fieldDom(node, type),
  };
}

/** Container spec: block children, rendered as a labelled group. */
function containerSpec(type: string, extraAttrs: Record<string, { default: unknown }>): NodeSpec {
  return {
    group: 'block',
    content: 'block*',
    defining: true,
    isolating: true,
    attrs: { id: { default: null }, name: { default: null }, ...extraAttrs },
    parseDOM: [{ tag: `div[data-form-field="${type}"]`, getAttrs: readDataAttrs('data-attrs') }],
    toDOM(node: PMNode): DOMOutputSpec {
      const attrs = node.attrs as Record<string, unknown>;
      return [
        'div',
        {
          class: `beakblock-form-container beakblock-form-${type}`,
          'data-form-field': type,
          'data-attrs': attrsToDataAttr(attrs),
          'data-block-id': attrs.id ? String(attrs.id) : '',
        },
        ['div', { class: 'beakblock-form-container-title' }, String(attrs.title || attrs.label || '')],
        ['div', { class: 'beakblock-form-container-body' }, 0],
      ];
    },
  };
}

/** Text input. */
export const formTextNode: NodeSpec = fieldSpec('formText', '');

/** Number input with range, unit and precision. */
export const formNumberNode: NodeSpec = fieldSpec('formNumber', null, {
  min: { default: null },
  max: { default: null },
  unit: { default: null },
  allowedUnits: { default: [] },
  decimals: { default: null },
});

/** Date input with optional ISO `min` and `max` bounds. */
export const formDateNode: NodeSpec = fieldSpec('formDate', null, {
  min: { default: null },
  max: { default: null },
});

/** Dropdown choosing one of `options`. */
export const formDropdownNode: NodeSpec = fieldSpec('formDropdown', null, {
  options: { default: [] },
});

/** Checkbox; `value` is `true` or `false`. */
export const formCheckboxNode: NodeSpec = fieldSpec('formCheckbox', false);

/** Radio group choosing one of `options`. */
export const formRadioNode: NodeSpec = fieldSpec('formRadio', null, {
  options: { default: [] },
});

/** Read-only value computed from other fields by `expression`. */
export const formCalculatedNode: NodeSpec = fieldSpec('formCalculated', null, {
  expression: { default: '' },
  decimals: { default: null },
});

/** Repeatable row: a block container; rows sharing a `name` collect into an array. */
export const formRepeatableRowNode: NodeSpec = containerSpec('formRepeatableRow', {
  label: { default: '' },
});

/** Section container whose fields are validated together. */
export const validatedFormSectionNode: NodeSpec = containerSpec('validatedFormSection', {
  title: { default: '' },
});

/** All form node specs, keyed by node type name. */
export const FORM_NODES: Record<string, NodeSpec> = {
  formText: formTextNode,
  formNumber: formNumberNode,
  formDate: formDateNode,
  formDropdown: formDropdownNode,
  formCheckbox: formCheckboxNode,
  formRadio: formRadioNode,
  formCalculated: formCalculatedNode,
  formRepeatableRow: formRepeatableRowNode,
  validatedFormSection: validatedFormSectionNode,
};
