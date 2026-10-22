/**
 * Field node view.
 *
 * Renders a `field` atom as `<span class="beakblock-field">` showing the
 * value from the editor's field resolver, falling back to the node's
 * `fallback` attr and then to its field type. Contract §1.2.
 *
 * @module
 */

import type { Node as PMNode } from 'prosemirror-model';
import type { NodeView } from 'prosemirror-view';

/**
 * Resolves a field's display text. Return `null` or `undefined` to use the fallback.
 */
export type FieldResolver = (attrs: Record<string, unknown>) => string | null | undefined;

/**
 * Computes the display text for a field node.
 *
 * @param attrs - Field node attrs
 * @param resolver - Optional resolver supplied by the host app
 */
export function resolveFieldText(
  attrs: Record<string, unknown>,
  resolver?: FieldResolver | null
): string {
  let resolved: string | null | undefined = null;
  if (resolver) {
    try {
      resolved = resolver(attrs);
    } catch {
      resolved = null;
    }
  }
  if (resolved != null && resolved !== '') return String(resolved);
  if (attrs.fallback != null && attrs.fallback !== '') return String(attrs.fallback);
  return String(attrs.fieldType ?? 'FIELD');
}

/**
 * Inline atom node view for `field` nodes.
 */
export class FieldNodeView implements NodeView {
  dom: HTMLElement;

  constructor(node: PMNode, private readonly getResolver: () => FieldResolver | null) {
    this.dom = document.createElement('span');
    this.render(node);
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'field') return false;
    this.render(node);
    return true;
  }

  private render(node: PMNode): void {
    const attrs = node.attrs as Record<string, unknown>;
    this.dom.className = 'beakblock-field';
    this.dom.setAttribute('contenteditable', 'false');
    this.dom.setAttribute('data-field-type', String(attrs.fieldType ?? ''));
    if (attrs.name) this.dom.setAttribute('data-field-name', String(attrs.name));
    else this.dom.removeAttribute('data-field-name');
    if (attrs.id) this.dom.setAttribute('data-block-id', String(attrs.id));
    this.dom.textContent = resolveFieldText(attrs, this.getResolver());
  }
}
