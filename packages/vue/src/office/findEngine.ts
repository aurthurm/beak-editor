/**
 * Pure find engine for the Office find and replace panel.
 *
 * Matches are searched inside each textblock. Inline leaf nodes (fields, images) count as one
 * placeholder character so a match never silently spans them. Positions are ProseMirror
 * document positions, so results can be used directly for selections and replacements.
 *
 * @module
 */

import type { Node as PMNode, Transaction } from '@amusendame/beakblock-core';
import { Decoration, DecorationSet, Plugin, PluginKey, TextSelection } from '@amusendame/beakblock-core';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';

/** Options for {@link findMatches}. */
export interface FindOptions {
  /** Case sensitive matching. Default false. */
  matchCase?: boolean;
  /** Only match whole words. Default false. */
  wholeWord?: boolean;
  /** Treat the query as a JavaScript regular expression. Default false. */
  regex?: boolean;
}

/** A single match in the document. */
export interface FindMatch {
  /** Start document position (inclusive). */
  from: number;
  /** End document position (exclusive). */
  to: number;
  /** Matched text. */
  text: string;
  /** Capture groups (regex mode), used by `$1` style replacements. */
  groups: string[];
}

/** Result of compiling a query. `error` is set when a regex is invalid. */
export interface FindPattern {
  regex: RegExp | null;
  error: string | null;
}

/** Placeholder used for inline leaf nodes in the searchable text. */
const LEAF_PLACEHOLDER = '￼';

const WORD_CHARS = '\\p{L}\\p{N}_';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile a query into a global RegExp. Returns `{ regex: null, error }` for an invalid regex
 * and `{ regex: null, error: null }` for an empty query.
 */
export function compileFindPattern(query: string, options: FindOptions = {}): FindPattern {
  if (!query) return { regex: null, error: null };
  let source = options.regex ? query : escapeRegExp(query);
  if (options.wholeWord) {
    source = `(?<![${WORD_CHARS}])(?:${source})(?![${WORD_CHARS}])`;
  }
  const flags = options.matchCase ? 'gu' : 'giu';
  try {
    return { regex: new RegExp(source, flags), error: null };
  } catch (err) {
    return { regex: null, error: err instanceof Error ? err.message : 'Invalid regular expression' };
  }
}

/** Searchable text of one textblock, with a document position for every character. */
function indexTextblock(node: PMNode, pos: number): { text: string; positions: number[] } {
  let text = '';
  const positions: number[] = [];
  node.forEach((child, offset) => {
    const start = pos + 1 + offset;
    if (child.isText) {
      const value = child.text ?? '';
      for (let i = 0; i < value.length; i++) {
        text += value[i];
        positions.push(start + i);
      }
    } else {
      text += LEAF_PLACEHOLDER;
      positions.push(start);
    }
  });
  return { text, positions };
}

/**
 * Find every match of `query` in `doc`. An empty or invalid query returns no matches.
 *
 * @example
 * ```typescript
 * const matches = findMatches(editor.pm.state.doc, 'hello', { matchCase: false, wholeWord: true });
 * ```
 */
export function findMatches(doc: PMNode, query: string, options: FindOptions = {}): FindMatch[] {
  const { regex } = compileFindPattern(query, options);
  if (!regex) return [];

  const matches: FindMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const { text, positions } = indexTextblock(node, pos);
    regex.lastIndex = 0;
    let found: RegExpExecArray | null;
    while ((found = regex.exec(text)) !== null) {
      const matched = found[0];
      if (matched.length === 0) {
        regex.lastIndex++;
        continue;
      }
      const startIndex = found.index;
      const endIndex = startIndex + matched.length - 1;
      const from = positions[startIndex];
      const last = positions[endIndex];
      if (from === undefined || last === undefined) continue;
      matches.push({
        from,
        to: last + 1,
        text: matched,
        groups: found.slice(1).map((g) => g ?? ''),
      });
    }
    return false;
  });
  return matches;
}

/**
 * Expand a replacement template. In plain mode the template is returned unchanged. In regex
 * mode `$&` and `$0` insert the match, `$1`..`$99` insert capture groups, and `$$` inserts `$`.
 */
export function expandReplacement(template: string, match: Pick<FindMatch, 'text' | 'groups'>, regex: boolean): string {
  if (!regex) return template;
  return template.replace(/\$(\$|&|0|\d{1,2})/g, (token, key: string) => {
    if (key === '$') return '$';
    if (key === '&' || key === '0') return match.text;
    const index = Number(key) - 1;
    return index >= 0 && index < match.groups.length ? match.groups[index] ?? '' : token;
  });
}

/** Plugin state for the find highlight decorations. */
export interface FindHighlightState {
  matches: FindMatch[];
  current: number;
}

/** Meta payload understood by the find highlight plugin. */
export interface FindHighlightMeta {
  matches: FindMatch[];
  current: number;
}

/** Plugin key for the find highlight plugin. */
export const FIND_HIGHLIGHT_KEY = new PluginKey<FindHighlightState>('beakblockOfficeFindHighlight');

/**
 * Plugin that draws every match as an inline decoration and marks the current one.
 * Set state with `tr.setMeta(FIND_HIGHLIGHT_KEY, { matches, current })`. Matches are mapped
 * through document changes until the caller refreshes them.
 */
export function createFindHighlightPlugin(): Plugin {
  return new Plugin<FindHighlightState>({
    key: FIND_HIGHLIGHT_KEY,
    state: {
      init: () => ({ matches: [], current: -1 }),
      apply(tr: Transaction, value: FindHighlightState): FindHighlightState {
        const meta = tr.getMeta(FIND_HIGHLIGHT_KEY) as FindHighlightMeta | undefined;
        if (meta) return { matches: meta.matches, current: meta.current };
        if (!tr.docChanged || value.matches.length === 0) return value;
        return {
          matches: value.matches.map((m) => ({
            ...m,
            from: tr.mapping.map(m.from),
            to: tr.mapping.map(m.to),
          })),
          current: value.current,
        };
      },
    },
    props: {
      decorations(state) {
        const value = FIND_HIGHLIGHT_KEY.getState(state);
        if (!value || value.matches.length === 0) return null;
        return DecorationSet.create(
          state.doc,
          value.matches.map((m, index) =>
            Decoration.inline(m.from, m.to, {
              class: index === value.current ? 'bb-office-find-match bb-office-find-current' : 'bb-office-find-match',
            })
          )
        );
      },
    },
  });
}

/**
 * Replace several matches in one transaction, so the whole change is a single undo step.
 * Matches must come from the current document. Returns the number of replacements.
 */
export function replaceMatches(
  editor: BeakBlockEditor,
  matches: FindMatch[],
  replacement: string,
  options: FindOptions = {}
): number {
  if (matches.length === 0) return 0;
  const tr = editor.pm.state.tr;
  const ordered = [...matches].sort((a, b) => b.from - a.from);
  for (const match of ordered) {
    const text = expandReplacement(replacement, match, Boolean(options.regex));
    if (text === '') {
      tr.delete(match.from, match.to);
    } else {
      tr.insertText(text, match.from, match.to);
    }
  }
  editor.pm.dispatch(tr);
  return matches.length;
}

/**
 * Select a match and scroll it into view. Returns false when the match is out of range.
 */
export function selectMatch(editor: BeakBlockEditor, match: FindMatch): boolean {
  const { doc } = editor.pm.state;
  if (match.from < 0 || match.to > doc.content.size || match.from >= match.to) return false;
  const tr = editor.pm.state.tr.setSelection(TextSelection.create(doc, match.from, match.to)).scrollIntoView();
  editor.pm.dispatch(tr);
  return true;
}
