/**
 * useCommandRegistry - creates a command registry bound to an editor.
 *
 * @module
 */

import { useEffect, useMemo } from 'react';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';
import {
  CommandRegistry,
  COMMAND_KEYMAP_PLUGIN_KEY,
  createBuiltInCommands,
} from '@amusendame/beakblock-commands';
import type { CommandDefinition, PolicyCheck } from '@amusendame/beakblock-commands';

/** Options for {@link useCommandRegistry}. */
export interface UseCommandRegistryOptions {
  /** Additional commands registered on top of the built-ins. Re-registered when the array changes. */
  extraCommands?: CommandDefinition[];
  /** Register `createBuiltInCommands()`. Default true. */
  includeBuiltins?: boolean;
  /** Policy hook consulted before every execution. */
  policyCheck?: PolicyCheck;
  /** Install the registry's keyboard shortcuts as a plugin on the editor. Default true. */
  installKeymap?: boolean;
}

/**
 * Create a `CommandRegistry` bound to `editor`, with built-in and extra commands registered
 * and keyboard shortcuts installed.
 *
 * Components that read `isActive` / `canExecute` should also subscribe to editor transactions
 * (the shell components do this through `useEditorTick`).
 *
 * Returns null while the editor is unavailable.
 *
 * @example
 * ```tsx
 * const registry = useCommandRegistry(editor, { extraCommands: [myCommand] });
 * ```
 */
export function useCommandRegistry(
  editor: BeakBlockEditor | null | undefined,
  options: UseCommandRegistryOptions = {}
): CommandRegistry | null {
  const includeBuiltins = options.includeBuiltins !== false;
  const installKeymap = options.installKeymap !== false;
  const extraCommands = options.extraCommands;
  const policyCheck = options.policyCheck;

  const registry = useMemo(() => {
    if (!editor || editor.isDestroyed) return null;
    const created = new CommandRegistry();
    if (includeBuiltins) created.register(createBuiltInCommands());
    created.bind(editor);
    return created;
  }, [editor, includeBuiltins]);

  // Extra commands override built-ins with the same id. On cleanup the previous definitions return.
  useEffect(() => {
    if (!registry || !extraCommands || extraCommands.length === 0) return;
    const previous = extraCommands.map((command) => registry.get(command.id));
    registry.register(extraCommands);
    return () => {
      extraCommands.forEach((command, index) => {
        const before = previous[index];
        if (before) registry.register(before);
        else registry.unregister(command.id);
      });
    };
  }, [registry, extraCommands]);

  useEffect(() => {
    if (!registry) return;
    registry.setPolicyCheck(policyCheck ?? null);
    return () => registry.setPolicyCheck(null);
  }, [registry, policyCheck]);

  useEffect(() => {
    if (!registry || !editor || editor.isDestroyed || !installKeymap) return;
    editor.pm.addPlugin(registry.createKeymapPlugin());
    return () => {
      if (!editor.isDestroyed) editor.pm.removePlugin(COMMAND_KEYMAP_PLUGIN_KEY);
    };
  }, [registry, editor, installKeymap]);

  return registry;
}
