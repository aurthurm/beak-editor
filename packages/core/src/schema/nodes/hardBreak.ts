/**
 * Hard break node specification.
 *
 * Represents a line break within a block (Shift+Enter).
 *
 * @module
 */

import type { NodeSpec } from 'prosemirror-model';

/**
 * Hard break (line break) node.
 *
 * Allows line breaks within text blocks without creating new blocks.
 */
export const hardBreakNode: NodeSpec = {
  inline: true,
  group: 'inline',
  selectable: false,
  parseDOM: [{ tag: 'br' }],
  toDOM() {
    return ['br'];
  },
};
