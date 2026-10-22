import { describe, expect, it } from 'vitest';
import type { Block } from '@amusendame/beakblock-core';

import { restoreSnapshotPreservingRevisions } from './restore';

const rev = (kind: 'insert' | 'delete', revisionId: string) => ({
  kind,
  revisionId,
  at: '2026-01-01T00:00:00Z',
});

describe('restoreSnapshotPreservingRevisions', () => {
  const snapshot: Block[] = [
    { id: 'p1', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Base text', styles: {} }] },
    { id: 'p2', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Second', styles: {} }] },
  ];

  it('keeps pending revisions on blocks whose base text still matches', () => {
    const current: Block[] = [
      {
        id: 'p1',
        type: 'paragraph',
        props: {},
        content: [
          { type: 'text', text: 'Base ', styles: {} },
          { type: 'text', text: 'draft ', styles: { revision: rev('insert', 'r1') } as never },
          { type: 'text', text: 'text', styles: {} },
        ],
      },
      { id: 'p2', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Second', styles: {} }] },
    ];
    const result = restoreSnapshotPreservingRevisions(current, snapshot);
    expect(result.droppedRevisions).toEqual([]);
    expect(result.blocks[0]!.content).toEqual(current[0]!.content);
    expect(result.blocks.map((b) => b.id)).toEqual(['p1', 'p2']);
  });

  it('reports revisions it cannot carry over instead of clearing them silently', () => {
    const current: Block[] = [
      {
        id: 'p1',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Changed heavily', styles: { revision: rev('delete', 'r2') } as never }],
      },
      {
        id: 'p9',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Extra', styles: { revision: rev('insert', 'r3') } as never }],
      },
    ];
    const result = restoreSnapshotPreservingRevisions(current, snapshot);
    expect(result.blocks.map((b) => b.id)).toEqual(['p1', 'p2']);
    expect(result.blocks[0]!.content).toEqual([{ type: 'text', text: 'Base text', styles: {} }]);
    expect(result.droppedRevisions).toEqual([
      { revisionId: 'r2', kind: 'delete', blockId: 'p1', reason: 'text-changed' },
      { revisionId: 'r3', kind: 'insert', blockId: 'p9', reason: 'block-removed' },
    ]);
  });
});
