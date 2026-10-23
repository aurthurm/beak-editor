/**
 * Keeps block props that the node type does not declare.
 *
 * A block whose type is registered can still carry props the schema has no attribute for. A
 * ProseMirror node drops attributes it does not declare, so those props would be lost on load.
 * Every block node carries one extra attribute, `unknownProps`, which holds them as JSON so
 * `getDocument()` returns them unchanged.
 *
 * @module
 */

import type { NodeSpec } from 'prosemirror-model';

/** Name of the attribute that holds undeclared props as JSON text. */
export const UNKNOWN_PROPS_ATTR = 'unknownProps';

/**
 * Returns the node spec with the `unknownProps` attribute added. Text nodes cannot carry attributes,
 * so they are returned unchanged, as are specs that already declare the attribute.
 */
export function withUnknownPropsAttr(name: string, spec: NodeSpec): NodeSpec {
  if (name === 'text' || name === 'doc') return spec;
  const attrs = spec.attrs ?? {};
  if (UNKNOWN_PROPS_ATTR in attrs) return spec;
  return { ...spec, attrs: { ...attrs, [UNKNOWN_PROPS_ATTR]: { default: null } } };
}
