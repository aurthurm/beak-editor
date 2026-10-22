/**
 * Print HTML rendering from a layout.
 *
 * Produces one `<section class="bb-page">` per laid-out page, sized with exact point
 * dimensions and a named `@page` rule per section, so browser print or a headless
 * renderer gives the same page count as the layout. All text is escaped; colours,
 * fonts and image sources are validated before they reach a style or attribute.
 *
 * @module
 */

import type {
  IRBlock,
  IRDocument,
  IRImageBlock,
  IRInline,
  IRParagraph,
  IRSection,
  IRTable,
} from '@amusendame/beakblock-ir';

import { bandBlocks } from './engine';
import { resolveSimpleField } from './fields';
import { layoutDocument } from './layout';
import { lineHeightFor } from './measure';
import { resolveParagraph, runStyleOf, DEFAULT_FONT } from './paragraph';
import type { LayoutFragment, LayoutOptions, LayoutPage, LayoutResult, Measurer } from './types';

/** Options for {@link renderPrintHTML}. */
export interface PrintOptions {
  /** Document title. Defaults to the document's `title` property, then "Document". */
  title?: string;
  /** Watermark text, for example "DRAFT" or "UNCONTROLLED WHEN PRINTED". */
  watermark?: string | null;
  /** Controlled-copy stamp drawn on every page. */
  controlledCopy?: { copyNumber: number | string; issuedTo?: string };
  /** Measurer used when no layout is supplied. */
  measurer?: Measurer;
  /** Date for DATE fields when no layout is supplied. */
  now?: Date;
}

/** Escapes text for HTML text content and attribute values. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const COLOR_PATTERN = /^#?[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$/;
const FONT_PATTERN = /^[A-Za-z0-9 ._-]{1,60}$/;
const ALIGNMENTS: readonly string[] = ['left', 'center', 'right', 'justify'];

/**
 * Formats a number for a CSS length. Anything that is not a finite number becomes `0`,
 * so the output only ever contains digits, a sign and a dot.
 */
export function pt(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

/** Integer for colspan, rowspan and similar attributes (at least `min`). */
function int(value: unknown, min: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.floor(value)) : min;
}

/** Allowlisted enumerated value; anything else becomes the fallback. */
function oneOf(value: unknown, allowed: readonly string[], fallback: string): string {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}

/** Paragraph alignment, from the allowlist. */
function alignOf(value: unknown): string {
  return oneOf(value, ALIGNMENTS, 'left');
}

/**
 * Joins CSS declarations into an attribute value. The result is HTML-escaped, so no
 * declaration can close the attribute.
 */
function styleAttr(parts: readonly string[]): string {
  return escapeHtml(parts.join(';'));
}

/** Returns a safe CSS colour (hex or a plain colour name), or null. */
function safeColor(value: string | undefined): string | null {
  if (!value || !COLOR_PATTERN.test(value)) return null;
  return value.startsWith('#') || /^[a-zA-Z]+$/.test(value) ? value : `#${value}`;
}

/** Returns a safe image source (https or raster data URI), or null. */
function safeImageSrc(value: string): string | null {
  if (/^https?:\/\//i.test(value)) return value;
  if (/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(value)) return value;
  return null;
}

/** Font stack with bundled metric-compatible fallbacks (ADR-6). */
const FONT_STACKS: Record<string, string> = {
  Carlito: "'Carlito', 'Calibri', 'Arial', 'Helvetica', sans-serif",
  Caladea: "'Caladea', 'Cambria', 'Georgia', 'Times New Roman', serif",
  'Liberation Sans': "'Liberation Sans', 'Arial', 'Helvetica', sans-serif",
  'Liberation Serif': "'Liberation Serif', 'Times New Roman', 'Times', serif",
  'Liberation Mono': "'Liberation Mono', 'Courier New', 'Courier', monospace",
};

function fontFamilyCss(font: string | undefined): string {
  if (!font) return FONT_STACKS[DEFAULT_FONT];
  if (FONT_STACKS[font]) return FONT_STACKS[font];
  if (!FONT_PATTERN.test(font)) return FONT_STACKS[DEFAULT_FONT];
  return `'${font}', ${FONT_STACKS[DEFAULT_FONT]}`;
}

/** Index of IR blocks by path, following the same path scheme as the layout. */
function indexBlocks(sections: readonly IRSection[]): Map<string, IRBlock> {
  const index = new Map<string, IRBlock>();
  const walk = (blocks: readonly IRBlock[], prefix: string) => {
    blocks.forEach((block, position) => {
      const path = `${prefix}/${position}`;
      index.set(path, block);
      if (block.type === 'sdt') walk(block.blocks, path);
    });
  };
  sections.forEach((section, sectionIndex) => walk(section.body, `s${sectionIndex}`));
  return index;
}

/** Render context for one document. */
interface RenderContext {
  doc: IRDocument;
  fieldValues: Record<string, string>;
  pageNumber: number;
  pageCount: number;
  now: Date;
}

/** Renders the inline content of a paragraph with formatting. */
function runsHtml(runs: readonly IRInline[], path: string, ctx: RenderContext, base: { font: string; sizePt: number; bold: boolean; italic: boolean }): string {
  return runs
    .map((item, index) => {
      if (item.type === 'run') {
        const style = runStyleOf(item.props, base, ctx.doc);
        const css: string[] = [`font-family:${fontFamilyCss(style.font)}`];
        css.push(`font-size:${pt(style.sizePt)}pt`);
        if (style.bold) css.push('font-weight:bold');
        if (style.italic) css.push('font-style:italic');
        if (item.props.underline) css.push('text-decoration:underline');
        if (item.props.strike) css.push('text-decoration:line-through');
        const color = safeColor(item.props.color);
        if (color) css.push(`color:${color}`);
        const shading = safeColor(item.props.shading);
        if (shading) css.push(`background-color:${shading}`);
        const text = escapeHtml(item.text);
        return `<span style="${styleAttr(css)}">${text}</span>`;
      }
      if (item.type === 'field') {
        const key = `${path}:${index}`;
        const value = ctx.fieldValues[key] ?? resolveSimpleField(item, { doc: ctx.doc, now: ctx.now, pageNumber: ctx.pageNumber, pageCount: ctx.pageCount });
        return `<span class="beakblock-field" data-field-type="${escapeHtml(item.fieldType)}">${escapeHtml(value)}</span>`;
      }
      if (item.type === 'break') return item.kind === 'line' ? '<br>' : '';
      if (item.type === 'icon') return `<span class="bb-icon">${escapeHtml(item.symbol)}</span>`;
      if (item.type === 'image') return imageHtml(item);
      if (item.type === 'footnoteRef') return '<sup>1</sup>';
      return '';
    })
    .join('');
}

function imageHtml(image: IRImageBlock | Extract<IRInline, { type: 'image' }>): string {
  const src = safeImageSrc(image.src);
  if (!src) return '';
  const size = [
    image.widthPt !== undefined ? `width:${pt(image.widthPt)}pt` : '',
    image.heightPt !== undefined ? `height:${pt(image.heightPt)}pt` : '',
  ]
    .filter(Boolean)
    .join(';');
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(image.alt ?? '')}" style="${escapeHtml(size)};max-width:100%"/>`;
}

/** Renders a paragraph block as an element with its resolved paragraph style. */
function paragraphHtml(paragraph: IRParagraph, path: string, ctx: RenderContext): string {
  const resolved = resolveParagraph(paragraph, ctx.doc);
  const align = alignOf(paragraph.props.align);
  const css = [
    `text-align:${alignOf(align)}`,
    `margin:0`,
    `padding-left:${pt(resolved.leftPt)}pt`,
    `text-indent:${pt(resolved.firstLinePt - resolved.hangingPt)}pt`,
    `font-family:${fontFamilyCss(resolved.base.font)}`,
    `font-size:${pt(resolved.base.sizePt)}pt`,
    `line-height:${pt(lineHeightFor(resolved.base.sizePt, resolved.spacing, resolved.base.font))}pt`,
    `white-space:normal`,
  ];
  const inner = runsHtml(paragraph.runs, path, ctx, resolved.base);
  return `<p class="bb-p" style="${styleAttr(css)}">${inner}</p>`;
}

/** Renders a split paragraph fragment as its own lines (the text slice of the layout). */
function paragraphSliceHtml(fragment: LayoutFragment, paragraph: IRParagraph, ctx: RenderContext): string {
  const resolved = resolveParagraph(paragraph, ctx.doc);
  const lines = fragment.lines ?? [];
  const body = lines.map((line) => `<span class="bb-line">${escapeHtml(line.text)}</span>`).join('<br>');
  const css = [
    `margin:0`,
    `padding-left:${pt(resolved.leftPt)}pt`,
    `font-family:${fontFamilyCss(resolved.base.font)}`,
    `font-size:${pt(resolved.base.sizePt)}pt`,
    `text-align:${alignOf(paragraph.props.align)}`,
  ];
  return `<p class="bb-p" style="${styleAttr(css)}">${body}</p>`;
}

/** Renders the cell content or band content of a block list. */
function blocksHtml(blocks: readonly IRBlock[], path: string, ctx: RenderContext): string {
  return blocks
    .map((block, index) => {
      const childPath = `${path}/${index}`;
      if (block.type === 'paragraph') return paragraphHtml(block, childPath, ctx);
      if (block.type === 'table') return tableHtml(block, childPath, ctx, { from: 0, to: block.rows.length, repeated: 0, width: undefined });
      if (block.type === 'image') return imageHtml(block);
      if (block.type === 'sdt') return blocksHtml(block.blocks, childPath, ctx);
      if (block.type === 'passthrough') {
        return block.preview ? `<div class="bb-passthrough">${escapeHtml(block.preview)}</div>` : '';
      }
      return '';
    })
    .join('');
}

interface RowWindow {
  from: number;
  to: number;
  repeated: number;
  width: number | undefined;
}

/** Renders a table restricted to a row window, with repeated header rows. */
function tableHtml(table: IRTable, path: string, ctx: RenderContext, window: RowWindow): string {
  const gridTotal = table.grid.reduce((sum, value) => sum + value, 0);
  const width = window.width ?? gridTotal / 20;
  const scale = gridTotal > 0 ? width / (gridTotal / 20) : 1;
  const cols = table.grid.map((value) => `<col style="width:${pt(((value / 20) * scale))}pt">`).join('');
  const rowIndexes: number[] = [];
  for (let r = 0; r < window.repeated; r += 1) rowIndexes.push(r);
  for (let r = window.from; r < window.to; r += 1) {
    if (r >= window.repeated) rowIndexes.push(r);
  }
  const rowsHtml = rowIndexes
    .map((rowIndex) => {
      const row = table.rows[rowIndex];
      const cells = row.cells
        .map((cell, cellIndex) => {
          if (cell.props.vMerge === 'continue') return '';
          let rowspan = 1;
          if (cell.props.vMerge === 'restart') {
            for (let below = rowIndex + 1; below < table.rows.length; below += 1) {
              const belowCell = table.rows[below].cells[cellIndex];
              if (belowCell?.props.vMerge === 'continue') rowspan += 1;
              else break;
            }
          }
          const tag = row.props.isHeader ? 'th' : 'td';
          const span = int(cell.props.gridSpan, 1) > 1 ? ` colspan="${int(cell.props.gridSpan, 1)}"` : '';
          const rowSpan = rowspan > 1 ? ` rowspan="${int(rowspan, 1)}"` : '';
          const shade = safeColor(cell.props.shading);
          const style = [
            'border:0.5pt solid #000',
            'padding:0 5.4pt',
            'vertical-align:top',
            shade ? `background-color:${shade}` : '',
          ]
            .filter(Boolean)
            .join(';');
          return `<${tag}${span}${rowSpan} style="${escapeHtml(style)}">${blocksHtml(cell.blocks, `${path}/r${rowIndex}c${cellIndex}`, ctx)}</${tag}>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table class="bb-table" style="border-collapse:collapse;table-layout:fixed;width:${pt(width)}pt"><colgroup>${cols}</colgroup><tbody>${rowsHtml}</tbody></table>`;
}

/** Renders one body fragment absolutely positioned on the page. */
function fragmentHtml(fragment: LayoutFragment, page: LayoutPage, ctx: RenderContext, blocks: Map<string, IRBlock>): string {
  const left = page.marginsPt.left + page.marginsPt.gutter;
  const width = page.sizePt.w - left - page.marginsPt.right;
  const position = `position:absolute;left:${pt(left)}pt;width:${pt(width)}pt;top:${pt(fragment.yPt)}pt`;
  const block = blocks.get(fragment.path);
  switch (fragment.kind) {
    case 'paragraph': {
      if (!block || block.type !== 'paragraph') return '';
      const whole = !fragment.continued && !fragment.continues;
      const inner = whole ? paragraphHtml(block, fragment.path, ctx) : paragraphSliceHtml(fragment, block, ctx);
      return `<div class="bb-frag" style="${escapeHtml(position)}">${inner}</div>`;
    }
    case 'tableRows': {
      if (!block || block.type !== 'table' || !fragment.rowRange) return '';
      const table = tableHtml(block, fragment.path, ctx, {
        from: fragment.rowRange[0],
        to: fragment.rowRange[1],
        repeated: fragment.repeatedHeaderRows ?? 0,
        width,
      });
      return `<div class="bb-frag" style="${escapeHtml(position)}">${table}</div>`;
    }
    case 'image': {
      if (!block || block.type !== 'image') return '';
      return `<div class="bb-frag" style="${escapeHtml(position)}">${imageHtml(block)}</div>`;
    }
    case 'passthrough': {
      if (!block || block.type !== 'passthrough') return '';
      return `<div class="bb-frag bb-passthrough" style="${escapeHtml(position)}">${block.preview ? escapeHtml(block.preview) : ''}</div>`;
    }
    default:
      return '';
  }
}

/** Renders a header or footer band for a page. */
function bandHtml(section: IRSection, kind: 'header' | 'footer', page: LayoutPage, ctx: RenderContext): string {
  const blocks = bandBlocks(section, kind, page.variant);
  if (blocks.length === 0) return '';
  return blocksHtml(blocks, `s${page.sectionIndex}/${kind}/${page.variant}`, ctx);
}

/** Sanitised CSS page-size rule name for a section index. */
function pageName(sectionIndex: number): string {
  return `bb-s${sectionIndex}`;
}

/**
 * Renders the document as a standalone print HTML document.
 *
 * @param ir The IR document.
 * @param layout A layout of `ir`. Computed with the options' measurer when omitted.
 * @param options Title, watermark, controlled-copy stamp.
 *
 * @example
 * ```typescript
 * const html = renderPrintHTML(ir, layoutDocument(ir), { watermark: 'DRAFT' });
 * ```
 */
export function renderPrintHTML(ir: IRDocument, layout?: LayoutResult, options: PrintOptions = {}): string {
  const layoutOptions: LayoutOptions = { measurer: options.measurer, now: options.now };
  const result = layout ?? layoutDocument(ir, layoutOptions);
  const now = options.now ?? new Date();
  const blocks = indexBlocks(ir.sections);
  const title = escapeHtml(options.title ?? ir.properties.title ?? 'Document');

  const sectionRules = ir.sections
    .map((section, index) => {
      const { size } = section.pageSetup;
      const w = size.widthTwips / 20;
      const h = size.heightTwips / 20;
      return `@page ${pageName(index)} { size: ${pt(w)}pt ${pt(h)}pt; margin: 0; }\n.bb-sec-${index} { page: ${pageName(index)}; }`;
    })
    .join('\n');

  const fontFaces = Object.keys(FONT_STACKS)
    .map((family) => {
      const local = [family];
      if (family === 'Carlito') local.push('Calibri');
      if (family === 'Caladea') local.push('Cambria');
      if (family === 'Liberation Sans') local.push('Arial');
      if (family === 'Liberation Serif') local.push('Times New Roman');
      if (family === 'Liberation Mono') local.push('Courier New');
      const src = local.map((name) => `local("${name}")`).join(', ');
      return `@font-face { font-family: "${family}"; src: ${src}; }`;
    })
    .join('\n');

  const pagesHtml = result.pages
    .map((page) => {
      const section = ir.sections[page.sectionIndex] ?? ir.sections[0];
      const ctx: RenderContext = {
        doc: ir,
        fieldValues: {},
        pageNumber: page.number,
        pageCount: result.pageCount,
        now,
      };
      const left = page.marginsPt.left + page.marginsPt.gutter;
      const width = page.sizePt.w - left - page.marginsPt.right;
      const headerHtml = section ? bandHtml(section, 'header', page, ctx) : '';
      const footerHtml = section ? bandHtml(section, 'footer', page, ctx) : '';
      const body = page.body.map((fragment) => fragmentHtml(fragment, page, { ...ctx, fieldValues: result.fieldValues }, blocks)).join('');
      const watermark = options.watermark
        ? `<div class="bb-watermark" aria-hidden="true">${escapeHtml(options.watermark)}</div>`
        : '';
      const stamp = options.controlledCopy
        ? `<div class="bb-stamp">Controlled copy ${escapeHtml(String(options.controlledCopy.copyNumber))}${
            options.controlledCopy.issuedTo ? ` &middot; Issued to ${escapeHtml(options.controlledCopy.issuedTo)}` : ''
          }</div>`
        : '';
      return [
        `<section class="bb-page bb-sec-${page.sectionIndex}" data-page="${int(page.number, 1)}" data-variant="${oneOf(page.variant, ['first', 'even', 'default'], 'default')}" style="width:${pt(page.sizePt.w)}pt;height:${pt(page.sizePt.h)}pt">`,
        `<header class="bb-band bb-header" style="position:absolute;left:${pt(left)}pt;top:${pt(page.marginsPt.header)}pt;width:${pt(width)}pt">${headerHtml}</header>`,
        body,
        `<footer class="bb-band bb-footer" style="position:absolute;left:${pt(left)}pt;bottom:${pt(page.marginsPt.footer)}pt;width:${pt(width)}pt">${footerHtml}</footer>`,
        watermark,
        stamp,
        '</section>',
      ].join('');
    })
    .join('\n');

  const css = [
    fontFaces,
    sectionRules,
    'html, body { margin: 0; padding: 0; background: #fff; color: #000; }',
    `body { font-family: ${FONT_STACKS[DEFAULT_FONT]}; }`,
    '.bb-page { position: relative; overflow: hidden; box-sizing: border-box; background: #fff; page-break-after: always; break-after: page; margin: 0 auto; }',
    '.bb-page:last-child { page-break-after: auto; break-after: auto; }',
    '.bb-p { margin: 0; }',
    '.bb-table td, .bb-table th { vertical-align: top; }',
    '.bb-watermark { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 72pt; font-weight: bold; color: rgba(0,0,0,0.08); white-space: nowrap; pointer-events: none; }',
    '.bb-stamp { position: absolute; right: 36pt; top: 18pt; border: 1pt solid #9C0006; color: #9C0006; padding: 2pt 6pt; font-size: 9pt; }',
    '@media screen { body { background: #d9d9d9; } .bb-page { margin: 16px auto; box-shadow: 0 1px 4px rgba(0,0,0,0.25); } }',
  ].join('\n');

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${title}</title>`,
    `<style>\n${css}\n</style>`,
    '</head>',
    '<body>',
    pagesHtml,
    '</body>',
    '</html>',
  ].join('\n');
}

/**
 * Opens the print HTML in a hidden iframe and calls `print()` (browser only).
 *
 * @returns `false` when there is no browser document to print from.
 * @throws Nothing; print failures are reported through the browser.
 */
export function renderPrintToWindow(html: string): boolean {
  if (typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') {
    return false;
  }
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  // No allow-scripts: the print document runs no script. The parent calls print() itself.
  frame.setAttribute('sandbox', 'allow-modals allow-same-origin');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.onload = () => {
    const target = frame.contentWindow;
    if (!target) return;
    target.focus();
    target.print();
    setTimeout(() => frame.remove(), 1000);
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
  return true;
}
