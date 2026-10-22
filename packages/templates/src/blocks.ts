/**
 * Small helpers for building block JSON: ids, deep clone, deep freeze, header and footer fields.
 *
 * @module
 */

import type { Block, InlineContent } from '@amusendame/beakblock-core';
import { cloneJson } from '@amusendame/beakblock-core';

let counter = 0;

/** New block or document id. Uses `crypto.randomUUID` when available. */
export function newId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Deep clone with fresh structure (works for frozen input). */
export function cloneDeep<T>(value: T): T {
  return cloneJson(value);
}

/** Deep clone that also gives every block (and child block) a fresh id. */
export function cloneWithNewIds(blocks: readonly Block[], prefix = 'blk'): Block[] {
  return blocks.map((block) => {
    const copy = cloneDeep(block);
    copy.id = newId(prefix);
    if (copy.children) copy.children = cloneWithNewIds(copy.children, prefix);
    return copy;
  });
}

/** Recursively freezes an object graph. Returns the same reference. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/** A paragraph with plain text. */
export function paragraph(text: string, props: Record<string, unknown> = {}): Block {
  return {
    id: newId('blk'),
    type: 'paragraph',
    props,
    content: text ? [{ type: 'text', text, styles: {} }] : [],
  };
}

/** A field inline (`DOCPROPERTY`, `PAGE`, ...). */
export function fieldContent(fieldType: string, name: string | null, fallback?: string): InlineContent {
  return fallback === undefined
    ? ({ type: 'field', fieldType, name } as InlineContent)
    : ({ type: 'field', fieldType, name, fallback } as InlineContent);
}

/** Text inline. */
function text(value: string): InlineContent {
  return { type: 'text', text: value, styles: {} } as InlineContent;
}

/**
 * Default header: document title line with docNumber and revision fields.
 * `fallback` values are shown until the editor resolves the fields.
 */
export function defaultHeaderBlocks(values: { docNumber?: string; revision?: string; title?: string }): Block[] {
  return [
    {
      id: newId('blk'),
      type: 'paragraph',
      props: { textAlign: 'right' },
      content: [
        text('Doc. no. '),
        fieldContent('DOCPROPERTY', 'docNumber', values.docNumber ?? ''),
        text('  Rev. '),
        fieldContent('DOCPROPERTY', 'revision', values.revision ?? ''),
      ],
    },
  ];
}

/** Default footer: "Page X of Y" with PAGE and NUMPAGES fields. */
export function defaultFooterBlocks(): Block[] {
  return [
    {
      id: newId('blk'),
      type: 'paragraph',
      props: { textAlign: 'center' },
      content: [text('Page '), fieldContent('PAGE', null, '1'), text(' of '), fieldContent('NUMPAGES', null, '1')],
    },
  ];
}

/** Finds blocks (depth first, children included) matching a predicate. */
export function findBlocks(blocks: readonly Block[], predicate: (block: Block) => boolean): Block[] {
  const out: Block[] = [];
  for (const block of blocks) {
    if (predicate(block)) out.push(block);
    if (block.children) out.push(...findBlocks(block.children, predicate));
  }
  return out;
}
