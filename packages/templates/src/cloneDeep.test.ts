import { describe, expect, it } from 'vitest';
import type { Block } from '@amusendame/beakblock-core';

import { cloneDeep, cloneWithNewIds } from './blocks';

/** Proxy-wrapped blocks, as produced by Vue reactive state. structuredClone rejects these. */
function reactive<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return new Proxy(value.map(reactive), {}) as T;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) next[key] = reactive(child);
  return new Proxy(next, {}) as T;
}

const blocks: Block[] = [
  {
    id: 'p-1',
    type: 'paragraph',
    props: { textAlign: 'left' },
    content: [{ type: 'text', text: 'Hello', styles: {} }],
  } as Block,
];

describe('cloneDeep and cloneWithNewIds on reactive input', () => {
  it('clones a Proxy-wrapped block array', () => {
    const copy = cloneDeep(reactive(blocks));
    expect(copy).toEqual(blocks);
    expect(copy[0]).not.toBe(blocks[0]);
  });

  it('assigns fresh ids to a Proxy-wrapped block array without touching the input', () => {
    const next = cloneWithNewIds(reactive(blocks), 'new');
    expect(next[0].id).not.toBe('p-1');
    expect(blocks[0].id).toBe('p-1');
  });
});
