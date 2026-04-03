import { defineComponent, h, nextTick, type Ref } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorView, TextSelection, type BeakBlockEditor, type Block } from '@aurthurm/beakblock-core';
import { BeakBlockView, useBeakBlock } from '@aurthurm/beakblock-vue';

const bulletContent: Block[] = [
  {
    id: 'bullet-list',
    type: 'bulletList',
    props: {},
    content: [],
    children: [
      {
        id: 'bullet-item-1',
        type: 'listItem',
        props: {},
        content: [{ type: 'text', text: 'First bullet', styles: {} }],
      },
    ],
  },
];

const orderedContent: Block[] = [
  {
    id: 'ordered-list',
    type: 'orderedList',
    props: { start: 1 },
    content: [],
    children: [
      {
        id: 'ordered-item-1',
        type: 'listItem',
        props: {},
        content: [{ type: 'text', text: 'First step', styles: {} }],
      },
    ],
  },
];

function setSelectionToTextEnd(editor: BeakBlockEditor) {
  const { doc } = editor.pm.state;
  let targetPos: number | null = null;

  doc.descendants((node, pos) => {
    if (node.isText && typeof node.text === 'string') {
      targetPos = pos + node.nodeSize;
      return false;
    }
    return true;
  });

  expect(targetPos).not.toBeNull();

  editor.pm.dispatch(
    editor.pm.state.tr.setSelection(TextSelection.create(doc, targetPos ?? 1))
  );
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('@aurthurm/beakblock-vue list enter behavior', () => {
  it.each([
    ['bullet list', bulletContent, 'bulletList'],
    ['ordered list', orderedContent, 'orderedList'],
  ])('splits %s items into sibling list items on Enter', async (_label, initialContent, expectedType) => {
    vi.spyOn(EditorView.prototype, 'coordsAtPos').mockReturnValue({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    } as DOMRect);

    let editorRef: Ref<BeakBlockEditor | null> | null = null;

    const Harness = defineComponent({
      name: 'ListEnterHarness',
      setup() {
        const editor = useBeakBlock({
          initialContent,
          injectStyles: false,
        });
        editorRef = editor;
        return () => h('div', [h(BeakBlockView, { editor: editor.value })]);
      },
    });

    const wrapper = mount(Harness, { attachTo: document.body });

    try {
      await nextTick();
      await nextTick();

      const editor = editorRef?.value;
      expect(editor).not.toBeNull();
      if (!editor) return;

      setSelectionToTextEnd(editor);
      await nextTick();

      const view = editor.pm.view.dom;
      view.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          bubbles: true,
          cancelable: true,
        })
      );

      await nextTick();
      await nextTick();

      const documentJson = editor.getDocument();
      expect(documentJson).toHaveLength(1);
      expect(documentJson[0].type).toBe(expectedType);
      expect(documentJson[0].children).toHaveLength(2);
      expect(documentJson[0].children?.[0].type).toBe('listItem');
      expect(documentJson[0].children?.[1].type).toBe('listItem');
    } finally {
      wrapper.unmount();
    }
  });
});
