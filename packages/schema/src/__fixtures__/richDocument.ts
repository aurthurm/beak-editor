/**
 * Rich SOP fixture covering every core block type, inline content kind and
 * revision mark. Shared with other packages' tests through the `fixtures`
 * export of `@amusendame/beakblock-schema`.
 *
 * Inline items that the core `InlineContent` union does not yet type
 * (`field`, revision styles) are written as plain JSON and cast at the end.
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';

import { createPageSetup } from '../page';

const plain = (text: string) => ({ type: 'text', text, styles: {} });

/** Body of the SOP, without section breaks. */
const body = [
  {
    id: 'h-purpose',
    type: 'heading',
    props: { level: 1, textAlign: 'left', locked: false, lockReason: null, lockId: null },
    content: [plain('Purpose')],
  },
  {
    id: 'p-intro',
    type: 'paragraph',
    props: { textAlign: 'left' },
    content: [
      plain('This procedure describes '),
      { type: 'text', text: 'bold', styles: { bold: true } },
      plain(' and '),
      { type: 'text', text: 'italic code', styles: { italic: true, code: true } },
      plain(' with '),
      { type: 'text', text: 'red', styles: { textColor: '#C00000' } },
      plain(' and '),
      { type: 'text', text: 'marked', styles: { backgroundColor: '#FFFF00', fontSize: 12 } },
      plain(' and '),
      { type: 'text', text: 'struck', styles: { strikethrough: true, underline: true } },
      plain('. See '),
      {
        type: 'link',
        href: 'https://example.com/sop-index',
        title: 'SOP index',
        target: '_blank',
        content: [{ type: 'text', text: 'the index', styles: { bold: true } }],
      },
      { type: 'icon', icon: 'warning', symbol: '⚠', size: 14 },
      { type: 'hardBreak' },
      { type: 'field', fieldType: 'DOCPROPERTY', name: 'docNumber', fallback: 'SOP-001' },
      plain(' page '),
      { type: 'field', fieldType: 'PAGE', name: null },
      plain(' of '),
      { type: 'field', fieldType: 'NUMPAGES', name: null, fallback: '1' },
      plain(' '),
      {
        type: 'text',
        text: 'inserted',
        styles: {
          revision: {
            kind: 'insert',
            revisionId: 'rev-1',
            authorId: 'u-1',
            authorName: 'Asha',
            at: '2026-01-02T10:00:00.000Z',
            aiGenerated: false,
          },
        },
      },
      plain(' '),
      {
        type: 'text',
        text: 'deleted',
        styles: {
          revision: {
            kind: 'delete',
            revisionId: 'rev-2',
            authorName: 'Ben',
            at: '2026-01-03T09:30:00.000Z',
            aiGenerated: true,
          },
        },
      },
    ],
  },
  {
    id: 'p-styled',
    type: 'paragraph',
    props: {
      textAlign: 'center',
      styleId: 'Normal',
      spacing: { beforePt: 6, afterPt: 6, line: 276, lineRule: 'auto' },
      indent: { leftPt: 18, firstLinePt: 9 },
      keepNext: true,
      keepLines: false,
      tabs: [{ posPt: 72, kind: 'left' }],
    },
    content: [plain('Styled paragraph with paragraph properties.')],
  },
  {
    id: 'h-scope',
    type: 'heading',
    props: { level: 2, textAlign: 'left', locked: false, lockReason: null, lockId: null },
    content: [plain('Scope')],
  },
  {
    id: 'h-steps',
    type: 'heading',
    props: { level: 3, textAlign: 'right', locked: true, lockReason: 'approved', lockId: 'lock-1' },
    content: [plain('Steps')],
  },
  {
    id: 'h-4',
    type: 'heading',
    props: { level: 4, textAlign: 'left', locked: false, lockReason: null, lockId: null },
    content: [plain('Sub-steps')],
  },
  {
    id: 'h-5',
    type: 'heading',
    props: { level: 5, textAlign: 'left', locked: false, lockReason: null, lockId: null },
    content: [plain('Notes')],
  },
  {
    id: 'h-6',
    type: 'heading',
    props: { level: 6, textAlign: 'left', locked: false, lockReason: null, lockId: null },
    content: [plain('Details')],
  },
  {
    id: 'bl-1',
    type: 'bulletList',
    props: {},
    children: [
      {
        id: 'li-1',
        type: 'listItem',
        props: {},
        content: [plain('first bullet')],
        children: [
          {
            id: 'p-child-1',
            type: 'paragraph',
            props: { textAlign: 'left' },
            content: [plain('child paragraph under the first bullet')],
          },
          {
            id: 'bl-2',
            type: 'bulletList',
            props: {},
            children: [
              {
                id: 'li-2',
                type: 'listItem',
                props: {},
                content: [plain('nested bullet')],
              },
            ],
          },
        ],
      },
      {
        id: 'li-3',
        type: 'listItem',
        props: {},
        content: [plain('second bullet')],
      },
    ],
  },
  {
    id: 'ol-1',
    type: 'orderedList',
    props: { start: 3 },
    children: [
      {
        id: 'oli-1',
        type: 'listItem',
        props: {},
        content: [plain('third step')],
      },
      {
        id: 'oli-2',
        type: 'listItem',
        props: {},
        content: [plain('fourth step')],
        children: [
          {
            id: 'ol-2',
            type: 'orderedList',
            props: { start: 1 },
            children: [
              {
                id: 'oli-2a',
                type: 'listItem',
                props: {},
                content: [plain('sub step a')],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'cl-1',
    type: 'checkList',
    props: {},
    children: [
      {
        id: 'cli-1',
        type: 'checkListItem',
        props: { checked: true },
        content: [plain('gloves on')],
      },
      {
        id: 'cli-2',
        type: 'checkListItem',
        props: { checked: false },
        content: [plain('area clean')],
      },
    ],
  },
  {
    id: 'bq-1',
    type: 'blockquote',
    props: {},
    content: [plain('quoted text')],
  },
  {
    id: 'co-1',
    type: 'callout',
    props: { calloutType: 'warning' },
    content: [plain('Safety warning: wear eye protection.')],
  },
  {
    id: 'cb-1',
    type: 'codeBlock',
    props: { language: 'typescript' },
    content: [plain('const x = 1;\nconsole.log(x);')],
  },
  {
    id: 'dv-1',
    type: 'divider',
    props: {},
  },
  {
    id: 'img-1',
    type: 'image',
    props: {
      src: 'https://example.com/diagram.png',
      alt: 'Diagram',
      caption: 'Figure 1',
      width: 320,
      alignment: 'center',
    },
  },
  {
    id: 'cols-1',
    type: 'columnList',
    props: { gap: 16 },
    children: [
      {
        id: 'col-1',
        type: 'column',
        props: { width: 50 },
        children: [
          {
            id: 'p-col-1',
            type: 'paragraph',
            props: { textAlign: 'left' },
            content: [plain('left column')],
          },
        ],
      },
      {
        id: 'col-2',
        type: 'column',
        props: { width: 50 },
        children: [
          {
            id: 'p-col-2',
            type: 'paragraph',
            props: { textAlign: 'left' },
            content: [plain('right column')],
          },
        ],
      },
    ],
  },
  {
    id: 'em-1',
    type: 'embed',
    props: {
      url: 'https://www.youtube.com/watch?v=abc',
      provider: 'youtube',
      embedId: 'abc',
      caption: '',
      width: null,
      height: null,
      aspectRatio: '16:9',
    },
  },
  {
    id: 'toc-1',
    type: 'tableOfContents',
    props: { items: [{ id: 'h-purpose', level: 1, text: 'Purpose' }] },
  },
  {
    id: 'tbl-1',
    type: 'table',
    props: {
      widthMode: 'pct',
      widthValue: 5000,
      styleId: 'TableGrid',
      look: { headerRow: true, bandedRows: true, firstColumn: false, lastRow: false },
    },
    children: [
      {
        id: 'tr-1',
        type: 'tableRow',
        props: { isHeader: true, cantSplit: true, heightTwips: 400 },
        children: [
          {
            id: 'th-1',
            type: 'tableHeader',
            props: { colspan: 2, rowspan: 1, colwidth: [200, 200], backgroundColor: '#D9E2F3' },
            children: [
              { id: 'p-th-1', type: 'paragraph', props: { textAlign: 'left' }, content: [plain('Step')] },
            ],
          },
        ],
      },
      {
        id: 'tr-2',
        type: 'tableRow',
        props: {},
        children: [
          {
            id: 'td-1',
            type: 'tableCell',
            props: { colspan: 1, rowspan: 2, colwidth: [200], backgroundColor: null },
            children: [
              {
                id: 'p-td-1',
                type: 'paragraph',
                props: { textAlign: 'left' },
                content: [plain('merged vertically')],
              },
            ],
          },
          {
            id: 'td-2',
            type: 'tableCell',
            props: { colspan: 1, rowspan: 1, colwidth: [200], backgroundColor: null },
            children: [
              {
                id: 'bl-cell',
                type: 'bulletList',
                props: {},
                children: [
                  {
                    id: 'li-cell-1',
                    type: 'listItem',
                    props: {},
                    content: [plain('cell list item')],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'tr-3',
        type: 'tableRow',
        props: {},
        children: [
          {
            id: 'td-3',
            type: 'tableCell',
            props: { colspan: 1, rowspan: 1, colwidth: [200], backgroundColor: null },
            children: [
              { id: 'p-td-3', type: 'paragraph', props: { textAlign: 'left' }, content: [plain('last row')] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'pb-1',
    type: 'pageBreak',
    props: {},
  },
  {
    id: 'cs-1',
    type: 'controlledSection',
    props: {
      sectionId: 'sec-scope-1',
      title: 'Scope',
      templateSectionId: 'tpl-scope',
      policyRef: 'pol-1',
      required: true,
      allowedBlocks: null,
      ownerName: 'QA',
      workflowState: 'draft',
    },
    children: [
      {
        id: 'p-scope',
        type: 'paragraph',
        props: { textAlign: 'left' },
        content: [plain('Scope text inside a controlled section.')],
      },
    ],
  },
  {
    id: 'p-final',
    type: 'paragraph',
    props: { textAlign: 'left' },
    content: [
      plain('Figure '),
      { type: 'field', fieldType: 'SEQ', name: 'Figure', format: 'ARABIC' },
      plain(' see '),
      { type: 'field', fieldType: 'REF', name: 'h-purpose', fallback: 'Purpose' },
      plain(' on '),
      { type: 'field', fieldType: 'DATE', name: null, format: 'd MMMM yyyy' },
    ],
  },
  {
    id: 'h-appendix',
    type: 'heading',
    props: { level: 1, textAlign: 'left', locked: false, lockReason: null, lockId: null },
    content: [plain('Appendix')],
  },
  {
    id: 'p-appendix',
    type: 'paragraph',
    props: { textAlign: 'left' },
    content: [plain('Landscape appendix content.')],
  },
] as unknown as Block[];

/**
 * A rich single-section SOP covering every core block type (lists, tables with
 * spans, controlled sections, fields, revisions, links, icons, and more).
 */
export const richSopBlocks: Block[] = body;

/**
 * The same SOP split into two sections by a `sectionBreak` placed before the
 * appendix. The appendix section uses a landscape page setup.
 */
export const richSopBlocksWithSections: Block[] = (() => {
  const index = body.findIndex((block) => block.id === 'h-appendix');
  const sectionBreak = {
    id: 'sb-appendix',
    type: 'sectionBreak',
    props: { pageSetup: createPageSetup({ size: 'A4', orientation: 'landscape' }) },
  } as unknown as Block;
  return [...body.slice(0, index), sectionBreak, ...body.slice(index)];
})();
