/**
 * Deep-clones JSON-like data (blocks, styles, document fragments).
 *
 * `structuredClone` throws `DataCloneError` for values it cannot copy, such as
 * Vue reactive proxies or objects holding functions. Those fall back to a JSON
 * round-trip, which is safe for block data because blocks are JSON by contract.
 *
 * @example
 * ```typescript
 * const copy = cloneJson(reactiveBlocks);
 * ```
 */
export function cloneJson<T>(value: T): T {
  if (value === undefined) return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
