/**
 * DOM helpers shared by block node specs.
 *
 * Node attributes are round-tripped through a single `data-attrs` JSON attribute,
 * which keeps copy/paste and DOM serialisation lossless for structured attrs.
 *
 * @module
 */

import type { DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/** Serialises node attrs (without nulls) into a `data-attrs` attribute value. */
export function attrsToDataAttr(attrs: Record<string, unknown>): string {
  const compact: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) compact[key] = value;
  }
  return JSON.stringify(compact);
}

/**
 * Builds a `getAttrs` function that reads the JSON `data-attrs` attribute
 * written by {@link attrsToDataAttr}. Unknown or malformed data yields `false`.
 */
export function readDataAttrs(
  selectorAttr: string
): (dom: HTMLElement) => Record<string, unknown> | false {
  return (dom: HTMLElement) => {
    if (!dom.hasAttribute(selectorAttr)) return false;
    try {
      const parsed: unknown = JSON.parse(dom.getAttribute('data-attrs') ?? '{}');
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : false;
    } catch {
      return false;
    }
  };
}

/** Escapes a value into a text-only DOM spec string. */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '-';
  return String(value);
}

/** Builds a labelled row list as a DOM spec for atom block nodes. */
export function labelledRowsDom(
  node: PMNode,
  className: string,
  rows: Array<[string, unknown]>
): DOMOutputSpec {
  return [
    'div',
    {
      class: className,
      contenteditable: 'false',
      'data-attrs': attrsToDataAttr(node.attrs),
      'data-block-id': node.attrs.id ? String(node.attrs.id) : '',
    },
    ...rows.map(
      ([label, value]): DOMOutputSpec => [
        'div',
        { class: 'beakblock-clinical-row' },
        ['span', { class: 'beakblock-clinical-label' }, `${label}: `],
        ['span', { class: 'beakblock-clinical-value' }, displayValue(value)],
      ]
    ),
  ];
}
