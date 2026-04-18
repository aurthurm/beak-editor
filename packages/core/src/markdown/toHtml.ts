/**
 * Serialize BeakBlock {@link Block} trees to HTML.
 *
 * @module
 */

import { toHtml } from 'hast-util-to-html';
import { toHast } from 'mdast-util-to-hast';

import type { Block } from '../blocks/types';
import { blocksToMdastRoot } from './blocksToMdast';

/**
 * Serialize blocks to an HTML fragment (no `html` / `body` wrapper).
 *
 * **Fidelity:** Matches {@link blocksToMarkdown} via the same mdast pipeline; inline HTML
 * from underline styling is preserved when `allowDangerousHtml` is used downstream.
 */
export function blocksToHtml(blocks: Block[]): string {
  const mdast = blocksToMdastRoot(blocks);
  const hast = toHast(mdast, { allowDangerousHtml: true });
  if (!hast) return '';
  return toHtml(hast, { allowDangerousHtml: true });
}
