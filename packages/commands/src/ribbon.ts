/**
 * Declarative ribbon layout and contextual tab detection.
 *
 * The ribbon only references command ids. Shells render the tabs and skip ids
 * that are not registered, so packages such as `ai`, `qms` and `review` can
 * contribute commands later without changing this file.
 *
 * @module
 */

import type { BeakBlockEditor, Node as PMNode } from '@amusendame/beakblock-core';
import { isInTable } from '@amusendame/beakblock-core';

import type { RibbonDefinition } from './types';

/**
 * Default Office-style ribbon: Home, Insert, Layout, References, Review, View and QMS,
 * plus the contextual Table, Picture, Chart and Controlled Section tabs.
 */
export function createDefaultRibbon(): RibbonDefinition {
  return {
    tabs: [
      {
        id: 'home',
        label: 'Home',
        groups: [
          {
            id: 'history',
            label: 'Undo',
            items: [
              { command: 'history.undo', size: 'small' },
              { command: 'history.redo', size: 'small' },
            ],
          },
          {
            id: 'font',
            label: 'Font',
            items: [
              { command: 'format.bold', kind: 'toggle', size: 'small' },
              { command: 'format.italic', kind: 'toggle', size: 'small' },
              { command: 'format.underline', kind: 'toggle', size: 'small' },
              { command: 'format.strikethrough', kind: 'toggle', size: 'small' },
              { command: 'format.code', kind: 'toggle', size: 'small' },
              { command: 'format.textColor', kind: 'color', size: 'small' },
              { command: 'format.highlight', kind: 'color', size: 'small' },
              { command: 'format.clearFormatting', size: 'small' },
            ],
          },
          {
            id: 'paragraph',
            label: 'Paragraph',
            items: [
              { command: 'list.bullet', kind: 'toggle', size: 'small' },
              { command: 'list.numbered', kind: 'toggle', size: 'small' },
              { command: 'list.check', kind: 'toggle', size: 'small' },
              { command: 'list.outdent', size: 'small' },
              { command: 'list.indent', size: 'small' },
              { command: 'paragraph.align.left', kind: 'toggle', size: 'small' },
              { command: 'paragraph.align.center', kind: 'toggle', size: 'small' },
              { command: 'paragraph.align.right', kind: 'toggle', size: 'small' },
              { command: 'paragraph.align.justify', kind: 'toggle', size: 'small' },
            ],
          },
          {
            id: 'styles',
            label: 'Styles',
            items: [
              { command: 'paragraph.style.normal', kind: 'gallery', size: 'large' },
              { command: 'paragraph.style.heading1', kind: 'gallery', size: 'large' },
              { command: 'paragraph.style.heading2', kind: 'gallery', size: 'large' },
              { command: 'paragraph.style.heading3', kind: 'gallery', size: 'large' },
              { command: 'paragraph.style.title', kind: 'gallery', size: 'large' },
              { command: 'paragraph.style.quote', kind: 'gallery', size: 'large' },
            ],
          },
        ],
      },
      {
        id: 'insert',
        label: 'Insert',
        groups: [
          {
            id: 'tables',
            label: 'Tables',
            items: [{ command: 'insert.table', kind: 'gallery', size: 'large' }],
          },
          {
            id: 'illustrations',
            label: 'Illustrations',
            items: [
              { command: 'insert.image', size: 'large' },
              { command: 'ai.generateImage', size: 'small' },
            ],
          },
          {
            id: 'blocks',
            label: 'Blocks',
            items: [
              { command: 'insert.callout', kind: 'gallery', size: 'small' },
              { command: 'insert.codeBlock', size: 'small' },
              { command: 'insert.divider', size: 'small' },
              { command: 'insert.columns', kind: 'gallery', size: 'small' },
            ],
          },
          {
            id: 'pages',
            label: 'Pages',
            items: [{ command: 'insert.pageBreak', size: 'small' }],
          },
          {
            id: 'fields',
            label: 'Fields',
            items: [
              { command: 'insert.field.page', size: 'small' },
              { command: 'insert.field.numPages', size: 'small' },
              { command: 'insert.field.docProperty', kind: 'dropdown', size: 'small' },
            ],
          },
        ],
      },
      {
        id: 'layout',
        label: 'Layout',
        groups: [
          {
            id: 'page-setup',
            label: 'Page Setup',
            items: [
              { command: 'layout.orientation', kind: 'dropdown', size: 'small' },
              { command: 'layout.size', kind: 'dropdown', size: 'small' },
              { command: 'layout.margins', kind: 'gallery', size: 'small' },
              { command: 'layout.sectionBreak', size: 'small' },
            ],
          },
          {
            id: 'arrange',
            label: 'Arrange',
            items: [{ command: 'insert.columns', kind: 'gallery', size: 'small' }],
          },
        ],
      },
      {
        id: 'references',
        label: 'References',
        groups: [
          {
            id: 'toc',
            label: 'Table of Contents',
            items: [{ command: 'insert.toc', size: 'large' }],
          },
          {
            id: 'captions',
            label: 'Captions',
            items: [
              { command: 'references.insertCaption', size: 'small' },
              { command: 'references.crossReference', size: 'small' },
            ],
          },
          {
            id: 'notes',
            label: 'Footnotes',
            items: [
              { command: 'references.insertFootnote', size: 'small' },
              { command: 'references.insertEndnote', size: 'small' },
            ],
          },
        ],
      },
      {
        id: 'review',
        label: 'Review',
        groups: [
          {
            id: 'tracking',
            label: 'Tracking',
            items: [{ command: 'review.toggleTrackChanges', kind: 'toggle', size: 'small' }],
          },
          {
            id: 'changes',
            label: 'Changes',
            items: [
              { command: 'review.acceptRevision', size: 'small' },
              { command: 'review.rejectRevision', size: 'small' },
              { command: 'review.acceptAll', size: 'small' },
              { command: 'review.rejectAll', size: 'small' },
            ],
          },
          {
            id: 'comments',
            label: 'Comments',
            items: [{ command: 'review.insertComment', size: 'small' }],
          },
          {
            id: 'view',
            label: 'Tracking View',
            items: [
              { command: 'review.view.markup', kind: 'dropdown', size: 'small' },
              { command: 'review.view.final', size: 'small' },
              { command: 'review.view.original', size: 'small' },
            ],
          },
        ],
      },
      {
        id: 'view',
        label: 'View',
        groups: [
          {
            id: 'modes',
            label: 'Editor Mode',
            items: [
              { command: 'view.mode.block', kind: 'toggle', size: 'small' },
              { command: 'view.mode.office', kind: 'toggle', size: 'small' },
              { command: 'view.mode.controlled', kind: 'toggle', size: 'small' },
            ],
          },
          {
            id: 'print',
            label: 'Print',
            items: [{ command: 'view.mode.print', size: 'small' }],
          },
        ],
      },
      {
        id: 'qms',
        label: 'QMS',
        groups: [
          {
            id: 'controlled',
            label: 'Controlled Document',
            items: [
              { command: 'qms.insertControlledSection', size: 'large' },
              { command: 'qms.insertDocumentIdentifier', size: 'small' },
              { command: 'qms.insertControlledNotice', size: 'small' },
            ],
          },
          {
            id: 'approval',
            label: 'Approval',
            items: [
              { command: 'qms.insertSignature', size: 'small' },
              { command: 'qms.insertApproval', size: 'small' },
              { command: 'qms.insertRevisionHistory', size: 'small' },
              { command: 'qms.insertAcknowledgement', size: 'small' },
            ],
          },
        ],
      },
      {
        id: 'table',
        label: 'Table Design',
        contextual: 'table',
        groups: [
          {
            id: 'rows-columns',
            label: 'Rows and Columns',
            items: [
              { command: 'table.insertRowAbove', size: 'small' },
              { command: 'table.insertRowBelow', size: 'small' },
              { command: 'table.insertColumnLeft', size: 'small' },
              { command: 'table.insertColumnRight', size: 'small' },
              { command: 'table.deleteRow', size: 'small' },
              { command: 'table.deleteColumn', size: 'small' },
              { command: 'table.deleteTable', size: 'small' },
            ],
          },
        ],
      },
      {
        id: 'picture',
        label: 'Picture',
        contextual: 'picture',
        groups: [
          {
            id: 'align',
            label: 'Alignment',
            items: [
              { command: 'picture.alignLeft', size: 'small' },
              { command: 'picture.alignCenter', size: 'small' },
              { command: 'picture.alignRight', size: 'small' },
            ],
          },
          {
            id: 'accessibility',
            label: 'Accessibility',
            items: [
              { command: 'picture.editAltText', size: 'small' },
              { command: 'picture.editCaption', size: 'small' },
            ],
          },
        ],
      },
      {
        id: 'chart',
        label: 'Chart',
        contextual: 'chart',
        groups: [
          {
            id: 'chart-tools',
            label: 'Chart',
            items: [
              { command: 'chart.editData', size: 'small' },
              { command: 'chart.changeType', kind: 'gallery', size: 'small' },
            ],
          },
        ],
      },
      {
        id: 'controlledSection',
        label: 'Controlled Section',
        contextual: 'controlledSection',
        groups: [
          {
            id: 'section',
            label: 'Section',
            items: [
              { command: 'controlledSection.rename', size: 'small' },
              { command: 'controlledSection.requestApproval', size: 'small' },
              { command: 'controlledSection.lock', kind: 'toggle', size: 'small' },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Contextual tabs that apply at the current selection, in a stable order:
 * `table` (caret in a table), `picture` (image selected), `chart` (chart or embed selected),
 * `controlledSection` (caret inside a controlled section).
 */
export function getContextualTabs(editor: BeakBlockEditor): string[] {
  const state = editor.pm.state;
  const found = new Set<string>();

  if (isInTable(state)) found.add('table');

  const selection = state.selection;
  // Duck-typed so it works across duplicate ProseMirror module instances.
  const selected = (selection as { node?: PMNode }).node;
  if (selected) {
    const name = selected.type.name;
    if (name === 'image') found.add('picture');
    if (name === 'chart' || name === 'embed') found.add('chart');
  }

  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node: PMNode = $from.node(depth);
    if (node.type.name === 'controlledSection') {
      found.add('controlledSection');
      break;
    }
  }

  const order = ['table', 'picture', 'chart', 'controlledSection'];
  return order.filter((tab) => found.has(tab));
}
