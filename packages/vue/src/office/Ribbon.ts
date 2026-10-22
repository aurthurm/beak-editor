import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, type PropType } from 'vue';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';
import {
  createDefaultRibbon,
  getContextualTabs,
  type CommandDefinition,
  type CommandRegistry,
  type RibbonDefinition,
  type RibbonGroup,
  type RibbonTab,
} from '@amusendame/beakblock-commands';
import { renderCommandButton } from './controls';
import { useEditorTick } from './editorState';

/**
 * Office-style ribbon. Tabs, groups and items come from a declarative {@link RibbonDefinition};
 * every item is a command id resolved against the registry. Unknown ids are skipped.
 * Contextual tabs (table, picture, chart, controlledSection) appear while the selection matches.
 *
 * Keyboard: Left and Right move between tabs, Home and End jump to the first and last tab,
 * and F10 or a lone Alt press moves focus into the ribbon.
 *
 * @example
 * ```typescript
 * h(Ribbon, { registry: registry.value, editor: editor.value })
 * ```
 */
export const Ribbon = defineComponent({
  name: 'BeakBlockOfficeRibbon',
  props: {
    registry: { type: Object as PropType<CommandRegistry | null>, default: null },
    ribbon: { type: Object as PropType<RibbonDefinition>, default: undefined },
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    /** Selected tab id. When omitted the ribbon keeps its own selection. */
    activeTab: { type: String, default: undefined },
    /** Accessible name for the ribbon region. */
    label: { type: String, default: 'Ribbon' },
  },
  emits: {
    'update:activeTab': (id: string) => typeof id === 'string',
    command: (id: string) => typeof id === 'string',
  },
  setup(props, { emit, expose }) {
    const tick = useEditorTick(() => props.editor);
    const internalTab = ref('home');
    const tabElements = new Map<string, HTMLElement>();
    const rootRef = ref<HTMLElement | null>(null);
    let altPending = false;

    const definition = computed<RibbonDefinition>(() => props.ribbon ?? createDefaultRibbon());

    const visibleTabs = computed<RibbonTab[]>(() => {
      void tick.value;
      const contextual = props.editor && !props.editor.isDestroyed ? getContextualTabs(props.editor) : [];
      return definition.value.tabs.filter((tab) => !tab.contextual || contextual.includes(tab.contextual));
    });

    const selectedId = computed(() => props.activeTab ?? internalTab.value);
    const currentTab = computed<RibbonTab | undefined>(() => {
      const tabs = visibleTabs.value;
      return tabs.find((tab) => tab.id === selectedId.value) ?? tabs[0];
    });

    function selectTab(id: string, focus = false): void {
      internalTab.value = id;
      emit('update:activeTab', id);
      if (focus) void nextTick(() => tabElements.get(id)?.focus());
    }

    function resolveGroup(group: RibbonGroup): { group: RibbonGroup; defs: Array<{ def: CommandDefinition; item: RibbonGroup['items'][number] }> } {
      const defs: Array<{ def: CommandDefinition; item: RibbonGroup['items'][number] }> = [];
      for (const item of group.items) {
        const def = props.registry?.get(item.command);
        if (def) defs.push({ def, item });
      }
      return { group, defs };
    }

    function focusRibbon(): void {
      const id = currentTab.value?.id;
      const byId = id ? tabElements.get(id) : undefined;
      const target = byId ?? rootRef.value?.querySelector<HTMLElement>('[role="tab"]');
      target?.focus();
    }

    function onTabKeydown(event: KeyboardEvent): void {
      const tabs = visibleTabs.value;
      const index = tabs.findIndex((tab) => tab.id === selectedId.value);
      let next = -1;
      switch (event.key) {
        case 'ArrowRight':
          next = (index + 1) % tabs.length;
          break;
        case 'ArrowLeft':
          next = (index - 1 + tabs.length) % tabs.length;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = tabs.length - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      const target = tabs[next];
      if (target) selectTab(target.id, true);
    }

    function onWindowKeydown(event: KeyboardEvent): void {
      if (event.key === 'F10') {
        event.preventDefault();
        altPending = false;
        focusRibbon();
        return;
      }
      altPending = event.key === 'Alt' && !event.repeat;
    }

    function onWindowKeyup(event: KeyboardEvent): void {
      if (event.key === 'Alt' && altPending) {
        altPending = false;
        focusRibbon();
      }
    }

    onMounted(() => {
      window.addEventListener('keydown', onWindowKeydown);
      window.addEventListener('keyup', onWindowKeyup);
    });
    onBeforeUnmount(() => {
      window.removeEventListener('keydown', onWindowKeydown);
      window.removeEventListener('keyup', onWindowKeyup);
    });

    expose({ focusRibbon, selectTab });

    return () => {
      void tick.value;
      const tabs = visibleTabs.value;
      const tab = currentTab.value;
      const registry = props.registry;

      const tabButtons = tabs.map((t) => {
        const selected = t.id === tab?.id;
        const contextual = Boolean(t.contextual);
        return h(
          'button',
          {
            type: 'button',
            role: 'tab',
            id: `bb-office-tab-${t.id}`,
            class: ['bb-office-ribbon-tab', contextual ? 'bb-office-ribbon-tab--contextual' : ''].filter(Boolean).join(' '),
            'aria-selected': String(selected),
            'aria-controls': `bb-office-panel-${t.id}`,
            tabindex: selected ? 0 : -1,
            'data-tab': t.id,
            'data-contextual': t.contextual,
            ref: (el: unknown) => {
              if (el instanceof HTMLElement) tabElements.set(t.id, el);
              else tabElements.delete(t.id);
            },
            onClick: () => selectTab(t.id),
            onKeydown: onTabKeydown,
          },
          t.label
        );
      });

      const groups = tab
        ? tab.groups
            .map((group) => resolveGroup(group))
            .filter(({ defs }) => defs.length > 0)
            .map(({ group, defs }) =>
              h(
                'div',
                { class: 'bb-office-ribbon-group', role: 'group', 'aria-label': group.label, 'data-group': group.id },
                [
                  h(
                    'div',
                    { class: 'bb-office-ribbon-items' },
                    defs.map(({ def, item }) =>
                      registry
                        ? renderCommandButton(registry, def, { size: item.size ?? 'small', kind: item.kind })
                        : null
                    )
                  ),
                  h('div', { class: 'bb-office-ribbon-group-label', 'aria-hidden': 'true' }, group.label),
                ]
              )
            )
        : [];

      return h(
        'div',
        {
          class: 'bb-office-ribbon',
          ref: rootRef,
          role: 'region',
          'aria-label': props.label,
          'data-beakblock-ribbon': '',
        },
        [
          h('div', { class: 'bb-office-ribbon-tabs', role: 'tablist', 'aria-label': 'Ribbon tabs' }, tabButtons),
          tab
            ? h(
                'div',
                {
                  class: 'bb-office-ribbon-panel',
                  role: 'tabpanel',
                  id: `bb-office-panel-${tab.id}`,
                  'aria-labelledby': `bb-office-tab-${tab.id}`,
                  tabindex: 0,
                },
                groups
              )
            : null,
        ]
      );
    };
  },
});
