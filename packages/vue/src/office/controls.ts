/**
 * Shared render helpers for command-driven controls (icons, buttons, shortcut hints).
 *
 * Buttons never call editor methods directly. They read state from the registry and run
 * commands through `registry.execute`.
 *
 * @module
 */

import { h, type VNode } from 'vue';
import {
  BUILTIN_ICON_PATHS,
  formatShortcutHint,
  hasBuiltinIcon,
  type CommandDefinition,
  type CommandRegistry,
} from '@amusendame/beakblock-commands';

/**
 * Render an icon for a built-in name as an inline SVG with the same glyphs as the React shell.
 * Unknown names fall back to the first letter of the label.
 */
export function renderIcon(icon: string | undefined, label: string): VNode {
  if (icon && hasBuiltinIcon(icon)) {
    return h(
      'svg',
      {
        class: 'bb-office-icon',
        viewBox: '0 0 24 24',
        width: 16,
        height: 16,
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      },
      [h('path', { d: BUILTIN_ICON_PATHS[icon] })]
    );
  }
  return h('span', { class: 'bb-office-button-letter', 'aria-hidden': 'true' }, label.charAt(0).toUpperCase());
}

/** First shortcut of a command as a human-readable hint (e.g. `Ctrl+B`), or undefined. */
export function shortcutHintFor(def: CommandDefinition): string | undefined {
  const first = Array.isArray(def.shortcut) ? def.shortcut[0] : def.shortcut;
  return first ? formatShortcutHint(first) : undefined;
}

/** Options for {@link renderCommandButton}. */
export interface CommandButtonOptions {
  size?: 'large' | 'small';
  kind?: string;
  /** Show the label next to the icon. */
  showLabel?: boolean;
  /** Called after a successful execution. */
  onExecuted?: (id: string) => void;
}

/**
 * Render a command as a button. Pressed state comes from `isActive` for toggles and galleries,
 * disabled state from `canExecute`. Mousedown is suppressed so the editor keeps its selection.
 */
export function renderCommandButton(
  registry: CommandRegistry,
  def: CommandDefinition,
  options: CommandButtonOptions = {}
): VNode {
  const { size = 'small', kind, showLabel = false } = options;
  const hint = shortcutHintFor(def);
  const isToggle = kind === 'toggle' || kind === 'gallery' || kind === 'color';
  const pressed = isToggle && def.isActive ? registry.isActive(def.id) : undefined;
  const disabled = !registry.canExecute(def.id);
  const title = hint ? `${def.label} (${hint})` : def.label;
  const classes = ['bb-office-button', `bb-office-ribbon-button--${size}`];
  if (kind === 'color') classes.push('bb-office-ribbon-button--color');
  if (kind) classes.push(`bb-office-button--${kind}`);

  return h(
    'button',
    {
      type: 'button',
      class: classes.join(' '),
      title,
      'aria-label': def.label,
      'aria-pressed': pressed === undefined ? undefined : String(pressed),
      'aria-keyshortcuts': hint ? hint.replace(/^Ctrl\+/, 'Control+') : undefined,
      disabled,
      'data-command': def.id,
      'data-kind': kind ?? 'button',
      onMousedown: (event: MouseEvent) => event.preventDefault(),
      onClick: () => {
        if (registry.execute(def.id)) options.onExecuted?.(def.id);
      },
    },
    [
      renderIcon(def.icon, def.label),
      kind === 'color' ? h('span', { class: 'bb-office-swatch', 'aria-hidden': 'true' }) : null,
      showLabel || size === 'large' ? h('span', { class: 'bb-office-button-label' }, def.label) : null,
    ]
  );
}
