import { describe, expect, it } from 'vitest';
import { InMemoryVersioningAdapter } from './inMemoryAdapter';
import type { DocumentVersion } from './types';

describe('InMemoryVersioningAdapter', () => {
  it('lists versions newest first', async () => {
    const adapter = new InMemoryVersioningAdapter();
    const v1: DocumentVersion = {
      id: '1',
      createdAt: '2026-01-01T00:00:00.000Z',
      blocks: [],
    };
    const v2: DocumentVersion = {
      id: '2',
      createdAt: '2026-02-01T00:00:00.000Z',
      blocks: [],
    };
    await adapter.saveVersion(v1);
    await adapter.saveVersion(v2);
    const list = await adapter.listVersions();
    expect(list.map((x) => x.id)).toEqual(['2', '1']);
  });

  it('getVersion returns a clone', async () => {
    const adapter = new InMemoryVersioningAdapter();
    const v: DocumentVersion = {
      id: 'x',
      createdAt: new Date().toISOString(),
      blocks: [{ id: 'b', type: 'paragraph', props: {}, content: [] }],
    };
    await adapter.saveVersion(v);
    const got = await adapter.getVersion('x');
    expect(got?.blocks[0]).toEqual(v.blocks[0]);
    if (got?.blocks[0]) {
      got.blocks[0] = { ...got.blocks[0], id: 'mutated' };
    }
    const again = await adapter.getVersion('x');
    expect(again?.blocks[0]?.id).toBe('b');
  });
});
