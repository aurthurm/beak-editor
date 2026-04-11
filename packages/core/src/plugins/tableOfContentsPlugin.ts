/**
 * Keeps tableOfContents nodes in sync with document headings.
 *
 * @module
 */

import type { Node as PMNode } from 'prosemirror-model';
import type { EditorState, Transaction } from 'prosemirror-state';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import type { TocHeadingItem } from '../schema/nodes/tableOfContents';

export const TABLE_OF_CONTENTS_PLUGIN_KEY = new PluginKey('beakblockTableOfContents');

export function collectHeadingTocItems(doc: PMNode): TocHeadingItem[] {
  const items: TocHeadingItem[] = [];
  doc.descendants((node) => {
    if (node.type.name !== 'heading') return;
    const text = node.textContent.trim();
    if (!text) return;
    const id = node.attrs.id;
    if (!id) return;
    items.push({
      id: String(id),
      level: Number(node.attrs.level) || 1,
      text,
    });
  });
  return items;
}

/**
 * Recompute heading outline and return a transaction that updates all TOC nodes, or null if nothing changed.
 */
export function buildTableOfContentsRefreshTransaction(state: EditorState): Transaction | null {
  if (!state.schema.nodes.tableOfContents) return null;

  const items = collectHeadingTocItems(state.doc);
  const itemsJson = JSON.stringify(items);

  const tocPositions: { pos: number; node: PMNode }[] = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'tableOfContents') {
      tocPositions.push({ pos, node });
    }
  });

  let tr = state.tr;
  let modified = false;
  for (const { pos, node } of tocPositions) {
    if (node.attrs.itemsJson !== itemsJson) {
      tr = tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        itemsJson,
      });
      modified = true;
    }
  }

  return modified ? tr : null;
}

/**
 * Manually re-sync every table of contents block (same logic as the plugin).
 * Normally unnecessary because the plugin runs on each edit; useful from the TOC options menu.
 */
export function refreshAllTableOfContents(view: EditorView): void {
  const tr = buildTableOfContentsRefreshTransaction(view.state);
  if (tr) view.dispatch(tr);
}

export function createTableOfContentsPlugin(): Plugin {
  return new Plugin({
    key: TABLE_OF_CONTENTS_PLUGIN_KEY,
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      return buildTableOfContentsRefreshTransaction(newState);
    },
  });
}
