/**
 * Field node specification.
 *
 * An inline atom that displays a dynamic value (page number, document
 * property, cross-reference, sequence number, date). Contract §1.2.
 *
 * @module
 */

import type { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/** Supported field kinds. */
export type FieldType = 'PAGE' | 'NUMPAGES' | 'DOCPROPERTY' | 'REF' | 'SEQ' | 'LIMS' | 'DATE';

/** All field kinds, for validation and UI lists. */
export const FIELD_TYPES: readonly FieldType[] = [
  'PAGE',
  'NUMPAGES',
  'DOCPROPERTY',
  'REF',
  'SEQ',
  'LIMS',
  'DATE',
];

/**
 * Field node spec.
 *
 * Renders as `<span class="beakblock-field" data-field-type data-field-name>`.
 * The visible text is the value returned by the editor's field resolver,
 * falling back to the `fallback` attr, then to the field type.
 *
 * @example
 * ```typescript
 * // Inline JSON representation:
 * { type: 'field', fieldType: 'DOCPROPERTY', name: 'docNumber', fallback: 'SOP-001' }
 * ```
 */
export const fieldNode: NodeSpec = {
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    id: { default: null },
    fieldType: { default: 'PAGE' },
    name: { default: null },
    format: { default: null },
    fallback: { default: null },
  },
  parseDOM: [
    {
      tag: 'span.beakblock-field',
      getAttrs(dom: HTMLElement) {
        return {
          id: dom.getAttribute('data-block-id'),
          fieldType: dom.getAttribute('data-field-type') || 'PAGE',
          name: dom.getAttribute('data-field-name'),
          format: dom.getAttribute('data-field-format'),
          fallback: dom.textContent || null,
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const { id, fieldType, name, format, fallback } = node.attrs;
    const attrs: Record<string, string> = {
      class: 'beakblock-field',
      'data-field-type': String(fieldType),
      contenteditable: 'false',
    };
    if (id) attrs['data-block-id'] = String(id);
    if (name) attrs['data-field-name'] = String(name);
    if (format) attrs['data-field-format'] = String(format);
    return ['span', attrs, String(fallback ?? fieldType)];
  },
};
