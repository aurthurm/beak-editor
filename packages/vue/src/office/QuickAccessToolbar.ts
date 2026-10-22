import { computed, defineComponent, h, type PropType } from 'vue';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';
import type { CommandRegistry } from '@amusendame/beakblock-commands';
import { renderCommandButton } from './controls';
import { useEditorTick } from './editorState';

/** Default quick access commands, in display order. */
export const DEFAULT_QUICK_ACCESS_COMMANDS: readonly string[] = [
  'history.undo',
  'history.redo',
  'format.bold',
  'format.italic',
  'format.underline',
];

/**
 * Quick access toolbar: a row of icon buttons for frequently used commands. Ids that are not
 * registered are skipped.
 */
export const QuickAccessToolbar = defineComponent({
  name: 'BeakBlockOfficeQuickAccessToolbar',
  props: {
    registry: { type: Object as PropType<CommandRegistry | null>, default: null },
    /** Command ids to show. */
    commands: { type: Array as PropType<string[]>, default: () => [...DEFAULT_QUICK_ACCESS_COMMANDS] },
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    label: { type: String, default: 'Quick Access Toolbar' },
  },
  emits: {
    command: (id: string) => typeof id === 'string',
  },
  setup(props, { emit }) {
    const tick = useEditorTick(() => props.editor);

    const defs = computed(() => {
      void tick.value;
      const registry = props.registry;
      if (!registry) return [];
      return props.commands.map((id) => registry.get(id)).filter((def) => def !== undefined);
    });

    return () => {
      const registry = props.registry;
      return h(
        'div',
        { class: 'bb-office-qat', role: 'toolbar', 'aria-label': props.label, 'data-beakblock-qat': '' },
        registry
          ? defs.value.map((def) =>
              renderCommandButton(registry, def, {
                size: 'small',
                kind: def.isActive ? 'toggle' : undefined,
                onExecuted: (id) => emit('command', id),
              })
            )
          : []
      );
    };
  },
});
