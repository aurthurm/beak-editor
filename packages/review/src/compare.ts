/**
 * Revision compare: block-level diff between two block trees, word-level inline diff for changed
 * text, and a redline HTML renderer.
 *
 * Blocks are matched by id, then unmatched blocks are paired by type, position and word overlap. Moves are detected from the longest common subsequence of surviving
 * blocks in document order.
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';

import { blockPlainText, escapeHtml, flattenBlocks, stableStringify, type FlatBlock } from './util';

/** Status of one block in a comparison. */
export type BlockDiffStatus = 'added' | 'removed' | 'modified' | 'moved' | 'unchanged';

/** A segment of an inline word diff. */
export interface InlineSegment {
  type: 'equal' | 'insert' | 'delete';
  text: string;
}

/** Diff of one block. */
export interface BlockDiff {
  blockId: string;
  status: BlockDiffStatus;
  blockType: string;
  sectionId: string | null;
  oldSectionId: string | null;
  newSectionId: string | null;
  oldIndex?: number;
  newIndex?: number;
  /** True when the block changed position (independent of content changes). */
  moved: boolean;
  /** What changed for modified blocks: text, format (same text, different styles), props, type. */
  changes: Array<'text' | 'format' | 'props' | 'type'>;
  oldText?: string;
  newText?: string;
  /** Word-level diff, present for modified text blocks whose text changed. */
  inline?: InlineSegment[];
}

/** Totals for a comparison. Blocks that both changed and moved count in `modified` and in `moved`. */
export interface CompareSummary {
  added: number;
  removed: number;
  modified: number;
  moved: number;
  /** Section ids (non-null) containing added, removed, modified or moved blocks. */
  sectionsChanged: string[];
}

/** Result of {@link compareRevisions}. `diffs` are in merged display order. */
export interface RevisionComparison {
  diffs: BlockDiff[];
  summary: CompareSummary;
}

/** Maximum product of token counts for the LCS table. Beyond this, the diff falls back to whole-text replacement. */
const MAX_LCS_CELLS = 4_000_000;

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

function lcsTable(a: readonly string[], b: readonly string[]): Uint32Array {
  const n = a.length;
  const m = b.length;
  const table = new Uint32Array((n + 1) * (m + 1));
  const w = m + 1;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * w + j] =
        a[i] === b[j] ? table[(i + 1) * w + j + 1]! + 1 : Math.max(table[(i + 1) * w + j]!, table[i * w + j + 1]!);
    }
  }
  return table;
}

/**
 * Word-level diff of two strings using a longest common subsequence over word and whitespace tokens.
 * Adjacent segments of the same type are merged.
 *
 * @example
 * ```typescript
 * diffWords('the quick fox', 'the slow fox');
 * // [{ type: 'equal', text: 'the ' }, { type: 'delete', text: 'quick' }, { type: 'insert', text: 'slow' }, { type: 'equal', text: ' fox' }]
 * ```
 */
export function diffWords(oldText: string, newText: string): InlineSegment[] {
  const a = tokenize(oldText);
  const b = tokenize(newText);
  const ops: InlineSegment[] = [];
  const push = (type: InlineSegment['type'], text: string) => {
    const last = ops[ops.length - 1];
    if (last && last.type === type) last.text += text;
    else ops.push({ type, text });
  };

  if (a.length * b.length > MAX_LCS_CELLS) {
    if (oldText.length > 0) push('delete', oldText);
    if (newText.length > 0) push('insert', newText);
    return ops;
  }

  const table = lcsTable(a, b);
  const w = b.length + 1;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('equal', a[i]!);
      i++;
      j++;
    } else if (table[(i + 1) * w + j]! >= table[i * w + j + 1]!) {
      push('delete', a[i]!);
      i++;
    } else {
      push('insert', b[j]!);
      j++;
    }
  }
  while (i < a.length) push('delete', a[i++]!);
  while (j < b.length) push('insert', b[j++]!);
  return ops;
}

/** Ids of the longest common subsequence of two id lists. */
function lcsIds(a: readonly string[], b: readonly string[]): Set<string> {
  const keep = new Set<string>();
  if (a.length * b.length > MAX_LCS_CELLS) return keep;
  const table = lcsTable(a, b);
  const w = b.length + 1;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      keep.add(a[i]!);
      i++;
      j++;
    } else if (table[(i + 1) * w + j]! >= table[i * w + j + 1]!) {
      i++;
    } else {
      j++;
    }
  }
  return keep;
}

/** Flat-order distance within which an unmatched block may pair with a block of the same type. */
const FUZZY_WINDOW = 2;
/** Minimum share of the smaller block's words that must be shared for a fuzzy pair. */
const FUZZY_MIN_OVERLAP = 0.6;

/** Plain text of a block and everything nested under it, used only to score fuzzy pairs. */
function subtreeText(block: Block): string {
  const own = blockPlainText(block);
  const children = (block.children ?? []).map((child) => subtreeText(child));
  return [own, ...children].filter((t) => t.length > 0).join(' ');
}

function wordCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (word) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}

/** Share of the smaller text's words that also appear in the other text (0 to 1). */
function wordOverlap(a: Map<string, number>, b: Map<string, number>): number {
  let totalA = 0;
  let totalB = 0;
  let shared = 0;
  for (const count of a.values()) totalA += count;
  for (const [word, count] of b) {
    totalB += count;
    shared += Math.min(count, a.get(word) ?? 0);
  }
  const smaller = Math.min(totalA, totalB);
  return smaller === 0 ? 0 : shared / smaller;
}

/**
 * Pairs blocks that have no id in common. A block pairs with an unmatched block of the same type
 * that sits within {@link FUZZY_WINDOW} positions in flat order and shares at least
 * {@link FUZZY_MIN_OVERLAP} of its words. The best-scoring candidate wins.
 */
function pairUnmatched(
  oldFlat: readonly FlatBlock[],
  newFlat: readonly FlatBlock[],
  oldToNew: Map<string, string>,
  newToOld: Map<string, string>
): void {
  const newWords = newFlat.map((f) => wordCounts(subtreeText(f.block)));
  for (let i = 0; i < oldFlat.length; i++) {
    const o = oldFlat[i]!;
    if (oldToNew.has(o.block.id)) continue;
    const oldWords = wordCounts(subtreeText(o.block));
    let best: { j: number; score: number } | null = null;
    const from = Math.max(0, i - FUZZY_WINDOW);
    const to = Math.min(newFlat.length - 1, i + FUZZY_WINDOW);
    for (let j = from; j <= to; j++) {
      const n = newFlat[j]!;
      if (newToOld.has(n.block.id) || n.block.type !== o.block.type) continue;
      const score = wordOverlap(oldWords, newWords[j]!);
      if (score >= FUZZY_MIN_OVERLAP && (!best || score > best.score)) best = { j, score };
    }
    if (best) {
      const newId = newFlat[best.j]!.block.id;
      oldToNew.set(o.block.id, newId);
      newToOld.set(newId, o.block.id);
    }
  }
}

/**
 * Compares two block trees.
 *
 * - `added`/`removed`: no matching block in the other tree.
 * - `modified`: same id, different type, props, or content. Changed text gets a word-level `inline` diff.
 * - `moved`: same id and content, but a different position among surviving blocks (LCS-based).
 * - `sectionsChanged`: section ids touched by any non-unchanged block.
 *
 * Blocks are matched by id first. Blocks left without an id match (for example, when a snapshot was
 * regenerated with new ids) pair with a nearby block of the same type that shares most of its words,
 * so they are reported as `modified` rather than as a removal plus an addition.
 *
 * Children are compared as their own blocks, so a container is only `modified` when its own
 * fields change.
 *
 * @example
 * ```typescript
 * const { diffs, summary } = compareRevisions(releasedBlocks, draftBlocks);
 * ```
 */
export function compareRevisions(oldBlocks: Block[], newBlocks: Block[]): RevisionComparison {
  const oldFlat = flattenBlocks(oldBlocks);
  const newFlat = flattenBlocks(newBlocks);
  const oldById = new Map(oldFlat.map((f) => [f.block.id, f] as const));
  const newById = new Map(newFlat.map((f) => [f.block.id, f] as const));

  // Matched pairs, keyed by old id and by new id. Matched blocks share one id in the output.
  const oldToNew = new Map<string, string>();
  const newToOld = new Map<string, string>();
  for (const f of oldFlat) {
    if (newById.has(f.block.id)) {
      oldToNew.set(f.block.id, f.block.id);
      newToOld.set(f.block.id, f.block.id);
    }
  }
  pairUnmatched(oldFlat, newFlat, oldToNew, newToOld);

  const commonOld = oldFlat.filter((f) => oldToNew.has(f.block.id)).map((f) => oldToNew.get(f.block.id)!);
  const commonNew = newFlat.filter((f) => newToOld.has(f.block.id)).map((f) => f.block.id);
  const stable = lcsIds(commonOld, commonNew);

  const oldIndex = new Map(oldFlat.map((f, i) => [f.block.id, i] as const));
  const newIndex = new Map(newFlat.map((f, i) => [f.block.id, i] as const));

  const diffFor = (oldId: string | null, newId: string | null): BlockDiff => {
    const o = oldId !== null ? oldById.get(oldId) : undefined;
    const n = newId !== null ? newById.get(newId) : undefined;
    const current = n ?? o!;
    const base = {
      blockId: current.block.id,
      blockType: current.block.type,
      sectionId: n ? n.sectionId : o!.sectionId,
      oldSectionId: o ? o.sectionId : null,
      newSectionId: n ? n.sectionId : null,
      oldIndex: o ? oldIndex.get(o.block.id) : undefined,
      newIndex: n ? newIndex.get(n.block.id) : undefined,
    };
    if (!o && n) {
      return { ...base, status: 'added', moved: false, changes: [], newText: blockPlainText(n.block) };
    }
    if (o && !n) {
      return { ...base, status: 'removed', moved: false, changes: [], oldText: blockPlainText(o.block) };
    }
    const oldBlock = o!.block;
    const newBlock = n!.block;
    const moved = !stable.has(newBlock.id);
    const changes: BlockDiff['changes'] = [];
    if (oldBlock.type !== newBlock.type) changes.push('type');
    if (stableStringify(oldBlock.props) !== stableStringify(newBlock.props)) changes.push('props');
    const oldText = blockPlainText(oldBlock);
    const newText = blockPlainText(newBlock);
    if (oldText !== newText) {
      changes.push('text');
    } else if (stableStringify(oldBlock.content ?? null) !== stableStringify(newBlock.content ?? null)) {
      changes.push('format');
    }

    const status: BlockDiffStatus = changes.length > 0 ? 'modified' : moved ? 'moved' : 'unchanged';
    const diff: BlockDiff = { ...base, status, moved, changes, oldText, newText };
    if (changes.includes('text')) diff.inline = diffWords(oldText, newText);
    return diff;
  };

  // Merge order: walk the new tree; removed blocks follow the surviving block that preceded them.
  const removedAfter = new Map<string | null, BlockDiff[]>();
  let prev: string | null = null;
  for (const f of oldFlat) {
    const newId = oldToNew.get(f.block.id);
    if (newId !== undefined) {
      prev = newId;
    } else {
      const list = removedAfter.get(prev) ?? [];
      list.push(diffFor(f.block.id, null));
      removedAfter.set(prev, list);
    }
  }

  const diffs: BlockDiff[] = [...(removedAfter.get(null) ?? [])];
  for (const f of newFlat) {
    const oldId = newToOld.get(f.block.id);
    diffs.push(oldId !== undefined ? diffFor(oldId, f.block.id) : diffFor(null, f.block.id));
    diffs.push(...(removedAfter.get(f.block.id) ?? []));
  }

  const summary: CompareSummary = { added: 0, removed: 0, modified: 0, moved: 0, sectionsChanged: [] };
  const sections = new Set<string>();
  for (const d of diffs) {
    if (d.status === 'added') summary.added++;
    if (d.status === 'removed') summary.removed++;
    if (d.status === 'modified') summary.modified++;
    if (d.moved) summary.moved++;
    if (d.status !== 'unchanged') {
      for (const s of [d.sectionId, d.oldSectionId, d.newSectionId]) {
        if (s) sections.add(s);
      }
    }
  }
  summary.sectionsChanged = [...sections];

  return { diffs, summary };
}

function renderSegments(segments: InlineSegment[]): string {
  return segments
    .map((s) => {
      const text = escapeHtml(s.text);
      if (s.type === 'insert') return `<ins class="beakblock-ins">${text}</ins>`;
      if (s.type === 'delete') return `<del class="beakblock-del">${text}</del>`;
      return text;
    })
    .join('');
}

/**
 * Renders a comparison as redline HTML. Added text is `<ins class="beakblock-ins">`, removed text is
 * `<del class="beakblock-del">`. Changed blocks carry `beakblock-change-bar` and
 * `beakblock-change-<status>`. A summary list comes first. All text is HTML-escaped.
 */
export function renderRedlineHTML(result: RevisionComparison): string {
  const s = result.summary;
  const sections = s.sectionsChanged.length > 0 ? escapeHtml(s.sectionsChanged.join(', ')) : 'none';
  const parts: string[] = [
    '<section class="beakblock-redline">',
    '<ul class="beakblock-redline-summary">',
    `<li>Added: ${s.added}</li>`,
    `<li>Removed: ${s.removed}</li>`,
    `<li>Modified: ${s.modified}</li>`,
    `<li>Moved: ${s.moved}</li>`,
    `<li>Sections changed: ${sections}</li>`,
    '</ul>',
  ];

  for (const d of result.diffs) {
    const attrs = [`data-block-id="${escapeHtml(d.blockId)}"`];
    if (d.sectionId) attrs.push(`data-section-id="${escapeHtml(d.sectionId)}"`);
    const classes = ['beakblock-redline-block'];
    if (d.status !== 'unchanged') classes.push('beakblock-change-bar', `beakblock-change-${d.status}`);

    let body: string;
    if (d.status === 'added') {
      body = `<ins class="beakblock-ins">${escapeHtml(d.newText ?? '')}</ins>`;
    } else if (d.status === 'removed') {
      body = `<del class="beakblock-del">${escapeHtml(d.oldText ?? '')}</del>`;
    } else if (d.inline) {
      body = renderSegments(d.inline);
    } else {
      body = escapeHtml(d.newText ?? d.oldText ?? (d.blockType ? `[${d.blockType}]` : ''));
      if (d.status === 'modified') {
        body += ` <span class="beakblock-change-note">(${escapeHtml(d.changes.join(', '))} changed)</span>`;
      }
    }
    if (d.moved && d.status !== 'added' && d.status !== 'removed') {
      body += ' <span class="beakblock-change-note">(moved)</span>';
    }
    parts.push(`<div class="${classes.join(' ')}" ${attrs.join(' ')}>${body}</div>`);
  }

  parts.push('</section>');
  return parts.join('\n');
}
