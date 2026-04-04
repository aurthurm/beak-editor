import {
  computed,
  defineComponent,
  h,
  type CSSProperties,
  nextTick,
  onBeforeUnmount,
  ref,
  Teleport,
  watch,
  type PropType,
  type VNodeChild,
} from 'vue';
import {
  BUBBLE_MENU_PLUGIN_KEY,
  type BlockTypeInfo,
  type BubbleMenuState,
  type BeakBlockEditor,
} from '@aurthurm/beakblock-core';
import { ColorPicker } from './ColorPicker';
import { LinkPopover } from './LinkPopover';

export interface BubbleMenuItem {
  id: string;
  label: string;
  icon: VNodeChild;
  isActive?: (state: BubbleMenuState, editor: BeakBlockEditor) => boolean;
  action: (editor: BeakBlockEditor, state: BubbleMenuState) => void;
}

export interface BubbleMenuProps {
  editor: BeakBlockEditor | null;
  customItems?: BubbleMenuItem[];
  itemOrder?: string[];
  hideItems?: string[];
  onComment?: () => void;
  onAI?: () => void;
  children?: (props: { editor: BeakBlockEditor; state: BubbleMenuState }) => VNodeChild;
  className?: string;
}

function svg(children: VNodeChild[], attrs: Record<string, unknown> = {}) {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', ...attrs }, children);
}

function getMenuHost(editor: BeakBlockEditor | null): HTMLElement | null {
  if (!editor || editor.isDestroyed) return null;
  return (editor.pm.view.dom.closest('.beakblock-vue-view') as HTMLElement | null) || editor.pm.view.dom.parentElement || null;
}

const Icons: Record<string, VNodeChild> = {
  bold: svg([h('path', { d: 'M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z' }), h('path', { d: 'M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z' })]),
  italic: svg([h('path', { d: 'M19 4h-9M14 20H5M15 4L9 20' })]),
  underline: svg([h('path', { d: 'M6 4v6a6 6 0 0 0 12 0V4' }), h('path', { d: 'M4 20h16' })]),
  strikethrough: svg([h('path', { d: 'M16 4c-1.5 0-3-.5-4.5-.5S8 4 6.5 5.5 5 9 6.5 10.5' }), h('path', { d: 'M8 20c1.5 0 3 .5 4.5.5s3.5-.5 5-2 1.5-4 0-5.5' }), h('path', { d: 'M4 12h16' })]),
  code: svg([h('path', { d: 'm16 18 6-6-6-6' }), h('path', { d: 'm8 6-6 6 6 6' })]),
  link: svg([h('path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }), h('path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' })]),
  alignLeft: svg([h('path', { d: 'M4 6h16M4 12h10M4 18h14' })]),
  alignCenter: svg([h('path', { d: 'M4 6h16M7 12h10M5 18h14' })]),
  alignRight: svg([h('path', { d: 'M4 6h16M10 12h10M6 18h14' })]),
  messageSquare: svg([h('path', { d: 'M21 15a2 2 0 0 1-2 2H8l-5 5V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' })]),
  sparkles: svg([h('path', { d: 'M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z' }), h('path', { d: 'M19 14l.9 2.6L22.5 18l-2.6.9L19 21.5l-.9-2.6-2.6-.9 2.6-.9L19 14z' })]),
};

const BLOCK_TYPE_OPTIONS: Array<{ type: string; label: string; props?: Record<string, unknown>; icon: VNodeChild }> = [
  { type: 'paragraph', label: 'Paragraph', icon: svg([h('path', { d: 'M4 6h16M4 12h16M4 18h10' })]) },
  { type: 'heading', label: 'Heading 1', props: { level: 1 }, icon: svg([h('path', { d: 'M4 12h8M4 6v12M12 6v12' }), h('path', { d: 'M20 8v8M17 8h6', strokeWidth: '1.5' })]) },
  { type: 'heading', label: 'Heading 2', props: { level: 2 }, icon: svg([h('path', { d: 'M4 12h8M4 6v12M12 6v12' }), h('path', { d: 'M16 12a3 3 0 1 1 6 0c0 1.5-3 3-3 3h3M16 18h6', strokeWidth: '1.5' })]) },
  { type: 'heading', label: 'Heading 3', props: { level: 3 }, icon: svg([h('path', { d: 'M4 12h8M4 6v12M12 6v12' }), h('path', { d: 'M16 9a2 2 0 1 1 4 1.5c-.5.5-2 1-2 1s1.5.5 2 1a2 2 0 1 1-4 1.5', strokeWidth: '1.5' })]) },
  { type: 'blockquote', label: 'Quote', icon: svg([h('path', { d: 'M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z' }), h('path', { d: 'M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v4z' })]) },
  { type: 'bulletList', label: 'Bullet List', icon: svg([h('circle', { cx: '4', cy: '7', r: '1.5', fill: 'currentColor', stroke: 'none' }), h('circle', { cx: '4', cy: '12', r: '1.5', fill: 'currentColor', stroke: 'none' }), h('circle', { cx: '4', cy: '17', r: '1.5', fill: 'currentColor', stroke: 'none' }), h('path', { d: 'M9 7h11M9 12h11M9 17h11' })]) },
  { type: 'orderedList', label: 'Numbered List', icon: svg([h('path', { d: 'M10 7h10M10 12h10M10 17h10' }), h('path', { d: 'M4 7h2M4 17h2M5 11v3h2', strokeWidth: '1.5' })]) },
  { type: 'codeBlock', label: 'Code Block', icon: svg([h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' }), h('path', { d: 'm9 9-3 3 3 3M15 9l3 3-3 3' })]) },
];

function getBlockTypeLabel(blockType: BlockTypeInfo): string {
  if (blockType.type === 'heading') {
    return `Heading ${blockType.props.level as number}`;
  }
  return BLOCK_TYPE_OPTIONS.find((opt) => opt.type === blockType.type)?.label || 'Paragraph';
}

function getBlockTypeIcon(blockType: BlockTypeInfo): VNodeChild {
  if (blockType.type === 'heading') {
    return BLOCK_TYPE_OPTIONS.find((opt) => opt.type === 'heading' && opt.props?.level === blockType.props.level)?.icon || BLOCK_TYPE_OPTIONS[0].icon;
  }
  return BLOCK_TYPE_OPTIONS.find((opt) => opt.type === blockType.type)?.icon || BLOCK_TYPE_OPTIONS[0].icon;
}

function blockTypeMatches(blockType: BlockTypeInfo, option: { type: string; props?: Record<string, unknown> }): boolean {
  if (blockType.type !== option.type) return false;
  if (option.props?.level && blockType.props.level !== option.props.level) return false;
  return true;
}

const BlockTypeSelector = defineComponent({
  name: 'BlockTypeSelector',
  props: {
    editor: { type: Object as PropType<BeakBlockEditor>, required: true },
    blockType: { type: Object as PropType<BlockTypeInfo>, required: true },
  },
  setup(props) {
    const isOpen = ref(false);
    const openUpward = ref(false);
    const containerRef = ref<HTMLElement | null>(null);
    const buttonRef = ref<HTMLButtonElement | null>(null);
    const dropdownRef = ref<HTMLElement | null>(null);

    const outside = (event: MouseEvent) => {
      if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
        isOpen.value = false;
      }
    };

    watch(isOpen, (open) => {
      if (open) document.addEventListener('mousedown', outside);
      else document.removeEventListener('mousedown', outside);
    });

    watch(isOpen, async (open) => {
      if (!open) return;
      await nextTick();
      if (!buttonRef.value || !dropdownRef.value) return;
      const buttonRect = buttonRef.value.getBoundingClientRect();
      const dropdownHeight = dropdownRef.value.offsetHeight || 300;
      const spaceBelow = window.innerHeight - buttonRect.bottom - 8;
      const spaceAbove = buttonRect.top - 8;
      openUpward.value = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    });

    onBeforeUnmount(() => document.removeEventListener('mousedown', outside));

    const select = (option: { type: string; props?: Record<string, unknown> }) => {
      props.editor.setBlockType(option.type, option.props || {});
      props.editor.pm.view.focus();
      isOpen.value = false;
    };

    return () =>
      h('div', { class: 'ob-block-type-selector', ref: containerRef }, [
        h(
          'button',
          {
            ref: buttonRef,
            type: 'button',
            class: 'ob-block-type-selector-btn',
            onClick: () => (isOpen.value = !isOpen.value),
            onMousedown: (e: MouseEvent) => e.preventDefault(),
            'aria-expanded': isOpen.value,
            'aria-haspopup': 'listbox',
          },
          [
            h('span', { class: 'ob-block-type-selector-icon' }, [getBlockTypeIcon(props.blockType)]),
            h('span', { class: 'ob-block-type-selector-label' }, getBlockTypeLabel(props.blockType)),
            h('svg', { class: ['ob-block-type-selector-chevron', isOpen.value ? 'ob-block-type-selector-chevron--open' : ''].filter(Boolean).join(' '), viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [
              h('path', { d: 'm6 9 6 6 6-6' }),
            ]),
          ]
        ),
        isOpen.value
          ? h(
              'div',
              {
                ref: dropdownRef,
                class: ['ob-block-type-dropdown', openUpward.value ? 'ob-block-type-dropdown--upward' : '']
                  .filter(Boolean)
                  .join(' '),
                role: 'listbox',
              },
              BLOCK_TYPE_OPTIONS.map((option, index) =>
                h(
                  'button',
                  {
                    key: `${option.type}-${option.props?.level || index}`,
                    type: 'button',
                    class: ['ob-block-type-option', blockTypeMatches(props.blockType, option) ? 'ob-block-type-option--active' : '']
                      .filter(Boolean)
                      .join(' '),
                    onClick: () => select(option),
                    onMousedown: (e: MouseEvent) => e.preventDefault(),
                    role: 'option',
                    'aria-selected': blockTypeMatches(props.blockType, option),
                  },
                  [
                    h('span', { class: 'ob-block-type-option-icon' }, [option.icon]),
                    h('span', { class: 'ob-block-type-option-label' }, option.label),
                    blockTypeMatches(props.blockType, option)
                      ? h('svg', { class: 'ob-block-type-option-check', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [h('path', { d: 'M20 6 9 17l-5-5' })])
                      : null,
                  ]
                )
              )
            )
          : null,
      ]);
  },
});

export const BUBBLE_MENU_ITEMS: Record<string, BubbleMenuItem> = {
  bold: { id: 'bold', label: 'Bold (Cmd+B)', icon: Icons.bold, isActive: (state) => state.activeMarks.bold, action: (editor) => { editor.toggleBold(); editor.pm.view.focus(); } },
  italic: { id: 'italic', label: 'Italic (Cmd+I)', icon: Icons.italic, isActive: (state) => state.activeMarks.italic, action: (editor) => { editor.toggleItalic(); editor.pm.view.focus(); } },
  underline: { id: 'underline', label: 'Underline (Cmd+U)', icon: Icons.underline, isActive: (state) => state.activeMarks.underline, action: (editor) => { editor.toggleUnderline(); editor.pm.view.focus(); } },
  strikethrough: { id: 'strikethrough', label: 'Strikethrough', icon: Icons.strikethrough, isActive: (state) => state.activeMarks.strikethrough, action: (editor) => { editor.toggleStrikethrough(); editor.pm.view.focus(); } },
  code: { id: 'code', label: 'Inline code', icon: Icons.code, isActive: (state) => state.activeMarks.code, action: (editor) => { editor.toggleCode(); editor.pm.view.focus(); } },
  alignLeft: { id: 'alignLeft', label: 'Align left', icon: Icons.alignLeft, isActive: (state) => state.textAlign === 'left', action: (editor) => { editor.setTextAlign('left'); editor.pm.view.focus(); } },
  alignCenter: { id: 'alignCenter', label: 'Align center', icon: Icons.alignCenter, isActive: (state) => state.textAlign === 'center', action: (editor) => { editor.setTextAlign('center'); editor.pm.view.focus(); } },
  alignRight: { id: 'alignRight', label: 'Align right', icon: Icons.alignRight, isActive: (state) => state.textAlign === 'right', action: (editor) => { editor.setTextAlign('right'); editor.pm.view.focus(); } },
};

export const DEFAULT_BUBBLE_MENU_ORDER: string[] = ['blockType', '---', 'alignLeft', 'alignCenter', 'alignRight', '---', 'bold', 'italic', 'underline', 'strikethrough', '---', 'code', 'link', '---', 'color', '---', 'comment', 'ai'];

export const BubbleMenu = defineComponent({
  name: 'BubbleMenu',
  emits: ['comment', 'ai'],
  props: {
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    customItems: { type: Array as PropType<BubbleMenuItem[]>, default: () => [] },
    itemOrder: { type: Array as PropType<string[]>, default: undefined },
    hideItems: { type: Array as PropType<string[]>, default: () => [] },
    onComment: { type: Function as PropType<() => void>, default: undefined },
    onAI: { type: Function as PropType<() => void>, default: undefined },
    children: { type: Function as PropType<(props: { editor: BeakBlockEditor; state: BubbleMenuState }) => VNodeChild>, default: undefined },
    className: { type: String, default: '' },
  },
  setup(props, { emit }) {
    const menuState = ref<BubbleMenuState | null>(null);
    const showLinkPopover = ref(false);
    const linkButtonRef = ref<HTMLButtonElement | null>(null);
    const menuRef = ref<HTMLElement | null>(null);

    const updateState = () => {
      if (!props.editor || props.editor.isDestroyed) return;
      menuState.value = BUBBLE_MENU_PLUGIN_KEY.getState(props.editor.pm.state) ?? null;
    };

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

    watch(
      () => menuState.value?.visible,
      (visible) => {
        if (!visible) showLinkPopover.value = false;
      }
    );

    const allItems = computed(() => {
      if (!props.editor) return [];
      const defaults = Object.values(BUBBLE_MENU_ITEMS);
      const merged = props.customItems?.length ? [...defaults, ...props.customItems] : defaults;
      const map = new Map<string, BubbleMenuItem>();
      merged.forEach((item) => map.set(item.id, item));
      if (props.itemOrder?.length) {
        return props.itemOrder.map((id) => map.get(id)).filter(Boolean) as BubbleMenuItem[];
      }
      if (props.hideItems?.length) {
        const hidden = new Set(props.hideItems);
        return merged.filter((item) => !hidden.has(item.id));
      }
      return merged;
    });

    const handleLinkClick = () => {
      showLinkPopover.value = true;
    };

    const closeLinkPopover = () => {
      showLinkPopover.value = false;
    };

    const style = computed<CSSProperties | undefined>(() => {
      const host = getMenuHost(props.editor);
      if (!menuState.value?.visible || !menuState.value.coords || !host) return undefined;
      const hostRect = host.getBoundingClientRect();
      const currentMenuHeight = menuRef.value?.offsetHeight || 44;
      return {
        position: 'absolute',
        left: `${Math.max(menuState.value.coords.left - hostRect.left, 4)}px`,
        top: `${Math.max(menuState.value.coords.top - hostRect.top - currentMenuHeight - 8, 4)}px`,
        zIndex: 1000,
      };
    });

    const renderItems = (): VNodeChild[] => {
      const state = menuState.value;
      const editor = props.editor;
      if (!state?.visible || !state.coords || !editor) return [];
      const currentEditor = editor as BeakBlockEditor;

      if (props.children) {
        return [props.children({ editor: currentEditor, state })];
      }

      const hidden = new Set(props.hideItems);
      const order = props.itemOrder || [...DEFAULT_BUBBLE_MENU_ORDER, ...(props.customItems.length > 0 ? ['---', ...props.customItems.map((i) => i.id)] : [])];

      const renderedItems: VNodeChild[] = [];
      for (const [index, itemId] of order.entries()) {
        const child = (() => {
          const activeState = menuState.value;
          if (itemId === '---') return h('span', { key: `divider-${index}`, class: 'ob-bubble-menu-divider' });
          if (hidden.has(itemId)) return null;
          if (itemId === 'blockType') return h(BlockTypeSelector, { key: 'blockType', editor: currentEditor, blockType: state.blockType });
          if (itemId === 'link') {
            return h(
              'div',
              {
                key: 'link-anchor',
                class: 'ob-link-popover-anchor',
              },
              [
                h(
                  'button',
                  {
                    key: 'link',
                    ref: linkButtonRef,
                    type: 'button',
                    class: ['ob-bubble-menu-btn', state.activeMarks.link ? 'ob-bubble-menu-btn--active' : '']
                      .filter(Boolean)
                      .join(' '),
                    title: state.activeMarks.link ? 'Edit link' : 'Add link',
                    onClick: handleLinkClick,
                    onMousedown: (e: MouseEvent) => e.preventDefault(),
                  },
                  [Icons.link]
                ),
                showLinkPopover.value && linkButtonRef.value && activeState
                  ? h(LinkPopover, {
                      editor: props.editor as BeakBlockEditor,
                      currentUrl: activeState.activeMarks.link,
                      onClose: closeLinkPopover,
                      triggerRef: linkButtonRef,
                      anchorToTrigger: true,
                    })
                  : null,
              ]
            );
          }
          if (itemId === 'color') {
            return h(ColorPicker, {
              key: 'color',
              editor: currentEditor,
              currentTextColor: state.activeMarks.textColor,
              currentBackgroundColor: state.activeMarks.backgroundColor,
            });
          }
          if (itemId === 'comment') {
            return h(
              'button',
              {
                key: 'comment',
                type: 'button',
                class: 'ob-bubble-menu-btn',
                title: 'Add comment',
                onClick: () => {
                  props.onComment?.();
                  emit('comment');
                },
                onMousedown: (e: MouseEvent) => e.preventDefault(),
              },
              [Icons.messageSquare]
            );
          }
          if (itemId === 'ai') {
            return h(
              'button',
              {
                key: 'ai',
                type: 'button',
                class: 'ob-bubble-menu-btn',
                title: 'Open AI assistant',
                onClick: () => {
                  props.onAI?.();
                  emit('ai');
                },
                onMousedown: (e: MouseEvent) => e.preventDefault(),
              },
              [Icons.sparkles]
            );
          }
          const item = allItems.value.find((entry) => entry.id === itemId);
          if (!item) return null;
          const isActive = item.isActive ? item.isActive(state, currentEditor) : false;
          return h(
            'button',
            {
              key: item.id,
              type: 'button',
              class: ['ob-bubble-menu-btn', isActive ? 'ob-bubble-menu-btn--active' : ''].filter(Boolean).join(' '),
              title: item.label,
              onClick: () => item.action(currentEditor, state),
              onMousedown: (e: MouseEvent) => e.preventDefault(),
            },
            [item.icon]
          );
        })();
        if (child != null) renderedItems.push(child);
      }
      return renderedItems;
    };

    return () => {
      const host = getMenuHost(props.editor);
      if (!props.editor || props.editor.isDestroyed || !menuState.value?.visible || !menuState.value.coords || !host || !style.value) return null;

      return h(Teleport, { to: host }, [
        h(
          'div',
          {
            ref: menuRef,
            class: ['ob-bubble-menu', props.className].filter(Boolean).join(' '),
            style: style.value,
            role: 'toolbar',
            'aria-label': 'Text formatting',
          },
          [
            ...renderItems(),
          ]
        ),
      ]);
    };
  },
});
