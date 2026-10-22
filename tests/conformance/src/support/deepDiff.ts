/**
 * Path-level deep diff for JSON-like values. Used to report exactly where a round trip lost or
 * changed data, instead of dumping two large objects into an assertion message.
 *
 * @module
 */

export interface DiffEntry {
  path: string;
  kind: 'missing' | 'extra' | 'changed' | 'type';
  expected?: unknown;
  actual?: unknown;
}

const MAX_VALUE_LENGTH = 160;

function preview(value: unknown): string {
  if (value === undefined) return 'undefined';
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    text = String(value);
  }
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}...` : text;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns every difference between `expected` and `actual`. An object key whose value is
 * `undefined` counts as absent. Arrays are compared index by index and report length changes.
 */
function hasId(value: unknown): value is { id: string } {
  return isPlainObject(value) && typeof value.id === 'string';
}

export function deepDiff(expected: unknown, actual: unknown, path = '$', out: DiffEntry[] = []): DiffEntry[] {
  if (Array.isArray(expected) && Array.isArray(actual) && expected.every(hasId) && actual.every(hasId)) {
    // Align blocks by id so one removed block does not shift every later index into a difference.
    const actualById = new Map(actual.map((item) => [item.id, item]));
    const expectedIds = new Set(expected.map((item) => item.id));
    for (const item of expected) {
      const childPath = `${path}[id=${item.id}]`;
      const match = actualById.get(item.id);
      if (!match) out.push({ path: childPath, kind: 'missing', expected: item });
      else deepDiff(item, match, childPath, out);
    }
    for (const item of actual) {
      if (!expectedIds.has(item.id)) out.push({ path: `${path}[id=${item.id}]`, kind: 'extra', actual: item });
    }
    const commonExpected = expected.map((item) => item.id).filter((id) => actualById.has(id));
    const commonActual = actual.map((item) => item.id).filter((id) => expectedIds.has(id));
    if (commonExpected.join('\u0000') !== commonActual.join('\u0000')) {
      out.push({ path: `${path}.order`, kind: 'changed', expected: commonExpected, actual: commonActual });
    }
    return out;
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const length = Math.max(expected.length, actual.length);
    for (let i = 0; i < length; i += 1) {
      const childPath = `${path}[${i}]`;
      if (i >= expected.length) out.push({ path: childPath, kind: 'extra', actual: actual[i] });
      else if (i >= actual.length) out.push({ path: childPath, kind: 'missing', expected: expected[i] });
      else deepDiff(expected[i], actual[i], childPath, out);
    }
    return out;
  }
  if (isPlainObject(expected) && isPlainObject(actual)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    for (const key of keys) {
      const childPath = `${path}.${key}`;
      const e = expected[key];
      const a = actual[key];
      if (e === undefined && a === undefined) continue;
      if (e === undefined) out.push({ path: childPath, kind: 'extra', actual: a });
      else if (a === undefined) out.push({ path: childPath, kind: 'missing', expected: e });
      else deepDiff(e, a, childPath, out);
    }
    return out;
  }
  if (Array.isArray(expected) !== Array.isArray(actual) || isPlainObject(expected) !== isPlainObject(actual)) {
    out.push({ path, kind: 'type', expected, actual });
    return out;
  }
  if (!Object.is(expected, actual)) out.push({ path, kind: 'changed', expected, actual });
  return out;
}

/** Formats a diff as one line per difference, for assertion messages and reports. */
export function formatDiff(entries: DiffEntry[], limit = 25): string {
  const lines = entries.slice(0, limit).map((entry) => {
    switch (entry.kind) {
      case 'missing':
        return `- ${entry.path} missing (expected ${preview(entry.expected)})`;
      case 'extra':
        return `+ ${entry.path} unexpected (${preview(entry.actual)})`;
      case 'type':
        return `~ ${entry.path} type ${preview(entry.expected)} -> ${preview(entry.actual)}`;
      default:
        return `~ ${entry.path} ${preview(entry.expected)} -> ${preview(entry.actual)}`;
    }
  });
  if (entries.length > limit) lines.push(`... and ${entries.length - limit} more`);
  return lines.join('\n');
}
