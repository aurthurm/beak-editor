/**
 * Revision mark specifications (durable track changes).
 *
 * `insertion` and `deletion` marks carry revision metadata and render as
 * `<ins class="beakblock-ins">` and `<del class="beakblock-del">`. Contract §1.3.
 *
 * @module
 */

import type { DOMOutputSpec, Mark, MarkSpec } from 'prosemirror-model';

const REVISION_ATTRS = {
  revisionId: { default: '' },
  authorId: { default: null },
  authorName: { default: null },
  at: { default: '' },
  aiGenerated: { default: false },
  groupId: { default: null },
};

function revisionAttrsFromDom(dom: HTMLElement): Record<string, unknown> {
  return {
    revisionId: dom.getAttribute('data-revision-id') ?? '',
    authorId: dom.getAttribute('data-author-id'),
    authorName: dom.getAttribute('data-author-name'),
    at: dom.getAttribute('data-at') ?? '',
    aiGenerated: dom.getAttribute('data-ai-generated') === 'true',
    groupId: dom.getAttribute('data-group-id'),
  };
}

function revisionDomAttrs(mark: Mark, className: string): Record<string, string> {
  const attrs: Record<string, string> = {
    class: className,
    'data-revision-id': String(mark.attrs.revisionId ?? ''),
    'data-at': String(mark.attrs.at ?? ''),
  };
  if (mark.attrs.authorId) attrs['data-author-id'] = String(mark.attrs.authorId);
  if (mark.attrs.authorName) attrs['data-author-name'] = String(mark.attrs.authorName);
  if (mark.attrs.aiGenerated) attrs['data-ai-generated'] = 'true';
  if (mark.attrs.groupId) attrs['data-group-id'] = String(mark.attrs.groupId);
  return attrs;
}

/**
 * Insertion mark spec. Text inserted under review.
 *
 * Renders as `<ins class="beakblock-ins">`.
 */
export const insertionMark: MarkSpec = {
  attrs: REVISION_ATTRS,
  parseDOM: [
    {
      tag: 'ins.beakblock-ins',
      getAttrs(dom: HTMLElement) {
        return revisionAttrsFromDom(dom);
      },
    },
  ],
  toDOM(mark: Mark): DOMOutputSpec {
    return ['ins', revisionDomAttrs(mark, 'beakblock-ins'), 0];
  },
};

/**
 * Deletion mark spec. Text deleted under review (kept until accepted).
 *
 * Renders as `<del class="beakblock-del">`.
 */
export const deletionMark: MarkSpec = {
  attrs: REVISION_ATTRS,
  parseDOM: [
    {
      tag: 'del.beakblock-del',
      getAttrs(dom: HTMLElement) {
        return revisionAttrsFromDom(dom);
      },
    },
  ],
  toDOM(mark: Mark): DOMOutputSpec {
    return ['del', revisionDomAttrs(mark, 'beakblock-del'), 0];
  },
};
