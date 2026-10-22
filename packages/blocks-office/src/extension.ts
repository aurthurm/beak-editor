/**
 * Office blocks extension, slash menu items and refresh helper.
 *
 * @module
 */

import type {
  BeakBlockEditor,
  BeakExtension,
  EditorView,
  NodeViewConstructor,
  SlashMenuItem,
} from '@amusendame/beakblock-core';
import { createOfficeBlockDefinitions } from './definitions';
import { createOfficeNodeSpecs } from './nodes';
import { createOfficeBlocksPlugin, OFFICE_REFRESH_META } from './plugin';
import { injectOfficeBlocksStyles } from './styles';
import {
  EquationNodeView,
  OfficeAtomNodeView,
  ReusableContentNodeView,
  ShapeNodeView,
} from './nodeViews';
import type { OfficeBlocksOptions } from './types';

/** Builds a node view map for the office atoms. */
function createOfficeNodeViews(options: OfficeBlocksOptions): Record<string, NodeViewConstructor> {
  return {
    footnote: (node, _view, _getPos, decorations) =>
      new OfficeAtomNodeView(node, decorations, {
        tag: 'sup',
        className: 'beakblock-footnote',
        fallback: () => '?',
        title: (attrs) => (attrs.text ? String(attrs.text) : undefined),
      }),
    endnote: (node, _view, _getPos, decorations) =>
      new OfficeAtomNodeView(node, decorations, {
        tag: 'sup',
        className: 'beakblock-endnote',
        fallback: () => '?',
        title: (attrs) => (attrs.text ? String(attrs.text) : undefined),
      }),
    inlineEquation: (node) => new EquationNodeView(node, false, () => options.renderMath),
    equation: (node) => new EquationNodeView(node, true, () => options.renderMath),
    crossReference: (node, _view, _getPos, decorations) =>
      new OfficeAtomNodeView(node, decorations, {
        className: 'beakblock-xref',
        fallback: () => '?',
      }),
    variable: (node, _view, _getPos, decorations) =>
      new OfficeAtomNodeView(node, decorations, {
        className: 'beakblock-variable',
        fallback: (attrs) => `[${String(attrs.name ?? '')}]`,
      }),
    computedValue: (node, _view, _getPos, decorations) =>
      new OfficeAtomNodeView(node, decorations, {
        className: 'beakblock-computed',
        fallback: () => '…',
      }),
    shape: (node) => new ShapeNodeView(node),
    reusableContent: (node) => new ReusableContentNodeView(node, () => options.resolveReusableContent),
  };
}

/**
 * Creates the office blocks extension.
 *
 * Contributes the nodes, the numbering and smart-content plugin, node views and
 * block definitions, and injects the office stylesheet unless `injectStyles` is `false`.
 * Pass it in `extensions` when creating the editor.
 *
 * @param options - Variables, math renderer, reusable content and cross-reference resolvers
 *
 * @example
 * ```typescript
 * const editor = new BeakBlockEditor({
 *   element,
 *   mode: 'office',
 *   extensions: [officeBlocksExtension({ variables: () => ({ procedureType: 'micro' }) })],
 * });
 * ```
 */
export function officeBlocksExtension(options: OfficeBlocksOptions = {}): BeakExtension {
  // Conditional hiding, footnote marks and captions are drawn by this stylesheet, so it is
  // injected here, as the core editor does for its own styles.
  if (options.injectStyles !== false) injectOfficeBlocksStyles();
  return {
    name: 'office-blocks',
    nodes: createOfficeNodeSpecs(),
    plugins: () => [createOfficeBlocksPlugin(options)],
    nodeViews: createOfficeNodeViews(options),
    blocks: createOfficeBlockDefinitions(options),
  };
}

/**
 * Forces office decorations (numbering, variables, conditions) to recalculate.
 * Call after changing the variables an app supplies.
 *
 * @param editor - The editor to refresh
 */
export function refreshOfficeBlocks(editor: BeakBlockEditor): void {
  const tr = editor.pm.createTransaction();
  tr.setMeta(OFFICE_REFRESH_META, true);
  editor.pm.dispatch(tr);
}

/** Generates an id for a new block or inline atom. */
function newId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `office-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Inserts a node at the selection, or at the current block.
 * Containers are filled with the minimum required content.
 */
function insertOfficeNode(view: EditorView, typeName: string, attrs: Record<string, unknown> = {}): void {
  const type = view.state.schema.nodes[typeName];
  if (!type) return;
  const node = type.createAndFill({ id: newId(), ...attrs });
  if (!node) return;
  view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
}

/**
 * Slash menu items for office blocks. Apps pass these to their slash menu
 * alongside the default items.
 *
 * @example
 * ```typescript
 * const items = [...getDefaultSlashMenuItems(schema), ...officeSlashItems];
 * ```
 */
export const officeSlashItems: SlashMenuItem[] = [
  {
    id: 'office-footnote',
    title: 'Footnote',
    description: 'Insert a footnote reference',
    icon: 'footnote',
    keywords: ['footnote', 'note'],
    group: 'Office',
    action: (view) => insertOfficeNode(view, 'footnote', { text: '' }),
  },
  {
    id: 'office-endnote',
    title: 'Endnote',
    description: 'Insert an endnote reference',
    icon: 'endnote',
    keywords: ['endnote', 'note'],
    group: 'Office',
    action: (view) => insertOfficeNode(view, 'endnote', { text: '' }),
  },
  {
    id: 'office-equation',
    title: 'Equation',
    description: 'Insert a display equation (LaTeX)',
    icon: 'equation',
    keywords: ['equation', 'math', 'latex', 'formula'],
    group: 'Office',
    action: (view) => insertOfficeNode(view, 'equation', { latex: 'E = mc^2' }),
  },
  {
    id: 'office-figure-caption',
    title: 'Figure caption',
    description: 'Insert a numbered figure caption',
    icon: 'caption',
    keywords: ['figure', 'caption'],
    group: 'Office',
    action: (view) => insertOfficeNode(view, 'caption', { label: 'Figure' }),
  },
  {
    id: 'office-table-caption',
    title: 'Table caption',
    description: 'Insert a numbered table caption',
    icon: 'caption',
    keywords: ['table', 'caption'],
    group: 'Office',
    action: (view) => insertOfficeNode(view, 'caption', { label: 'Table' }),
  },
  {
    id: 'office-text-box',
    title: 'Text box',
    description: 'Insert a bordered text box',
    icon: 'textbox',
    keywords: ['text box', 'box', 'frame'],
    group: 'Office',
    action: (view) => insertOfficeNode(view, 'textBox', {}),
  },
  {
    id: 'office-shape-rect',
    title: 'Rectangle',
    description: 'Insert a rectangle shape',
    icon: 'shape',
    keywords: ['rectangle', 'shape', 'box'],
    group: 'Office',
    action: (view) => insertOfficeNode(view, 'shape', { kind: 'rect' }),
  },
  {
    id: 'office-shape-ellipse',
    title: 'Ellipse',
    description: 'Insert an ellipse shape',
    icon: 'shape',
    keywords: ['ellipse', 'circle', 'shape'],
    group: 'Office',
    action: (view) => insertOfficeNode(view, 'shape', { kind: 'ellipse' }),
  },
  {
    id: 'office-shape-arrow',
    title: 'Arrow',
    description: 'Insert an arrow shape',
    icon: 'shape',
    keywords: ['arrow', 'shape', 'line'],
    group: 'Office',
    action: (view) => insertOfficeNode(view, 'shape', { kind: 'arrow' }),
  },
  {
    id: 'smart-conditional',
    title: 'Conditional section',
    description: 'Show content only when a condition is true',
    icon: 'condition',
    keywords: ['if', 'condition', 'conditional', 'show', 'hide'],
    group: 'Smart content',
    action: (view) => insertOfficeNode(view, 'conditional', { expression: 'true' }),
  },
  {
    id: 'smart-repeating-section',
    title: 'Repeating section',
    description: 'Repeat content for each item in a list',
    icon: 'repeat',
    keywords: ['repeat', 'repeating', 'loop', 'list', 'items'],
    group: 'Smart content',
    action: (view) => insertOfficeNode(view, 'repeatingSection', { itemsKey: '', min: 0, max: null }),
  },
];
