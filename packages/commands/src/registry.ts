/**
 * Command registry for BeakBlock.
 *
 * One registry drives the ribbon, keyboard shortcuts, menus, AI and the
 * programmatic API. Every execution passes through the policy check first.
 *
 * @module
 */

import type { BeakBlockEditor, Plugin as PMPlugin } from '@amusendame/beakblock-core';
import { Plugin, PluginKey } from '@amusendame/beakblock-core';

import type {
  CommandContext,
  CommandDefinition,
  CommandDeniedListener,
  CommandExecuteListener,
  CommandSearchResult,
  PolicyCheck,
  PolicyResult,
} from './types';
import {
  eventCandidates,
  formatShortcutHint,
  isMacPlatform,
  normalizeBinding,
} from './keymap';

/** Key used for the registry keymap plugin. */
export const COMMAND_KEYMAP_PLUGIN_KEY = new PluginKey('beakblock-commands-keymap');

/** Last denial recorded by `execute()`. */
export interface CommandDenial {
  id: string;
  reason?: string;
}

interface RepeatRecord {
  id: string;
  args?: unknown;
}

/** Normalise `shortcut` to an array of bindings. */
function bindingsOf(def: CommandDefinition): string[] {
  if (!def.shortcut) return [];
  return Array.isArray(def.shortcut) ? def.shortcut : [def.shortcut];
}

/** Score one query token against a command. Returns 0 when nothing matches. */
function scoreToken(token: string, def: CommandDefinition): number {
  const label = def.label.toLowerCase();
  const id = def.id.toLowerCase();
  const description = (def.description ?? '').toLowerCase();
  const group = (def.group ?? '').toLowerCase();
  const words = label.split(/[\s\-_/]+/);

  if (label === token) return 50;
  if (label.startsWith(token)) return 30;
  if (words.some((w) => w.startsWith(token))) return 20;
  if (label.includes(token)) return 12;
  if (id.includes(token)) return 10;
  if (description.includes(token)) return 6;
  if (group.includes(token)) return 4;
  // Subsequence ("fuzzy") match on the label: every character of the token appears in order.
  let i = 0;
  for (const ch of label) {
    if (ch === token[i]) i++;
    if (i === token.length) return 3;
  }
  return 0;
}

/**
 * Registry of commands with policy checks, execution events, keymap integration
 * and F4 "repeat last" support.
 *
 * @example
 * ```typescript
 * const registry = new CommandRegistry();
 * registry.register(createBuiltInCommands());
 * registry.bind(editor);
 * editor.pm.addPlugin(registry.createKeymapPlugin());
 * registry.execute('format.bold');
 * ```
 */
export class CommandRegistry {
  private readonly commands = new Map<string, CommandDefinition>();
  private editor: BeakBlockEditor | null = null;
  private policy: PolicyCheck | null = null;
  private readonly executeListeners = new Set<CommandExecuteListener>();
  private readonly deniedListeners = new Set<CommandDeniedListener>();
  private lastRepeatable: RepeatRecord | null = null;
  private lastDenial: CommandDenial | null = null;

  /**
   * Register one command or an array of commands. Registering an existing id replaces it.
   */
  register(def: CommandDefinition | CommandDefinition[]): void {
    const list = Array.isArray(def) ? def : [def];
    for (const command of list) {
      if (!command.id) throw new Error('Command id is required');
      this.commands.set(command.id, command);
    }
  }

  /** Remove a command. Returns true when it existed. */
  unregister(id: string): boolean {
    return this.commands.delete(id);
  }

  /** Get a command by id. */
  get(id: string): CommandDefinition | undefined {
    return this.commands.get(id);
  }

  /** List commands in registration order, optionally filtered by group. */
  list(group?: string): CommandDefinition[] {
    const all = [...this.commands.values()];
    return group === undefined ? all : all.filter((c) => c.group === group);
  }

  /**
   * Fuzzy search over label, id, description and group.
   *
   * Every whitespace-separated token must match somewhere. Results are ranked by score
   * (higher first), with registration order breaking ties. An empty query returns every command.
   */
  search(query: string): CommandSearchResult[] {
    const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const results: CommandSearchResult[] = [];
    for (const command of this.commands.values()) {
      let score = 0;
      let matched = true;
      for (const token of tokens) {
        const s = scoreToken(token, command);
        if (s === 0) {
          matched = false;
          break;
        }
        score += s;
      }
      if (!matched) continue;
      const first = bindingsOf(command)[0];
      results.push({
        command,
        score,
        shortcutHint: first ? formatShortcutHint(first) : undefined,
      });
    }
    // Array.prototype.sort is stable, so ties keep registration order.
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Install the policy check consulted before every execution. Pass `null` to remove it.
   * The check returns `true` to allow, `false` or a reason string to deny.
   */
  setPolicyCheck(fn: PolicyCheck | null): void {
    this.policy = fn;
  }

  /** Subscribe to executed commands. Returns an unsubscribe function. */
  onExecute(listener: CommandExecuteListener): () => void {
    this.executeListeners.add(listener);
    return () => this.executeListeners.delete(listener);
  }

  /** Subscribe to commands denied by the policy check. Returns an unsubscribe function. */
  onDenied(listener: CommandDeniedListener): () => void {
    this.deniedListeners.add(listener);
    return () => this.deniedListeners.delete(listener);
  }

  /** The most recent policy denial, if any. */
  getLastDenial(): CommandDenial | null {
    return this.lastDenial ? { ...this.lastDenial } : null;
  }

  /** Bind the registry to an editor. Commands cannot run before this is called. */
  bind(editor: BeakBlockEditor): void {
    this.editor = editor;
  }

  /** Run the policy check for a command. Records and emits denials. */
  private checkPolicy(def: CommandDefinition, ctx: CommandContext): boolean {
    if (!this.policy) return true;
    const verdict: PolicyResult = this.policy(def, ctx);
    if (verdict === true) return true;
    const reason = typeof verdict === 'string' ? verdict : undefined;
    this.lastDenial = { id: def.id, reason };
    for (const listener of this.deniedListeners) listener({ id: def.id, args: ctx.args, reason });
    return false;
  }

  /**
   * Execute a command: policy check, enabled check, run, then notify listeners.
   * Returns false when the command is unknown, unbound, denied, disabled or did nothing.
   */
  execute(id: string, args?: unknown): boolean {
    const def = this.commands.get(id);
    if (!def || !this.editor) return false;
    const ctx: CommandContext = { editor: this.editor, args };
    if (!this.checkPolicy(def, ctx)) return false;
    if (def.isEnabled && !def.isEnabled(ctx)) return false;

    const result = def.run(ctx) === true;
    for (const listener of this.executeListeners) listener({ id, args, result });
    if (result && def.repeatable) this.lastRepeatable = { id, args };
    return result;
  }

  /** True when the command exists, the registry is bound, the policy allows it and it is enabled. */
  canExecute(id: string, args?: unknown): boolean {
    const def = this.commands.get(id);
    if (!def || !this.editor) return false;
    const ctx: CommandContext = { editor: this.editor, args };
    const allowed = this.policy ? this.policy(def, ctx) === true : true;
    if (!allowed) return false;
    return def.isEnabled ? def.isEnabled(ctx) : true;
  }

  /** True when the command reports its effect is active at the selection. */
  isActive(id: string, args?: unknown): boolean {
    const def = this.commands.get(id);
    if (!def || !this.editor || !def.isActive) return false;
    return def.isActive({ editor: this.editor, args }) === true;
  }

  /** Re-run the last successful repeatable command with its original arguments (F4). */
  repeatLast(): boolean {
    if (!this.lastRepeatable) return false;
    const { id, args } = this.lastRepeatable;
    return this.execute(id, args);
  }

  /**
   * Build a ProseMirror plugin that dispatches keyboard shortcuts from every registered
   * command. Bindings are resolved at key-press time, so commands registered later work too.
   * `F4` runs `repeatLast()` unless a command binds F4 itself.
   */
  createKeymapPlugin(): PMPlugin {
    // The plugin's handlers run with ProseMirror's `this`, so capture the registry.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const registry = this;
    return new Plugin({
      key: COMMAND_KEYMAP_PLUGIN_KEY,
      props: {
        handleKeyDown(_view, event) {
          const isMac = isMacPlatform();
          const table = new Map<string, string[]>();
          for (const def of registry.commands.values()) {
            for (const binding of bindingsOf(def)) {
              const key = normalizeBinding(binding, isMac);
              const ids = table.get(key) ?? [];
              ids.push(def.id);
              table.set(key, ids);
            }
          }
          for (const candidate of eventCandidates(event)) {
            const ids = table.get(candidate) ?? [];
            for (const id of ids) {
              if (registry.execute(id)) {
                event.preventDefault();
                return true;
              }
            }
            if (candidate === 'F4' && ids.length === 0 && registry.repeatLast()) {
              event.preventDefault();
              return true;
            }
          }
          return false;
        },
      },
    });
  }
}
