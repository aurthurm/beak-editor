import { describe, expect, it, vi } from 'vitest';

import { InMemoryCommentStore } from './store';

function threadFixture(id: string): import('./types').CommentThread {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id,
    from: 1,
    to: 5,
    createdAt: now,
    updatedAt: now,
    resolved: false,
    comments: [
      {
        id: `${id}-c1`,
        authorId: 'a',
        body: 'hello',
        createdAt: now,
        updatedAt: now,
        reactions: [],
      },
    ],
  };
}

describe('InMemoryCommentStore', () => {
  it('hydrate replaces threads and notifies subscribers', () => {
    const store = new InMemoryCommentStore();
    store.createThread({ from: 0, to: 1, authorId: 'x', body: 'old' });
    const listener = vi.fn();
    store.subscribe(listener);
    listener.mockClear();

    store.hydrate([threadFixture('t-restore')]);

    expect(store.getThreads().map((t) => t.id)).toEqual(['t-restore']);
    expect(listener).toHaveBeenCalledTimes(1);
    const passed = listener.mock.calls[0][0] as import('./types').CommentThread[];
    expect(passed[0].id).toBe('t-restore');
    expect(passed[0].comments[0].body).toBe('hello');
  });
});
