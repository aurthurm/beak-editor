/**
 * Paste normalisation for Word and Excel clipboard HTML (roadmap §5H).
 *
 * Office HTML is full of `mso-*` inline styles, conditional comments and
 * fake list markers. This module rewrites it into plain HTML whose formatting
 * lives in `data-*` attributes that the schema's parseDOM rules read:
 *
 * - Table and column widths (pt/px/cm/in/% to twips), `colspan`/`rowspan`
 *   merges (vMerge continuation cells are dropped and the grid re-placed),
 *   cell shading, per-edge borders, padding and alignment.
 * - `MsoHeadingN` / outline-level paragraphs become `h1`..`h6` with
 *   `data-style-id="HeadingN"`.
 * - `MsoListParagraph` runs with `mso-list` become real `ul`/`ol` lists.
 * - Inline `mso-*` styles are dropped; bold, italic, underline and strike
 *   spans become semantic tags.
 *
 * @module
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import { ptToTwips, pxToTwips } from '../schema/nodes/tableOffice';

/** Plugin key for the Office paste plugin. */
export const OFFICE_PASTE_PLUGIN_KEY = new PluginKey('officePaste');

/**
 * Detects clipboard HTML that came from Word or Excel.
 *
 * @param html - Clipboard `text/html`
 */
export function isOfficeHtml(html: string): boolean {
  return /mso-|urn:schemas-microsoft-com:office|ProgId["']?\s*content=["']?(Word|Excel)\./i.test(html);
}

/**
 * Converts a CSS length to points. Returns null for unitless, percentage
 * and unparseable values.
 *
 * @param raw - e.g. `48pt`, `64px`, `1.5cm`, `0.5in`
 */
export function cssLengthToPt(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = /^(-?\d+(?:\.\d+)?)\s*(pt|px|cm|mm|in)?$/i.exec(raw.trim());
  if (!m) return null;
  const value = parseFloat(m[1]!);
  switch ((m[2] ?? '').toLowerCase()) {
    case 'pt':
      return value;
    case 'px':
      return value * 0.75;
    case 'cm':
      return value * (72 / 2.54);
    case 'mm':
      return value * (72 / 25.4);
    case 'in':
      return value * 72;
    default:
      return null;
  }
}

/** Parses an inline style attribute into lower-cased property/value pairs. */
function parseStyle(raw: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const decl of raw.split(';')) {
    const idx = decl.indexOf(':');
    if (idx < 0) continue;
    const key = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}

/** Normalises a colour token to `#rrggbb`, or null when it is not a colour. */
function normaliseColor(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (v === 'windowtext' || v === 'black' || v === 'auto') return '#000000';
  if (v === 'white' || v === 'window') return '#ffffff';
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    const h = hex[1]!;
    return h.length === 3 ? `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}` : `#${h}`;
  }
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(v);
  if (rgb) {
    return '#' + rgb.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  }
  if (/^[a-z]+$/.test(v)) return v;
  return null;
}

/** Parses a CSS border shorthand value (`1pt solid #000`, `none`). */
function parseBorderValue(raw: string): { style: string; sizePt: number; color: string } | null {
  let style = 'solid';
  let sizePt = 0.5;
  let color = '#000000';
  let sawStyle = false;
  for (const token of raw.trim().split(/\s+/)) {
    const t = token.toLowerCase();
    if (['none', 'hidden'].includes(t)) return { style: 'none', sizePt: 0, color };
    if (['solid', 'double', 'dashed', 'dotted'].includes(t)) {
      style = t;
      sawStyle = true;
      continue;
    }
    if (t === 'groove' || t === 'ridge' || t === 'inset' || t === 'outset') {
      style = 'solid';
      sawStyle = true;
      continue;
    }
    const len = cssLengthToPt(t);
    if (len !== null) {
      sizePt = len;
      continue;
    }
    const c = normaliseColor(t);
    if (c) color = c;
  }
  if (!sawStyle && sizePt === 0.5 && raw.trim() === '') return null;
  return { style, sizePt: Math.round(sizePt * 100) / 100, color };
}

/** Reads per-edge borders from `border` and `border-<edge>` declarations. */
function readBorders(style: Record<string, string>): Record<string, unknown> | null {
  const edges = ['top', 'right', 'bottom', 'left'] as const;
  const out: Record<string, unknown> = {};
  let any = false;
  const shorthand = style.border;
  for (const edge of edges) {
    const raw = style[`border-${edge}`] ?? shorthand;
    if (!raw) continue;
    const parsed = parseBorderValue(raw);
    if (!parsed) continue;
    out[edge] = parsed;
    any = true;
  }
  return any ? out : null;
}

/** Reads padding (shorthand plus longhands) into pt. */
function readPadding(style: Record<string, string>): Record<string, number> | null {
  let top: number | null = null;
  let right: number | null = null;
  let bottom: number | null = null;
  let left: number | null = null;
  if (style.padding) {
    const parts = style.padding.split(/\s+/).map((p) => cssLengthToPt(p) ?? 0);
    if (parts.length === 1) [top, right, bottom, left] = [parts[0]!, parts[0]!, parts[0]!, parts[0]!];
    else if (parts.length === 2) [top, right, bottom, left] = [parts[0]!, parts[1]!, parts[0]!, parts[1]!];
    else if (parts.length === 3) [top, right, bottom, left] = [parts[0]!, parts[1]!, parts[2]!, parts[1]!];
    else if (parts.length >= 4) [top, right, bottom, left] = [parts[0]!, parts[1]!, parts[2]!, parts[3]!];
  }
  const longhand = (name: string) => cssLengthToPt(style[`padding-${name}`] ?? null);
  top = longhand('top') ?? top;
  right = longhand('right') ?? right;
  bottom = longhand('bottom') ?? bottom;
  left = longhand('left') ?? left;
  if (top === null && right === null && bottom === null && left === null) return null;
  return {
    topPt: top ?? 0,
    rightPt: right ?? 0,
    bottomPt: bottom ?? 0,
    leftPt: left ?? 0,
  };
}

/** Removes comments, script/style/meta/xml and Office-namespace elements. */
function stripNoise(root: HTMLElement): void {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 0x80 /* SHOW_COMMENT */);
  const comments: Comment[] = [];
  let n = walker.nextNode();
  while (n) {
    comments.push(n as Comment);
    n = walker.nextNode();
  }
  for (const c of comments) c.remove();

  for (const el of Array.from(root.querySelectorAll('*'))) {
    const tag = el.tagName.toLowerCase();
    if (['style', 'script', 'meta', 'link', 'title', 'xml'].includes(tag) || tag.startsWith('w:') || tag.startsWith('v:')) {
      el.remove();
    } else if (tag.includes(':')) {
      // o:p and similar wrappers: keep their content
      el.replaceWith(...Array.from(el.childNodes));
    }
  }
}

/** Replaces `el` with a new element of `tag` that keeps its children. */
function renameElement(el: Element, tag: string): HTMLElement {
  const next = el.ownerDocument.createElement(tag);
  next.append(...Array.from(el.childNodes));
  el.replaceWith(next);
  return next;
}

/** Converts Office table markup to attribute-based table markup. */
function normaliseTables(root: HTMLElement): void {
  for (const table of Array.from(root.querySelectorAll('table'))) {
    const tStyle = parseStyle(table.getAttribute('style'));
    const widthRaw = tStyle.width ?? table.getAttribute('width');
    if (widthRaw && widthRaw.trim().endsWith('%')) {
      const pct = parseFloat(widthRaw);
      if (Number.isFinite(pct)) {
        table.setAttribute('data-width-mode', 'pct');
        table.setAttribute('data-width-value', String(Math.round(pct * 50)));
      }
    } else {
      const pt = cssLengthToPt(widthRaw) ?? (widthRaw && /^\d+$/.test(widthRaw.trim()) ? Number(widthRaw) * 0.75 : null);
      if (pt !== null && pt > 0) {
        table.setAttribute('data-width-mode', 'fixed');
        table.setAttribute('data-width-value', String(ptToTwips(pt)));
      }
    }

    // Column widths from <col> elements (px per column).
    const colPx: (number | null)[] = [];
    for (const col of Array.from(table.querySelectorAll('col'))) {
      const span = Math.max(1, parseInt(col.getAttribute('span') ?? '1', 10) || 1);
      const cStyle = parseStyle(col.getAttribute('style'));
      const pt = cssLengthToPt(cStyle.width ?? null);
      const px = pt !== null ? pt / 0.75 : parseFloat(col.getAttribute('width') ?? '') || null;
      for (let i = 0; i < span; i++) colPx.push(px);
    }
    table.querySelectorAll('colgroup').forEach((g) => g.remove());

    const occupied = new Set<string>();
    const rows = Array.from(table.querySelectorAll('tr')).filter((tr) => tr.closest('table') === table);
    rows.forEach((tr, r) => {
      const rStyle = parseStyle(tr.getAttribute('style'));
      const attrPx = parseFloat(tr.getAttribute('height') ?? '');
      const heightPt = cssLengthToPt(rStyle.height ?? null) ?? (Number.isFinite(attrPx) ? attrPx * 0.75 : null);
      if (heightPt && heightPt > 0) tr.setAttribute('data-height-twips', String(ptToTwips(heightPt)));
      const inHead = tr.parentElement?.tagName.toLowerCase() === 'thead';
      const cells = Array.from(tr.children).filter((c) => /^(td|th)$/i.test(c.tagName));
      if (inHead || (r === 0 && cells.some((c) => c.tagName.toLowerCase() === 'th'))) {
        tr.setAttribute('data-is-header', 'true');
      }

      let col = 0;
      for (const cell of cells) {
        const el = cell as HTMLElement;
        if (el.getAttribute('rowspan') === '0') {
          el.remove();
          continue;
        }
        while (occupied.has(`${r},${col}`)) col++;
        const colspan = Math.max(1, parseInt(el.getAttribute('colspan') ?? '1', 10) || 1);
        const rowspan = Math.max(1, parseInt(el.getAttribute('rowspan') ?? '1', 10) || 1);
        for (let dr = 0; dr < rowspan; dr++) {
          for (let dc = 0; dc < colspan; dc++) occupied.add(`${r + dr},${col + dc}`);
        }

        const cStyle = parseStyle(el.getAttribute('style'));
        const widthPt = cssLengthToPt(cStyle.width ?? null);
        const widthPx = widthPt !== null
          ? widthPt / 0.75
          : parseFloat(el.getAttribute('width') ?? '') || null;
        const spanPx: (number | null)[] = [];
        for (let c = 0; c < colspan; c++) spanPx.push(colPx[col + c] ?? null);
        let colwidth: number[] | null = null;
        if (widthPx !== null && widthPx > 0 && colspan === 1) {
          colwidth = [widthPx];
        } else if (spanPx.every((p) => p !== null)) {
          colwidth = spanPx as number[];
        } else if (widthPx !== null && widthPx > 0) {
          colwidth = Array.from({ length: colspan }, () => widthPx / colspan);
        }
        if (colwidth) {
          el.setAttribute('data-colwidth', colwidth.map((w) => Math.round(w * 100) / 100).join(','));
          el.setAttribute('data-width-twips', String(pxToTwips(colwidth.reduce((a, b) => a + b, 0))));
        }

        const bg = cStyle['background'] ?? cStyle['background-color'] ?? el.getAttribute('bgcolor');
        const shade = bg ? normaliseColor(bg.replace(/^.*?(#[0-9a-f]{3,6}|rgba?\([^)]*\)).*$/i, '$1')) : null;
        if (shade && shade !== 'transparent') el.setAttribute('data-shading', shade);

        const borders = readBorders(cStyle);
        if (borders) el.setAttribute('data-borders', JSON.stringify(borders));

        const padding = readPadding(cStyle);
        if (padding) el.setAttribute('data-padding', JSON.stringify(padding));

        const valign = (cStyle['vertical-align'] ?? el.getAttribute('valign') ?? '').toLowerCase();
        if (valign === 'top' || valign === 'bottom') el.setAttribute('data-valign', valign);
        else if (valign === 'middle' || valign === 'center') el.setAttribute('data-valign', 'center');

        const halign = (cStyle['text-align'] ?? el.getAttribute('align') ?? '').toLowerCase();
        if (['left', 'center', 'right', 'justify'].includes(halign)) el.setAttribute('data-halign', halign);

        for (const attr of Array.from(el.attributes)) {
          if (!['colspan', 'rowspan', 'data-colwidth', 'data-width-twips', 'data-shading', 'data-borders', 'data-padding', 'data-valign', 'data-halign'].includes(attr.name)) {
            el.removeAttribute(attr.name);
          }
        }
        if (colspan > 1) el.setAttribute('colspan', String(colspan));
        if (rowspan > 1) el.setAttribute('rowspan', String(rowspan));
        col += colspan;
      }

      for (const attr of Array.from(tr.attributes)) {
        if (!['data-height-twips', 'data-is-header'].includes(attr.name)) tr.removeAttribute(attr.name);
      }
    });

    for (const attr of Array.from(table.attributes)) {
      if (!attr.name.startsWith('data-')) table.removeAttribute(attr.name);
    }
  }
}

/** Heading level from an MsoHeadingN class, `heading N` style name or outline level. */
function headingLevel(p: HTMLElement): number | null {
  const cls = /\bMsoHeading([1-6])\b/.exec(p.getAttribute('class') ?? '');
  if (cls) return Number(cls[1]);
  const style = p.getAttribute('style') ?? '';
  const name = /mso-style-name:\s*"?heading\s+([1-6])"?/i.exec(style);
  if (name) return Number(name[1]);
  const outline = /mso-outline-level:\s*([1-6])\b/i.exec(style);
  if (outline) return Number(outline[1]);
  return null;
}

/** Paragraphs with Word list formatting, with their list id and level. */
function msoListInfo(p: HTMLElement): { lid: string; level: number } | null {
  const m = /mso-list:\s*(l\d+|[\w-]+)\s+level(\d+)/i.exec(p.getAttribute('style') ?? '');
  if (!m) return null;
  return { lid: m[1]!.toLowerCase(), level: Number(m[2]) };
}

/** Whether a list marker label indicates a numbered (not bullet) list. */
function isOrderedLabel(label: string): boolean {
  return /^\s*(\d+|[a-z]|[ivxlcdm]+)[.)]\s*$/i.test(label) || /^\s*\(?(\d+|[a-z]+)\)\s*$/i.test(label);
}

/** Converts headings and Word list paragraphs into semantic elements. */
function normaliseBlocks(root: HTMLElement): void {
  for (const p of Array.from(root.querySelectorAll('p'))) {
    if (msoListInfo(p)) continue;
    const level = headingLevel(p);
    if (!level) continue;
    const h = renameElement(p, `h${level}`);
    h.setAttribute('data-style-id', `Heading${level}`);
  }

  const doc = root.ownerDocument;
  type Frame = { level: number; lid: string; list: HTMLElement };
  let stack: Frame[] = [];
  let anchor: Element | null = null;
  let anchorParent: Node | null = null;

  for (const p of Array.from(root.querySelectorAll('p'))) {
    const info = msoListInfo(p);
    if (!info) {
      stack = [];
      continue;
    }
    const parent = p.parentNode;
    const contiguous = parent === anchorParent && p.previousElementSibling === anchor && anchor !== null;
    if (!contiguous || (stack.length === 1 && stack[0]!.lid !== info.lid && info.level === 1)) {
      stack = [];
    }

    // Read the marker label, then remove the ignored marker span.
    let label = '';
    for (const span of Array.from(p.querySelectorAll('span'))) {
      if (/mso-list:\s*ignore/i.test(span.getAttribute('style') ?? '')) {
        label = span.textContent ?? '';
        span.remove();
      }
    }

    const level = info.level;
    while (stack.length && stack[stack.length - 1]!.level > level) stack.pop();
    let top = stack[stack.length - 1];
    if (!top || top.level < level) {
      const list = doc.createElement(isOrderedLabel(label) ? 'ol' : 'ul');
      if (!top) {
        parent?.insertBefore(list, p);
      } else {
        const host = top.list.lastElementChild ?? top.list;
        host.appendChild(list);
      }
      top = { level, lid: info.lid, list };
      stack.push(top);
      anchorParent = parent;
    } else if (top.lid !== info.lid && top.level === level) {
      const list = doc.createElement(isOrderedLabel(label) ? 'ol' : 'ul');
      top.list.parentNode?.insertBefore(list, top.list.nextSibling);
      stack[stack.length - 1] = { level, lid: info.lid, list };
      top = stack[stack.length - 1]!;
    }

    const li = doc.createElement('li');
    p.setAttribute('data-style-id', 'ListParagraph');
    li.appendChild(p);
    top.list.appendChild(li);
    anchor = stack[0]!.list;
    anchorParent = parent;
  }
}

/** Maps inline spans to semantic tags and removes remaining style attributes. */
function normaliseInline(root: HTMLElement): void {
  for (const span of Array.from(root.querySelectorAll('span'))) {
    const style = parseStyle(span.getAttribute('style'));
    const wrappers: string[] = [];
    const weight = style['font-weight'];
    if (weight && (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600)) wrappers.push('strong');
    if (style['font-style'] === 'italic') wrappers.push('em');
    if ((style['text-decoration'] ?? style['text-decoration-line'] ?? '').includes('underline')) wrappers.push('u');
    if ((style['text-decoration'] ?? '').includes('line-through')) wrappers.push('s');

    const doc = span.ownerDocument;
    const content = Array.from(span.childNodes);
    if (wrappers.length) {
      let inner: Node[] = content;
      for (const tag of wrappers) {
        const el = doc.createElement(tag);
        el.append(...inner);
        inner = [el];
      }
      span.replaceWith(...inner);
    } else {
      span.replaceWith(...content);
    }
  }

  for (const el of Array.from(root.querySelectorAll('*'))) {
    const keep = el.tagName === 'TD' || el.tagName === 'TH' || el.tagName === 'TR' || el.tagName === 'TABLE';
    for (const attr of Array.from(el.attributes)) {
      if (attr.name === 'style' || attr.name === 'class' || attr.name === 'lang' || attr.name.startsWith('mso') || attr.name.includes(':')) {
        el.removeAttribute(attr.name);
      } else if (!keep && attr.name === 'align') {
        el.removeAttribute(attr.name);
      }
    }
  }
}

/**
 * Normalises Word or Excel clipboard HTML into attribute-based HTML that the
 * BeakBlock schema parses without inline Office styles.
 *
 * @param html - Clipboard `text/html` from Word or Excel
 * @returns Clean HTML (body contents)
 */
export function normaliseOfficeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.body;
  stripNoise(root);
  normaliseTables(root);
  normaliseBlocks(root);
  normaliseInline(root);
  return root.innerHTML;
}

/**
 * ProseMirror plugin that normalises Office HTML on paste. Non-Office HTML
 * passes through unchanged.
 */
export function createOfficePastePlugin(): Plugin {
  return new Plugin({
    key: OFFICE_PASTE_PLUGIN_KEY,
    props: {
      transformPastedHTML(html: string): string {
        return isOfficeHtml(html) ? normaliseOfficeHtml(html) : html;
      },
    },
  });
}
