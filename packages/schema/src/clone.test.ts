import { describe, expect, it } from 'vitest';

import { blocksToDocument, documentToBlocks, migrateDocument } from './index';
import type { Block } from './index';

/** Wraps every object in a Proxy, the way Vue reactive state does. structuredClone rejects these. */
function reactive<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return new Proxy(value.map(reactive), {}) as T;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) next[key] = reactive(child);
  return new Proxy(next, {}) as T;
}

const blocks: Block[] = [
  { id: 'p-1', type: 'paragraph', props: { textAlign: 'left' }, content: [{ type: 'text', text: 'Hello', styles: {} }] } as Block,
  { id: 'h-1', type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Title', styles: {} }] } as Block,
];

describe('cloning reactive block data', () => {
  it('structuredClone would reject the proxy-wrapped input', () => {
    expect(() => structuredClone(reactive(blocks))).toThrow();
  });

  it('blocksToDocument accepts a Proxy-wrapped block array', () => {
    const doc = blocksToDocument(reactive(blocks), { id: 'doc-1' });
    expect(documentToBlocks(doc)).toEqual(blocks);
  });

  it('migrateDocument accepts a Proxy-wrapped block array and returns plain data', () => {
    const doc = migrateDocument(reactive(blocks));
    expect(documentToBlocks(doc)).toEqual(blocks);
    expect(structuredClone(doc)).toEqual(doc);
  });

  it('returns copies that do not alias the input', () => {
    const input = reactive(blocks);
    const doc = blocksToDocument(input);
    (doc.sections[0].blocks[0] as unknown as { id: string }).id = 'changed';
    expect(blocks[0].id).toBe('p-1');
  });
});
