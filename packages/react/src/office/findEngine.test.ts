import { describe, it, expect } from 'vitest';
import { findMatches, expandReplacement, getRegexError } from './findEngine';

// Fixture: two paragraphs. Text of p1 starts at position 1; text of p2 starts at position 20.
const doc = {
  descendants(cb: (n: { isText: boolean; text?: string }, pos: number) => boolean | void) {
    cb({ isText: false }, 0);
    cb({ isText: true, text: 'Hello world hello' }, 1);
    cb({ isText: false }, 18);
    cb({ isText: false }, 19);
    cb({ isText: true, text: 'helloworld' }, 20);
  },
};

describe('findMatches', () => {
  it('finds case-insensitive matches with document positions', () => {
    const matches = findMatches(doc, 'hello');
    expect(matches.map((m) => [m.from, m.to])).toEqual([
      [1, 6],
      [13, 18],
      [20, 25],
    ]);
  });

  it('respects match case', () => {
    expect(findMatches(doc, 'Hello', { matchCase: true })).toHaveLength(1);
  });

  it('whole word excludes substrings', () => {
    const matches = findMatches(doc, 'hello', { wholeWord: true });
    expect(matches.map((m) => m.from)).toEqual([1, 13]);
  });

  it('supports regex and reports invalid regex as no matches', () => {
    expect(findMatches(doc, 'h\\w+o', { regex: true })).toHaveLength(3);
    expect(findMatches(doc, '(', { regex: true })).toEqual([]);
    expect(getRegexError('(', { regex: true })).not.toBeNull();
    expect(getRegexError('(', {})).toBeNull();
  });

  it('returns nothing for an empty query', () => {
    expect(findMatches(doc, '')).toEqual([]);
  });

  it('expands regex replacement groups only in regex mode', () => {
    expect(expandReplacement('abc', '[$&]', 'a(b)c', { regex: true })).toBe('[abc]');
    expect(expandReplacement('abc', 'X', 'abc', {})).toBe('X');
  });
});
