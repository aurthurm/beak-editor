/**
 * Review views: toggling the Markup, Final and Original projections, and projecting Block JSON.
 *
 * @module
 */

import { isBuiltinInline, type Block, type InlineContent } from '@amusendame/beakblock-core';

import type { ReviewView } from './types';
import { revisionRefOf } from './util';

/** All review view names. */
export const REVIEW_VIEWS: readonly ReviewView[] = ['markup', 'final', 'original'];

/** Class prefix applied to the editor root. CSS hides `<del>` in Final and `<ins>` in Original. */
export const REVIEW_VIEW_CLASS_PREFIX = 'beakblock-review-view-';

/** Anything with a DOM root: an element, or an EditorView (which has `dom`). */
export type ReviewViewTarget = HTMLElement | { dom: HTMLElement } | null | undefined;

/**
 * Sets the review view on the editor root element. Replaces any existing
 * `beakblock-review-view-*` class.
 *
 * @example
 * ```typescript
 * setReviewView(view.dom, 'final');
 * ```
 */
export function setReviewView(target: ReviewViewTarget, view: ReviewView): void {
  const el = target && 'dom' in target ? target.dom : (target as HTMLElement | null | undefined);
  if (!el || !el.classList) return;
  for (const name of REVIEW_VIEWS) {
    el.classList.remove(`${REVIEW_VIEW_CLASS_PREFIX}${name}`);
  }
  el.classList.add(`${REVIEW_VIEW_CLASS_PREFIX}${view}`);
}

/** Reads the current review view from the root element classes. Defaults to `markup`. */
export function getReviewView(target: ReviewViewTarget): ReviewView {
  const el = target && 'dom' in target ? target.dom : (target as HTMLElement | null | undefined);
  if (!el || !el.classList) return 'markup';
  for (const name of REVIEW_VIEWS) {
    if (el.classList.contains(`${REVIEW_VIEW_CLASS_PREFIX}${name}`)) return name;
  }
  return 'markup';
}

function projectInline(content: InlineContent[], view: ReviewView): InlineContent[] {
  const out: InlineContent[] = [];
  for (const item of content) {
    if (!isBuiltinInline(item)) {
      out.push(item);
      continue;
    }
    if (item.type === 'text') {
      const ref = revisionRefOf(item.styles);
      if (view === 'final' && ref?.kind === 'delete') continue;
      if (view === 'original' && ref?.kind === 'insert') continue;
      if (!ref) {
        out.push(item);
      } else {
        const styles: Record<string, unknown> = { ...item.styles };
        delete styles.revision;
        out.push({ ...item, styles: styles as typeof item.styles });
      }
      continue;
    }
    if (item.type === 'link') {
      const inner = projectInline(item.content as InlineContent[], view).filter(
        (x): x is Extract<InlineContent, { type: 'text' }> => x.type === 'text'
      );
      if (inner.length > 0) out.push({ ...item, content: inner });
      continue;
    }
    out.push(item);
  }
  return out;
}

function textLength(content: InlineContent[] | undefined): number {
  if (!content) return 0;
  return content.reduce((n, item) => {
    if (!isBuiltinInline(item)) return n;
    if (item.type === 'text') return n + item.text.length;
    if (item.type === 'link') return n + item.content.reduce((m, t) => m + t.text.length, 0);
    return n;
  }, 0);
}

function projectBlock(block: Block, view: ReviewView): Block | null {
  const next: Block = { ...block, props: { ...block.props } };
  if (block.content) {
    const before = textLength(block.content);
    const kept = projectInline(block.content, view);
    const after = textLength(kept);
    // A block whose text is entirely removed by the view is dropped.
    if (before > 0 && after === 0) return null;
    next.content = kept;
  }
  if (block.children && block.children.length > 0) {
    const children = projectBlocks(block.children, view);
    if (children.length === 0) return null;
    next.children = children;
  }
  return next;
}

/**
 * Projects Block JSON into one review view.
 *
 * - `final`: drops deleted text and unmarks inserted text.
 * - `original`: drops inserted text and unmarks deleted text.
 * - `markup`: returns a copy with the revision references kept.
 *
 * Blocks whose text is entirely removed by the projection are dropped. Input is never mutated.
 *
 * @example
 * ```typescript
 * const finalBlocks = projectBlocks(blocks, 'final');
 * ```
 */
export function projectBlocks(blocks: Block[], view: ReviewView): Block[] {
  if (view === 'markup') return JSON.parse(JSON.stringify(blocks)) as Block[];
  const out: Block[] = [];
  for (const block of blocks) {
    const projected = projectBlock(block, view);
    if (projected) out.push(projected);
  }
  return out;
}
