/**
 * Heading node specification.
 *
 * Supports levels 1-6 (h1-h6).
 *
 * @module
 */

import type { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';
import {
  officeParagraphAttrs,
  officeParagraphDomAttrs,
  officeParagraphParseAttrs,
  combinedBlockStyle,
} from './officeParagraph';

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
function headingAttrsFromDom(dom: unknown, level: number): Record<string, unknown> {
  const el = dom as HTMLElement;
  const lockedRaw = el.getAttribute('data-beakblock-locked') ?? el.dataset.beakblockLocked;
  return {
    level,
    textAlign: el.style.textAlign || 'left',
    locked: lockedRaw === 'true',
    lockReason: el.getAttribute('data-beakblock-lock-reason') ?? el.dataset.beakblockLockReason ?? null,
    lockId: el.getAttribute('data-beakblock-lock-id') ?? el.dataset.beakblockLockId ?? null,
    ...officeParagraphParseAttrs(el),
  };
}

export const headingNode: NodeSpec = {
  content: 'inline*',
  group: 'block',
  attrs: {
    id: { default: null },
    level: { default: 1 },
    textAlign: { default: 'left' },
    locked: { default: false },
    lockReason: { default: null },
    lockId: { default: null },
    ...officeParagraphAttrs,
  },
  parseDOM: [
    { tag: 'h1', getAttrs: (dom) => headingAttrsFromDom(dom, 1) },
    { tag: 'h2', getAttrs: (dom) => headingAttrsFromDom(dom, 2) },
    { tag: 'h3', getAttrs: (dom) => headingAttrsFromDom(dom, 3) },
    { tag: 'h4', getAttrs: (dom) => headingAttrsFromDom(dom, 4) },
    { tag: 'h5', getAttrs: (dom) => headingAttrsFromDom(dom, 5) },
    { tag: 'h6', getAttrs: (dom) => headingAttrsFromDom(dom, 6) },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const attrs: Record<string, string> = {
      'data-block-id': node.attrs.id,
      ...officeParagraphDomAttrs(node.attrs),
    };
    const style = combinedBlockStyle(node.attrs.textAlign, node.attrs);
    if (style) {
      attrs.style = style;
    }
    if (node.attrs.locked) {
      attrs['data-beakblock-locked'] = 'true';
    }
    if (node.attrs.lockReason) {
      attrs['data-beakblock-lock-reason'] = String(node.attrs.lockReason);
    }
    if (node.attrs.lockId) {
      attrs['data-beakblock-lock-id'] = String(node.attrs.lockId);
    }
    return [`h${node.attrs.level}`, attrs, 0];
  },
};
