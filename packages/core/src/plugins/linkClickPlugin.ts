/**
 * Link click handling plugin.
 *
 * Opens clicked links in a new tab/window from within the editor.
 *
 * @module
 */

import { Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/**
 * Creates a ProseMirror plugin that opens links on click.
 *
 * This keeps link interactions consistent inside the editor where anchors
 * would otherwise behave like regular editable content.
 */
export function createLinkClickPlugin(): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        click(view: EditorView, event: MouseEvent): boolean {
          if (event.button !== 0 || event.defaultPrevented) return false;

          const target = event.target as HTMLElement | null;
          const link = target?.closest('a[href]') as HTMLAnchorElement | null;
          if (!link) return false;

          const href = link.getAttribute('href');
          if (!href) return false;

          event.preventDefault();
          window.open(href, '_blank', 'noopener,noreferrer');
          view.focus();
          return true;
        },
      },
    },
  });
}
