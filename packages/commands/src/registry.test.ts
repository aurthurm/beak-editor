/**
 * @module
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BeakBlockEditor } from '@amusendame/beakblock-core';

import { CommandRegistry } from './registry';
import { normalizeBinding, formatShortcutHint, eventCandidates } from './keymap';
import type { CommandDefinition } from './types';

function makeEditor(container: HTMLElement): BeakBlockEditor {
  return new BeakBlockEditor({
    element: container,
    injectStyles: false,
    initialContent: [
      { id: 'p1', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'hello', styles: {} }] },
    ],
  });
}

describe('CommandRegistry', () => {
  let container: HTMLElement;
  let editor: BeakBlockEditor;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = makeEditor(container);
  });

  afterEach(() => {
    editor.destroy();
    container.remove();
  });

  it('registers, gets, lists by group and unregisters commands', () => {
    const registry = new CommandRegistry();
    const a: CommandDefinition = { id: 'a.one', label: 'One', group: 'G1', run: () => true };
    const b: CommandDefinition = { id: 'b.two', label: 'Two', group: 'G2', run: () => true };
    registry.register([a, b]);
    expect(registry.get('a.one')).toBe(a);
    expect(registry.list().map((c) => c.id)).toEqual(['a.one', 'b.two']);
    expect(registry.list('G2').map((c) => c.id)).toEqual(['b.two']);
    expect(registry.unregister('a.one')).toBe(true);
    expect(registry.get('a.one')).toBeUndefined();
    expect(registry.unregister('missing')).toBe(false);
  });

  it('search ranks label matches above description matches and shows shortcut hints', () => {
    const registry = new CommandRegistry();
    registry.register([
      { id: 'format.bold', label: 'Bold', description: 'Make text strong', shortcut: 'Mod-b', run: () => true },
      { id: 'format.italic', label: 'Italic', description: 'Slant bold-ish text', run: () => true },
      { id: 'insert.table', label: 'Table', description: 'Insert a grid', group: 'Insert', run: () => true },
    ]);
    const hits = registry.search('bold');
    expect(hits[0]?.command.id).toBe('format.bold');
    expect(hits[0]?.shortcutHint).toBe('Ctrl+B');
    expect(hits.map((h) => h.command.id)).toContain('format.italic');
    expect(registry.search('gird').length).toBe(0);
    expect(registry.search('grid')[0]?.command.id).toBe('insert.table');
    expect(registry.search('').length).toBe(3);
    expect(registry.search('zzzz')).toEqual([]);
  });

  it('execute runs the command, notifies listeners and returns the run result', () => {
    const registry = new CommandRegistry();
    registry.bind(editor);
    const seen: Array<{ id: string; result: boolean }> = [];
    const unsubscribe = registry.onExecute((e) => seen.push({ id: e.id, result: e.result }));
    registry.register({ id: 'test.ok', label: 'OK', run: () => true });
    registry.register({ id: 'test.no', label: 'No', run: () => false });

    expect(registry.execute('test.ok')).toBe(true);
    expect(registry.execute('test.no')).toBe(false);
    expect(registry.execute('unknown.id')).toBe(false);
    expect(seen).toEqual([
      { id: 'test.ok', result: true },
      { id: 'test.no', result: false },
    ]);

    unsubscribe();
    registry.execute('test.ok');
    expect(seen.length).toBe(2);
  });

  it('does not execute before bind(editor)', () => {
    const registry = new CommandRegistry();
    let ran = false;
    registry.register({ id: 'x', label: 'X', run: () => ((ran = true), true) });
    expect(registry.execute('x')).toBe(false);
    expect(registry.canExecute('x')).toBe(false);
    expect(ran).toBe(false);
  });

  it('honours isEnabled and canExecute', () => {
    const registry = new CommandRegistry();
    registry.bind(editor);
    registry.register({ id: 'x', label: 'X', isEnabled: () => false, run: () => true });
    expect(registry.canExecute('x')).toBe(false);
    expect(registry.execute('x')).toBe(false);
  });

  it('policy check blocks execution and reports the reason', () => {
    const registry = new CommandRegistry();
    registry.bind(editor);
    let ran = false;
    registry.register({ id: 'danger.do', label: 'Do', run: () => ((ran = true), true) });
    registry.setPolicyCheck((cmd) => (cmd.id.startsWith('danger') ? 'section is locked' : true));

    const denied: Array<string | undefined> = [];
    registry.onDenied((e) => denied.push(e.reason));

    expect(registry.canExecute('danger.do')).toBe(false);
    expect(registry.execute('danger.do')).toBe(false);
    expect(ran).toBe(false);
    expect(denied).toEqual(['section is locked']);
    expect(registry.getLastDenial()).toEqual({ id: 'danger.do', reason: 'section is locked' });

    registry.setPolicyCheck(null);
    expect(registry.execute('danger.do')).toBe(true);
    expect(ran).toBe(true);
  });

  it('boolean false from the policy check denies without a reason', () => {
    const registry = new CommandRegistry();
    registry.bind(editor);
    registry.register({ id: 'x', label: 'X', run: () => true });
    registry.setPolicyCheck(() => false);
    expect(registry.execute('x')).toBe(false);
    expect(registry.getLastDenial()).toEqual({ id: 'x', reason: undefined });
  });

  it('repeatLast re-runs the last successful repeatable command with its args', () => {
    const registry = new CommandRegistry();
    registry.bind(editor);
    const calls: unknown[] = [];
    registry.register([
      { id: 'rep', label: 'Rep', repeatable: true, run: ({ args }) => (calls.push(args), true) },
      { id: 'nonrep', label: 'Non', run: ({ args }) => (calls.push(['nonrep', args]), true) },
    ]);
    expect(registry.repeatLast()).toBe(false);
    registry.execute('rep', { color: 'red' });
    registry.execute('nonrep', 1);
    expect(registry.repeatLast()).toBe(true);
    expect(calls).toEqual([{ color: 'red' }, ['nonrep', 1], { color: 'red' }]);
  });

  it('isActive reflects the command isActive callback', () => {
    const registry = new CommandRegistry();
    registry.bind(editor);
    registry.register({ id: 'on', label: 'On', isActive: () => true, run: () => true });
    expect(registry.isActive('on')).toBe(true);
    expect(registry.isActive('missing')).toBe(false);
  });

  it('keymap plugin dispatches command shortcuts and F4 to repeatLast', () => {
    const registry = new CommandRegistry();
    registry.bind(editor);
    const ran: string[] = [];
    registry.register([
      { id: 'k.alpha', label: 'Alpha', shortcut: 'Mod-Shift-a', repeatable: true, run: () => (ran.push('alpha'), true) },
      { id: 'k.beta', label: 'Beta', shortcut: ['Mod-Alt-1'], run: () => (ran.push('beta'), true) },
    ]);
    editor.pm.addPlugin(registry.createKeymapPlugin());
    const handle = (init: KeyboardEventInit & { key: string }) => {
      const plugin = editor.pm.getPlugins().find((p) => (p as unknown as { key: string }).key.startsWith('beakblock-commands-keymap'));
      const handler = plugin?.props.handleKeyDown as ((view: unknown, event: KeyboardEvent) => boolean) | undefined;
      return handler?.(editor.pm.view, new KeyboardEvent('keydown', { ...init, cancelable: true })) ?? false;
    };

    expect(handle({ key: 'A', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(handle({ key: '1', ctrlKey: true, altKey: true })).toBe(true);
    expect(handle({ key: 'x', ctrlKey: true })).toBe(false);
    expect(handle({ key: 'F4' })).toBe(true);
    expect(ran).toEqual(['alpha', 'beta', 'alpha']);
  });
});

describe('keyboard helpers', () => {
  it('normalises Mod per platform and orders modifiers', () => {
    expect(normalizeBinding('Mod-Shift-N', false)).toBe('Ctrl-Shift-n');
    expect(normalizeBinding('Mod-Shift-N', true)).toBe('Meta-Shift-n');
    expect(normalizeBinding('Shift-Alt-Mod-1', false)).toBe('Alt-Ctrl-Shift-1');
    expect(normalizeBinding('F4', false)).toBe('F4');
  });

  it('builds event candidates from key and physical code', () => {
    const e = new KeyboardEvent('keydown', { key: '&', code: 'Digit7', ctrlKey: true, shiftKey: true });
    expect(eventCandidates(e)).toEqual(['Ctrl-Shift-&', 'Ctrl-Shift-7']);
    const letter = new KeyboardEvent('keydown', { key: 'B', code: 'KeyB', ctrlKey: true });
    expect(eventCandidates(letter)).toEqual(['Ctrl-b']);
  });

  it('formats shortcut hints for display', () => {
    expect(formatShortcutHint('Mod-Alt-1', false)).toBe('Ctrl+Alt+1');
    expect(formatShortcutHint('Mod-Shift-n', false)).toBe('Ctrl+Shift+N');
    expect(formatShortcutHint('Mod-Shift-n', true)).toBe('Cmd+Shift+N');
    expect(formatShortcutHint('F4', false)).toBe('F4');
  });
});
