/**
 * Heading node specification.
 *
 * Supports levels 1-6 (h1-h6).
 *
 * @module
 */

import type { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/**
 * Heading node spec.
 *
 * A heading block with configurable level (1-6).
 * Each heading has a unique `id` attribute for block-level operations.
 *
 * @example
 * ```typescript
 * // JSON block representation:
 * {
 *   id: 'xyz789',
 *   type: 'heading',
 *   props: { level: 2, textAlign: 'center' },
 *   content: [{ type: 'text', text: 'My Title', styles: { bold: true } }]
 * }
 * ```
 */
export const headingNode: NodeSpec = {
  content: 'inline*',
  group: 'block',
  attrs: {
    id: { default: null },
    level: { default: 1 },
    textAlign: { default: 'left' },
  },
  parseDOM: [
    { tag: 'h1', getAttrs: (dom) => ({ level: 1, textAlign: (dom as HTMLElement).style.textAlign || 'left' }) },
    { tag: 'h2', getAttrs: (dom) => ({ level: 2, textAlign: (dom as HTMLElement).style.textAlign || 'left' }) },
    { tag: 'h3', getAttrs: (dom) => ({ level: 3, textAlign: (dom as HTMLElement).style.textAlign || 'left' }) },
    { tag: 'h4', getAttrs: (dom) => ({ level: 4, textAlign: (dom as HTMLElement).style.textAlign || 'left' }) },
    { tag: 'h5', getAttrs: (dom) => ({ level: 5, textAlign: (dom as HTMLElement).style.textAlign || 'left' }) },
    { tag: 'h6', getAttrs: (dom) => ({ level: 6, textAlign: (dom as HTMLElement).style.textAlign || 'left' }) },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const attrs: Record<string, string> = { 'data-block-id': node.attrs.id };
    if (node.attrs.textAlign && node.attrs.textAlign !== 'left') {
      attrs.style = `text-align: ${node.attrs.textAlign}`;
    }
    return [`h${node.attrs.level}`, attrs, 0];
  },
};
