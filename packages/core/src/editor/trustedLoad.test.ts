/**
 * `setDocument` tags a load as trusted only when the caller opts in. Guard plugins may relax
 * their checks for trusted loads, so the default must stay strict.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from 'prosemirror-state';
import { BeakBlockEditor } from './Editor';
import { BEAKBLOCK_META_LOAD_DOCUMENT } from '../plugins/documentLoadMeta';

describe('setDocument trustedLoad', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  function capture(editor: BeakBlockEditor): Transaction[] {
    const seen: Transaction[] = [];
    const dispatch = editor.pm.dispatch.bind(editor.pm);
    vi.spyOn(editor.pm, 'dispatch').mockImplementation((tr: Transaction) => {
      seen.push(tr);
      dispatch(tr);
    });
    return seen;
  }

  it('does not tag a default setDocument as a trusted load', () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false });
    const seen = capture(editor);
    editor.setDocument([{ id: 'p1', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'A', styles: {} }] }]);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.getMeta(BEAKBLOCK_META_LOAD_DOCUMENT)).toBeUndefined();
    editor.destroy();
  });

  it('tags setDocument with trustedLoad: true', () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false });
    const seen = capture(editor);
    editor.setDocument([{ id: 'p1', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'A', styles: {} }] }], {
      trustedLoad: true,
    });
    expect(seen[0]!.getMeta(BEAKBLOCK_META_LOAD_DOCUMENT)).toBe(true);
    editor.destroy();
  });
});
