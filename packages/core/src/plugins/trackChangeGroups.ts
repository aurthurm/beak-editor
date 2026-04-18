/**
 * Group sequential track-change records so UI can accept/reject a typed run as one action.
 *
 * @module
 */

import type { TrackedChangeRecord } from './trackChangesPlugin';

function hasInsertSpan(e: TrackedChangeRecord): e is TrackedChangeRecord & { insertRange: { from: number; to: number } } {
  return Boolean(e.insertRange && e.insertRange.from < e.insertRange.to);
}

/**
 * Merge insert/replace hunks whose highlighted ranges form one contiguous span (touching or overlapping),
 * with no gap of unchanged document between them. Pure delete hunks (no insert span) are never merged;
 * each becomes its own group.
 */
export function groupContiguousInsertTrackChanges(log: readonly TrackedChangeRecord[]): TrackedChangeRecord[][] {
  const withInsert = log.filter((e) => hasInsertSpan(e) && (e.kind === 'insert' || e.kind === 'replace'));
  const insertIds = new Set(withInsert.map((e) => e.id));
  const rest = log.filter((e) => !insertIds.has(e.id));

  const sorted = [...withInsert].sort((a, b) => a.insertRange!.from - b.insertRange!.from);
  const groups: TrackedChangeRecord[][] = [];

  for (const e of sorted) {
    const r = e.insertRange!;
    if (!groups.length) {
      groups.push([e]);
      continue;
    }
    const last = groups[groups.length - 1]!;
    const maxTo = Math.max(...last.map((x) => x.insertRange!.to));
    if (r.from <= maxTo) {
      last.push(e);
    } else {
      groups.push([e]);
    }
  }

  for (const e of rest) {
    groups.push([e]);
  }

  return groups;
}
