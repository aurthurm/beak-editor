/**
 * Paste plain-text Markdown from the clipboard as structured blocks.
 *
 * @module
 */

import { Slice } from 'prosemirror-model';
import type { Schema } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';

import { blocksToDoc } from '../blocks/blockToNode';
import { markdownToBlocks } from '../markdown/parse';
import { looksLikeMarkdown } from '../markdown/heuristic';

export type MarkdownPasteMode = boolean | 'heuristic';

export interface MarkdownPastePluginOptions {
  schema: Schema;
  /**
   * - `heuristic`: parse only when {@link looksLikeMarkdown} is true (default).
   * - `true`: always parse `text/plain` when there is no `text/html`.
   * - `false`: disable (use browser default paste).
   */
  mode?: MarkdownPasteMode;
}

/**
 * When the clipboard has plain text only, optionally interpret it as Markdown
 * and replace the selection with the resulting blocks.
 *
 * Rich HTML paste is left to ProseMirror’s default handler.
 */
export function createMarkdownPastePlugin(options: MarkdownPastePluginOptions): Plugin {
  const mode = options.mode ?? 'heuristic';

  return new Plugin({
    props: {
      handlePaste(view, event) {
        if (mode === false) return false;

        const cd = event.clipboardData;
        if (!cd) return false;

        if (cd.types.includes('text/html')) {
          return false;
        }

        const text = cd.getData('text/plain');
        if (!text?.trim()) return false;

        if (mode === 'heuristic' && !looksLikeMarkdown(text)) {
          return false;
        }

        event.preventDefault();
        const blocks = markdownToBlocks(text);
        const docFragment = blocksToDoc(options.schema, blocks).content;
        const slice = new Slice(docFragment, 0, 0);
        view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
        return true;
      },
    },
  });
}
