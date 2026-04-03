/**
 * Text node specification.
 *
 * The leaf node that contains actual text content.
 *
 * @module
 */

import type { NodeSpec } from 'prosemirror-model';

/**
 * Text node spec.
 *
 * The inline text node. All visible text in the document is contained
 * in text nodes. Text nodes can have marks applied (bold, italic, etc.).
 */
export const textNode: NodeSpec = {
  group: 'inline',
};
