/**
 * Built-in ProseMirror node views.
 *
 * @module
 */

import type { NodeViewConstructor } from 'prosemirror-view';

import { CodeBlockNodeView } from './CodeBlockNodeView';
import { EmbedNodeView } from './EmbedNodeView';
import { TableOfContentsNodeView } from './TableOfContentsNodeView';

/** Use when merging `nodeViews` in framework adapters so the code block line gutter is preserved. */
export const codeBlockNodeView: NodeViewConstructor = (node, view, getPos) =>
  new CodeBlockNodeView(node, view, getPos);

/** Use when merging `nodeViews` in framework adapters so the default embed UI is preserved. */
export const embedNodeView: NodeViewConstructor = (node, view, getPos) => new EmbedNodeView(node, view, getPos);

/** Use when merging `nodeViews` in framework adapters so the default TOC UI is preserved. */
export const tableOfContentsNodeView: NodeViewConstructor = (node, view, getPos) =>
  new TableOfContentsNodeView(node, view, getPos);

export { CodeBlockNodeView } from './CodeBlockNodeView';
export { EmbedNodeView } from './EmbedNodeView';
export { TableOfContentsNodeView } from './TableOfContentsNodeView';
