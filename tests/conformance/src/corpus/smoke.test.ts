import { describe, expect, it } from 'vitest';
import { corpus } from './index';

describe('corpus smoke', () => {
  it('builds 20 documents with unique ids', () => {
    expect(corpus).toHaveLength(20);
    expect(new Set(corpus.map((c) => c.id)).size).toBe(20);
  });
  it('has unique block ids in every document', () => {
    for (const entry of corpus) {
      const ids: string[] = [];
      const walk = (blocks: unknown[]) => {
        for (const b of blocks as { id: string; children?: unknown[] }[]) {
          ids.push(b.id);
          if (b.children) walk(b.children);
        }
      };
      walk(entry.blocks);
      const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
      expect(dups, entry.id).toEqual([]);
    }
  });
});
