/**
 * Public types for the BeakBlock command registry.
 *
 * @module
 */

import type { BeakBlockEditor } from '@amusendame/beakblock-core';

/** Context passed to every command callback. */
export interface CommandContext {
  /** The editor the command operates on (the registry must be bound to it). */
  editor: BeakBlockEditor;
  /** Optional arguments supplied by the caller (ribbon gallery value, API call, etc.). */
  args?: unknown;
}

/**
 * A single registered command.
 *
 * Commands are the single source of truth for the ribbon, keyboard shortcuts,
 * context menus, AI tooling and the programmatic API.
 */
export interface CommandDefinition {
  /** Dotted, stable identifier, e.g. `format.bold` or `table.insertRowBelow`. */
  id: string;
  /** Human readable label. */
  label: string;
  /** Longer description, used by search. */
  description?: string;
  /** Lucide-style icon name, e.g. `bold`, `heading-1`. */
  icon?: string;
  /** Grouping key, e.g. `Font`, `Paragraph`, `Insert`. */
  group?: string;
  /** ProseMirror keymap syntax, e.g. `Mod-b`, or several bindings. */
  shortcut?: string | string[];
  /** OperationKind from `@amusendame/beakblock-permissions` this command performs. */
  operation?: string;
  /** Returns false to disable the command in the current state. */
  isEnabled?(ctx: CommandContext): boolean;
  /** Returns true when the command's effect is active at the selection (toggle state). */
  isActive?(ctx: CommandContext): boolean;
  /** Performs the command. Returns true when the document or state changed/was handled. */
  run(ctx: CommandContext): boolean;
  /** When true, the command is recorded for `repeatLast()` (F4) after a successful run. */
  repeatable?: boolean;
}

/**
 * Policy check result.
 *
 * `true` allows the command. `false` denies it. A string denies it and supplies the reason.
 */
export type PolicyResult = boolean | string;

/** Policy hook consulted before every `execute()`. */
export type PolicyCheck = (cmd: CommandDefinition, ctx: CommandContext) => PolicyResult;

/** Event emitted after a command has been executed (or attempted to run). */
export interface CommandExecuteEvent {
  id: string;
  args?: unknown;
  /** The boolean returned by `run()`. */
  result: boolean;
}

/** Listener for `onExecute`. */
export type CommandExecuteListener = (event: CommandExecuteEvent) => void;

/** Event emitted when the policy check denies a command. */
export interface CommandDeniedEvent {
  id: string;
  args?: unknown;
  reason?: string;
}

/** Listener for `onDenied`. */
export type CommandDeniedListener = (event: CommandDeniedEvent) => void;

/** A ranked search hit. */
export interface CommandSearchResult {
  command: CommandDefinition;
  /** Higher is better. */
  score: number;
  /** Human readable shortcut, e.g. `Ctrl+B`. Undefined when the command has no shortcut. */
  shortcutHint?: string;
}

/** Ribbon tab kinds. Contextual tabs only show when `getContextualTabs()` reports them. */
export type RibbonContext = 'table' | 'picture' | 'chart' | 'controlledSection';

/** Control kinds a ribbon item can render as. */
export type RibbonItemKind = 'button' | 'toggle' | 'dropdown' | 'gallery' | 'color';

/** A ribbon item referencing a command by id. Shells skip ids they do not know. */
export interface RibbonItem {
  command: string;
  size?: 'large' | 'small';
  kind?: RibbonItemKind;
}

/** A ribbon group. */
export interface RibbonGroup {
  id: string;
  label: string;
  items: RibbonItem[];
}

/** A ribbon tab. */
export interface RibbonTab {
  id: string;
  label: string;
  /** When set, the tab is only shown while the matching context is active. */
  contextual?: RibbonContext | string;
  groups: RibbonGroup[];
}

/** Declarative ribbon layout. */
export interface RibbonDefinition {
  tabs: RibbonTab[];
}
