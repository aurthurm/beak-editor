import { computed, defineComponent, h, type PropType } from 'vue';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';
import type { CommandRegistry } from '@amusendame/beakblock-commands';
import { useEditorTick } from './editorState';

/** Paragraph style command ids shown by default, in display order. */
export const DEFAULT_STYLE_COMMAND_IDS: readonly string[] = [
  'paragraph.style.normal',
  'paragraph.style.title',
  'paragraph.style.heading1',
  'paragraph.style.heading2',
  'paragraph.style.heading3',
  'paragraph.style.quote',
];

/** Shared props for the styles gallery and styles pane. */
const styleProps = {
  registry: { type: Object as PropType<CommandRegistry | null>, default: null },
  editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
  /** Paragraph style command ids to show. */
  styles: { type: Array as PropType<string[]>, default: () => [...DEFAULT_STYLE_COMMAND_IDS] },
};

/**
 * Styles gallery: a row of paragraph style buttons. The current style is highlighted and the
 * buttons run `paragraph.style.*` commands.
 */
export const StylesGallery = defineComponent({
  name: 'BeakBlockOfficeStylesGallery',
  props: styleProps,
  emits: {
    apply: (id: string) => typeof id === 'string',
  },
  setup(props, { emit }) {
    const tick = useEditorTick(() => props.editor);
    const defs = computed(() => {
      void tick.value;
      return props.styles.map((id) => props.registry?.get(id)).filter((def) => def !== undefined);
    });

    return () => {
      const registry = props.registry;
      void tick.value;
      return h(
        'div',
        { class: 'bb-office-styles', role: 'group', 'aria-label': 'Styles gallery' },
        registry
          ? defs.value.map((def) => {
              const pressed = registry.isActive(def.id);
              return h(
                'button',
                {
                  type: 'button',
                  class: 'bb-office-style',
                  'data-command': def.id,
                  'aria-pressed': String(pressed),
                  disabled: !registry.canExecute(def.id),
                  title: def.description ?? def.label,
                  onMousedown: (event: MouseEvent) => event.preventDefault(),
                  onClick: () => {
                    if (registry.execute(def.id)) emit('apply', def.id);
                  },
                },
                def.label
              );
            })
          : []
      );
    };
  },
});

/**
 * Styles pane: a vertical list of paragraph styles with a short description, for side panels.
 */
export const StylesPane = defineComponent({
  name: 'BeakBlockOfficeStylesPane',
  props: styleProps,
  emits: {
    apply: (id: string) => typeof id === 'string',
  },
  setup(props, { emit }) {
    const tick = useEditorTick(() => props.editor);
    return () => {
      void tick.value;
      const registry = props.registry;
      const defs = registry
        ? props.styles.map((id) => registry.get(id)).filter((def) => def !== undefined)
        : [];
      return h(
        'div',
        { class: 'bb-office-styles bb-office-styles--pane', role: 'group', 'aria-label': 'Styles' },
        defs.map((def) => {
          const pressed = registry ? registry.isActive(def.id) : false;
          return h(
            'button',
            {
              type: 'button',
              class: 'bb-office-style',
              'data-command': def.id,
              'aria-pressed': String(pressed),
              disabled: !registry?.canExecute(def.id),
              onMousedown: (event: MouseEvent) => event.preventDefault(),
              onClick: () => {
                if (registry?.execute(def.id)) emit('apply', def.id);
              },
            },
            [
              h('span', { class: 'bb-office-style-label' }, def.label),
              def.description ? h('span', { class: 'bb-office-nav-meta' }, def.description) : null,
            ]
          );
        })
      );
    };
  },
});
