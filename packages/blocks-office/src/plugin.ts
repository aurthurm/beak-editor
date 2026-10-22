/**
 * Office blocks plugin.
 *
 * Computes numbering, cross-reference text, variable values, computed values,
 * conditional visibility and repeat counts as node decorations. Nothing is
 * written into the document, and decorations are recalculated on every view
 * update, so changes to variables take effect with {@link refreshOfficeBlocks}.
 *
 * @module
 */

import { Decoration, DecorationSet, Plugin, PluginKey } from '@amusendame/beakblock-core';
import type { EditorState } from '@amusendame/beakblock-core';
import type { Node as PMNode } from 'prosemirror-model';

import { collectItemsFromDoc, resolveOfficeItems, type OfficeResolution } from './model';
import type { OfficeBlocksOptions, OfficeVariables } from './types';

/** Plugin key for the office blocks plugin. */
export const OFFICE_BLOCKS_PLUGIN_KEY = new PluginKey('beakblock-office-blocks');

/** Transaction meta that forces decorations to be recalculated. */
export const OFFICE_REFRESH_META = 'beakblock-office-refresh';

/** Reads the variable set from options (function or object). */
export function readOfficeVariables(options: OfficeBlocksOptions): OfficeVariables {
  const source = options.variables;
  if (typeof source === 'function') {
    try {
      return source() ?? {};
    } catch {
      return {};
    }
  }
  return source ?? {};
}

/**
 * Resolves all office items in a ProseMirror document.
 *
 * @param doc - Document node
 * @param options - Variables and cross-reference resolver
 */
export function resolveDocument(doc: PMNode, options: OfficeBlocksOptions = {}): OfficeResolution {
  return resolveOfficeItems(collectItemsFromDoc(doc), {
    variables: readOfficeVariables(options),
    crossReferenceResolver: options.crossReferenceResolver,
  });
}

/** Builds the decoration set for a document. */
export function buildOfficeDecorations(doc: PMNode, options: OfficeBlocksOptions = {}): DecorationSet {
  const { items } = resolveDocument(doc, options);
  const decorations: Decoration[] = [];
  for (const entry of items) {
    const { item } = entry;
    if (item.pos === undefined || item.nodeSize === undefined) continue;
    const from = item.pos;
    const to = item.pos + item.nodeSize;
    switch (item.kind) {
      case 'footnote':
      case 'endnote':
        decorations.push(
          Decoration.node(from, to, {}, { officeText: entry.number != null ? String(entry.number) : '?' })
        );
        break;
      case 'caption':
        decorations.push(
          Decoration.node(from, to, {
            'data-caption-label': entry.label ?? 'Figure',
            'data-caption-number': entry.number != null ? String(entry.number) : '',
          })
        );
        break;
      case 'crossReference':
      case 'variable':
      case 'computedValue':
        decorations.push(Decoration.node(from, to, {}, { officeText: entry.display ?? '' }));
        break;
      case 'conditional':
        decorations.push(
          Decoration.node(from, to, { 'data-condition-result': entry.visible === false ? 'false' : 'true' })
        );
        break;
      case 'repeatingSection':
        decorations.push(Decoration.node(from, to, { 'data-repeat-count': String(entry.count ?? 0) }));
        break;
      default:
        break;
    }
  }
  return DecorationSet.create(doc, decorations);
}

/**
 * Creates the office blocks plugin.
 *
 * @param options - Variables and cross-reference resolver
 */
export function createOfficeBlocksPlugin(options: OfficeBlocksOptions = {}): Plugin {
  return new Plugin({
    key: OFFICE_BLOCKS_PLUGIN_KEY,
    props: {
      decorations(state: EditorState) {
        return buildOfficeDecorations(state.doc, options);
      },
    },
  });
}
