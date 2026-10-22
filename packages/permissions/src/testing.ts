/**
 * Test fixtures shared by the permissions test suites: a PM schema with a `controlledSection`
 * node and small document builders.
 *
 * @module
 */

import { createSchema } from '@amusendame/beakblock-core';
import type { Node as PMNode } from '@amusendame/beakblock-core';

export const schema = createSchema({
  controlledSection: {
    content: 'block+',
    group: 'block',
    defining: true,
    isolating: true,
    attrs: {
      id: { default: null },
      sectionId: { default: null },
      title: { default: '' },
      required: { default: false },
      styleId: { default: null },
      templateSectionId: { default: null },
      policyRef: { default: null },
    },
    parseDOM: [{ tag: 'section[data-controlled]' }],
    toDOM: () => ['section', { 'data-controlled': '' }, 0],
  },
  signatureBlock: {
    group: 'block',
    atom: true,
    attrs: {
      id: { default: null },
      signerName: { default: '' },
      signedAt: { default: null },
    },
    parseDOM: [{ tag: 'div[data-signature]' }],
    toDOM: () => ['div', { 'data-signature': '' }],
  },
});

export function signature(id: string, signerName = 'K. Phiri'): PMNode {
  return schema.nodes.signatureBlock!.create({ id, signerName, signedAt: '2026-05-06T14:12:00.000Z' });
}

export function para(id: string, text = ''): PMNode {
  return schema.nodes.paragraph!.create({ id }, text ? schema.text(text) : undefined);
}

export function section(
  id: string,
  sectionId: string,
  children: PMNode[],
  attrs: Record<string, unknown> = {}
): PMNode {
  return schema.nodes.controlledSection!.create({ id, sectionId, title: `Title ${sectionId}`, ...attrs }, children);
}

export function docOf(...blocks: PMNode[]): PMNode {
  return schema.nodes.doc!.create(null, blocks);
}

/** Position of the first node matching `predicate` (position is before the node). */
export function posOf(doc: PMNode, predicate: (node: PMNode) => boolean): number {
  let found = -1;
  doc.descendants((node, pos) => {
    if (found === -1 && predicate(node)) found = pos;
    return found === -1;
  });
  if (found === -1) throw new Error('node not found');
  return found;
}

export function sectionPos(doc: PMNode, sectionId: string): number {
  return posOf(doc, (n) => n.type.name === 'controlledSection' && n.attrs.sectionId === sectionId);
}

export function paraPos(doc: PMNode, blockId: string): number {
  return posOf(doc, (n) => n.type.name === 'paragraph' && n.attrs.id === blockId);
}
