/**
 * XML escaping, element serialisation and a lightweight well-formedness check.
 *
 * The check runs without DOM APIs so that the writer works in Node and browsers alike.
 *
 * @module
 */

// Control characters are invalid in XML 1.0, so matching them is the point.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

/** Namespace prefixes declared on every generated part root. */
const ROOT_PREFIXES = ['w', 'r', 'wp', 'a', 'pic', 'xml'];

/** Removes XML 1.0 control characters, which cannot appear in a document. */
export function stripControl(value: string): string {
  return value.replace(CONTROL_CHARS, '');
}

/** Escapes text for element content or a double-quoted attribute value. */
export function escapeXml(value: string): string {
  return stripControl(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Attribute values accepted by {@link element}. `undefined` attributes are omitted. */
export type AttrRecord = Record<string, string | number | undefined>;

/** Serialises an attribute map, skipping `undefined` values. */
export function attrs(values: AttrRecord): string {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ` ${key}="${escapeXml(String(value))}"`)
    .join('');
}

/** Serialises an element. An empty `inner` produces a self-closing tag. */
export function element(name: string, values: AttrRecord = {}, inner = ''): string {
  const at = attrs(values);
  return inner ? `<${name}${at}>${inner}</${name}>` : `<${name}${at}/>`;
}

/** A `w:val` only element, such as `<w:jc w:val="center"/>`. */
export function valEl(name: string, value: string | number): string {
  return element(name, { 'w:val': value });
}

/**
 * An on/off property. `true` writes the bare element, `false` writes `w:val="0"`
 * so that inherited values are overridden, and `undefined` writes nothing.
 */
export function onOff(name: string, value: boolean | undefined): string {
  if (value === undefined) return '';
  return value ? `<${name}/>` : `<${name} w:val="0"/>`;
}

/** Points to twips (1 pt = 20 twips), rounded to an integer. */
export function twips(pt: number): number {
  return Math.round(pt * 20);
}

/** Points to EMU (1 pt = 12700 EMU), rounded to an integer. */
export function emu(pt: number): number {
  return Math.round(pt * 12700);
}

/** Normalises a colour to six upper-case hex digits without `#`. */
export function hex(color: string): string {
  return color.replace(/^#/, '').toUpperCase();
}

/**
 * Checks that an XML fragment is balanced and uses only known namespace prefixes.
 *
 * Returns `null` when the fragment passes, otherwise a short reason.
 */
export function checkFragment(xml: string): string | null {
  const body = xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '');
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(body)) return 'unescaped ampersand';

  const tagPattern = /<(\/?)([^\s/>!?]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  const stack: string[] = [];
  const declared = new Set<string>();
  const used = new Set<string>();
  let tags = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(body))) {
    tags += 1;
    const [, closing, name, attributes, selfClosing] = match;
    if (name.includes(':')) used.add(name.split(':')[0]);
    for (const attribute of attributes.matchAll(/(?:^|\s)([\w.:-]+)\s*=/g)) {
      const attributeName = attribute[1];
      if (attributeName.startsWith('xmlns:')) declared.add(attributeName.slice(6));
      else if (attributeName.includes(':')) used.add(attributeName.split(':')[0]);
    }
    if (closing) {
      if (stack.pop() !== name) return `mismatched closing tag </${name}>`;
    } else if (!selfClosing) {
      stack.push(name);
    }
  }
  if (stack.length) return `unclosed element <${stack[stack.length - 1]}>`;
  const angleBrackets = (body.match(/</g) ?? []).length;
  if (angleBrackets !== tags) return 'malformed markup';
  for (const prefix of used) {
    if (!ROOT_PREFIXES.includes(prefix) && !declared.has(prefix)) {
      return `undeclared namespace prefix "${prefix}"`;
    }
  }
  return null;
}
