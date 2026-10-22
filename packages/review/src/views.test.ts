import { describe, expect, it } from 'vitest';
import type { Block } from '@amusendame/beakblock-core';

import { getReviewView, projectBlocks, setReviewView } from './views';

const revised: Block[] = [
  {
    id: 'p1',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'Keep ', styles: {} },
      { type: 'text', text: 'old', styles: { revision: { kind: 'delete', revisionId: 'r1', at: '2026-01-01T00:00:00Z' } } as never },
      { type: 'text', text: 'new', styles: { revision: { kind: 'insert', revisionId: 'r2', at: '2026-01-01T00:00:00Z' } } as never },
    ],
  },
  {
    id: 'p2',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'gone', styles: { revision: { kind: 'delete', revisionId: 'r3', at: 'x' } } as never }],
  },
  {
    id: 'p3',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'draft line', styles: { revision: { kind: 'insert', revisionId: 'r4', at: 'x' } } as never }],
  },
];

describe('review views', () => {
  it('toggles the view class on the root element', () => {
    const el = document.createElement('div');
    setReviewView(el, 'final');
    expect(el.classList.contains('beakblock-review-view-final')).toBe(true);
    expect(getReviewView(el)).toBe('final');
    setReviewView(el, 'original');
    expect(el.classList.contains('beakblock-review-view-final')).toBe(false);
    expect(el.classList.contains('beakblock-review-view-original')).toBe(true);
    expect(getReviewView({ dom: el })).toBe('original');
  });

  it('projects Final: drops deleted text and blocks that are entirely deleted', () => {
    const final = projectBlocks(revised, 'final');
    expect(final.map((b) => b.id)).toEqual(['p1', 'p3']);
    expect(final[0]!.content).toEqual([
      { type: 'text', text: 'Keep ', styles: {} },
      { type: 'text', text: 'new', styles: {} },
    ]);
  });

  it('projects Original: drops inserted text and blocks that are entirely inserted', () => {
    const original = projectBlocks(revised, 'original');
    expect(original.map((b) => b.id)).toEqual(['p1', 'p2']);
    expect(original[0]!.content).toEqual([
      { type: 'text', text: 'Keep ', styles: {} },
      { type: 'text', text: 'old', styles: {} },
    ]);
  });

  it('keeps revision references in Markup and does not mutate its input', () => {
    const before = JSON.stringify(revised);
    const markup = projectBlocks(revised, 'markup');
    expect(markup).toEqual(revised);
    expect(JSON.stringify(revised)).toBe(before);
  });
});
