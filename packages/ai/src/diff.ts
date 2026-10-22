/**
 * Word-granular diff for proposals. Text is split into tokens (words, whitespace runs and single
 * punctuation marks), the token sequences are compared, and each changed run is reported as a
 * character range of the old text that holds whole tokens. A proposal therefore never splits a
 * word such as "procedure" into "proced" and "ure".
 *
 * @module
 */

/** One replacement: `old.slice(start, end)` becomes `text`. Offsets are into the old text. */
export interface TextChange {
  start: number;
  end: number;
  text: string;
}

interface Token {
  value: string;
  start: number;
  end: number;
}

/** Above this many token pairs the diff is not computed and the whole text is replaced. */
const MAX_TOKEN_PAIRS = 1_000_000;

const TOKEN_PATTERN = /\s+|[\p{L}\p{N}_']+|[^\s\p{L}\p{N}_']/gu;

/** Splits text into word, whitespace and punctuation tokens with their offsets. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const start = match.index ?? 0;
    tokens.push({ value: match[0], start, end: start + match[0].length });
  }
  return tokens;
}

/** Longest common subsequence length table over two token lists. */
function lcsTable(a: readonly Token[], b: readonly Token[]): Uint32Array {
  const cols = b.length + 1;
  const table = new Uint32Array((a.length + 1) * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const idx = i * cols + j;
      table[idx] =
        a[i]!.value === b[j]!.value
          ? table[(i + 1) * cols + j + 1]! + 1
          : Math.max(table[(i + 1) * cols + j]!, table[i * cols + j + 1]!);
    }
  }
  return table;
}

/**
 * Word-level changes that turn `oldText` into `newText`. Adjacent changed tokens form one change.
 * Returns an empty list when the texts are equal.
 *
 * @example
 * ```typescript
 * wordDiff('The procedure is long.', 'The procedure is short.');
 * // [{ start: 19, end: 23, text: 'short' }]
 * ```
 */
export function wordDiff(oldText: string, newText: string): TextChange[] {
  if (oldText === newText) return [];
  const a = tokenize(oldText);
  const b = tokenize(newText);
  if (a.length * b.length > MAX_TOKEN_PAIRS) {
    return [{ start: 0, end: oldText.length, text: newText }];
  }

  const cols = b.length + 1;
  const table = lcsTable(a, b);
  const changes: TextChange[] = [];
  let i = 0;
  let j = 0;
  // Open change: old range and new range that have not been emitted yet.
  let open: { oldStart: number; oldEnd: number; newStart: number; newEnd: number } | null = null;
  const flush = () => {
    if (!open) return;
    changes.push({
      start: open.oldStart,
      end: open.oldEnd,
      text: newText.slice(open.newStart, open.newEnd),
    });
    open = null;
  };
  const oldOffset = (index: number) => (index < a.length ? a[index]!.start : oldText.length);
  const newOffset = (index: number) => (index < b.length ? b[index]!.start : newText.length);

  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i]!.value === b[j]!.value) {
      flush();
      i++;
      j++;
    } else if (j < b.length && (i === a.length || table[i * cols + j + 1]! >= table[(i + 1) * cols + j]!)) {
      // Token only in the new text.
      if (!open) open = { oldStart: oldOffset(i), oldEnd: oldOffset(i), newStart: newOffset(j), newEnd: newOffset(j) };
      j++;
      open.newEnd = newOffset(j);
    } else {
      // Token only in the old text.
      if (!open) open = { oldStart: oldOffset(i), oldEnd: oldOffset(i), newStart: newOffset(j), newEnd: newOffset(j) };
      i++;
      open.oldEnd = oldOffset(i);
    }
  }
  flush();
  return changes;
}
