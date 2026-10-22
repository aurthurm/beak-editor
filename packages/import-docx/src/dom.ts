/**
 * Namespace-aware DOM helpers for OOXML parts.
 *
 * Elements are matched by local name (OOXML prefixes are conventional but not
 * mandated). Attributes are read namespace-first with a local-name fallback.
 *
 * @module
 */

/** WordprocessingML main namespace. */
export const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
/** Relationships namespace (`r:id`, `r:embed`). */
export const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
/** DrawingML main namespace. */
export const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
/** Office package relationships namespace. */
export const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** Minimal shape of a `DOMParser` (browser or injected). */
export interface DomParserLike {
  parseFromString(source: string, mimeType: 'text/xml'): Document;
}

/** Parses XML text. Returns `null` when the document is not well-formed. */
export function parseXml(xml: string, parser: DomParserLike): Document | null {
  const doc = parser.parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return null;
  if (doc.getElementsByTagNameNS('*', 'parsererror').length > 0) return null;
  return doc;
}

/** Element children of `el` (empty when `el` is null). */
export function kids(el: Element | null | undefined): Element[] {
  return el ? Array.from(el.children) : [];
}

/** First child element with the given local name. */
export function child(el: Element | null | undefined, local: string): Element | null {
  if (!el) return null;
  for (const c of Array.from(el.children)) {
    if (c.localName === local) return c;
  }
  return null;
}

/** All child elements with the given local name. */
export function childrenNamed(el: Element | null | undefined, local: string): Element[] {
  return kids(el).filter((c) => c.localName === local);
}

/** Reads a WordprocessingML attribute (`w:val` is `wAttr(el, 'val')`). */
export function wAttr(el: Element, name: string): string | null {
  const ns = el.getAttributeNS(W_NS, name);
  if (ns !== null) return ns;
  for (const a of Array.from(el.attributes)) {
    if (a.localName === name) return a.value;
  }
  return null;
}

/** Reads a relationships attribute such as `r:id`. */
export function rAttr(el: Element, name: string): string | null {
  const ns = el.getAttributeNS(R_NS, name);
  if (ns !== null) return ns;
  for (const a of Array.from(el.attributes)) {
    if (a.localName === name && a.prefix === 'r') return a.value;
  }
  return null;
}

/** Reads any attribute by local name (namespace ignored). */
export function anyAttr(el: Element, name: string): string | null {
  for (const a of Array.from(el.attributes)) {
    if (a.localName === name) return a.value;
  }
  return null;
}

/** Reads a numeric WordprocessingML attribute, or `undefined` when absent or not a number. */
export function wNum(el: Element | null | undefined, name: string): number | undefined {
  if (!el) return undefined;
  const raw = wAttr(el, name);
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Reads an on/off toggle element (`<w:b/>`, `<w:b w:val="0"/>`). Returns `undefined` when absent. */
export function onOff(el: Element | null | undefined): boolean | undefined {
  if (!el) return undefined;
  const val = wAttr(el, 'val');
  if (val === null) return true;
  return !['0', 'false', 'off', 'none'].includes(val.toLowerCase());
}

/** Plain text of an element with whitespace collapsed. */
export function textOf(el: Element | null | undefined): string {
  if (!el) return '';
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Escapes text for XML element content. */
export function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeXml(text).replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;');
}

/**
 * Serializes an element to XML. Namespace declarations in scope from ancestors
 * are added to the root of the fragment, so the result is self-contained.
 */
export function serializeElement(el: Element): string {
  const scope = new Map<string, string>();
  const ancestors: Element[] = [];
  let parent = el.parentElement;
  while (parent) {
    ancestors.unshift(parent);
    parent = parent.parentElement;
  }
  for (const anc of ancestors) {
    for (const a of Array.from(anc.attributes)) {
      if (a.name === 'xmlns' || a.name.startsWith('xmlns:')) scope.set(a.name, a.value);
    }
  }
  return serializeNode(el, scope, true);
}

function serializeNode(node: Node, scope: Map<string, string>, root: boolean): string {
  if (node.nodeType === 3) return escapeXml(node.nodeValue ?? '');
  if (node.nodeType === 4) return `<![CDATA[${node.nodeValue ?? ''}]]>`;
  if (node.nodeType === 8) return `<!--${node.nodeValue ?? ''}-->`;
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  let attrs = '';
  const declared = new Set<string>();
  for (const a of Array.from(el.attributes)) {
    declared.add(a.name);
    attrs += ` ${a.name}="${escapeAttr(a.value)}"`;
  }
  if (root) {
    for (const [name, value] of scope) {
      if (!declared.has(name)) attrs += ` ${name}="${escapeAttr(value)}"`;
    }
  }
  const inner = Array.from(el.childNodes).map((c) => serializeNode(c, scope, false)).join('');
  if (inner.length === 0) return `<${el.tagName}${attrs}/>`;
  return `<${el.tagName}${attrs}>${inner}</${el.tagName}>`;
}
