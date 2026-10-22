import { afterEach, describe, expect, it } from 'vitest';
import { StrictMode, createElement, useEffect } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { BeakBlockEditor, BeakExtension, Block } from '@amusendame/beakblock-core';
import { useBeakBlock } from './useBeakBlock';
import { BeakBlockView } from '../components/BeakBlockView';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** An atom whose only rendering comes from its extension node view. */
const tagExtension: BeakExtension = {
  name: 'test-tag',
  nodes: {
    testTag: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: { label: { default: '' } },
      toDOM: () => ['span', { class: 'raw-tag' }, 'raw'],
    },
  },
  nodeViews: {
    testTag: (node) => {
      const dom = document.createElement('span');
      dom.className = 'view-tag';
      dom.textContent = `view:${String(node.attrs.label)}`;
      return { dom };
    },
  },
};

const initialContent = [
  {
    id: 'p1',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'Before ', styles: {} },
      { type: 'testTag', props: { label: 'x' } },
    ],
  },
] as unknown as Block[];

let root: Root | null = null;
let container: HTMLElement | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('useBeakBlock', () => {
  it('keeps the node views contributed by extensions when the hook adds its own', async () => {
    let editor: BeakBlockEditor | null = null;
    function Host() {
      const instance = useBeakBlock({ initialContent, extensions: [tagExtension] });
      useEffect(() => {
        if (instance) editor = instance;
      }, [instance]);
      return createElement(BeakBlockView, { editor: instance });
    }
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(StrictMode, null, createElement(Host)));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(editor).not.toBeNull();
    expect(container.querySelector('.view-tag')?.textContent).toBe('view:x');
    expect(container.querySelector('.raw-tag')).toBeNull();
  });
});
