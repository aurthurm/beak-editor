/**
 * Checklist plugin for BeakBlock.
 *
 * Handles checkbox click interactions and keyboard behavior in check list items.
 *
 * @module
 */

import { Plugin, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

/**
 * Configuration for the checklist plugin.
 */
export interface ChecklistPluginConfig {
  /**
   * Callback when a checkbox is toggled.
   */
  onToggle?: (checked: boolean, itemId: string | null) => void;
}

/**
 * Creates a plugin that handles checkbox interactions in check lists.
 *
 * @param config - Configuration options
 * @returns A ProseMirror plugin
 */
export function createChecklistPlugin(config: ChecklistPluginConfig = {}): Plugin {
  return new Plugin({
    props: {
      handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
        const { state } = view;
        const { selection } = state;
        const { $from } = selection;

        // Check if we're inside a checkListItem
        let checkListItemDepth: number | null = null;
        for (let depth = $from.depth; depth >= 0; depth--) {
          if ($from.node(depth).type.name === 'checkListItem') {
            checkListItemDepth = depth;
            break;
          }
        }

        if (checkListItemDepth === null) return false;

        const checkListItem = $from.node(checkListItemDepth);
        const checkListItemPos = $from.before(checkListItemDepth);

        // Shift+Enter: Insert hard break (soft line break within the item)
        if (event.key === 'Enter' && event.shiftKey) {
          const hardBreak = state.schema.nodes.hardBreak;
          if (hardBreak) {
            const tr = state.tr.replaceSelectionWith(hardBreak.create());
            view.dispatch(tr);
            return true;
          }
        }

        // Enter without shift
        if (event.key === 'Enter' && !event.shiftKey) {
          // Check if the checkListItem is empty (only contains an empty paragraph or no text content)
          const isEmpty = checkListItem.textContent.trim() === '';

          if (isEmpty) {
            // Exit checklist: delete this empty item and create a paragraph after the checkList
            const checkListDepth = checkListItemDepth - 1;
            if (checkListDepth >= 0 && $from.node(checkListDepth).type.name === 'checkList') {
              const checkList = $from.node(checkListDepth);
              const checkListPos = $from.before(checkListDepth);

              // If this is the only item, replace the whole checklist with a paragraph
              if (checkList.childCount === 1) {
                const paragraph = state.schema.nodes.paragraph.create();
                const tr = state.tr.replaceWith(
                  checkListPos,
                  checkListPos + checkList.nodeSize,
                  paragraph
                );
                view.dispatch(tr.scrollIntoView());
                return true;
              }

              // Otherwise, delete just this item and insert a paragraph after the checkList
              const tr = state.tr;

              // Delete the empty checkListItem
              tr.delete(checkListItemPos, checkListItemPos + checkListItem.nodeSize);

              // Find the new position after the checklist (after deletion, positions shift)
              const newCheckListPos = tr.mapping.map(checkListPos);
              const checkListNode = tr.doc.nodeAt(newCheckListPos);
              const newCheckListEndPos = newCheckListPos + (checkListNode ? checkListNode.nodeSize : 0);

              // Insert a paragraph after the checklist
              const paragraph = state.schema.nodes.paragraph.create();
              tr.insert(newCheckListEndPos, paragraph);

              // Set selection to the new paragraph
              const $insertPos = tr.doc.resolve(newCheckListEndPos + 1);
              tr.setSelection(TextSelection.near($insertPos));

              view.dispatch(tr.scrollIntoView());
              return true;
            }
          }
        }

        return false;
      },
      handleDOMEvents: {
        click(view: EditorView, event: Event): boolean {
          const mouseEvent = event as MouseEvent;
          const target = mouseEvent.target as HTMLElement;

          // Check if we clicked on a checkbox
          if (
            target.tagName === 'INPUT' &&
            target.getAttribute('type') === 'checkbox' &&
            target.classList.contains('beakblock-checklist-checkbox')
          ) {
            // Find the parent list item
            const listItem = target.closest('.beakblock-checklist-item');
            if (!listItem) return false;

            // Get the position of the list item in the document
            const pos = view.posAtDOM(listItem, 0);
            if (pos === null || pos === undefined) return false;

            // Resolve position and find the check list item node
            const $pos = view.state.doc.resolve(pos);
            let checkListItemPos: number | null = null;
            let checkListItemNode = null;

            // Walk up the node tree to find the checkListItem node
            for (let depth = $pos.depth; depth >= 0; depth--) {
              const node = $pos.node(depth);
              if (node.type.name === 'checkListItem') {
                checkListItemPos = $pos.before(depth);
                checkListItemNode = node;
                break;
              }
            }

            if (checkListItemPos === null || !checkListItemNode) return false;

            // Toggle the checked state
            const newChecked = !checkListItemNode.attrs.checked;
            const tr = view.state.tr.setNodeMarkup(checkListItemPos, undefined, {
              ...checkListItemNode.attrs,
              checked: newChecked,
            });

            view.dispatch(tr);

            // Call the onToggle callback
            config.onToggle?.(newChecked, checkListItemNode.attrs.id);

            // Prevent the default checkbox behavior since we're handling it
            event.preventDefault();
            return true;
          }

          return false;
        },
      },
    },
  });
}
