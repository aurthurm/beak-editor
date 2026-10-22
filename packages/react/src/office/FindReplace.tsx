/**
 * FindReplace - find and replace bar with match case, whole word and regex options.
 *
 * Matches are highlighted with ProseMirror decorations from a plugin this component installs
 * on the editor. Replace all runs as one transaction, so one undo reverts it.
 *
 * @module
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { BeakBlockEditor, Plugin, Transaction } from '@amusendame/beakblock-core';
import { Decoration, DecorationSet, Plugin as PMPlugin, PluginKey } from '@amusendame/beakblock-core';
import {
  expandReplacement,
  findMatches,
  getRegexError,
} from './findEngine';
import type { SearchMatch, SearchOptions } from './findEngine';
import { selectRange, useEditorTick } from './editorUtils';
import { joinClass } from './shared';

/** Highlight state stored by the find plugin. */
export interface FindHighlightState {
  matches: SearchMatch[];
  current: number;
}

/** Plugin key for the highlight plugin. Exported so callers can remove it. */
export const FIND_HIGHLIGHT_KEY = new PluginKey<FindHighlightState>('beakblock-office-find-highlight');

/**
 * Create the decoration plugin that highlights find matches. Positions are refreshed by
 * {@link FindReplace} through `setMeta(FIND_HIGHLIGHT_KEY, state)`.
 */
export function createFindHighlightPlugin(): Plugin {
  return new PMPlugin<FindHighlightState>({
    key: FIND_HIGHLIGHT_KEY,
    state: {
      init: () => ({ matches: [], current: -1 }),
      apply(tr, value) {
        const meta = tr.getMeta(FIND_HIGHLIGHT_KEY) as FindHighlightState | undefined;
        return meta ?? value;
      },
    },
    props: {
      decorations(state) {
        const value = FIND_HIGHLIGHT_KEY.getState(state);
        if (!value || value.matches.length === 0) return null;
        return DecorationSet.create(
          state.doc,
          value.matches.map((match, index) =>
            Decoration.inline(match.from, match.to, {
              class: index === value.current ? 'bb-office-find-current' : 'bb-office-find-match',
            })
          )
        );
      },
    },
  });
}

function sameMatches(a: SearchMatch[], b: SearchMatch[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((match, i) => match.from === b[i]!.from && match.to === b[i]!.to);
}

/** Props for {@link FindReplace}. */
export interface FindReplaceProps {
  editor: BeakBlockEditor | null;
  /** Initial value for the find box. */
  initialQuery?: string;
  /** Called when the user closes the bar (close button or Escape). */
  onClose?: () => void;
  className?: string;
}

/** Find and replace bar for the editor. */
export function FindReplace({ editor, initialQuery = '', onClose, className }: FindReplaceProps): React.ReactElement {
  const tick = useEditorTick(editor);
  const baseId = useId();
  const findRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [replacement, setReplacement] = useState('');
  const [options, setOptions] = useState<SearchOptions>({ matchCase: false, wholeWord: false, regex: false });
  const [current, setCurrent] = useState(-1);
  const [status, setStatus] = useState('');

  useEffect(() => {
    findRef.current?.focus();
    findRef.current?.select();
  }, []);

  // Install the highlight plugin for the lifetime of the bar.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.pm.addPlugin(createFindHighlightPlugin());
    return () => {
      if (!editor.isDestroyed) editor.pm.removePlugin(FIND_HIGHLIGHT_KEY);
    };
  }, [editor]);

  const error = getRegexError(query, options);
  const matches = useMemo<SearchMatch[]>(() => {
    if (!editor || editor.isDestroyed || error) return [];
    return findMatches(editor.pm.state.doc, query, options);
    // tick changes on every transaction, so matches follow document edits.
  }, [editor, query, options.matchCase, options.wholeWord, options.regex, error, tick]);

  const index = matches.length === 0 ? -1 : current >= 0 && current < matches.length ? current : -1;

  // Keep the highlight plugin in sync with the matches.
  // Only dispatch when the highlight actually changed. Dispatching bumps the editor tick, which
  // recomputes matches, so an unconditional dispatch would loop.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const existing = FIND_HIGHLIGHT_KEY.getState(editor.pm.state);
    if (existing && existing.current === index && sameMatches(existing.matches, matches)) return;
    const tr = editor.pm.createTransaction();
    tr.setMeta(FIND_HIGHLIGHT_KEY, { matches, current: index } satisfies FindHighlightState);
    editor.pm.dispatch(tr);
  }, [editor, matches, index]);

  const toggle = (key: keyof SearchOptions) => setOptions((value) => ({ ...value, [key]: !value[key] }));

  const goTo = (position: number) => {
    if (!editor || editor.isDestroyed || matches.length === 0) return;
    const match = matches[position];
    if (!match) return;
    setCurrent(position);
    selectRange(editor, match.from, match.to, false);
    setStatus(`${position + 1} of ${matches.length}`);
  };

  const findNext = (direction: 1 | -1) => {
    if (matches.length === 0) return;
    if (index < 0) {
      const caret = editor && !editor.isDestroyed ? editor.pm.state.selection.from : 0;
      const after = matches.findIndex((match) => match.from >= caret);
      const first = direction === 1 ? (after >= 0 ? after : 0) : Math.max(0, (after >= 0 ? after : matches.length) - 1);
      goTo(first);
      return;
    }
    goTo((index + direction + matches.length) % matches.length);
  };

  const replaceCurrent = () => {
    if (!editor || editor.isDestroyed || index < 0) return;
    const match = matches[index];
    if (!match) return;
    const text = expandReplacement(match.text, replacement, query, options);
    const tr = editor.pm.createTransaction();
    tr.insertText(text, match.from, match.to);
    editor.pm.dispatch(tr);
    setStatus('Replaced 1 occurrence');
    setCurrent(index);
  };

  const replaceAll = () => {
    if (!editor || editor.isDestroyed || matches.length === 0) return;
    const tr: Transaction = editor.pm.createTransaction();
    // Reverse order keeps earlier positions valid while later ones are replaced.
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i]!;
      tr.insertText(expandReplacement(match.text, replacement, query, options), match.from, match.to);
    }
    editor.pm.dispatch(tr);
    setCurrent(-1);
    setStatus(`Replaced ${matches.length} occurrence${matches.length === 1 ? '' : 's'}`);
  };

  const onFindKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      findNext(event.shiftKey ? -1 : 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose?.();
      editor?.pm.view.focus();
    }
  };

  const countText = error
    ? error
    : !query
      ? ''
      : matches.length === 0
        ? 'No results'
        : index >= 0
          ? `${index + 1} of ${matches.length}`
          : `${matches.length} match${matches.length === 1 ? '' : 'es'}`;

  return (
    <div className={joinClass('bb-office-find', className)} role="search" aria-label="Find and replace">
      <div className="bb-office-find-row">
        <label className="bb-office-find-label" htmlFor={`${baseId}-find`}>
          Find
        </label>
        <input
          id={`${baseId}-find`}
          ref={findRef}
          type="search"
          className={joinClass('bb-office-find-input', error && 'is-invalid')}
          value={query}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${baseId}-count`}
          onChange={(event) => {
            setQuery(event.target.value);
            setCurrent(-1);
          }}
          onKeyDown={onFindKeyDown}
        />
        <span id={`${baseId}-count`} className={joinClass('bb-office-find-count', error && 'is-error')} aria-live="polite">
          {countText}
        </span>
        <button type="button" className="bb-office-find-button" disabled={matches.length === 0} onClick={() => findNext(-1)} title="Previous match (Shift+Enter)">
          Previous
        </button>
        <button type="button" className="bb-office-find-button" disabled={matches.length === 0} onClick={() => findNext(1)} title="Next match (Enter)">
          Next
        </button>
        <div className="bb-office-find-options" role="group" aria-label="Search options">
          <button type="button" className="bb-office-find-toggle" aria-label="Match case" aria-pressed={!!options.matchCase} title="Match case" onClick={() => toggle('matchCase')}>
            Aa
          </button>
          <button type="button" className="bb-office-find-toggle" aria-label="Whole words" aria-pressed={!!options.wholeWord} title="Whole words" onClick={() => toggle('wholeWord')}>
            Whole
          </button>
          <button type="button" className="bb-office-find-toggle" aria-label="Regular expressions" aria-pressed={!!options.regex} title="Use regular expressions" onClick={() => toggle('regex')}>
            .*
          </button>
        </div>
        {onClose && (
          <button type="button" className="bb-office-find-close" aria-label="Close find and replace" onClick={onClose}>
            &times;
          </button>
        )}
      </div>
      <div className="bb-office-find-row">
        <label className="bb-office-find-label" htmlFor={`${baseId}-replace`}>
          Replace
        </label>
        <input
          id={`${baseId}-replace`}
          type="text"
          className="bb-office-find-input"
          value={replacement}
          onChange={(event) => setReplacement(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              replaceCurrent();
            }
          }}
        />
        <button type="button" className="bb-office-find-button" disabled={index < 0} onClick={replaceCurrent}>
          Replace
        </button>
        <button type="button" className="bb-office-find-button" disabled={matches.length === 0} onClick={replaceAll}>
          Replace all
        </button>
      </div>
      <div className="bb-office-sr-only" role="status" aria-live="polite">
        {status}
      </div>
    </div>
  );
}
