import { describe, expect, it } from 'vitest';
import type { Block } from '@amusendame/beakblock-core';

import { compareRevisions, diffWords, renderRedlineHTML } from './compare';

function para(id: string, text: string): Block {
  return { id, type: 'paragraph', props: {}, content: [{ type: 'text', text, styles: {} }] };
}

function section(id: string, sectionId: string, children: Block[]): Block {
  return { id, type: 'controlledSection', props: { sectionId }, children };
}

describe('compareRevisions', () => {
  const oldBlocks: Block[] = [
    section('s1', 'SEC-1', [para('a', 'Alpha'), para('b', 'Beta')]),
    para('c', 'Gamma'),
    para('d', 'Delta'),
  ];

  it('classifies added, removed, modified and moved blocks, with section context', () => {
    const newBlocks: Block[] = [
      para('d', 'Delta'),
      section('s1', 'SEC-1', [para('b', 'Beta is changed'), para('a', 'Alpha')]),
      para('e', 'Epsilon'),
    ];
    const { diffs, summary } = compareRevisions(oldBlocks, newBlocks);
    const byId = Object.fromEntries(diffs.map((d) => [d.blockId, d]));

    expect(byId['c']!.status).toBe('removed');
    expect(byId['e']!.status).toBe('added');
    expect(byId['b']!.status).toBe('modified');
    expect(byId['b']!.changes).toContain('text');
    expect(byId['b']!.inline).toEqual([
      { type: 'equal', text: 'Beta' },
      { type: 'insert', text: ' is changed' },
    ]);
    expect(byId['a']!.moved).toBe(true);
    expect(byId['a']!.status).toBe('moved');
    expect(byId['b']!.sectionId).toBe('SEC-1');
    expect(byId['c']!.sectionId).toBeNull();

    expect(summary).toMatchObject({ added: 1, removed: 1, modified: 1 });
    expect(summary.moved).toBeGreaterThanOrEqual(1);
    expect(summary.sectionsChanged).toEqual(['SEC-1']);
  });

  it('reports a changed paragraph and a changed nested list item as modified when ids match', () => {
    const before: Block[] = [
      para('p1', 'Purpose of the procedure'),
      {
        id: 'list',
        type: 'orderedList',
        props: { start: 1 },
        children: [
          { id: 'li1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Fix the smear', styles: {} }] },
        ],
      },
    ];
    const after: Block[] = [
      para('p1', 'Purpose of this procedure'),
      {
        id: 'list',
        type: 'orderedList',
        props: { start: 1 },
        children: [
          { id: 'li1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Fix the smear in methanol', styles: {} }] },
        ],
      },
    ];
    const { diffs, summary } = compareRevisions(before, after);
    const byId = Object.fromEntries(diffs.map((d) => [d.blockId, d]));
    expect(byId['p1']!.status).toBe('modified');
    expect(byId['li1']!.status).toBe('modified');
    expect(summary).toMatchObject({ added: 0, removed: 0, modified: 2 });
  });

  it('matches changed blocks whose ids were regenerated, by type, position and word overlap', () => {
    // Mirrors the track-changes demo: the released snapshot and the working copy use different ids.
    const released: Block[] = [
      para('rv-h2', 'Scope'),
      para('rv-p2', 'Applies to bench analysts who read smears.'),
      {
        id: 'rv-steps',
        type: 'orderedList',
        props: { start: 1 },
        children: [
          { id: 'rv-s1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Fix the smear in methanol for 3 minutes.', styles: {} }] },
          { id: 'rv-s2', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Stain with crystal violet for 1 minute.', styles: {} }] },
        ],
      },
    ];
    const working: Block[] = [
      para('wc-h2', 'Scope'),
      para('wc-p2', 'Applies to bench analysts and section supervisors who read smears for culture review.'),
      {
        id: 'wc-steps',
        type: 'orderedList',
        props: { start: 1 },
        children: [
          { id: 'wc-s1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Fix the smear in methanol for 3 minutes.', styles: {} }] },
          { id: 'wc-s2', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Stain with crystal violet for 2 minutes.', styles: {} }] },
        ],
      },
    ];
    const { diffs, summary } = compareRevisions(released, working);
    const byId = Object.fromEntries(diffs.map((d) => [d.blockId, d]));
    expect(byId['wc-p2']!.status).toBe('modified');
    expect(byId['wc-p2']!.changes).toContain('text');
    expect(byId['wc-p2']!.inline?.some((s) => s.type === 'insert')).toBe(true);
    expect(byId['wc-s2']!.status).toBe('modified');
    expect(byId['wc-s1']!.status).toBe('unchanged');
    expect(byId['wc-h2']!.status).toBe('unchanged');
    expect(summary.modified).toBe(2);
    expect(summary.added).toBe(0);
    expect(summary.removed).toBe(0);
  });

  it('does not pair blocks of a different type or with little word overlap', () => {
    const before: Block[] = [para('x1', 'Gram stain procedure for smears')];
    const after: Block[] = [para('y1', 'Completely unrelated sentence here')];
    const { diffs } = compareRevisions(before, after);
    const byId = Object.fromEntries(diffs.map((d) => [d.blockId, d]));
    expect(byId['x1']!.status).toBe('removed');
    expect(byId['y1']!.status).toBe('added');
  });

  it('reports no changes for identical trees', () => {
    const { summary, diffs } = compareRevisions(oldBlocks, oldBlocks);
    expect(diffs.every((d) => d.status === 'unchanged')).toBe(true);
    expect(summary).toEqual({ added: 0, removed: 0, modified: 0, moved: 0, sectionsChanged: [] });
  });

  it('renders redline HTML with ins, del, change bars and escaped text', () => {
    const newBlocks: Block[] = [
      section('s1', 'SEC-1', [para('a', 'Alpha'), para('b', 'Beta <b>bold</b>')]),
      para('c', 'Gamma'),
      para('e', 'New & improved'),
    ];
    const html = renderRedlineHTML(compareRevisions(oldBlocks, newBlocks));
    expect(html).toContain('class="beakblock-redline-summary"');
    expect(html).toContain('<ins class="beakblock-ins">');
    expect(html).toContain('<del class="beakblock-del">');
    expect(html).toContain('beakblock-change-bar');
    expect(html).toContain('New &amp; improved');
    expect(html).toContain('Beta<ins class="beakblock-ins"> &lt;b&gt;bold&lt;/b&gt;</ins>');
    expect(html).toContain('Removed: 1');
  });
});

describe('diffWords', () => {
  it('computes a word-level LCS diff', () => {
    expect(diffWords('the quick fox', 'the slow fox')).toEqual([
      { type: 'equal', text: 'the ' },
      { type: 'delete', text: 'quick' },
      { type: 'insert', text: 'slow' },
      { type: 'equal', text: ' fox' },
    ]);
    expect(diffWords('', 'new')).toEqual([{ type: 'insert', text: 'new' }]);
  });
});
