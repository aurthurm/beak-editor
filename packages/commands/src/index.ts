/**
 * @amusendame/beakblock-commands
 *
 * Unified command registry driving ribbon, shortcuts, menus, AI and API.
 *
 * @example
 * ```typescript
 * import { BeakBlockEditor } from '@amusendame/beakblock-core';
 * import { CommandRegistry, createBuiltInCommands, createDefaultRibbon } from '@amusendame/beakblock-commands';
 *
 * const editor = new BeakBlockEditor({ element });
 * const registry = new CommandRegistry();
 * registry.register(createBuiltInCommands());
 * registry.bind(editor);
 * editor.pm.addPlugin(registry.createKeymapPlugin());
 * registry.execute('format.bold');
 * ```
 *
 * @module
 */

export { CommandRegistry, COMMAND_KEYMAP_PLUGIN_KEY } from './registry';
export type { CommandDenial } from './registry';

export { createBuiltInCommands, newBlockId } from './builtins';

export { BUILTIN_ICON_PATHS, hasBuiltinIcon } from './icons';

export { createDefaultRibbon, getContextualTabs } from './ribbon';

export { normalizeBinding, formatShortcutHint, eventCandidates, isMacPlatform } from './keymap';

export type {
  CommandContext,
  CommandDefinition,
  CommandDeniedEvent,
  CommandDeniedListener,
  CommandExecuteEvent,
  CommandExecuteListener,
  CommandSearchResult,
  PolicyCheck,
  PolicyResult,
  RibbonContext,
  RibbonDefinition,
  RibbonGroup,
  RibbonItem,
  RibbonItemKind,
  RibbonTab,
} from './types';
