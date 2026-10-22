/**
 * QuickAccessToolbar - a compact row of frequently used command buttons.
 *
 * @module
 */

import React from 'react';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';
import { formatShortcutHint } from '@amusendame/beakblock-commands';
import type { CommandRegistry } from '@amusendame/beakblock-commands';
import { OfficeIcon } from './icons';
import { joinClass, useRegistryRefresh } from './shared';

/** Props for {@link QuickAccessToolbar}. */
export interface QuickAccessToolbarProps {
  registry: CommandRegistry | null;
  /** Command ids to show, in order. Unregistered ids are skipped. */
  commands: string[];
  /** Optional editor, used to refresh enabled and toggle state on transactions. */
  editor?: BeakBlockEditor | null;
  className?: string;
}

/** Quick access toolbar driven by command ids. */
export function QuickAccessToolbar({ registry, commands, editor, className }: QuickAccessToolbarProps): React.ReactElement {
  useRegistryRefresh(registry, editor);
  return (
    <div className={joinClass('bb-office-qat', className)} role="toolbar" aria-label="Quick Access Toolbar">
      {registry &&
        commands.map((id) => {
          const def = registry.get(id);
          if (!def) return null;
          const enabled = registry.canExecute(id);
          const pressed = def.isActive ? registry.isActive(id) : undefined;
          const binding = Array.isArray(def.shortcut) ? def.shortcut[0] : def.shortcut;
          const hint = binding ? formatShortcutHint(binding) : undefined;
          return (
            <button
              key={id}
              type="button"
              className={joinClass('bb-office-qat-button', pressed && 'is-pressed')}
              title={hint ? `${def.label} (${hint})` : def.label}
              aria-label={def.label}
              aria-pressed={pressed === undefined ? undefined : pressed}
              disabled={!enabled}
              data-command={id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                registry.execute(id);
                if (editor && !editor.isDestroyed) editor.pm.view.focus();
              }}
            >
              <OfficeIcon name={def.icon} size={16} />
            </button>
          );
        })}
    </div>
  );
}
