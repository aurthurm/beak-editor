/**
 * Revision mark specs (`insertion` and `deletion`) for durable track changes.
 *
 * Attributes follow contract section 1.3. `groupId` is an additional optional attribute that ties the
 * deletion and insertion halves of a replacement together, so the grouping survives a reload.
 * Both marks are non-inclusive and have an empty `excludes`, so revisions by different authors can
 * overlap on the same text (nested revisions).
 *
 * @module
 */

import type { Attrs, DOMOutputSpec, Mark, MarkSpec } from 'prosemirror-model';

/** Attribute specs shared by both revision marks. */
export const REVISION_MARK_ATTRS = {
  revisionId: { default: null },
  authorId: { default: null },
  authorName: { default: null },
  at: { default: null },
  aiGenerated: { default: false },
  groupId: { default: null },
};

function readRevisionAttrs(dom: HTMLElement): Attrs {
  return {
    revisionId: dom.getAttribute('data-revision-id'),
    authorId: dom.getAttribute('data-author-id'),
    authorName: dom.getAttribute('data-author-name'),
    at: dom.getAttribute('data-at'),
    aiGenerated: dom.getAttribute('data-ai-generated') === 'true',
    groupId: dom.getAttribute('data-group-id'),
  };
}

function revisionToDOM(tag: 'ins' | 'del', className: string, label: string) {
  return (mark: Mark): DOMOutputSpec => {
    const a = mark.attrs;
    const attrs: Record<string, string> = { class: className };
    if (a.revisionId) attrs['data-revision-id'] = String(a.revisionId);
    if (a.authorId) attrs['data-author-id'] = String(a.authorId);
    if (a.authorName) attrs['data-author-name'] = String(a.authorName);
    if (a.at) attrs['data-at'] = String(a.at);
    if (a.groupId) attrs['data-group-id'] = String(a.groupId);
    if (a.aiGenerated) attrs['data-ai-generated'] = 'true';
    attrs.title = `${label} by ${String(a.authorName ?? a.authorId ?? 'unknown')}${a.at ? ` on ${String(a.at)}` : ''}`;
    return [tag, attrs, 0];
  };
}

/**
 * Mark for inserted text. Renders as `<ins class="beakblock-ins" data-revision-id>`.
 *
 * @example
 * ```typescript
 * const schema = new Schema({ nodes, marks: { ...DEFAULT_MARKS, insertion: insertionMarkSpec, deletion: deletionMarkSpec } });
 * ```
 */
export const insertionMarkSpec: MarkSpec = {
  attrs: REVISION_MARK_ATTRS,
  inclusive: false,
  excludes: '',
  parseDOM: [
    { tag: 'ins.beakblock-ins', getAttrs: (dom) => readRevisionAttrs(dom as HTMLElement) },
    { tag: 'ins', getAttrs: (dom) => readRevisionAttrs(dom as HTMLElement) },
  ],
  toDOM: revisionToDOM('ins', 'beakblock-ins', 'Inserted'),
};

/**
 * Mark for deleted text. The text stays in the document until the deletion is accepted.
 * Renders as `<del class="beakblock-del" data-revision-id>`.
 */
export const deletionMarkSpec: MarkSpec = {
  attrs: REVISION_MARK_ATTRS,
  inclusive: false,
  excludes: '',
  parseDOM: [
    { tag: 'del.beakblock-del', getAttrs: (dom) => readRevisionAttrs(dom as HTMLElement) },
    { tag: 'del', getAttrs: (dom) => readRevisionAttrs(dom as HTMLElement) },
  ],
  toDOM: revisionToDOM('del', 'beakblock-del', 'Deleted'),
};
