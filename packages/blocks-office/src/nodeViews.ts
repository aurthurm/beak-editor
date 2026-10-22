/**
 * Vanilla DOM node views for office blocks.
 *
 * Inline atoms read their display text from the outer decorations supplied
 * by the office plugin (`spec.officeText`), so they redraw when numbering or
 * variables change without a document edit.
 *
 * @module
 */

import type { Block, Decoration, NodeView } from '@amusendame/beakblock-core';
import type { Node as PMNode } from 'prosemirror-model';

import {
  createShapeSvgElement,
  equationSourceHtml,
  escapeHtml,
  numberOr,
  renderMathHtml,
  type ShapeAttrs,
} from './render';
import type { MathRenderer, ReusableContentResolver } from './types';
import { blockPlainText } from './model';

/** Text shown for an inline atom when no decoration supplies one. */
export interface AtomViewSpec {
  className: string;
  tag?: 'span' | 'sup';
  fallback: (attrs: Record<string, unknown>) => string;
  title?: (attrs: Record<string, unknown>) => string | undefined;
}

/** Reads the `officeText` spec from the outer decorations, if any. */
export function decorationText(decorations: readonly Decoration[]): string | undefined {
  for (const decoration of decorations) {
    const spec = (decoration as unknown as { spec?: { officeText?: unknown } }).spec;
    if (spec && typeof spec.officeText === 'string') return spec.officeText;
  }
  return undefined;
}

/** Inline atom view that displays decoration text, falling back to attrs. */
export class OfficeAtomNodeView implements NodeView {
  dom: HTMLElement;
  private node: PMNode;

  constructor(node: PMNode, decorations: readonly Decoration[], private readonly spec: AtomViewSpec) {
    this.node = node;
    this.dom = document.createElement(spec.tag ?? 'span');
    this.dom.className = spec.className;
    this.dom.setAttribute('contenteditable', 'false');
    this.render(node, decorations);
  }

  update(node: PMNode, decorations: readonly Decoration[]): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render(node, decorations);
    return true;
  }

  private render(node: PMNode, decorations: readonly Decoration[]): void {
    const attrs = node.attrs as Record<string, unknown>;
    this.dom.textContent = decorationText(decorations) ?? this.spec.fallback(attrs);
    const title = this.spec.title?.(attrs);
    if (title) this.dom.setAttribute('title', title);
    else this.dom.removeAttribute('title');
  }
}

/** Display or inline equation view. Renders with KaTeX when available, otherwise shows the source. */
export class EquationNodeView implements NodeView {
  dom: HTMLElement;

  constructor(
    node: PMNode,
    private readonly displayMode: boolean,
    private readonly getRenderer: () => MathRenderer | undefined
  ) {
    this.dom = document.createElement(displayMode ? 'div' : 'span');
    this.dom.className = displayMode ? 'beakblock-equation' : 'beakblock-inline-equation';
    this.dom.setAttribute('contenteditable', 'false');
    this.render(node);
  }

  update(node: PMNode): boolean {
    if (node.type.name !== (this.displayMode ? 'equation' : 'inlineEquation')) return false;
    this.render(node);
    return true;
  }

  private render(node: PMNode): void {
    const latex = String(node.attrs.latex ?? '');
    this.dom.setAttribute('data-latex', latex);
    const html = renderMathHtml(latex, this.displayMode, this.getRenderer());
    this.dom.innerHTML = html ?? equationSourceHtml(latex);
  }
}

/** Shape view. Renders the shape as inline SVG. */
export class ShapeNodeView implements NodeView {
  dom: HTMLElement;

  constructor(node: PMNode) {
    this.dom = document.createElement('div');
    this.dom.className = 'beakblock-shape';
    this.dom.setAttribute('contenteditable', 'false');
    this.render(node);
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'shape') return false;
    this.render(node);
    return true;
  }

  private render(node: PMNode): void {
    const a = node.attrs as Record<string, unknown>;
    const attrs: ShapeAttrs = {
      kind: String(a.kind ?? 'rect'),
      width: numberOr(a.width, 120),
      height: numberOr(a.height, 80),
      fill: a.fill ? String(a.fill) : null,
      stroke: String(a.stroke ?? '#334155'),
      strokeWidth: numberOr(a.strokeWidth, 1),
    };
    this.dom.replaceChildren(createShapeSvgElement(attrs));
  }
}

/**
 * Reusable content view. Shows a read-only preview of the pinned or floating
 * content, with a badge for the revision state.
 */
export class ReusableContentNodeView implements NodeView {
  dom: HTMLElement;

  constructor(node: PMNode, private readonly resolve: () => ReusableContentResolver | undefined) {
    this.dom = document.createElement('div');
    this.dom.className = 'beakblock-reusable';
    this.dom.setAttribute('contenteditable', 'false');
    this.render(node);
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'reusableContent') return false;
    this.render(node);
    return true;
  }

  private render(node: PMNode): void {
    const contentId = String(node.attrs.contentId ?? '');
    const revision = node.attrs.revision == null ? null : numberOr(node.attrs.revision, 0);
    const title = String(node.attrs.title ?? '');
    const resolver = this.resolve();
    let blocks: Block[] | null | undefined = null;
    if (resolver) {
      try {
        blocks = resolver(contentId, revision);
      } catch {
        blocks = null;
      }
    }

    const badge = revision == null ? 'Floating revision' : `Pinned to revision ${revision}`;
    const header = `<div class="beakblock-reusable-header"><span class="beakblock-reusable-title">${escapeHtml(
      title || contentId || 'Reusable content'
    )}</span><span class="beakblock-reusable-badge" data-pinned="${revision == null ? 'false' : 'true'}">${escapeHtml(
      badge
    )}</span></div>`;
    const body = blocks
      ? blocks
          .map((block) => blockPlainText(block))
          .filter((text) => text !== '')
          .map((text) => `<p>${escapeHtml(text)}</p>`)
          .join('')
      : '<p class="beakblock-reusable-missing">Content not available</p>';
    this.dom.innerHTML = `${header}<div class="beakblock-reusable-body">${body}</div>`;
  }
}
