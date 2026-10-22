/**
 * Rendering helpers shared by node views and print output.
 *
 * @module
 */

import type { MathRenderer } from './types';

/** Escapes text for safe use in HTML content and attribute values. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Points-to-pixels factor used for shape sizing (96 px per inch, 72 pt per inch). */
export const PT_TO_PX = 96 / 72;

/**
 * Default math renderer: uses `globalThis.katex.renderToString` when the host
 * has loaded KaTeX. Returns `null` otherwise, so callers show the source.
 */
export const defaultMathRenderer: MathRenderer = (latex, displayMode) => {
  const katex = (globalThis as { katex?: { renderToString?: (src: string, opts: object) => string } }).katex;
  if (!katex || typeof katex.renderToString !== 'function') return null;
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false });
  } catch {
    return null;
  }
};

/**
 * Renders LaTeX with the given renderer, falling back to the default.
 *
 * @returns HTML from the renderer, or `null` when only the source can be shown
 */
export function renderMathHtml(
  latex: string,
  displayMode: boolean,
  renderer?: MathRenderer
): string | null {
  const custom = renderer ?? defaultMathRenderer;
  try {
    const html = custom(latex, displayMode);
    return typeof html === 'string' && html !== '' ? html : null;
  } catch {
    return null;
  }
}

/** Fallback markup that shows LaTeX source when no renderer is available. */
export function equationSourceHtml(latex: string): string {
  return `<code class="beakblock-equation-source">${escapeHtml(latex)}</code>`;
}

/** Element description used to build a shape in markup or DOM. */
export interface ShapeElement {
  tag: 'rect' | 'ellipse' | 'line' | 'polygon';
  attrs: Record<string, string>;
}

/** Shape attributes as stored on the node. */
export interface ShapeAttrs {
  kind: string;
  width: number;
  height: number;
  fill: string | null;
  stroke: string;
  strokeWidth: number;
}

/**
 * Geometry for a shape in a viewBox of `width x height` points.
 *
 * @param attrs - Shape attributes
 */
export function shapeGeometry(attrs: ShapeAttrs): { viewWidth: number; viewHeight: number; elements: ShapeElement[] } {
  const w = Math.max(1, attrs.width);
  const h = Math.max(1, attrs.height);
  const stroke = attrs.stroke || 'none';
  const sw = String(Math.max(0, attrs.strokeWidth));
  const fill = attrs.fill || 'none';
  const common = { stroke, 'stroke-width': sw };
  const elements: ShapeElement[] = [];

  switch (attrs.kind) {
    case 'ellipse':
      elements.push({
        tag: 'ellipse',
        attrs: { cx: String(w / 2), cy: String(h / 2), rx: String(w / 2), ry: String(h / 2), fill, ...common },
      });
      break;
    case 'line':
      elements.push({
        tag: 'line',
        attrs: { x1: '0', y1: '0', x2: String(w), y2: String(h), fill: 'none', ...common },
      });
      break;
    case 'arrow': {
      const midY = h / 2;
      const head = Math.min(10, w / 3);
      elements.push({
        tag: 'line',
        attrs: { x1: '0', y1: String(midY), x2: String(w - head), y2: String(midY), fill: 'none', ...common },
      });
      elements.push({
        tag: 'polygon',
        attrs: {
          points: `${w},${midY} ${w - head},${midY - head / 2} ${w - head},${midY + head / 2}`,
          fill: stroke === 'none' ? 'none' : stroke,
          stroke: 'none',
        },
      });
      break;
    }
    default:
      elements.push({
        tag: 'rect',
        attrs: { x: '0', y: '0', width: String(w), height: String(h), fill, ...common },
      });
  }
  return { viewWidth: w, viewHeight: h, elements };
}

/** Shape SVG markup for print output. */
export function shapeSvgMarkup(attrs: ShapeAttrs): string {
  const { viewWidth, viewHeight, elements } = shapeGeometry(attrs);
  const body = elements
    .map((el) => {
      const attrText = Object.entries(el.attrs)
        .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
        .join(' ');
      return `<${el.tag} ${attrText}/>`;
    })
    .join('');
  const width = Math.round(viewWidth * PT_TO_PX);
  const height = Math.round(viewHeight * PT_TO_PX);
  return `<svg class="beakblock-shape-svg" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${viewWidth} ${viewHeight}" overflow="visible">${body}</svg>`;
}

/** Builds the shape SVG as DOM nodes (SVG namespace). */
export function createShapeSvgElement(attrs: ShapeAttrs): SVGSVGElement {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const { viewWidth, viewHeight, elements } = shapeGeometry(attrs);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'beakblock-shape-svg');
  svg.setAttribute('width', String(Math.round(viewWidth * PT_TO_PX)));
  svg.setAttribute('height', String(Math.round(viewHeight * PT_TO_PX)));
  svg.setAttribute('viewBox', `0 0 ${viewWidth} ${viewHeight}`);
  svg.setAttribute('overflow', 'visible');
  for (const el of elements) {
    const node = document.createElementNS(SVG_NS, el.tag);
    for (const [name, value] of Object.entries(el.attrs)) node.setAttribute(name, value);
    svg.appendChild(node);
  }
  return svg;
}

/** Converts a value to a finite number, or `fallback`. */
export function numberOr(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
