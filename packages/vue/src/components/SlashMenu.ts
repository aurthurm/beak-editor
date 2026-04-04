import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  ref,
  Teleport,
  watch,
  type PropType,
  type VNodeChild,
} from 'vue';
import { Icon } from '@iconify/vue';
import data from '@emoji-mart/data';
import { init, SearchIndex } from 'emoji-mart';
import {
  SLASH_MENU_PLUGIN_KEY,
  closeSlashMenu,
  executeSlashCommand,
  filterSlashMenuItems,
  getDefaultSlashMenuItems,
  type BeakBlockEditor,
  type SlashMenuItem,
  type SlashMenuState,
} from '@aurthurm/beakblock-core';

export interface SlashMenuProps {
  editor: BeakBlockEditor | null;
  items?: SlashMenuItem[];
  customItems?: SlashMenuItem[];
  itemOrder?: string[];
  hideItems?: string[];
  renderItem?: (item: SlashMenuItem, isSelected: boolean) => VNodeChild;
  className?: string;
}

function svg(path: string, attrs: Record<string, unknown> = {}) {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', ...attrs }, [h('path', { d: path })]);
}

function getMenuHost(editor: BeakBlockEditor | null): HTMLElement | null {
  if (!editor || editor.isDestroyed) return null;
  return (editor.pm.view.dom.closest('.beakblock-vue-view') as HTMLElement | null) || editor.pm.view.dom.parentElement || null;
}

const Icons: Record<string, VNodeChild> = {
  heading1: svg('M4 12h8M4 6v12M12 6v12M17 12l3-2v8'),
  heading2: svg('M4 12h8M4 6v12M12 6v12M17 10c1.5-1 3 0 3 2s-3 3-3 5h3'),
  heading3: svg('M4 12h8M4 6v12M12 6v12M17 10c1.5-1 3 0 3 1.5c0 1-1 1.5-1.5 1.5c.5 0 1.5.5 1.5 1.5c0 1.5-1.5 2.5-3 1.5'),
  list: svg('M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'),
  listOrdered: svg('M10 6h11M10 12h11M10 18h11M3 5v3h2M3 10v1c0 1 2 2 2 2s-2 1-2 2v1h4M3 17v4h2l2-2'),
  quote: svg('M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21'),
  code: svg('M16 18l6-6-6-6M8 6l-6 6 6 6'),
  minus: svg('M5 12h14'),
  emoji: h('span', { class: 'ob-slash-menu-icon-text' }, '🙂'),
  sparkles: svg('M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2zM19 14l.9 2.6L22.5 18l-2.6.9L19 21.5l-.9-2.6-2.6-.9 2.6-.9L19 14z'),
  image: h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [
    h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2', ry: '2' }),
    h('circle', { cx: '8.5', cy: '8.5', r: '1.5' }),
    h('polyline', { points: '21 15 16 10 5 21' }),
  ]),
  checkSquare: svg('M9 11 12 14 22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'),
  callout: svg('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'),
  info: h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [
    h('circle', { cx: '12', cy: '12', r: '10', strokeWidth: '2' }),
    h('path', { d: 'M12 10v6', strokeWidth: '2' }),
    h('path', { d: 'M12 7h.01', strokeWidth: '2' }),
  ]),
  alertTriangle: h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [
    h('path', { d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', strokeWidth: '2' }),
    h('path', { d: 'M12 9v4', strokeWidth: '2' }),
    h('path', { d: 'M12 17h.01', strokeWidth: '2' }),
  ]),
  checkCircle: h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [
    h('circle', { cx: '12', cy: '12', r: '10', strokeWidth: '2' }),
    h('polyline', { points: '9 12 11 14 15 10', strokeWidth: '2' }),
  ]),
  xCircle: h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [
    h('circle', { cx: '12', cy: '12', r: '10', strokeWidth: '2' }),
    h('path', { d: 'M15 9l-6 6M9 9l6 6', strokeWidth: '2' }),
  ]),
  columns: h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [
    h('rect', { x: '3', y: '4', width: '7', height: '16', rx: '1.5', strokeWidth: '2' }),
    h('rect', { x: '14', y: '4', width: '7', height: '16', rx: '1.5', strokeWidth: '2' }),
  ]),
  chart: h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [
    h('path', { d: 'M3 3v18h18', strokeWidth: '2' }),
    h('rect', { x: '6', y: '13', width: '3', height: '5', rx: '0.5', strokeWidth: '2' }),
    h('rect', { x: '11', y: '9', width: '3', height: '9', rx: '0.5', strokeWidth: '2' }),
    h('rect', { x: '16', y: '5', width: '3', height: '13', rx: '0.5', strokeWidth: '2' }),
  ]),
};

const FALLBACK_ICON_BY_ID: Record<string, string> = {
  calloutInfo: 'info',
  calloutWarning: 'alertTriangle',
  calloutSuccess: 'checkCircle',
  calloutError: 'xCircle',
  columns2: 'columns',
  columns3: 'columns',
  columnsSidebar: 'columns',
  table: 'table',
  table2x2: 'table',
  table4x4: 'table',
  embed: 'embed',
  youtube: 'youtube',
  chart: 'chart',
};

function resolveItemIcon(item: SlashMenuItem) {
  const iconKey = item.icon || FALLBACK_ICON_BY_ID[item.id];
  return iconKey ? Icons[iconKey] ?? null : null;
}

const SearchIcon = svg('M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.25-1.25L21 22');

init({ data });

type EmojiSearchResult = {
  id: string;
  name: string;
  skins?: { native: string }[];
};

type IconOption = {
  id: string;
  icon: string;
  symbol: string;
};

const EMOJI_FAVORITES = ['😀', '😁', '😂', '🥹', '🙂', '😍', '🔥', '✨', '🎉', '🚀', '💡', '✅'];

const ICON_OPTIONS: IconOption[] = [
  { id: 'sparkles', icon: 'lucide:sparkles', symbol: '✦' },
  { id: 'heart', icon: 'lucide:heart', symbol: '♥' },
  { id: 'star', icon: 'lucide:star', symbol: '★' },
  { id: 'smile', icon: 'lucide:smile', symbol: '☺' },
  { id: 'zap', icon: 'lucide:zap', symbol: '⚡' },
  { id: 'check', icon: 'lucide:check', symbol: '✓' },
  { id: 'plus', icon: 'lucide:plus', symbol: '+' },
  { id: 'arrow-right', icon: 'lucide:arrow-right', symbol: '➜' },
  { id: 'chevron-right', icon: 'lucide:chevron-right', symbol: '›' },
  { id: 'circle', icon: 'lucide:circle', symbol: '●' },
  { id: 'square', icon: 'lucide:square', symbol: '■' },
  { id: 'triangle', icon: 'lucide:triangle', symbol: '▲' },
  { id: 'bookmark', icon: 'lucide:bookmark', symbol: '🔖' },
  { id: 'message-circle', icon: 'lucide:message-circle', symbol: '◉' },
  { id: 'image', icon: 'lucide:image', symbol: '🖼' },
  { id: 'calendar', icon: 'lucide:calendar', symbol: '📅' },
  { id: 'clock', icon: 'lucide:clock', symbol: '◔' },
  { id: 'camera', icon: 'lucide:camera', symbol: '◌' },
  { id: 'pen-line', icon: 'lucide:pen-line', symbol: '✎' },
  { id: 'flag', icon: 'lucide:flag', symbol: '⚑' },
  { id: 'lightbulb', icon: 'lucide:lightbulb', symbol: '💡' },
  { id: 'globe', icon: 'lucide:globe', symbol: '🌐' },
  { id: 'shield', icon: 'lucide:shield', symbol: '🛡' },
  { id: 'rocket', icon: 'lucide:rocket', symbol: '🚀' },
  { id: 'music', icon: 'lucide:music', symbol: '♪' },
  { id: 'settings', icon: 'lucide:settings', symbol: '⚙' },
];

export const SlashMenu = defineComponent({
  name: 'SlashMenu',
  emits: ['ai'],
  props: {
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    items: { type: Array as PropType<SlashMenuItem[]>, default: undefined },
    customItems: { type: Array as PropType<SlashMenuItem[]>, default: () => [] },
    itemOrder: { type: Array as PropType<string[]>, default: undefined },
    hideItems: { type: Array as PropType<string[]>, default: () => [] },
    onAI: { type: Function as PropType<() => void>, default: undefined },
    renderItem: { type: Function as PropType<(item: SlashMenuItem, isSelected: boolean) => VNodeChild>, default: undefined },
    className: { type: String, default: '' },
  },
  setup(props, { emit }) {
    const menuState = ref<SlashMenuState | null>(null);
    const selectedIndex = ref(0);
    const openUpward = ref(false);
    const activePicker = ref<'emoji' | 'icon' | null>(null);
    const pickerAnchor = ref<SlashMenuState | null>(null);
    const menuRef = ref<HTMLElement | null>(null);
    const emojiQuery = ref('');
    const emojiResults = ref<EmojiSearchResult[]>([]);
    const iconQuery = ref('');

    const setDefaultEmojiResults = () => {
      emojiResults.value = EMOJI_FAVORITES.map((native) => ({
        id: native,
        name: native,
        skins: [{ native }],
      }));
    };

    const allItems = computed(() => {
      if (!props.editor) return [];
      if (props.items) return props.items;
      const defaultItems = getDefaultSlashMenuItems(props.editor.pm.state.schema);
      const merged = props.customItems?.length ? [...defaultItems, ...props.customItems] : defaultItems;
      const itemMap = new Map<string, SlashMenuItem>();
      merged.forEach((item) => itemMap.set(item.id, item));
      if (props.itemOrder?.length) {
        return props.itemOrder.map((id) => itemMap.get(id)).filter(Boolean) as SlashMenuItem[];
      }
      if (props.hideItems?.length) {
        const hidden = new Set(props.hideItems);
        return merged.filter((item) => !hidden.has(item.id));
      }
      return merged;
    });

    const filteredItems = computed(() => (menuState.value ? filterSlashMenuItems(allItems.value, menuState.value.query) : []));
    const filteredIconOptions = computed(() => {
      const query = iconQuery.value.trim().toLowerCase();
      if (!query) return ICON_OPTIONS;
      return ICON_OPTIONS.filter((item) => item.id.includes(query));
    });

    const updateState = () => {
      if (!props.editor || props.editor.isDestroyed) return;
      menuState.value = SLASH_MENU_PLUGIN_KEY.getState(props.editor.pm.state) ?? null;
      selectedIndex.value = 0;
    };

    watch(
      () => activePicker.value,
      async (picker) => {
        emojiQuery.value = '';
        iconQuery.value = '';
        if (picker === 'emoji') {
          setDefaultEmojiResults();
          await nextTick();
          return;
        }
        emojiResults.value = [];
      },
      { immediate: true }
    );

    watch(
      () => emojiQuery.value,
      async (query) => {
        if (activePicker.value !== 'emoji') return;
        const trimmed = query.trim();
        if (!trimmed) {
          setDefaultEmojiResults();
          return;
        }
        const results = await SearchIndex.search(trimmed, { maxResults: 24, caller: 'SlashMenu.emojiSearch' });
        emojiResults.value = (results ?? []).map((emoji: EmojiSearchResult) => ({
          id: emoji.id,
          name: emoji.name,
          skins: emoji.skins,
        }));
      }
    );

    watch(
      () => props.editor,
      (editor, _prev, onCleanup) => {
        updateState();
        if (!editor || editor.isDestroyed) return;
        const unsubscribe = editor.on('transaction', updateState);
        onCleanup(() => unsubscribe());
      },
      { immediate: true }
    );

    const handleSelect = (item: SlashMenuItem) => {
      if (!props.editor || props.editor.isDestroyed || !menuState.value) return;
      const currentMenuState = menuState.value;
      if (item.id === 'ai') {
        executeSlashCommand(props.editor.pm.view, currentMenuState, () => {
          props.onAI?.();
        });
        emit('ai');
        activePicker.value = null;
        pickerAnchor.value = null;
        props.editor.pm.view.focus();
        return;
      }
      if (item.picker) {
        executeSlashCommand(props.editor.pm.view, currentMenuState, () => {
          pickerAnchor.value = { ...currentMenuState };
          activePicker.value = item.picker ?? null;
        });
        props.editor.pm.view.focus();
        return;
      }
      executeSlashCommand(props.editor.pm.view, currentMenuState, item.action);
      activePicker.value = null;
      pickerAnchor.value = null;
      props.editor.pm.view.focus();
    };

    watch(
      () => [menuState.value?.active, filteredItems.value.length, selectedIndex.value] as const,
      async () => {
        if (!menuState.value?.active || !menuState.value.coords || !menuRef.value) return;
        await nextTick();
        const menuHeight = menuRef.value.offsetHeight || 300;
        const spaceBelow = window.innerHeight - menuState.value.coords.bottom - 8;
        const spaceAbove = menuState.value.coords.top - 8;
        openUpward.value = spaceBelow < menuHeight && spaceAbove > spaceBelow;
      }
    );

    const keydown = (event: KeyboardEvent) => {
      if (activePicker.value) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          activePicker.value = null;
          pickerAnchor.value = null;
        }
        return;
      }
      if (!menuState.value?.active || !props.editor) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        selectedIndex.value = Math.min(selectedIndex.value + 1, Math.max(filteredItems.value.length - 1, 0));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        const item = filteredItems.value[selectedIndex.value];
        if (item) handleSelect(item);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeSlashMenu(props.editor.pm.view);
      }
    };

    watch(
      () => menuState.value?.active,
      (active) => {
        const currentEditor = props.editor;
        if (!currentEditor || currentEditor.isDestroyed) return;
        const editorElement = currentEditor.pm.view.dom;
        if (active) editorElement.addEventListener('keydown', keydown, true);
        else editorElement.removeEventListener('keydown', keydown, true);
      }
    );

    onBeforeUnmount(() => {
      const currentEditor = props.editor;
      if (currentEditor && !currentEditor.isDestroyed) {
        currentEditor.pm.view.dom.removeEventListener('keydown', keydown, true);
      }
    });

    const style = computed(() => {
      const host = getMenuHost(props.editor);
      const currentState = menuState.value?.active ? menuState.value : pickerAnchor.value;
      if (!currentState?.coords || !host) return undefined;
      const hostRect = host.getBoundingClientRect();
      return {
        position: 'absolute',
        left: `${Math.max(currentState.coords.left - hostRect.left, 4)}px`,
        zIndex: 1000,
        ...(openUpward.value
          ? { top: `${Math.max(currentState.coords.top - hostRect.top - 8, 4)}px` }
        : { top: `${Math.max(currentState.coords.bottom - hostRect.top + 4, 4)}px` }),
      };
    });

    const pickerStyle = computed(() => {
      const host = getMenuHost(props.editor);
      const currentState = menuState.value?.active ? menuState.value : pickerAnchor.value;
      if (!currentState?.coords || !host) return undefined;
      const hostRect = host.getBoundingClientRect();
      const pickerHeight = activePicker.value === 'emoji' ? 456 : 360;
      return {
        position: 'absolute',
        left: `${Math.max(currentState.coords.left - hostRect.left, 4)}px`,
        zIndex: 1001,
        ...(openUpward.value
          ? { top: `${Math.max(currentState.coords.top - hostRect.top - pickerHeight - 12, 4)}px` }
          : { top: `${Math.max(currentState.coords.bottom - hostRect.top + 12, 4)}px` }),
      };
    });

    return () => {
      const host = getMenuHost(props.editor);
      const currentState = menuState.value?.active ? menuState.value : pickerAnchor.value;
      if (!currentState?.coords || !host || !style.value) return null;

      const pickerTitle = activePicker.value === 'emoji' ? 'Choose an emoji' : 'Choose an icon';
      const pickerSubtitle = activePicker.value === 'emoji' ? 'Add a little personality to the selected block.' : 'Insert a simple symbol with one click.';
      const closePicker = () => {
        activePicker.value = null;
        pickerAnchor.value = null;
      };

      return h(Teleport, { to: host }, [
        !activePicker.value
          ? h(
              'div',
              {
                ref: menuRef,
                class: ['ob-slash-menu', props.className].filter(Boolean).join(' '),
                style: style.value,
                role: 'listbox',
              },
              filteredItems.value.length === 0
                ? h('div', { class: 'ob-slash-menu-empty' }, 'No results')
                : filteredItems.value.map((item, index) => {
                  const isSelected = index === selectedIndex.value;
                  const icon = resolveItemIcon(item);
                    if (props.renderItem) {
                      return h(
                        'div',
                        {
                          key: item.id,
                          role: 'option',
                          'aria-selected': isSelected,
                          onClick: () => handleSelect(item),
                        },
                        (() => {
                          const rendered = props.renderItem?.(item, isSelected);
                          return rendered == null ? [] : [rendered];
                        })()
                      );
                    }
                    return h(
                      'div',
                      {
                        key: item.id,
                        class: ['ob-slash-menu-item', isSelected ? 'ob-slash-menu-item--selected' : ''].filter(Boolean).join(' '),
                        role: 'option',
                        'aria-selected': isSelected,
                        onClick: () => handleSelect(item),
                        onMouseenter: () => {
                          selectedIndex.value = index;
                        },
                      },
                      [
                        icon ? h('span', { class: 'ob-slash-menu-item-icon' }, [icon]) : null,
                        h('div', { class: 'ob-slash-menu-item-content' }, [
                          h('span', { class: 'ob-slash-menu-item-title' }, item.title),
                          item.description ? h('span', { class: 'ob-slash-menu-item-description' }, item.description) : null,
                        ]),
                      ]
                    );
                  })
            )
          : null,
        activePicker.value
          ? h(
              'div',
              {
                class: 'ob-slash-picker-backdrop',
                onClick: () => {
                  activePicker.value = null;
                  pickerAnchor.value = null;
                },
              },
              [
                h(
                  'div',
                  {
                    class: 'ob-slash-picker',
                    style: pickerStyle.value ?? undefined,
                    role: 'dialog',
                    'aria-label': activePicker.value === 'emoji' ? 'Emoji picker' : 'Icon picker',
                    onClick: (e: MouseEvent) => e.stopPropagation(),
                  },
                  activePicker.value === 'emoji'
                    ? [
                        h('div', { class: 'ob-slash-picker-header' }, [
                          h('div', { class: 'ob-slash-picker-title' }, pickerTitle),
                          h('div', { class: 'ob-slash-picker-subtitle' }, pickerSubtitle),
                        ]),
                        h('div', { class: 'ob-slash-picker-search-row' }, [
                          h('span', { class: 'ob-slash-picker-search-icon', 'aria-hidden': 'true' }, [SearchIcon]),
                          h('input', {
                            class: 'ob-slash-picker-search',
                            type: 'search',
                            value: emojiQuery.value,
                            placeholder: 'Search emoji',
                            onInput: (event: Event) => {
                              emojiQuery.value = (event.target as HTMLInputElement).value;
                            },
                            onKeydown: (event: KeyboardEvent) => event.stopPropagation(),
                          }),
                        ]),
                        h(
                          'div',
                          { class: 'ob-slash-picker-grid ob-slash-picker-grid--emoji' },
                          emojiResults.value.length
                            ? emojiResults.value.map((emoji) => {
                                const native = emoji.skins?.[0]?.native ?? '';
                                return h(
                                  'button',
                                  {
                                    key: emoji.id,
                                    type: 'button',
                                    class: 'ob-slash-picker-item ob-slash-picker-item--emoji',
                                    title: emoji.name,
                                    'aria-label': emoji.name,
                                    onClick: () => {
                                      if (!props.editor || props.editor.isDestroyed || !native) return;
                                      props.editor.insertEmoji(native);
                                      closePicker();
                                      props.editor.pm.view.focus();
                                    },
                                    onMousedown: (e: MouseEvent) => e.preventDefault(),
                                  },
                                  h('span', { class: 'ob-slash-picker-emoji' }, native)
                                );
                              })
                            : h('div', { class: 'ob-slash-picker-empty' }, 'No emoji found')
                        ),
                        h('div', { class: 'ob-slash-picker-footer' }, [
                          h(
                            'button',
                            {
                              type: 'button',
                              class: 'ob-slash-picker-close',
                              onClick: closePicker,
                              onMousedown: (e: MouseEvent) => e.preventDefault(),
                            },
                            'Close'
                          ),
                        ]),
                      ]
                    : [
                        h('div', { class: 'ob-slash-picker-header' }, [
                          h('div', { class: 'ob-slash-picker-title' }, pickerTitle),
                          h('div', { class: 'ob-slash-picker-subtitle' }, pickerSubtitle),
                        ]),
                        h('div', { class: 'ob-slash-picker-search-row' }, [
                          h('span', { class: 'ob-slash-picker-search-icon', 'aria-hidden': 'true' }, [SearchIcon]),
                          h('input', {
                            class: 'ob-slash-picker-search',
                            type: 'search',
                            value: iconQuery.value,
                            placeholder: 'Search icons',
                            onInput: (event: Event) => {
                              iconQuery.value = (event.target as HTMLInputElement).value;
                            },
                            onKeydown: (event: KeyboardEvent) => event.stopPropagation(),
                          }),
                        ]),
                        h(
                          'div',
                          { class: 'ob-slash-picker-grid ob-slash-picker-grid--icon' },
                          filteredIconOptions.value.length
                            ? filteredIconOptions.value.map((item) =>
                                h(
                                  'button',
                                  {
                                    key: item.id,
                                    type: 'button',
                                    class: 'ob-slash-picker-item ob-slash-picker-item--icon',
                                    title: item.id,
                                    'aria-label': item.id,
                                    onClick: () => {
                                      if (!props.editor || props.editor.isDestroyed) return;
                                      props.editor.insertIcon(item.icon, item.symbol, 36);
                                      closePicker();
                                      props.editor.pm.view.focus();
                                    },
                                    onMousedown: (e: MouseEvent) => e.preventDefault(),
                                  },
                                  [h(Icon, { icon: item.icon, width: 20, height: 20 })]
                                )
                              )
                            : h('div', { class: 'ob-slash-picker-empty' }, 'No icons found')
                        ),
                        h('div', { class: 'ob-slash-picker-footer' }, [
                          h(
                            'button',
                            {
                              type: 'button',
                              class: 'ob-slash-picker-close',
                              onClick: closePicker,
                              onMousedown: (e: MouseEvent) => e.preventDefault(),
                            },
                            'Close'
                          ),
                        ]),
                      ]
                ),
              ]
            )
          : null,
      ]);
    };
  },
});
