import { describe, expect, it } from 'vitest';
import { tokenize, wordDiff, type TextChange } from './diff';

/** Applies changes (sorted by start) to the old text. */
function apply(oldText: string, changes: TextChange[]): string {
  let out = '';
  let cursor = 0;
  for (const change of changes) {
    out += oldText.slice(cursor, change.start) + change.text;
    cursor = change.end;
  }
  return out + oldText.slice(cursor);
}

/** Every change must start and end on a token boundary of the old text. */
function boundaries(text: string): Set<number> {
  const set = new Set<number>([0, text.length]);
  for (const token of tokenize(text)) {
    set.add(token.start);
    set.add(token.end);
  }
  return set;
}

describe('wordDiff', () => {
  it('returns no changes for equal text', () => {
    expect(wordDiff('same text', 'same text')).toEqual([]);
  });

  it('replaces a whole word, never a fragment of one', () => {
    const oldText = 'The procedure is long.';
    const newText = 'The protocol is long.';
    const changes = wordDiff(oldText, newText);
    expect(changes).toEqual([{ start: 4, end: 13, text: 'protocol' }]);
    expect(oldText.slice(changes[0]!.start, changes[0]!.end)).toBe('procedure');
  });

  it('keeps unchanged words out of the change', () => {
    const oldText = 'Fix the smear in methanol for three minutes.';
    const newText = 'Fix the smear in ethanol for five minutes.';
    const changes = wordDiff(oldText, newText);
    expect(changes.map((c) => oldText.slice(c.start, c.end))).toEqual(['methanol', 'three']);
    expect(changes.map((c) => c.text)).toEqual(['ethanol', 'five']);
  });

  it('reports pure insertions and deletions as zero-width or empty replacements', () => {
    const insertion = wordDiff('Stain the smear.', 'Stain the fixed smear.');
    expect(insertion).toEqual([{ start: 10, end: 10, text: 'fixed ' }]);
    const deletion = wordDiff('Stain the fixed smear.', 'Stain the smear.');
    expect(deletion).toEqual([{ start: 10, end: 16, text: '' }]);
  });

  it('applies back to the new text, with changes on token boundaries', () => {
    const cases: Array<[string, string]> = [
      ['Dry the smear fully before fixing.', 'Air-dry the slide completely before fixing it.'],
      ['Record the lot number.', 'Record the stain lot number and date.'],
      ['', 'Entirely new text.'],
      ['Remove everything.', ''],
      ['Crystal violet, 2 mL; iodine, 1 mL.', 'Crystal violet, 3 mL; iodine.'],
    ];
    for (const [oldText, newText] of cases) {
      const changes = wordDiff(oldText, newText);
      expect(apply(oldText, changes)).toBe(newText);
      const allowed = boundaries(oldText);
      for (const change of changes) {
        expect(allowed.has(change.start)).toBe(true);
        expect(allowed.has(change.end)).toBe(true);
      }
    }
  });

  it('falls back to one whole replacement for very large inputs', () => {
    const oldText = Array.from({ length: 3000 }, (_, i) => `w${i}`).join(' ');
    const newText = Array.from({ length: 3000 }, (_, i) => `x${i}`).join(' ');
    expect(wordDiff(oldText, newText)).toEqual([{ start: 0, end: oldText.length, text: newText }]);
  });
});
