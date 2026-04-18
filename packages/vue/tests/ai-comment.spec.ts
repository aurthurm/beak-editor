import { describe, expect, it } from 'vitest';
import {
  BeakBlockEditor,
  BUBBLE_AI_PRESETS,
  InMemoryCommentStore,
  SLASH_AI_PRESETS,
  buildAIContext,
  getDefaultSlashMenuItems,
} from '@amusendame/beakblock-core';

describe('@amusendame/beakblock-ai + comments', () => {
  it('supports comment thread lifecycle actions', () => {
    const store = new InMemoryCommentStore();
    const thread = store.createThread({
      from: 1,
      to: 5,
      authorId: 'alice',
      body: 'Needs revision',
    });

    expect(store.getThreads()).toHaveLength(1);
    expect(store.getThread(thread.id)?.comments).toHaveLength(1);

    const reply = store.addComment({
      threadId: thread.id,
      authorId: 'bob',
      body: 'Will do',
    });

    store.updateComment({
      threadId: thread.id,
      commentId: reply.id,
      body: 'Updated reply',
    });
    store.addReaction({
      threadId: thread.id,
      commentId: reply.id,
      emoji: '👍',
      userId: 'bob',
    });
    store.resolveThread({ threadId: thread.id, userId: 'carol' });

    const updated = store.getThread(thread.id);
    expect(updated?.resolved).toBe(true);
    expect(updated?.comments[1].body).toBe('Updated reply');
    expect(updated?.comments[1].reactions[0].emoji).toBe('👍');

    store.deleteReaction({
      threadId: thread.id,
      commentId: reply.id,
      emoji: '👍',
      userId: 'bob',
    });
    store.deleteComment({ threadId: thread.id, commentId: reply.id });
    expect(store.getThread(thread.id)?.comments).toHaveLength(1);
  });

  it('builds selection-aware AI context and exposes preset catalogs', () => {
    const editor = new BeakBlockEditor({
      initialContent: [
        {
          id: 'p1',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: 'Hello BeakBlock', styles: {} }],
        },
      ],
      injectStyles: false,
    });

    editor.pm.setSelection(editor.pm.createTextSelection(1, 6));

    const bubble = buildAIContext(editor, 'bubble', BUBBLE_AI_PRESETS[0], 'Improve it');
    const slash = buildAIContext(editor, 'slash', SLASH_AI_PRESETS[0], 'Continue writing');

    expect(bubble.selection?.text).toBe('Hello');
    expect(bubble.document.markdown).toContain('Hello BeakBlock');
    expect(slash.mode).toBe('slash');
    expect(getDefaultSlashMenuItems(editor.pm.state.schema).some((item) => item.id === 'ai')).toBe(true);
  });
});

