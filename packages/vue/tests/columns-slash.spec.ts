import { defineComponent, h, nextTick, type Ref } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BeakBlockView,
  getDefaultSlashMenuItems,
  TextSelection,
  type Block,
  type BeakBlockEditor,
} from '@aurthurm/beakblock-core';
import { useBeakBlock } from '@aurthurm/beakblock-vue';

const initialContent: Block[] = [
  {
    id: 'column-list-1',
    type: 'columnList',
    props: { gap: 16 },
    children: [
      {
        id: 'column-1',
        type: 'column',
        props: { width: 50 },
        children: [
          {
            id: 'col1-para',
            type: 'paragraph',
            props: {},
            content: [{ type: 'text', text: 'Inside the first column', styles: {} }],
          },
        ],
      },
      {
        id: 'column-2',
        type: 'column',
        props: { width: 50 },
        children: [
          {
            id: 'col2-para',
            type: 'paragraph',
            props: {},
            content: [{ type: 'text', text: 'Inside the second column', styles: {} }],
          },
        ],
      },
    ],
  },
];

function setSelectionInsideBlock(editor: BeakBlockEditor, blockId: string) {
  let targetPos: number | null = null;

  editor.pm.state.doc.descendants((node, pos) => {
    if (node.attrs?.id === blockId) {
      targetPos = pos + 1;
      return false;
    }
    return true;
  });

  expect(targetPos).not.toBeNull();

  editor.pm.dispatch(
    editor.pm.state.tr.setSelection(TextSelection.create(editor.pm.state.doc, targetPos ?? 1))
  );
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('@aurthurm/beakblock-vue column slash commands', () => {
  it.each([
    ['bulletList', 'bulletList'],
    ['orderedList', 'orderedList'],
    ['checklist', 'checkList'],
  ])('keeps the column layout when inserting %s inside a column', async (itemId, expectedType) => {
    let editorRef: Ref<BeakBlockEditor | null> | null = null;

    const Harness = defineComponent({
      name: 'ColumnSlashHarness',
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

      const columnList = editor.pm.view.dom.querySelector('.ob-column-list') as HTMLElement | null;
      expect(columnList).not.toBeNull();
      expect(columnList?.style.display).toBe('grid');
      expect(columnList?.style.gridTemplateColumns).toContain('50fr');

      setSelectionInsideBlock(editor, 'col1-para');
      await nextTick();

      const menuItem = getDefaultSlashMenuItems(editor.pm.state.schema).find((item) => item.id === itemId);
      expect(menuItem).toBeDefined();
      if (!menuItem) return;

      menuItem.action(
        editor.pm.view,
        {
          active: false,
          query: '',
          triggerPos: 0,
          coords: null,
        }
      );

      await nextTick();
      await nextTick();

      const seenTypes: string[] = [];
      editor.pm.state.doc.descendants((node) => {
        seenTypes.push(node.type.name);
        return true;
      });

      expect(seenTypes.filter((type) => type === 'columnList')).toHaveLength(1);
      expect(seenTypes.filter((type) => type === 'column')).toHaveLength(2);
      expect(seenTypes).toContain(expectedType);
      expect(seenTypes.some((type) => type === 'bulletList' || type === 'orderedList' || type === 'checkList')).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });
});
