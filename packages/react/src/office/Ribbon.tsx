/**
 * Ribbon - Office-style command ribbon driven by the command registry.
 *
 * Every button references a command id. Unknown ids are skipped, tabs without any
 * registered command are hidden, and contextual tabs appear when `getContextualTabs`
 * reports their context.
 *
 * Keyboard: ArrowLeft/ArrowRight/Home/End move between tabs, ArrowDown enters the
 * panel, Escape returns to the editor. F10, or Alt pressed and released on its own,
 * focuses the ribbon.
 *
 * @module
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';
import {
  createDefaultRibbon,
  formatShortcutHint,
  getContextualTabs,
} from '@amusendame/beakblock-commands';
import type {
  CommandDefinition,
  CommandRegistry,
  RibbonDefinition,
  RibbonGroup,
  RibbonItem,
  RibbonTab,
} from '@amusendame/beakblock-commands';
import { OfficeIcon } from './icons';
import { useEditorTick } from './editorUtils';
import { joinClass } from './shared';

/** Swatches offered by colour items (text colour and highlight). */
export const RIBBON_COLOR_SWATCHES: { value: string; label: string }[] = [
  { value: '', label: 'Automatic' },
  { value: '#dc2626', label: 'Red' },
  { value: '#ea580c', label: 'Orange' },
  { value: '#ca8a04', label: 'Yellow' },
  { value: '#16a34a', label: 'Green' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#7c3aed', label: 'Purple' },
  { value: '#db2777', label: 'Pink' },
  { value: '#374151', label: 'Gray' },
];

/** Props for {@link Ribbon}. */
export interface RibbonProps {
  /** Registry the ribbon reads and executes commands through. */
  registry: CommandRegistry | null;
  /** Editor used for contextual tabs, transaction updates and returning focus. */
  editor: BeakBlockEditor | null;
  /** Ribbon layout. Default `createDefaultRibbon()`. */
  ribbon?: RibbonDefinition;
  /** Id of the tab to show first. Default `home`. */
  defaultTab?: string;
  /** Called when the visible tab changes. */
  onTabChange?: (tabId: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

interface ResolvedItem {
  item: RibbonItem;
  def: CommandDefinition;
}

interface ResolvedGroup {
  group: RibbonGroup;
  items: ResolvedItem[];
}

/** Resolve a tab's items against the registry, dropping unknown ids and empty groups. */
function resolveTab(tab: RibbonTab, registry: CommandRegistry): ResolvedGroup[] {
  const groups: ResolvedGroup[] = [];
  for (const group of tab.groups) {
    const items: ResolvedItem[] = [];
    for (const item of group.items) {
      const def = registry.get(item.command);
      if (def) items.push({ item, def });
    }
    if (items.length > 0) groups.push({ group, items });
  }
  return groups;
}

/**
 * Office-style ribbon with tabs, groups and command buttons.
 *
 * @example
 * ```tsx
 * <Ribbon registry={registry} editor={editor} />
 * ```
 */
export function Ribbon({ registry, editor, ribbon, defaultTab = 'home', onTabChange, className, style }: RibbonProps): React.ReactElement {
  const definition = useMemo(() => ribbon ?? createDefaultRibbon(), [ribbon]);
  const tick = useEditorTick(editor);
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const [selectedId, setSelectedId] = useState(defaultTab);
  const [openColor, setOpenColor] = useState<string | null>(null);

  const contexts = useMemo(() => (editor && !editor.isDestroyed ? getContextualTabs(editor) : []), [editor, tick]);

  const visibleTabs = useMemo(() => {
    if (!registry) return [] as { tab: RibbonTab; groups: ResolvedGroup[] }[];
    const result: { tab: RibbonTab; groups: ResolvedGroup[] }[] = [];
    for (const tab of definition.tabs) {
      if (tab.contextual && !contexts.includes(tab.contextual)) continue;
      const groups = resolveTab(tab, registry);
      if (groups.length > 0) result.push({ tab, groups });
    }
    return result;
  }, [definition, registry, contexts]);

  // Switch to a contextual tab the moment its context appears (Word behaviour).
  const previousContexts = useRef<string[]>([]);
  useEffect(() => {
    const appeared = contexts.filter((context) => !previousContexts.current.includes(context));
    previousContexts.current = contexts;
    const tab = definition.tabs.find((candidate) => candidate.contextual && appeared.includes(candidate.contextual));
    if (tab) setSelectedId(tab.id);
  }, [contexts, definition]);

  const active = visibleTabs.find((entry) => entry.tab.id === selectedId) ?? visibleTabs[0];
  const activeId = active?.tab.id ?? '';

  useEffect(() => {
    if (activeId) onTabChange?.(activeId);
    // onTabChange is intentionally excluded: callers pass inline handlers.
  }, [activeId]);

  const focusTab = (id: string) => {
    setSelectedId(id);
    tabRefs.current.get(id)?.focus();
  };

  // F10, or Alt pressed and released alone, moves focus into the ribbon.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let altAlone = false;
    const focusRibbon = () => {
      const target = tabRefs.current.get(activeId) ?? tabRefs.current.values().next().value;
      target?.focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F10') {
        event.preventDefault();
        focusRibbon();
        altAlone = false;
        return;
      }
      altAlone = event.key === 'Alt';
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Alt' && altAlone) {
        altAlone = false;
        focusRibbon();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [activeId]);

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = visibleTabs.length;
    if (count === 0) return;
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        focusTab(visibleTabs[(index + 1) % count]!.tab.id);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusTab(visibleTabs[(index - 1 + count) % count]!.tab.id);
        break;
      case 'Home':
        event.preventDefault();
        focusTab(visibleTabs[0]!.tab.id);
        break;
      case 'End':
        event.preventDefault();
        focusTab(visibleTabs[count - 1]!.tab.id);
        break;
      case 'ArrowDown': {
        event.preventDefault();
        const panel = document.getElementById(`${baseId}-panel-${activeId}`);
        panel?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
        break;
      }
      case 'Escape':
        event.preventDefault();
        if (editor && !editor.isDestroyed) editor.pm.view.focus();
        break;
      default:
        break;
    }
  };

  if (!registry) {
    return <div className={joinClass('bb-office-ribbon', className)} style={style} />;
  }

  const runCommand = (id: string, args?: unknown) => {
    registry.execute(id, args);
    setOpenColor(null);
    if (editor && !editor.isDestroyed) editor.pm.view.focus();
  };

  return (
    <div className={joinClass('bb-office-ribbon', className)} style={style} data-testid="bb-office-ribbon">
      <div className="bb-office-ribbon-tabs" role="tablist" aria-label="Ribbon">
        {visibleTabs.map(({ tab }, index) => {
          const selected = tab.id === activeId;
          const contextual = !!tab.contextual;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.id, node);
                else tabRefs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={joinClass(
                'bb-office-ribbon-tab',
                selected && 'is-active',
                contextual && 'bb-office-ribbon-tab-contextual'
              )}
              data-contextual={contextual ? tab.contextual : undefined}
              onClick={() => setSelectedId(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {active && (
        <div
          key={active.tab.id}
          className={joinClass('bb-office-ribbon-panel', active.tab.contextual && 'bb-office-ribbon-panel-contextual')}
          role="tabpanel"
          id={`${baseId}-panel-${active.tab.id}`}
          aria-labelledby={`${baseId}-tab-${active.tab.id}`}
        >
          {active.groups.map(({ group, items }) => (
            <div key={group.id} className="bb-office-ribbon-group" role="group" aria-label={group.label}>
              <div className="bb-office-ribbon-items">
                {items.map(({ item, def }) => (
                  <RibbonButton
                    key={`${group.id}-${item.command}`}
                    item={item}
                    def={def}
                    registry={registry}
                    colorOpen={openColor === item.command}
                    onToggleColor={() => setOpenColor(openColor === item.command ? null : item.command)}
                    onRun={runCommand}
                  />
                ))}
              </div>
              <div className="bb-office-ribbon-group-label">{group.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface RibbonButtonProps {
  item: RibbonItem;
  def: CommandDefinition;
  registry: CommandRegistry;
  colorOpen: boolean;
  onToggleColor: () => void;
  onRun: (id: string, args?: unknown) => void;
}

function RibbonButton({ item, def, registry, colorOpen, onToggleColor, onRun }: RibbonButtonProps): React.ReactElement {
  const kind = item.kind ?? 'button';
  const size = item.size ?? 'small';
  const enabled = registry.canExecute(def.id);
  const pressed = kind === 'toggle' ? registry.isActive(def.id) : undefined;
  const hint = firstShortcutHint(def);
  const title = hint ? `${def.label} (${hint})` : def.description ?? def.label;
  const iconSize = size === 'large' ? 24 : 16;

  if (kind === 'color') {
    return (
      <div className="bb-office-color-wrap">
        <button
          type="button"
          className={joinClass('bb-office-button', `bb-office-button-${size}`, 'bb-office-button-color')}
          aria-label={title}
          aria-haspopup="true"
          aria-expanded={colorOpen}
          title={title}
          disabled={!enabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onToggleColor}
        >
          <OfficeIcon name={def.icon} size={iconSize} />
          <span className="bb-office-button-label">{def.label}</span>
          <OfficeIcon name="chevron-down" size={10} />
        </button>
        {colorOpen && (
          <div className="bb-office-color-popover" role="group" aria-label={`${def.label} colours`}>
            {RIBBON_COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch.value || 'auto'}
                type="button"
                className="bb-office-swatch"
                title={swatch.label}
                aria-label={swatch.label}
                style={{ background: swatch.value || 'transparent' }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onRun(def.id, { color: swatch.value })}
              >
                {swatch.value ? '' : 'A'}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const classes = joinClass(
    'bb-office-button',
    `bb-office-button-${size}`,
    pressed && 'is-pressed',
    (kind === 'gallery' || kind === 'dropdown') && 'bb-office-button-menu'
  );

  return (
    <button
      type="button"
      className={classes}
      title={title}
      aria-label={def.label}
      aria-pressed={pressed === undefined ? undefined : pressed}
      disabled={!enabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onRun(def.id)}
      data-command={def.id}
    >
      <OfficeIcon name={def.icon} size={iconSize} />
      <span className="bb-office-button-label">{def.label}</span>
      {(kind === 'gallery' || kind === 'dropdown') && <OfficeIcon name="chevron-down" size={10} />}
    </button>
  );
}

function firstShortcutHint(def: CommandDefinition): string | undefined {
  const binding = Array.isArray(def.shortcut) ? def.shortcut[0] : def.shortcut;
  return binding ? formatShortcutHint(binding) : undefined;
}

