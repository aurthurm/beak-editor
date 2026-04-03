/**
 * List item Enter handling for BeakBlock.
 *
 * Ensures Enter inside bullet and ordered lists creates a sibling list item
 * instead of splitting the paragraph inside the current item.
 *
 * @module
 */

import { Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { splitListItem } from 'prosemirror-schema-list';
import type { Schema } from 'prosemirror-model';

/**
 * Creates a plugin that handles Enter in bullet and ordered lists.
 *
 * @param schema - The ProseMirror schema
 * @returns A ProseMirror plugin
 */
export function createListEnterPlugin(schema: Schema): Plugin {
  const listItemType = schema.nodes.listItem;

  if (!listItemType) {
    return new Plugin({});
  }

  const splitListItemCommand = splitListItem(listItemType);

  return new Plugin({
    props: {
      handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
        if (event.key !== 'Enter' || event.shiftKey) {
          return false;
        }

        const { $from } = view.state.selection;

        // Let the checklist plugin keep owning checklist-specific Enter behavior.
        for (let depth = $from.depth; depth >= 0; depth--) {
          if ($from.node(depth).type.name === 'checkListItem') {
            return false;
          }
        }

        let listItemDepth: number | null = null;
        for (let depth = $from.depth; depth >= 0; depth--) {
          if ($from.node(depth).type === listItemType) {
            listItemDepth = depth;
            break;
          }
        }

        if (listItemDepth === null) {
          return false;
        }

        return splitListItemCommand(view.state, view.dispatch, view);
      },
    },
  });
}
