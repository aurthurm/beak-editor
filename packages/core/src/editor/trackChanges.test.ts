import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { BeakBlockEditor } from './Editor';

describe('track changes', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('records log entries when enabled', () => {
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      initialContent: [
        {
          id: 'a',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: 'hello', styles: {} }],
        },
      ],
    });
    editor.enableTrackChanges({ authorId: 't' });
    editor.focus('end');
    const before = editor.getPendingTrackChanges().length;
    editor.pm.insertText(' world');
    const after = editor.getPendingTrackChanges().length;
    expect(after).toBeGreaterThan(before);
    editor.destroy();
  });

  it('setDocument does not append track log', () => {
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      initialContent: [
        {
          id: 'a',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: 'hello', styles: {} }],
        },
      ],
    });
    editor.enableTrackChanges();
    editor.setDocument([
      {
        id: 'b',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'replaced', styles: {} }],
      },
    ]);
    expect(editor.getPendingTrackChanges()).toHaveLength(0);
    editor.destroy();
  });

  it('isTrackChangesEnabled reflects plugin presence', () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false });
    expect(editor.isTrackChangesEnabled).toBe(false);
    editor.enableTrackChanges();
    expect(editor.isTrackChangesEnabled).toBe(true);
    editor.disableTrackChanges();
    expect(editor.isTrackChangesEnabled).toBe(false);
    editor.destroy();
  });
});
