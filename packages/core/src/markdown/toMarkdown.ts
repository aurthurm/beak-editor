/**
 * Serialize BeakBlock {@link Block} trees to Markdown.
 *
 * @module
 */

import { gfmToMarkdown } from 'mdast-util-gfm';
import { toMarkdown } from 'mdast-util-to-markdown';

import type { Block } from '../blocks/types';
import { blocksToMdastRoot } from './blocksToMdast';

export interface MarkdownSerializeOptions {
  /**
   * Emit GFM (tables, task lists, strikethrough).
   * @default true
   */
  gfm?: boolean;
  /**
   * Bullet list marker.
   * @default '-'
   */
  bullet?: '-' | '*' | '+';
}

/**
 * Serialize blocks to a Markdown string.
 *
 * **Fidelity:** Covers common block and inline types. Custom blocks, columns,
 * table of contents, and rich embeds degrade to placeholders or simplified
 * constructs; see `docs/markdown.md` in the repository.
 */
export function blocksToMarkdown(blocks: Block[], options?: MarkdownSerializeOptions): string {
  const gfm = options?.gfm !== false;
  const bullet = options?.bullet ?? '-';
  return toMarkdown(blocksToMdastRoot(blocks), {
    extensions: gfm ? [gfmToMarkdown()] : [],
    bullet,
  });
}
