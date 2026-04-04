import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick, defineComponent, h } from 'vue';
import { BubbleMenu, ColorPicker, MediaMenu, SlashMenu, TableHandles, TableMenu } from '@aurthurm/beakblock-vue';
import * as core from '@aurthurm/beakblock-core';
import { BUBBLE_MENU_PLUGIN_KEY, MEDIA_MENU_PLUGIN_KEY, SLASH_MENU_PLUGIN_KEY, type BeakBlockEditor } from '@aurthurm/beakblock-core';

type StubEditor = Pick<BeakBlockEditor, 'on' | 'isDestroyed' | 'pm'> & {
  insertEmoji: (emoji: string) => void;
  insertIcon: (icon: string, symbol: string, size?: number) => void;
};

function createStubEditor() {
  const listeners = new Map<string, Set<() => void>>();
  const editorDom = document.createElement('div');
  const host = document.createElement('div');
  host.className = 'beakblock-vue-view';
  host.style.position = 'relative';
  host.appendChild(editorDom);
  document.body.appendChild(host);

  const editor: StubEditor = {
    isDestroyed: false,
    on(event: string, callback: () => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(callback);
      return () => listeners.get(event)?.delete(callback);
    },
    pm: {
      state: {},
      view: {
        dom: editorDom,
        focus: vi.fn(),
        dispatch: vi.fn(),
      },
    } as unknown as BeakBlockEditor['pm'],
    insertEmoji: vi.fn(),
    insertIcon: vi.fn(),
  };

  return { editor: editor as BeakBlockEditor, host };
}

function createTableEditor() {
  const listeners = new Map<string, Set<() => void>>();
  const editorDom = document.createElement('div');
  const host = document.createElement('div');
  host.className = 'beakblock-vue-view';
  host.style.position = 'relative';
  host.appendChild(editorDom);
  document.body.appendChild(host);

  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.textContent = 'cell';
  row.appendChild(cell);
  tbody.appendChild(row);
  table.appendChild(tbody);
  editorDom.appendChild(table);

  const editor: StubEditor = {
    isDestroyed: false,
    on(event: string, callback: () => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(callback);
      return () => listeners.get(event)?.delete(callback);
    },
    pm: {
      state: {
        doc: {
          descendants(callback: (node: { type: { name: string }; childCount: number }, pos: number) => boolean | void) {
            callback({ type: { name: 'table' }, childCount: 1 }, 4);
          },
          nodeAt: (pos: number) => (pos === 4 ? { type: { name: 'table' }, childCount: 1 } : null),
        },
        selection: {
          $from: {
            depth: 1,
            node: () => ({ type: { name: 'table' } }),
            before: () => 4,
          },
        },
      },
      view: {
        dom: editorDom,
        state: {
          doc: {
            descendants(callback: (node: { type: { name: string }; childCount: number }, pos: number) => boolean | void) {
              callback({ type: { name: 'table' }, childCount: 1 }, 4);
            },
            nodeAt: (pos: number) => (pos === 4 ? { type: { name: 'table' }, childCount: 1 } : null),
          },
          selection: {
            $from: {
              depth: 1,
              node: () => ({ type: { name: 'table' } }),
              before: () => 4,
            },
          },
        },
        focus: vi.fn(),
        dispatch: vi.fn(),
        nodeDOM: vi.fn(() => table),
      },
    } as unknown as BeakBlockEditor['pm'],
  };

  return { editor: editor as BeakBlockEditor, host, table, row, cell };
}

function mockRect(element: HTMLElement, rect: Partial<DOMRectReadOnly>) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () =>
      ({
        x: rect.left ?? 0,
        y: rect.top ?? 0,
        left: rect.left ?? 0,
        top: rect.top ?? 0,
        right: rect.right ?? (rect.left ?? 0) + (rect.width ?? 0),
        bottom: rect.bottom ?? (rect.top ?? 0) + (rect.height ?? 0),
        width: rect.width ?? 0,
        height: rect.height ?? 0,
        toJSON: () => ({}),
      }) as DOMRect,
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('Vue menu positioning', () => {
  it('opens the color picker as an in-editor dropdown and applies colors', async () => {
    const editor = {
      isDestroyed: false,
      on: vi.fn(() => () => undefined),
      pm: {
        view: {
          dom: document.createElement('div'),
          focus: vi.fn(),
        },
        state: {},
      },
      setTextColor: vi.fn(),
      removeTextColor: vi.fn(),
      setBackgroundColor: vi.fn(),
      removeBackgroundColor: vi.fn(),
    } as unknown as BeakBlockEditor;

    const wrapper = mount(ColorPicker, {
      attachTo: document.body,
      props: {
        editor,
        currentTextColor: null,
        currentBackgroundColor: null,
      },
    });

    await wrapper.find('button').trigger('click');
    await nextTick();

    const dropdown = wrapper.find('.ob-color-picker-dropdown');
    expect(dropdown.exists()).toBe(true);
    expect((dropdown.element as HTMLElement).style.position).toBe('absolute');
    expect((dropdown.element as HTMLElement).style.left).toBe('50%');
    expect((dropdown.element as HTMLElement).style.top).toBe('calc(100% + 8px)');

    await dropdown.find('button[title="Blue"]').trigger('click');
    expect(editor.setTextColor).toHaveBeenCalledWith('#2563eb');
    expect(editor.pm.view.focus).toHaveBeenCalled();

    await wrapper.find('button').trigger('click');
    await nextTick();
    const greenButtons = wrapper.findAll('.ob-color-picker-dropdown button[title="Green"]');
    await greenButtons[1].trigger('click');
    expect(editor.setBackgroundColor).toHaveBeenCalledWith('#dcfce7');
    expect(editor.pm.view.focus).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });

  it('anchors the slash menu to the editor container', async () => {
    const { editor, host } = createStubEditor();
    mockRect(host, { left: 100, top: 200, width: 640, height: 480, right: 740, bottom: 680 });

    vi.spyOn(SLASH_MENU_PLUGIN_KEY, 'getState').mockReturnValue({
      active: true,
      query: 'hea',
      triggerPos: 5,
      coords: { left: 180, top: 260, bottom: 284 },
    } as ReturnType<typeof SLASH_MENU_PLUGIN_KEY.getState>);

    const wrapper = mount(
      defineComponent({
        setup: () =>
          () =>
            h(SlashMenu, {
              editor,
              items: [
                {
                  id: 'custom',
                  title: 'Custom',
                  action: vi.fn(),
                },
              ],
            }),
      }),
      { attachTo: document.body }
    );

    await nextTick();

    const menu = host.querySelector('.ob-slash-menu') as HTMLElement | null;
    expect(menu).not.toBeNull();
    expect(menu?.style.position).toBe('absolute');
    expect(menu?.style.left).toBe('80px');
    expect(menu?.style.top).toBe('88px');

    wrapper.unmount();
  });

  it.each([
    ['emoji', 'Emoji', '😀'],
    ['icon', 'Icon', '✦'],
  ])('opens the %s picker and inserts the selected glyph', async (itemId, title, glyph) => {
    const insertEmoji = vi.fn();
    const insertIcon = vi.fn();
    const { editor, host } = createStubEditor();
    mockRect(host, { left: 100, top: 200, width: 640, height: 480, right: 740, bottom: 680 });
    (editor as unknown as { insertEmoji: typeof insertEmoji }).insertEmoji = insertEmoji;
    (editor as unknown as { insertIcon: typeof insertIcon }).insertIcon = insertIcon;
    editor.pm.state = {
      doc: {
        content: { size: 6 },
        textBetween: vi.fn(() => '/pick'),
        nodeAt: vi.fn(() => null),
      },
      tr: {
        delete: vi.fn().mockReturnThis(),
        setMeta: vi.fn().mockReturnThis(),
      },
      selection: {},
    } as unknown as BeakBlockEditor['pm']['state'];
    (editor.pm.view as unknown as { state: typeof editor.pm.state }).state = editor.pm.state;

    vi.spyOn(SLASH_MENU_PLUGIN_KEY, 'getState').mockReturnValue({
      active: true,
      query: itemId === 'emoji' ? 'emo' : 'icon',
      triggerPos: 0,
      coords: { left: 180, top: 260, bottom: 284 },
    } as ReturnType<typeof SLASH_MENU_PLUGIN_KEY.getState>);

    const wrapper = mount(
      defineComponent({
        setup: () =>
          () =>
            h(SlashMenu, {
              editor,
              items: [
                {
                  id: 'emoji',
                  title: 'Emoji',
                  description: 'Insert an emoji',
                  icon: 'emoji',
                  picker: 'emoji',
                  action: vi.fn(),
                },
                {
                  id: 'icon',
                  title: 'Icon',
                  description: 'Insert a symbol icon',
                  icon: 'sparkles',
                  picker: 'icon',
                  action: vi.fn(),
                },
              ],
            }),
      }),
      { attachTo: document.body }
    );

    await nextTick();

    const menuItem = Array.from(document.querySelectorAll('.ob-slash-menu-item')).find((node) =>
      node.textContent?.includes(title)
    ) as HTMLElement | undefined;
    expect(menuItem).toBeDefined();
    menuItem?.click();
    await nextTick();
    await nextTick();

    const picker = document.querySelector('.ob-slash-picker') as HTMLElement | null;
    expect(picker).not.toBeNull();
    expect(picker?.getAttribute('aria-label')).toBe(itemId === 'emoji' ? 'Emoji picker' : 'Icon picker');
    expect(document.querySelector('.ob-slash-menu')).toBeNull();
    expect(document.querySelector('.ob-slash-picker-backdrop')).not.toBeNull();
    expect(picker?.querySelector('.ob-slash-picker-search')).not.toBeNull();

    const pickerButton = picker?.querySelector('.ob-slash-picker-item') as HTMLButtonElement | null;
    expect(pickerButton).not.toBeNull();
    pickerButton?.click();
    await nextTick();

    if (itemId === 'icon') {
      expect(insertIcon).toHaveBeenCalledWith('lucide:sparkles', '✦', 36);
    } else {
      expect(insertEmoji).toHaveBeenCalledWith(glyph);
    }
    wrapper.unmount();
  });

  it('anchors the bubble menu to the editor container', async () => {
    const { editor, host } = createStubEditor();
    mockRect(host, { left: 120, top: 300, width: 640, height: 480, right: 760, bottom: 780 });

    vi.spyOn(BUBBLE_MENU_PLUGIN_KEY, 'getState').mockReturnValue({
      visible: true,
      from: 1,
      to: 4,
      coords: { left: 220, top: 400, bottom: 424 },
      activeMarks: {
        bold: true,
        italic: false,
        underline: false,
        strikethrough: false,
        code: false,
        link: null,
        textColor: null,
        backgroundColor: null,
      },
      blockType: { type: 'paragraph', props: {} },
      textAlign: 'left',
    } as ReturnType<typeof BUBBLE_MENU_PLUGIN_KEY.getState>);

    const wrapper = mount(
      defineComponent({
        setup: () => () => h(BubbleMenu, { editor }),
      }),
      { attachTo: document.body }
    );

    await nextTick();

    const menu = host.querySelector('.ob-bubble-menu') as HTMLElement | null;
    expect(menu).not.toBeNull();
    expect(menu?.style.position).toBe('absolute');
    expect(menu?.style.left).toBe('100px');
    expect(menu?.style.top).toBe('48px');

    wrapper.unmount();
  });

  it('anchors the link popover to the bubble menu', async () => {
    const { editor, host } = createStubEditor();
    mockRect(host, { left: 120, top: 300, width: 640, height: 480, right: 760, bottom: 780 });

    vi.spyOn(BUBBLE_MENU_PLUGIN_KEY, 'getState').mockReturnValue({
      visible: true,
      from: 1,
      to: 4,
      coords: { left: 220, top: 400, bottom: 424 },
      activeMarks: {
        bold: true,
        italic: false,
        underline: false,
        strikethrough: false,
        code: false,
        link: null,
        textColor: null,
        backgroundColor: null,
      },
      blockType: { type: 'paragraph', props: {} },
      textAlign: 'left',
    } as ReturnType<typeof BUBBLE_MENU_PLUGIN_KEY.getState>);

    const wrapper = mount(
      defineComponent({
        setup: () => () => h(BubbleMenu, { editor }),
      }),
      { attachTo: document.body }
    );

    await nextTick();

    const linkButton = host.querySelector('button[title="Add link"]') as HTMLButtonElement | null;
    expect(linkButton).not.toBeNull();
    linkButton?.click();
    await nextTick();
    await nextTick();

    const popover = host.querySelector('.ob-link-popover') as HTMLElement | null;
    expect(popover).not.toBeNull();
    expect(popover?.style.position).toBe('absolute');
    expect(popover?.style.left).toBe('50%');

    wrapper.unmount();
  });

  it('anchors the media menu to the editor container', async () => {
    const { editor, host } = createStubEditor();
    mockRect(host, { left: 100, top: 200, width: 640, height: 480, right: 740, bottom: 680 });

    vi.spyOn(MEDIA_MENU_PLUGIN_KEY, 'getState').mockReturnValue({
      visible: true,
      nodePos: 8,
      mediaType: 'image',
      attrs: {
        src: 'https://example.com/image.png',
        alignment: 'center',
        caption: 'Caption',
      },
      coords: { left: 220, top: 400, bottom: 424, right: 260 },
    } as ReturnType<typeof MEDIA_MENU_PLUGIN_KEY.getState>);

    const wrapper = mount(
      defineComponent({
        setup: () => () => h(MediaMenu, { editor }),
      }),
      { attachTo: document.body }
    );

    await nextTick();

    const menu = host.querySelector('.ob-media-menu') as HTMLElement | null;
    expect(menu).not.toBeNull();
    expect(menu?.style.position).toBe('absolute');
    expect(menu?.style.left).toBe('140px');
    expect(menu?.style.top).toBe('148px');

    wrapper.unmount();
  });

  it('uploads an image from the computer and applies the data url', async () => {
    const fileReaderMock = vi.fn();
    class MockFileReader {
      result: string | ArrayBuffer | null = 'data:image/png;base64,ZmFrZQ==';
      error: DOMException | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
      readAsDataURL = fileReaderMock.mockImplementation(() => {
        this.onload?.call(this as unknown as FileReader, { target: { result: this.result } } as ProgressEvent<FileReader>);
      });
    }

    vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader);

    const updateMediaAttrsSpy = vi.spyOn(core, 'updateMediaAttrs');
    const { editor, host } = createStubEditor();
    mockRect(host, { left: 100, top: 200, width: 640, height: 480, right: 740, bottom: 680 });

    vi.spyOn(MEDIA_MENU_PLUGIN_KEY, 'getState').mockReturnValue({
      visible: true,
      nodePos: 8,
      mediaType: 'image',
      attrs: {
        src: 'https://example.com/image.png',
        alignment: 'center',
        caption: 'Caption',
        alt: '',
        width: null,
      },
      coords: { left: 220, top: 400, bottom: 424, right: 260 },
    } as ReturnType<typeof MEDIA_MENU_PLUGIN_KEY.getState>);

    const wrapper = mount(
      defineComponent({
        setup: () => () => h(MediaMenu, { editor }),
      }),
      { attachTo: document.body }
    );

    await nextTick();

    const uploadButton = host.querySelector('button[title="Upload image from computer"]') as HTMLButtonElement | null;
    expect(uploadButton).not.toBeNull();
    uploadButton?.click();

    const fileInput = host.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    if (!fileInput) return;

    const file = new File(['fake'], 'photo.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      configurable: true,
    });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    await nextTick();
    await nextTick();

    expect(updateMediaAttrsSpy).toHaveBeenCalledWith(
      editor.pm.view,
      8,
      expect.objectContaining({
        src: 'data:image/png;base64,ZmFrZQ==',
        alt: 'photo.png',
      })
    );

    wrapper.unmount();
  });

  it('anchors the table menu to the editor container', async () => {
    const { editor, host, table } = createTableEditor();
    mockRect(host, { left: 100, top: 200, width: 640, height: 480, right: 740, bottom: 680 });
    mockRect(table, { left: 220, top: 340, width: 200, height: 40, right: 420, bottom: 380 });

    vi.spyOn(core, 'isInTable').mockReturnValue(true);
    vi.spyOn(core, 'getTableInfo').mockReturnValue({ rowIndex: 0, cellIndex: 0, rowCount: 1, colCount: 1 });

    const wrapper = mount(
      defineComponent({
        setup: () => () => h(TableMenu, { editor }),
      }),
      { attachTo: document.body }
    );

    await nextTick();

    const menu = host.querySelector('.ob-table-menu') as HTMLElement | null;
    expect(menu).not.toBeNull();
    expect(menu?.style.position).toBe('absolute');
    expect(menu?.style.left).toBe('120px');
    expect(menu?.style.top).toBe('96px');

    wrapper.unmount();
  });

  it('anchors table handles and extend buttons to the editor container', async () => {
    const { editor, host, table, row, cell } = createTableEditor();
    mockRect(host, { left: 100, top: 200, width: 640, height: 480, right: 740, bottom: 680 });
    mockRect(table, { left: 220, top: 340, width: 200, height: 40, right: 420, bottom: 380 });
    mockRect(row, { left: 220, top: 340, width: 200, height: 40, right: 420, bottom: 380 });
    mockRect(cell, { left: 220, top: 340, width: 100, height: 40, right: 320, bottom: 380 });

    const wrapper = mount(
      defineComponent({
        setup: () => () => h(TableHandles, { editor }),
      }),
      { attachTo: document.body }
    );

    await nextTick();

    cell.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 250, clientY: 360 }));
    await nextTick();

    const overlay = host.querySelector('.ob-table-handles') as HTMLElement | null;
    const rowHandle = host.querySelector('.ob-table-handle--row') as HTMLElement | null;
    const rowExtendBtn = host.querySelector('.ob-table-extend-btn--row') as HTMLElement | null;
    expect(overlay).not.toBeNull();
    expect(rowHandle).not.toBeNull();
    expect(rowHandle?.style.position).toBe('absolute');
    expect(rowHandle?.style.left).toBe('92px');
    expect(rowHandle?.style.top).toBe('140px');
    expect(rowExtendBtn?.style.position).toBe('absolute');
    expect(rowExtendBtn?.style.left).toBe('120px');
    expect(rowExtendBtn?.style.top).toBe('184px');

    wrapper.unmount();
  });

  it('renders icons for the main slash command variants', async () => {
    const { editor, host } = createStubEditor();
    mockRect(host, { left: 100, top: 200, width: 640, height: 480, right: 740, bottom: 680 });

    vi.spyOn(SLASH_MENU_PLUGIN_KEY, 'getState').mockReturnValue({
      active: true,
      query: '',
      triggerPos: 5,
      coords: { left: 180, top: 260, bottom: 284 },
    } as ReturnType<typeof SLASH_MENU_PLUGIN_KEY.getState>);

    const items = [
      { id: 'callout', title: 'Callout', icon: 'callout', action: vi.fn() },
      { id: 'warning', title: 'Warning', icon: 'alertTriangle', action: vi.fn() },
      { id: 'success', title: 'Success', icon: 'checkCircle', action: vi.fn() },
      { id: 'error', title: 'Error', icon: 'xCircle', action: vi.fn() },
      { id: 'columns2', title: '2 Columns', icon: 'columns', action: vi.fn() },
      { id: 'columns3', title: '3 Columns', icon: 'columns', action: vi.fn() },
      { id: 'columnsSidebar', title: 'Sidebar Left', icon: 'columns', action: vi.fn() },
      { id: 'table', title: 'Table', icon: 'table', action: vi.fn() },
      { id: 'table2x2', title: 'Table 2x2', icon: 'table', action: vi.fn() },
      { id: 'table4x4', title: 'Table 4x4', icon: 'table', action: vi.fn() },
      { id: 'embed', title: 'Embed', icon: 'embed', action: vi.fn() },
      { id: 'youtube', title: 'YouTube', icon: 'youtube', action: vi.fn() },
      { id: 'chart', title: 'Chart', icon: 'chart', action: vi.fn() },
    ] as const;

    const wrapper = mount(
      defineComponent({
        setup: () =>
          () =>
            h(SlashMenu, {
              editor,
              items: items as unknown as typeof items[number][],
            }),
      }),
      { attachTo: document.body }
    );

    await nextTick();

    const iconWrappers = host.querySelectorAll('.ob-slash-menu-item-icon');
    expect(iconWrappers.length).toBeGreaterThanOrEqual(8);
    expect(host.textContent).toContain('Callout');
    expect(host.textContent).toContain('Chart');

    wrapper.unmount();
  });
});
