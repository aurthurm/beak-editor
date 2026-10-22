import { describe, expect, it } from 'vitest';

import { cloneJson } from './cloneJson';

describe('cloneJson', () => {
  it('deep-clones plain data', () => {
    const input = { a: [{ b: 1 }] };
    const copy = cloneJson(input);
    expect(copy).toEqual(input);
    expect(copy.a[0]).not.toBe(input.a[0]);
  });

  it('falls back to a JSON round-trip for values structuredClone rejects', () => {
    const target = { id: 'x', tags: ['a'] };
    const proxied = new Proxy(target, {});
    expect(() => structuredClone(proxied)).toThrow();
    const copy = cloneJson(proxied);
    expect(copy).toEqual({ id: 'x', tags: ['a'] });
    expect(copy).not.toBe(target);
  });

  it('passes undefined through', () => {
    expect(cloneJson(undefined)).toBeUndefined();
  });
});
