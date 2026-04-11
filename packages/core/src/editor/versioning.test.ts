import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { BeakBlockEditor } from './Editor';
import { InMemoryVersioningAdapter } from '../versioning/inMemoryAdapter';

describe('BeakBlockEditor versioning', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('saveVersion and restoreVersion round-trip', async () => {
    const adapter = new InMemoryVersioningAdapter();
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      versioning: { adapter },
      initialContent: [
        {
          id: 'a',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: 'v1', styles: {} }],
        },
      ],
    });
    const v = await editor.saveVersion({ label: 'snap' });
    editor.focus('end');
    editor.pm.insertText(' edited');
    expect(editor.pm.doc.textContent).toContain('edited');
    const ok = await editor.restoreVersion(v.id);
    expect(ok).toBe(true);
    expect(editor.pm.doc.textContent).toMatch(/v1/);
    expect(editor.pm.doc.textContent).not.toContain('edited');
    editor.destroy();
  });

  it('saveVersion throws without adapter', async () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false });
    await expect(editor.saveVersion()).rejects.toThrow(/not configured/);
    editor.destroy();
  });
});
