import { afterEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BeakBlockEditor, type Block } from '@amusendame/beakblock-core';

import { FindReplace } from './FindReplace';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: Array<{ root: Root; host: HTMLElement; editor: BeakBlockEditor }> = [];

afterEach(() => {
  while (mounted.length) {
    const { root, host, editor } = mounted.pop()!;
    act(() => root.unmount());
    editor.destroy();
    host.remove();
  }
});

function render(blocks: Block[]): HTMLElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const editor = new BeakBlockEditor({ initialContent: blocks, injectStyles: false, mode: 'office' });
  const root = createRoot(host);
  act(() => {
    root.render(createElement(FindReplace, { editor }));
  });
  mounted.push({ root, host, editor });
  return host;
}

/** The accessible name of a form control: aria-label, or the text of its associated label. */
function nameOf(el: HTMLElement): string {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();
  const labels = (el as HTMLInputElement).labels ? Array.from((el as HTMLInputElement).labels!) : [];
  return labels.map((label) => label.textContent?.trim() ?? '').filter(Boolean).join(' ');
}

describe('FindReplace accessibility', () => {
  it('labels the find and replace inputs', () => {
    const host = render([{ id: 'p1', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'hello', styles: {} }] }]);
    const find = host.querySelector<HTMLInputElement>('input[type="search"]');
    const replace = host.querySelector<HTMLInputElement>('input[type="text"]');
    expect(find && nameOf(find)).toBe('Find');
    expect(replace && nameOf(replace)).toBe('Replace');
  });

  it('gives each option toggle an accessible name and reports its state', () => {
    const host = render([{ id: 'p1', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'hello', styles: {} }] }]);
    const toggles = Array.from(host.querySelectorAll<HTMLButtonElement>('.bb-office-find-toggle'));
    expect(toggles.map((toggle) => nameOf(toggle))).toEqual(['Match case', 'Whole words', 'Regular expressions']);
    for (const toggle of toggles) expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });
});
