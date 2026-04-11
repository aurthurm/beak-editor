/**
 * Parse Markdown strings into BeakBlock {@link Block} trees.
 *
 * @module
 */

import type { Root } from 'mdast';
import { unified } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';

import type { Block } from '../blocks/types';
import { mdastToBlocks } from './mdastToBlocks';

export interface MarkdownParseOptions {
  /**
   * Enable GitHub Flavored Markdown (tables, task lists, strikethrough, autolinks).
   * @default true
   */
  gfm?: boolean;
}

/**
 * Parse a Markdown document into blocks suitable for {@link BeakBlockEditor#setDocument}
 * or {@link blocksToDoc}.
 */
export function markdownToBlocks(markdown: string, options?: MarkdownParseOptions): Block[] {
  const useGfm = options?.gfm !== false;
  const processor = unified().use(remarkParse);
  if (useGfm) {
    processor.use(remarkGfm);
  }
  const tree = processor.parse(markdown) as Root;
  return mdastToBlocks(tree);
}
