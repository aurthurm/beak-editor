/**
 * Pure find engine for the Office shell.
 *
 * Works on any document-like object that exposes `descendants`, so it can run against a
 * ProseMirror node in the editor and against plain fixtures in unit tests.
 * Matches never span two text runs (for example two paragraphs).
 *
 * @module
 */

/** Options controlling how a query is matched. */
export interface SearchOptions {
  /** Case-sensitive matching. Default false. */
  matchCase?: boolean;
  /** Only match whole words (letters, digits and underscore are word characters). */
  wholeWord?: boolean;
  /** Treat the query as a JavaScript regular expression (Unicode mode). */
  regex?: boolean;
}

/** A match in document positions. `to` is exclusive. */
export interface SearchMatch {
  from: number;
  to: number;
  /** The matched text. */
  text: string;
}

/** The subset of a node the engine reads. ProseMirror nodes satisfy this structurally. */
export interface SearchableNode {
  isText: boolean;
  text?: string | null;
  nodeSize?: number;
}

/** A document-like tree the engine can walk. */
export interface SearchableDoc {
  descendants(callback: (node: SearchableNode, pos: number) => boolean | void): void;
}

/** A contiguous run of text in the document. */
export interface TextRun {
  text: string;
  /** Segments map a text index to a document position. */
  segments: { textStart: number; docPos: number }[];
}

const WORD_CHAR = '[\\p{L}\\p{N}_]';

/** Escape a string so it can be embedded literally in a RegExp source. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build the RegExp for a query, or null when the query is empty or is an invalid regex.
 * The returned expression always has the `g` and `u` flags.
 */
export function buildSearchRegExp(query: string, options: SearchOptions = {}): RegExp | null {
  if (!query) return null;
  let source = options.regex ? query : escapeRegExp(query);
  if (options.wholeWord) {
    source = `(?<!${WORD_CHAR})(?:${source})(?!${WORD_CHAR})`;
  }
  const flags = options.matchCase ? 'gu' : 'giu';
  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

/** Returns an error message when the query is an invalid regex, otherwise null. */
export function getRegexError(query: string, options: SearchOptions = {}): string | null {
  if (!options.regex || !query) return null;
  try {
    new RegExp(query, 'u');
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid regular expression';
  }
}

/** Collect the text runs of a document, in document order. */
export function collectTextRuns(doc: SearchableDoc): TextRun[] {
  const runs: TextRun[] = [];
  let current: TextRun | null = null;
  let runEnd = -1;
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    if (!current || pos !== runEnd) {
      current = { text: '', segments: [] };
      runs.push(current);
    }
    current.segments.push({ textStart: current.text.length, docPos: pos });
    current.text += node.text;
    runEnd = pos + node.text.length;
  });
  return runs;
}

/** Map a text index inside a run to a document position. `index` may equal the run length. */
function positionAt(run: TextRun, index: number): number {
  let segment = run.segments[0];
  for (const candidate of run.segments) {
    if (candidate.textStart <= index) segment = candidate;
    else break;
  }
  return segment ? segment.docPos + (index - segment.textStart) : 0;
}

/**
 * Find every match of `query` in the document. Returns an empty array for an empty
 * query or an invalid regex. Zero-length matches are skipped.
 */
export function findMatches(doc: SearchableDoc, query: string, options: SearchOptions = {}): SearchMatch[] {
  const pattern = buildSearchRegExp(query, options);
  if (!pattern) return [];
  const matches: SearchMatch[] = [];
  for (const run of collectTextRuns(doc)) {
    pattern.lastIndex = 0;
    let found: RegExpExecArray | null;
    while ((found = pattern.exec(run.text)) !== null) {
      const matched = found[0];
      if (matched.length === 0) {
        pattern.lastIndex += 1;
        continue;
      }
      matches.push({
        from: positionAt(run, found.index),
        to: positionAt(run, found.index + matched.length),
        text: matched,
      });
    }
  }
  return matches;
}

/**
 * Compute the replacement text for one match. Literal for plain queries; `$1`, `$&` and
 * friends are expanded for regex queries.
 */
export function expandReplacement(
  matchText: string,
  replacement: string,
  query: string,
  options: SearchOptions = {}
): string {
  if (!options.regex) return replacement;
  const pattern = buildSearchRegExp(query, options);
  if (!pattern) return replacement;
  const single = new RegExp(pattern.source, options.matchCase ? 'u' : 'iu');
  return matchText.replace(single, replacement);
}
