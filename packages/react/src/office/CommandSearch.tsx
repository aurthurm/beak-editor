/**
 * CommandSearch - the "Tell me what you want to do" box.
 *
 * Alt+Q or Ctrl/Cmd+Shift+P focuses the box. Results are ranked by the registry,
 * show shortcut hints, and Enter runs the highlighted command.
 *
 * @module
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';
import type { CommandRegistry, CommandSearchResult } from '@amusendame/beakblock-commands';
import { OfficeIcon } from './icons';
import { joinClass, useRegistryRefresh } from './shared';

/** Props for {@link CommandSearch}. */
export interface CommandSearchProps {
  registry: CommandRegistry | null;
  /** Optional editor. Focus returns to it after a command runs. */
  editor?: BeakBlockEditor | null;
  /** Maximum number of results shown. Default 8. */
  maxResults?: number;
  placeholder?: string;
  className?: string;
}

/**
 * Command search box with ranked results.
 *
 * @example
 * ```tsx
 * <CommandSearch registry={registry} editor={editor} />
 * ```
 */
export function CommandSearch({
  registry,
  editor,
  maxResults = 8,
  placeholder = 'Tell me what you want to do',
  className,
}: CommandSearchProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  useRegistryRefresh(registry, editor);

  const results: CommandSearchResult[] = useMemo(() => {
    if (!registry || !query.trim()) return [];
    return registry.search(query).slice(0, maxResults);
  }, [registry, query, maxResults]);

  // Global shortcuts: Alt+Q and Ctrl/Cmd+Shift+P focus the search box.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isAltQ = event.altKey && !event.ctrlKey && !event.metaKey && (key === 'q' || event.code === 'KeyQ');
      const isModShiftP =
        (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && (key === 'p' || event.code === 'KeyP');
      if (isAltQ || isModShiftP) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const close = () => {
    setOpen(false);
    setActive(0);
  };

  const execute = (result: CommandSearchResult) => {
    if (!registry) return;
    registry.execute(result.command.id);
    setQuery('');
    close();
    if (editor && !editor.isDestroyed) editor.pm.view.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (results.length ? (index + 1) % results.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (results.length ? (index - 1 + results.length) % results.length : 0));
    } else if (event.key === 'Enter') {
      const result = results[active];
      if (result && registry?.canExecute(result.command.id)) {
        event.preventDefault();
        execute(result);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (open) close();
      else {
        setQuery('');
        editor?.pm.view.focus();
      }
    }
  };

  const showList = open && query.trim().length > 0;
  const activeId = showList && results[active] ? `${listId}-${active}` : undefined;

  return (
    <div className={joinClass('bb-office-search', className)} role="search">
      <div className="bb-office-search-field">
        <OfficeIcon name="search" size={14} />
        <input
          ref={inputRef}
          type="search"
          className="bb-office-search-input"
          role="combobox"
          aria-label={placeholder}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(close, 120)}
          onKeyDown={onKeyDown}
        />
      </div>
      {showList && (
        <ul id={listId} className="bb-office-search-results" role="listbox" aria-label="Command results">
          {results.length === 0 && <li className="bb-office-search-empty">No commands match "{query}"</li>}
          {results.map((result, index) => {
            const enabled = registry?.canExecute(result.command.id) ?? false;
            const hint = result.shortcutHint;
            return (
              <li
                key={result.command.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                aria-disabled={!enabled}
                className={joinClass(
                  'bb-office-search-result',
                  index === active && 'is-active',
                  !enabled && 'is-disabled'
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => enabled && execute(result)}
              >
                <span className="bb-office-search-result-label">{result.command.label}</span>
                {result.command.group && (
                  <span className="bb-office-search-result-group">{result.command.group}</span>
                )}
                {hint && <kbd className="bb-office-search-result-shortcut">{hint}</kbd>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
