import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';
import type { CommandRegistry, CommandSearchResult } from '@amusendame/beakblock-commands';
import { useEditorTick } from './editorState';

/**
 * Returns true when a keyboard event opens command search: Alt+Q, or Mod+Shift+P
 * (Ctrl on Windows and Linux, Cmd on Apple platforms).
 */
export function isCommandSearchShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  if (event.altKey && !event.ctrlKey && !event.metaKey && key === 'q') return true;
  return (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && key === 'p';
}

/**
 * Command palette. Searches every registered command (label, id, description, group) with the
 * registry's ranked `search()`. Enter runs the highlighted command when it can execute.
 */
export const CommandSearch = defineComponent({
  name: 'BeakBlockOfficeCommandSearch',
  props: {
    registry: { type: Object as PropType<CommandRegistry | null>, default: null },
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    /** Controlled open state. Omit to let the component manage its own state. */
    open: { type: Boolean, default: undefined },
    placeholder: { type: String, default: 'Tell me what you want to do' },
    limit: { type: Number, default: 12 },
  },
  emits: {
    'update:open': (open: boolean) => typeof open === 'boolean',
    execute: (id: string, ok: boolean) => typeof id === 'string' && typeof ok === 'boolean',
  },
  setup(props, { emit, expose }) {
    const tick = useEditorTick(() => props.editor);
    const internalOpen = ref(false);
    const query = ref('');
    const activeIndex = ref(0);
    const inputRef = ref<HTMLInputElement | null>(null);

    const isOpen = computed(() => (props.open !== undefined ? props.open : internalOpen.value));

    const results = computed<CommandSearchResult[]>(() => {
      void tick.value;
      if (!props.registry || !isOpen.value) return [];
      return props.registry.search(query.value).slice(0, props.limit);
    });

    function setOpen(next: boolean): void {
      internalOpen.value = next;
      emit('update:open', next);
      if (next) {
        query.value = '';
        activeIndex.value = 0;
        void nextTick(() => inputRef.value?.focus());
      }
    }

    function run(index: number): void {
      const hit = results.value[index];
      if (!hit || !props.registry) return;
      const ok = props.registry.canExecute(hit.command.id) && props.registry.execute(hit.command.id);
      emit('execute', hit.command.id, ok);
      setOpen(false);
    }

    function onWindowKeydown(event: KeyboardEvent): void {
      if (isCommandSearchShortcut(event)) {
        event.preventDefault();
        setOpen(!isOpen.value);
      }
    }

    onMounted(() => window.addEventListener('keydown', onWindowKeydown));
    onBeforeUnmount(() => window.removeEventListener('keydown', onWindowKeydown));

    watch(
      () => props.open,
      (value) => {
        if (value === true) void nextTick(() => inputRef.value?.focus());
      }
    );

    function onKeydown(event: KeyboardEvent): void {
      const count = results.value.length;
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          activeIndex.value = count ? (activeIndex.value + 1) % count : 0;
          break;
        case 'ArrowUp':
          event.preventDefault();
          activeIndex.value = count ? (activeIndex.value - 1 + count) % count : 0;
          break;
        case 'Enter':
          event.preventDefault();
          run(activeIndex.value);
          break;
        case 'Escape':
          event.preventDefault();
          setOpen(false);
          break;
        default:
          break;
      }
    }

    expose({
      open: () => setOpen(true),
      close: () => setOpen(false),
      get query() {
        return query.value;
      },
    });

    return () => {
      if (!isOpen.value) return null;
      const hits = results.value;
      const listId = 'bb-office-command-search-results';
      const activeId = hits[activeIndex.value] ? `bb-office-command-${hits[activeIndex.value]!.command.id}` : undefined;
      return h(
        'div',
        { class: 'bb-office-search', role: 'dialog', 'aria-label': 'Command search', 'data-beakblock-command-search': '' },
        [
          h('input', {
            ref: inputRef,
            class: 'bb-office-search-input',
            type: 'text',
            role: 'combobox',
            'aria-expanded': 'true',
            'aria-controls': listId,
            'aria-autocomplete': 'list',
            'aria-activedescendant': activeId,
            'aria-label': 'Search commands',
            placeholder: props.placeholder,
            value: query.value,
            onInput: (event: Event) => {
              query.value = (event.target as HTMLInputElement).value;
              activeIndex.value = 0;
            },
            onKeydown,
          }),
          h(
            'ul',
            { class: 'bb-office-search-results', role: 'listbox', id: listId, 'aria-label': 'Commands' },
            hits.length === 0
              ? [h('li', { class: 'bb-office-search-result', role: 'presentation' }, 'No matching commands')]
              : hits.map((hit, index) =>
                  h(
                    'li',
                    {
                      id: `bb-office-command-${hit.command.id}`,
                      class: 'bb-office-search-result',
                      role: 'option',
                      'aria-selected': String(index === activeIndex.value),
                      'aria-disabled': props.registry?.canExecute(hit.command.id) ? undefined : 'true',
                      'data-command': hit.command.id,
                      onMousedown: (event: MouseEvent) => event.preventDefault(),
                      onMouseenter: () => {
                        activeIndex.value = index;
                      },
                      onClick: () => run(index),
                    },
                    [
                      h('span', [
                        h('span', { class: 'bb-office-search-result-label' }, hit.command.label),
                        h('span', { class: 'bb-office-search-result-group' }, ` ${hit.command.group ?? ''}`),
                      ]),
                      hit.shortcutHint ? h('span', { class: 'bb-office-shortcut' }, hit.shortcutHint) : null,
                    ]
                  )
                )
          ),
        ]
      );
    };
  },
});
