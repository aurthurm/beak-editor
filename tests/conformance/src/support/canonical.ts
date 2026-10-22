/**
 * Documented normalisation for round-trip comparisons.
 *
 * The IR and the schema treat an empty `content` or `children` array as absent. That is a
 * representation choice, not data loss, so comparisons drop empty arrays on both sides. Nothing
 * else is normalised: every other difference is reported as a real loss.
 *
 * @module
 */

export function canonicalBlocks<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => canonicalBlocks(item)) as unknown as T;
  if (typeof value !== 'object' || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((key === 'content' || key === 'children') && Array.isArray(child) && child.length === 0) continue;
    out[key] = canonicalBlocks(child);
  }
  return out as T;
}

/**
 * Normalisation for editor round trips (`setDocument` -> `getDocument`). Applies
 * `canonicalBlocks` and then these documented equivalences:
 *
 * - `null` and `''` attribute values are the schema defaults and equal an absent attribute.
 * - `textAlign: 'left'` is the default alignment.
 * - `styles.revision.aiGenerated: false` equals an absent flag.
 * - `tableOfContents.items` is derived from the headings on load, so it is ignored.
 * - Table cell `colwidth` has exactly one entry per column (`colspan`). Shorter arrays are padded
 *   with their last value, which is how prosemirror-tables stores them.
 */
export function canonicalEditorBlocks<T>(value: T): T {
  return canonicalEditorNode(canonicalBlocks(value)) as T;
}

function canonicalEditorNode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalEditorNode(item));
  if (typeof value !== 'object' || value === null) return value;
  const node = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(node)) {
    if (key === 'props' && typeof child === 'object' && child !== null) {
      const props: Record<string, unknown> = {};
      for (const [pKey, pValue] of Object.entries(child as Record<string, unknown>)) {
        if (pValue === null || pValue === '') continue;
        if (pKey === 'textAlign' && pValue === 'left') continue;
        if (node.type === 'tableOfContents' && pKey === 'items') continue;
        props[pKey] = pValue;
      }
      if (Array.isArray(props.colwidth) && typeof node.type === 'string') {
        const colspan = typeof props.colspan === 'number' ? props.colspan : 1;
        const widths = [...(props.colwidth as number[])];
        while (widths.length < colspan) widths.push(widths[widths.length - 1]);
        props.colwidth = widths.slice(0, colspan);
      }
      out[key] = canonicalEditorNode(props);
      continue;
    }
    if (key === 'styles' && typeof child === 'object' && child !== null && 'revision' in (child as object)) {
      const styles = { ...(child as Record<string, unknown>) };
      const revision = { ...(styles.revision as Record<string, unknown>) };
      if (revision.aiGenerated === false) delete revision.aiGenerated;
      styles.revision = revision;
      out[key] = canonicalEditorNode(styles);
      continue;
    }
    out[key] = canonicalEditorNode(child);
  }
  return out;
}
