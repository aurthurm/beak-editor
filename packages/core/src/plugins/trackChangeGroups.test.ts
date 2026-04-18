import { describe, expect, it } from 'vitest';

import type { TrackedChangeRecord } from './trackChangesPlugin';
import { groupContiguousInsertTrackChanges } from './trackChangeGroups';

function ins(id: string, from: number, to: number, at = '2026-01-01T00:00:00.000Z'): TrackedChangeRecord {
  return {
    id,
    kind: 'insert',
    at,
    insertRange: { from, to },
    insertedLength: to - from,
  };
}

describe('groupContiguousInsertTrackChanges', () => {
  it('merges adjacent inserts into one group', () => {
    const log = [ins('a', 1, 2), ins('b', 2, 3), ins('c', 3, 5)];
    const g = groupContiguousInsertTrackChanges(log);
    expect(g.length).toBe(1);
    expect(g[0]!.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('splits when there is a gap between insert ranges', () => {
    const log = [ins('a', 1, 2), ins('b', 5, 6)];
    const g = groupContiguousInsertTrackChanges(log);
    expect(g.length).toBe(2);
  });

  it('merges overlapping ranges', () => {
    const log = [ins('a', 1, 4), ins('b', 3, 6)];
    const g = groupContiguousInsertTrackChanges(log);
    expect(g.length).toBe(1);
  });

  it('keeps pure deletes as separate single-item groups', () => {
    const del: TrackedChangeRecord = {
      id: 'd1',
      kind: 'delete',
      at: '2026-01-01T00:00:01.000Z',
      deletedText: 'x',
      deleteWidgetPos: 10,
    };
    const log = [ins('a', 1, 2), del];
    const g = groupContiguousInsertTrackChanges(log);
    expect(g.length).toBe(2);
    expect(g[0]!.length).toBe(1);
    expect(g[1]!).toEqual([del]);
  });
});
