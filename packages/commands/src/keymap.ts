/**
 * Keyboard binding normalisation for the command registry.
 *
 * Bindings use ProseMirror keymap syntax (`Mod-b`, `Mod-Shift-n`, `F4`).
 * This module converts both bindings and DOM keyboard events into one canonical
 * form so the registry can dispatch without depending on `prosemirror-keymap`.
 *
 * @module
 */

const MODIFIER_ORDER = ['Alt', 'Ctrl', 'Meta', 'Shift'] as const;

/** True when running on Apple platforms, where `Mod` means Meta (Cmd). */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform ?? '');
}

function normalizeKeyName(name: string): string {
  if (name === ' ') return 'Space';
  return name.length === 1 ? name.toLowerCase() : name;
}

/**
 * Normalise a ProseMirror-style binding (e.g. `Mod-Shift-N`) into canonical form
 * (e.g. `Ctrl-Shift-n`). Modifiers are ordered Alt, Ctrl, Meta, Shift.
 */
export function normalizeBinding(binding: string, isMac = isMacPlatform()): string {
  const parts = binding.split('-');
  const key = parts.pop() ?? '';
  const mods = new Set<string>();
  for (const part of parts) {
    switch (part.toLowerCase()) {
      case 'mod':
        mods.add(isMac ? 'Meta' : 'Ctrl');
        break;
      case 'ctrl':
      case 'control':
        mods.add('Ctrl');
        break;
      case 'alt':
      case 'option':
        mods.add('Alt');
        break;
      case 'shift':
        mods.add('Shift');
        break;
      case 'meta':
      case 'cmd':
      case 'command':
        mods.add('Meta');
        break;
      default:
        break;
    }
  }
  return [...MODIFIER_ORDER.filter((m) => mods.has(m)), normalizeKeyName(key)].join('-');
}

/**
 * Candidate canonical names for a keyboard event. The `key` name is tried first,
 * then the physical `code` (so `Mod-Shift-7` matches even when Shift yields `&`).
 */
export function eventCandidates(event: KeyboardEvent): string[] {
  const mods: string[] = [];
  if (event.altKey) mods.push('Alt');
  if (event.ctrlKey) mods.push('Ctrl');
  if (event.metaKey) mods.push('Meta');
  if (event.shiftKey) mods.push('Shift');

  const names = new Set<string>();
  if (event.key && event.key !== 'Dead' && event.key !== 'Unidentified') {
    names.add(normalizeKeyName(event.key));
  }
  const code = event.code ?? '';
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter?.[1]) names.add(letter[1].toLowerCase());
  const digit = /^Digit(\d)$/.exec(code);
  if (digit?.[1]) names.add(digit[1]);

  return [...names].map((name) => [...mods, name].join('-'));
}

/**
 * Human-readable shortcut, e.g. `Mod-Alt-1` -> `Ctrl+Alt+1` (or `Cmd+...` on Apple platforms).
 */
export function formatShortcutHint(binding: string, isMac = isMacPlatform()): string {
  const parts = binding.split('-');
  const key = parts.pop() ?? '';
  const labels = parts.map((part) => {
    const p = part.toLowerCase();
    if (p === 'mod') return isMac ? 'Cmd' : 'Ctrl';
    if (p === 'ctrl' || p === 'control') return 'Ctrl';
    if (p === 'alt' || p === 'option') return isMac ? 'Option' : 'Alt';
    if (p === 'shift') return 'Shift';
    if (p === 'meta' || p === 'cmd' || p === 'command') return isMac ? 'Cmd' : 'Meta';
    return part;
  });
  const keyLabel = key.length === 1 ? key.toUpperCase() : key;
  return [...labels, keyLabel].join('+');
}
