import { defineComponent, h, nextTick, ref, type Ref } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { BeakBlockView, createVueBlockSpec, useCustomSlashMenuItems, useEditorContent, useEditorFocus, useEditorSelection, useBeakBlock, useUpdateBlock } from '@amusendame/beakblock-vue';
import type { Block, BeakBlockEditor } from '@amusendame/beakblock-core';

const initialContent: Block[] = [
  {
    id: 'intro',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Hello from Vue', styles: {} }],
  },
];

describe('@amusendame/beakblock-vue', () => {
  it('mounts the editor view and exposes reactive editor state', async () => {
    let captured: {
      editor: Ref<BeakBlockEditor | null>;
      content: Ref<Block[]>;
      selection: Ref<Block[]>;
      focused: Ref<boolean>;
    } | null = null;

    const Harness = defineComponent({
      name: 'VueHarness',
      setup() {
        const editor = useBeakBlock({
          initialContent,
          injectStyles: false,
        });
        const content = useEditorContent(editor);
        const selection = useEditorSelection(editor);
        const focused = useEditorFocus(editor);
        captured = { editor, content, selection, focused };

        return () => h('div', [h(BeakBlockView, { editor: editor.value })]);
      },
    });

    const wrapper = mount(Harness, { attachTo: document.body });
    await nextTick();
    await nextTick();

    expect(captured).not.toBeNull();
    expect(captured?.editor.value).not.toBeNull();
    expect(captured?.content.value).toHaveLength(1);
    expect(captured?.content.value[0].type).toBe('paragraph');
    expect(captured?.selection.value.length).toBeGreaterThan(0);
    expect(captured?.selection.value[0].type).toBe('paragraph');
    expect(captured?.focused.value).toBe(false);
    expect(wrapper.find('.beakblock-vue-view').exists()).toBe(true);

    wrapper.unmount();
  });

  it('renders links in blue and opens them in a new window when clicked', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const linkText = 'BeakBlock link';
    const linkContent: Block[] = [
      {
        id: 'link-block',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: linkText, styles: {} }],
      },
    ];

    let editorRef: Ref<BeakBlockEditor | null> | null = null;

    const Harness = defineComponent({
      name: 'LinkHarness',
      setup() {
        const editor = useBeakBlock({
          initialContent: linkContent,
        });
        editorRef = editor;
        return () => h('div', [h(BeakBlockView, { editor: editor.value })]);
      },
    });

    const wrapper = mount(Harness, { attachTo: document.body });
    await nextTick();
    await nextTick();

    const editor = editorRef?.value;
    expect(editor).not.toBeNull();
    if (!editor) return;

    const linkMark = editor.pm.schema.marks.link.create({
      href: 'https://example.com',
      title: 'Example',
      target: '_blank',
    });
    editor.pm.dispatch(editor.pm.state.tr.addMark(1, linkText.length + 1, linkMark));
    await nextTick();

    const link = document.querySelector('.beakblock-vue-view a[href="https://example.com"]') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(getComputedStyle(link as HTMLElement).color).toBe('rgb(36, 99, 235)');

    link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');

    openSpy.mockRestore();
    wrapper.unmount();
  });

  it('round-trips links, color marks, and icon sizing through block JSON', async () => {
    let editorRef: Ref<BeakBlockEditor | null> | null = null;

    const roundTripContent: Block[] = [
      {
        id: 'p1',
        type: 'paragraph',
        props: { textAlign: 'left' },
        content: [
          {
            type: 'text',
            text: 'BeakBlock ',
            styles: {},
          },
          {
            type: 'icon',
            icon: 'lucide:sparkles',
            symbol: '✦',
            size: 36,
          },
          {
            type: 'link',
            href: 'https://example.com',
            title: 'Example',
            target: '_blank',
            content: [
              {
                type: 'text',
                text: ' link',
                styles: {
                  textColor: '#2563eb',
                  backgroundColor: '#dcfce7',
                },
              },
            ],
          },
        ],
      },
    ];

    const Harness = defineComponent({
      name: 'RoundTripHarness',
      setup() {
        const editor = useBeakBlock({
          initialContent: roundTripContent,
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

      const exported = editor.getDocument();
      expect(exported).toEqual(roundTripContent);
    } finally {
      wrapper.unmount();
    }
  });

  it('creates Vue custom block specs and slash menu entries', () => {
    const noticeBlock = createVueBlockSpec(
      {
        type: 'notice',
        propSchema: {
          tone: { default: 'info' },
        },
        content: 'none',
      },
      {
        render: defineComponent({
          name: 'NoticeBlock',
          setup: () => () => null,
        }),
        slashMenu: {
          title: 'Notice',
          description: 'Insert a notice block',
          icon: 'callout',
          aliases: ['notice', 'info'],
          group: 'Custom',
        },
      }
    );

    expect(noticeBlock.type).toBe('notice');
    expect(noticeBlock.nodeSpec.attrs.tone.default).toBe('info');
    expect(noticeBlock.slashMenu?.title).toBe('Notice');

    const items = useCustomSlashMenuItems(ref({ isDestroyed: false } as BeakBlockEditor), ref([noticeBlock]));
    expect(items.value).toHaveLength(1);
    expect(items.value[0]).toMatchObject({
      id: 'notice',
      title: 'Notice',
      description: 'Insert a notice block',
      group: 'Custom',
    });
  });

  it('updates blocks through the Vue update helper', async () => {
    let editorRef: Ref<BeakBlockEditor | null> | null = null;

    const Harness = defineComponent({
      name: 'UpdateHarness',
      setup() {
        const editor = useBeakBlock({
          initialContent,
          injectStyles: false,
        });
        editorRef = editor;
        return () => h('div', [h(BeakBlockView, { editor: editor.value })]);
      },
    });

    mount(Harness, { attachTo: document.body });
    await nextTick();

    expect(editorRef?.value).not.toBeNull();
    const updateBlock = useUpdateBlock(editorRef!.value, 'intro');
    updateBlock({ textAlign: 'center' });
    await nextTick();

    expect(editorRef?.value?.getDocument()[0].props.textAlign).toBe('center');
  });

  it('exposes the BeakBlockView container and respects Vue props', async () => {
    let editorRef: Ref<BeakBlockEditor | null> | null = null;
    const viewRef = ref<{ container?: HTMLElement | null; editor?: BeakBlockEditor | null } | null>(null);

    const Harness = defineComponent({
      name: 'ViewHarness',
      setup() {
        const editor = useBeakBlock({
          initialContent,
          injectStyles: false,
        });
        editorRef = editor;
        return () =>
          h(BeakBlockView, {
            ref: viewRef,
            editor: editor.value,
            tag: 'section',
            className: 'custom-shell',
            style: { color: 'rgb(255, 0, 0)' },
          });
      },
    });

    const wrapper = mount(Harness, { attachTo: document.body });
    await nextTick();
    await nextTick();

    const section = wrapper.find('section');
    expect(section.exists()).toBe(true);
    expect(section.classes()).toContain('custom-shell');
    expect((section.element as HTMLElement).style.color).toBe('rgb(255, 0, 0)');
    expect(viewRef.value?.container).toBeInstanceOf(HTMLElement);
    expect(viewRef.value?.editor).toBe(editorRef?.value);
  });
});
