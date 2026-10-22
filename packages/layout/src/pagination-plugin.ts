/**
 * ProseMirror plugin that draws page boundaries in the editor's Print Layout view.
 *
 * The plugin measures top-level blocks in the DOM, accumulates their heights against the
 * content height of a page setup, and draws a widget (footer with "Page X of Y", a gap,
 * and the next page's header) before each block that starts a new page. It never changes
 * the document: its transactions carry metadata only, and the test suite asserts that.
 *
 * Measurement is injectable (`measureBlock`) so the logic can be tested without layout.
 *
 * @module
 */

import type { IRSection } from '@amusendame/beakblock-ir';
import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { EditorView } from 'prosemirror-view';

import type { LayoutResult } from './types';

/** Pixels per point (CSS: 96 px per inch, 72 pt per inch). */
const PX_PER_PT = 96 / 72;

/** Options for {@link createPaginationPlugin}. */
export interface PaginationPluginOptions {
  /** Returns the current layout. Used for the page total and the resolved header text. */
  getLayout?: () => LayoutResult | null | undefined;
  /**
   * Page setup whose content height limits each page. Defaults to A4 portrait with
   * one-inch margins.
   */
  pageSetup?: IRSection['pageSetup'];
  /** Gap between pages in pixels. Defaults to 24. */
  pageGapPx?: number;
  /** Draw the next page's header text inside each boundary. Defaults to true. */
  showHeaders?: boolean;
  /**
   * Height in pixels of a top-level block (including its vertical margins). Defaults to
   * the rendered DOM height. Override in tests or when the DOM is not laid out.
   */
  measureBlock?: (view: EditorView, node: PMNode, pos: number) => number;
}

/** State of the pagination plugin. */
export interface PaginationState {
  /** Document positions of the blocks that start a new page (before each widget). */
  breaks: number[];
  /** Total number of pages shown in the widgets. */
  pageCount: number;
  /** Header text of the page that starts at each break, taken from the layout when available. */
  headers: string[];
}

/** Key of the pagination plugin state. Use it with `getState` to read the breaks. */
export const paginationPluginKey = new PluginKey<PaginationState>('beakblockPagination');

/** Content height of a page setup, in pixels (page height minus top and bottom margins). */
export function contentHeightPx(setup: IRSection['pageSetup']): number {
  const heightPt = setup.size.heightTwips / 20;
  const contentPt = heightPt - setup.margins.top / 20 - setup.margins.bottom / 20;
  return Math.max(contentPt, 1) * PX_PER_PT;
}

/** Default block measurement: rendered height plus vertical margins. */
function domBlockHeight(view: EditorView, _node: PMNode, pos: number): number {
  const dom = view.nodeDOM(pos);
  if (!(dom instanceof HTMLElement)) return 0;
  const rect = dom.getBoundingClientRect();
  const style = typeof getComputedStyle === 'function' ? getComputedStyle(dom) : null;
  const margin = style ? (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0) : 0;
  return rect.height + margin;
}

/**
 * Computes the page breaks of the document: block positions where the accumulated
 * height would exceed the content height of a page. A block taller than a page starts
 * its own page and is not split.
 *
 * @example
 * ```typescript
 * const breaks = computePageBreaks(view, 900, (v, node, pos) => node.nodeSize);
 * ```
 */
export function computePageBreaks(
  view: EditorView,
  limitPx: number,
  measureBlock: (view: EditorView, node: PMNode, pos: number) => number
): number[] {
  const breaks: number[] = [];
  let used = 0;
  view.state.doc.forEach((node, offset) => {
    const height = measureBlock(view, node, offset);
    if (used > 0 && used + height > limitPx) {
      breaks.push(offset);
      used = height;
    } else {
      used += height;
    }
  });
  return breaks;
}

/** Builds the boundary widget DOM for one break. */
function boundaryElement(
  pageLabel: string,
  headerText: string,
  gapPx: number,
  showHeaders: boolean
): HTMLElement {
  const element = document.createElement('div');
  element.className = 'bb-page-break';
  element.setAttribute('contenteditable', 'false');
  const footer = document.createElement('div');
  footer.className = 'bb-page-footer';
  footer.textContent = pageLabel;
  element.appendChild(footer);
  const gap = document.createElement('div');
  gap.className = 'bb-page-gap';
  gap.style.height = `${gapPx}px`;
  element.appendChild(gap);
  if (showHeaders) {
    const header = document.createElement('div');
    header.className = 'bb-page-header';
    header.textContent = headerText;
    element.appendChild(header);
  }
  return element;
}

/**
 * Creates the pagination plugin for the editor's Print Layout view.
 *
 * @example
 * ```typescript
 * const plugin = createPaginationPlugin({ getLayout: () => layout, pageSetup: ir.sections[0].pageSetup });
 * const state = EditorState.create({ schema, plugins: [plugin] });
 * ```
 */
export function createPaginationPlugin(options: PaginationPluginOptions = {}): Plugin {
  const limitPx = contentHeightPx(options.pageSetup ?? defaultSetup());
  const gapPx = options.pageGapPx ?? 24;
  const showHeaders = options.showHeaders ?? true;
  const measure = options.measureBlock ?? domBlockHeight;

  const headersFor = (count: number): string[] => {
    const layout = options.getLayout?.();
    if (!layout) return [];
    return Array.from({ length: count }, (_value, index) => {
      const page = layout.pages[index + 1];
      return page ? page.headerText.join(' ') : '';
    });
  };

  return new Plugin<PaginationState>({
    key: paginationPluginKey,
    state: {
      init(): PaginationState {
        return { breaks: [], pageCount: 1, headers: [] };
      },
      apply(tr: Transaction, value: PaginationState): PaginationState {
        const meta = tr.getMeta(paginationPluginKey) as Partial<PaginationState> | undefined;
        return meta ? { ...value, ...meta } : value;
      },
    },
    props: {
      decorations(state: EditorState) {
        const pluginState = paginationPluginKey.getState(state);
        if (!pluginState || pluginState.breaks.length === 0) return DecorationSet.empty;
        const layout = options.getLayout?.();
        const total = layout ? layout.pageCount : pluginState.pageCount;
        const decorations = pluginState.breaks.map((pos, index) => {
          const pageNumber = index + 2;
          const headerText = pluginState.headers[index] ?? '';
          return Decoration.widget(
            pos,
            () => boundaryElement(`Page ${pageNumber - 1} of ${total}`, headerText, gapPx, showHeaders),
            { side: -1, key: `bb-break-${pos}-${pageNumber}-${total}`, ignoreSelector: '.bb-page-break' }
          );
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
    view(editorView: EditorView) {
      let scheduled = false;
      let lastDoc = editorView.state.doc;

      const measureAndSchedule = () => {
        if (editorView.isDestroyed) return;
        const breaks = computePageBreaks(editorView, limitPx, measure);
        const pageCount = breaks.length + 1;
        const current = paginationPluginKey.getState(editorView.state);
        const same =
          current !== undefined &&
          current.breaks.length === breaks.length &&
          current.breaks.every((value, index) => value === breaks[index]);
        if (same) return;
        const tr = editorView.state.tr.setMeta(paginationPluginKey, {
          breaks,
          pageCount,
          headers: headersFor(pageCount),
        });
        editorView.dispatch(tr);
      };

      const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        Promise.resolve().then(() => {
          scheduled = false;
          measureAndSchedule();
        });
      };

      schedule();
      return {
        update(view: EditorView) {
          if (view.state.doc !== lastDoc) {
            lastDoc = view.state.doc;
            schedule();
          }
        },
        destroy() {
          scheduled = false;
        },
      };
    },
  });
}

/** A4 portrait with one-inch margins, used when no page setup is given. */
function defaultSetup(): IRSection['pageSetup'] {
  return {
    size: { widthTwips: 11906, heightTwips: 16838 },
    orientation: 'portrait',
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720, gutter: 0 },
  };
}
