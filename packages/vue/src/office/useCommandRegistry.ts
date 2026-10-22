import { ref, shallowRef, unref, watch, type MaybeRef, type Ref, type ShallowRef } from 'vue';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';
import {
  CommandRegistry,
  createBuiltInCommands,
  type CommandDefinition,
  type PolicyCheck,
} from '@amusendame/beakblock-commands';

/** Options for {@link useCommandRegistry}. */
export interface UseCommandRegistryOptions {
  /** Register `createBuiltInCommands()`. Default true. */
  builtins?: boolean;
  /** Additional commands (AI, QMS, review, app specific). Registered after the built-ins. */
  extraCommands?: CommandDefinition[];
  /** Optional policy check installed before every execution. */
  policy?: PolicyCheck | null;
}

/** Return value of {@link useCommandRegistry}. */
export interface CommandRegistryHandle {
  /** The registry bound to the current editor, or null before the editor exists. */
  registry: ShallowRef<CommandRegistry | null>;
  /** Incremented on every editor transaction so templates can re-read active and enabled states. */
  version: Ref<number>;
}

/**
 * Create a {@link CommandRegistry} bound to an editor. The registry gets the built-in commands
 * and `extraCommands`, and its keymap plugin is installed with `editor.pm.addPlugin`.
 *
 * @example
 * ```typescript
 * const editor = useBeakBlock({ mode: 'office' });
 * const { registry, version } = useCommandRegistry(editor, { extraCommands: aiCommands });
 * ```
 */
export function useCommandRegistry(
  editorRef: MaybeRef<BeakBlockEditor | null>,
  options: UseCommandRegistryOptions = {}
): CommandRegistryHandle {
  const registry = shallowRef<CommandRegistry | null>(null);
  const version = ref(0);

  watch(
    () => unref(editorRef),
    (editor, _previous, onCleanup) => {
      if (!editor || editor.isDestroyed) {
        registry.value = null;
        return;
      }

      const next = new CommandRegistry();
      if (options.builtins !== false) next.register(createBuiltInCommands());
      if (options.extraCommands?.length) next.register(options.extraCommands);
      if (options.policy !== undefined) next.setPolicyCheck(options.policy);
      next.bind(editor);
      editor.pm.addPlugin(next.createKeymapPlugin());
      registry.value = next;

      const unsubscribe = editor.on('transaction', () => {
        version.value++;
      });
      onCleanup(() => {
        unsubscribe();
      });
    },
    { immediate: true }
  );

  return { registry, version };
}
