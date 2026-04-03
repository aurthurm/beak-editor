/**
 * Document node specification.
 *
 * The root node of every ProseMirror document. Contains block-level content.
 *
 * @module
 */

import type { NodeSpec } from 'prosemirror-model';

/**
 * The document node spec.
 *
 * This is the root container for all content. It accepts one or more block nodes.
 *
 * @example
 * ```typescript
 * import { docNode } from '@beakblock/core';
 * // Used internally by createSchema()
 * ```
 */
export const docNode: NodeSpec = {
  content: 'block+',
};
