import type { Block } from '@amusendame/beakblock-core';
import { createDefaultChartData } from '@amusendame/beakblock-vue';

function createChart(
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea',
  title: string,
  labels: string[],
  data: number[],
  mode: 'default' | 'random' | 'gradient' = 'default'
) {
  const chart = createDefaultChartData(type);
  chart.data = {
    labels,
    datasets: [
      {
        ...chart.data.datasets[0],
        label: title,
        data,
        borderWidth: 2,
      },
    ],
  };
  chart.options = {
    ...chart.options,
    colorScheme: { mode },
    plugins: {
      ...chart.options?.plugins,
      title: {
        ...chart.options?.plugins?.title,
        display: true,
        text: title,
      },
      legend: {
        ...chart.options?.plugins?.legend,
        display: true,
        position: 'top',
      },
    },
  };
  return chart;
}

export const sampleDocument: Block[] = [
  {
    id: 'heading-1',
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: 'BeakBlock Vue Showcase', styles: {} }],
  },
  {
    id: 'paragraph-1',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'This page demonstrates ', styles: {} },
      { type: 'text', text: 'formatting', styles: { bold: true } },
      { type: 'text', text: ', ', styles: {} },
      { type: 'text', text: 'links', styles: { italic: true } },
      { type: 'text', text: ', inline ', styles: {} },
      { type: 'icon', icon: 'lucide:sparkles', symbol: '✦', size: 34 },
      { type: 'text', text: ', and ', styles: {} },
      {
        type: 'link',
        href: 'https://github.com/beak-insights/beakblock',
        title: 'BeakBlock repository',
        target: '_blank',
        content: [{ type: 'text', text: 'clickable links', styles: { underline: true } }],
      },
      { type: 'text', text: ' living in the same editor.', styles: {} },
    ],
  },
  {
    id: 'callout-1',
    type: 'callout',
    props: { calloutType: 'note' },
    content: [
      { type: 'text', text: 'Note: ', styles: { bold: true } },
      { type: 'text', text: 'Menus, tables, charts, icons, emoji, and overlays all use the same document model.', styles: {} },
    ],
  },
  {
    id: 'blockquote-1',
    type: 'blockquote',
    props: {},
    content: [
      { type: 'text', text: 'Good editor design disappears into the page. The controls should feel attached to the content, not layered on top of it.', styles: {} },
    ],
  },
  {
    id: 'divider-1',
    type: 'divider',
    props: {},
  },
  {
    id: 'heading-formatting',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Typography and inline styling', styles: {} }],
  },
  {
    id: 'paragraph-formatting',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'BeakBlock supports ', styles: {} },
      { type: 'text', text: 'bold', styles: { bold: true } },
      { type: 'text', text: ', ', styles: {} },
      { type: 'text', text: 'italic', styles: { italic: true } },
      { type: 'text', text: ', ', styles: {} },
      { type: 'text', text: 'underline', styles: { underline: true } },
      { type: 'text', text: ', ', styles: {} },
      { type: 'text', text: 'strikethrough', styles: { strikethrough: true } },
      { type: 'text', text: ', ', styles: {} },
      { type: 'text', text: 'inline code', styles: { code: true } },
      { type: 'text', text: ', ', styles: {} },
      { type: 'text', text: 'tinted text', styles: { textColor: '#0f766e', backgroundColor: '#ecfccb', fontSize: 18 } },
      { type: 'text', text: ', and a larger sentence fragment.', styles: {} },
    ],
  },
  {
    id: 'paragraph-formatting-2',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'The editor also handles keyboard shortcuts, JSON round-tripping, and nested block content without changing the document shape.', styles: {} },
    ],
  },
  {
    id: 'divider-2',
    type: 'divider',
    props: {},
  },
  {
    id: 'heading-lists',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Lists and task tracking', styles: {} }],
  },
  {
    id: 'bullet-list-1',
    type: 'bulletList',
    props: {},
    children: [
      { id: 'bullet-item-1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Bullet lists split correctly with Enter', styles: {} }] },
      { id: 'bullet-item-2', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Ordered lists preserve sequence numbering', styles: {} }] },
      { id: 'bullet-item-3', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Checklist items stay interactive and round-trip in JSON', styles: {} }] },
    ],
  },
  {
    id: 'ordered-list-1',
    type: 'orderedList',
    props: { start: 1 },
    children: [
      { id: 'ordered-item-1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Type /list or use the toolbar', styles: {} }] },
      { id: 'ordered-item-2', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Press Enter to create the next item', styles: {} }] },
      { id: 'ordered-item-3', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Use Tab and Shift+Tab for nesting', styles: {} }] },
    ],
  },
  {
    id: 'checklist-1',
    type: 'checkList',
    props: {},
    children: [
      { id: 'check-item-1', type: 'checkListItem', props: { checked: true }, content: [{ type: 'text', text: 'Draw a cleaner editor shell', styles: {} }] },
      { id: 'check-item-2', type: 'checkListItem', props: { checked: true }, content: [{ type: 'text', text: 'Anchor menus to the editor host', styles: {} }] },
      { id: 'check-item-3', type: 'checkListItem', props: { checked: false }, content: [{ type: 'text', text: 'Keep improving the multi-column empty-state cue', styles: {} }] },
    ],
  },
  {
    id: 'divider-3',
    type: 'divider',
    props: {},
  },
  {
    id: 'heading-columns',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Multi-column layout', styles: {} }],
  },
  {
    id: 'paragraph-columns',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Columns behave like the Pubwave example: the placeholder sits inline, the add/drag affordances stay hidden, and slash commands still work.', styles: {} }],
  },
  {
    id: 'column-list-1',
    type: 'columnList',
    props: { gap: 16 },
    children: [
      {
        id: 'column-1',
        type: 'column',
        props: { width: 50 },
        children: [
          {
            id: 'col1-heading',
            type: 'heading',
            props: { level: 3 },
            content: [{ type: 'text', text: 'Left column', styles: {} }],
          },
          {
            id: 'col1-para',
            type: 'paragraph',
            props: {},
            content: [
              { type: 'text', text: 'Each column is just a content lane. The helper text appears on the first empty line, and the editor does not waste horizontal space on block chrome.', styles: {} },
            ],
          },
          {
            id: 'col1-list',
            type: 'bulletList',
            props: {},
            children: [
              { id: 'col1-item-1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Inline placeholder text', styles: {} }] },
              { id: 'col1-item-2', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Slash commands remain available', styles: {} }] },
            ],
          },
        ],
      },
      {
        id: 'column-2',
        type: 'column',
        props: { width: 50 },
        children: [
          {
            id: 'col2-heading',
            type: 'heading',
            props: { level: 3 },
            content: [{ type: 'text', text: 'Right column', styles: {} }],
          },
          {
            id: 'col2-quote',
            type: 'blockquote',
            props: {},
            content: [{ type: 'text', text: 'Columns are where the page feels most editorial.', styles: { italic: true } }],
          },
          {
            id: 'col2-checklist',
            type: 'checkList',
            props: {},
            children: [
              { id: 'col2-check-1', type: 'checkListItem', props: { checked: false }, content: [{ type: 'text', text: 'Write inside the empty column', styles: {} }] },
              { id: 'col2-check-2', type: 'checkListItem', props: { checked: false }, content: [{ type: 'text', text: 'Use Enter for lists and todo items', styles: {} }] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'divider-4',
    type: 'divider',
    props: {},
  },
  {
    id: 'heading-table',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Tables and structured data', styles: {} }],
  },
  {
    id: 'paragraph-table',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Tables, headers, and multi-cell rows all stay editable without breaking the layout.', styles: {} }],
  },
  {
    id: 'table-1',
    type: 'table',
    props: {},
    children: [
      {
        id: 'table-row-header',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'header-cell-1', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Feature', styles: { bold: true } }] },
          { id: 'header-cell-2', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Status', styles: { bold: true } }] },
          { id: 'header-cell-3', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Notes', styles: { bold: true } }] },
        ],
      },
      {
        id: 'table-row-1',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'cell-1-1', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Text styles', styles: {} }] },
          { id: 'cell-1-2', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Complete', styles: { bold: true } }] },
          { id: 'cell-1-3', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Bold, italic, underline, code, colors', styles: {} }] },
        ],
      },
      {
        id: 'table-row-2',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'cell-2-1', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Columns', styles: {} }] },
          { id: 'cell-2-2', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Complete', styles: { bold: true } }] },
          { id: 'cell-2-3', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Grid-based, inline placeholders', styles: {} }] },
        ],
      },
      {
        id: 'table-row-3',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'cell-3-1', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Charts', styles: {} }] },
          { id: 'cell-3-2', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Available', styles: { italic: true } }] },
          { id: 'cell-3-3', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Hover edit action and solid modal styling', styles: {} }] },
        ],
      },
    ],
  },
  {
    id: 'divider-5',
    type: 'divider',
    props: {},
  },
  {
    id: 'heading-media',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Images and embeds', styles: {} }],
  },
  {
    id: 'paragraph-media',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Media blocks are inline with the rest of the page, not floating in a separate toolbox section.', styles: {} }],
  },
  {
    id: 'image-1',
    type: 'image',
    props: {
      src: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80',
      alt: 'Code on a screen',
      caption: 'A clean setup for editing and previewing blocks',
      alignment: 'center',
    },
  },
  {
    id: 'embed-1',
    type: 'embed',
    props: {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      provider: 'youtube',
      embedId: 'dQw4w9WgXcQ',
      caption: 'Embedded video example',
      aspectRatio: '16:9',
    },
  },
  {
    id: 'divider-6',
    type: 'divider',
    props: {},
  },
  {
    id: 'heading-charts',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Charts with edit-on-hover', styles: {} }],
  },
  {
    id: 'paragraph-charts',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'The chart block supports bar, line, pie, doughnut, radar, and polar area charts with category palettes.', styles: {} }],
  },
  {
    id: 'chart-columns',
    type: 'columnList',
    props: { gap: 20 },
    children: [
      {
        id: 'chart-column-1',
        type: 'column',
        props: { width: 50 },
        children: [
          {
            id: 'chart-bar',
            type: 'chart',
            props: {
              data: createChart(
                'bar',
                'AI Application Distribution',
                ['Neural Networks', 'NLP Apps', 'Computer Vision', 'Robotics', 'Automation'],
                [30, 25, 20, 15, 10],
                'gradient'
              ),
            },
          },
        ],
      },
      {
        id: 'chart-column-2',
        type: 'column',
        props: { width: 50 },
        children: [
          {
            id: 'chart-doughnut',
            type: 'chart',
            props: {
              data: createChart(
                'doughnut',
                'Content Mix',
                ['Text', 'Lists', 'Columns', 'Tables', 'Media', 'Charts'],
                [24, 16, 14, 10, 18, 22],
                'gradient'
              ),
            },
          },
        ],
      },
    ],
  },
  {
    id: 'divider-7',
    type: 'divider',
    props: {},
  },
  {
    id: 'heading-shortcuts',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Keyboard shortcuts', styles: {} }],
  },
  {
    id: 'shortcuts-table',
    type: 'table',
    props: {},
    children: [
      {
        id: 'shortcuts-header',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'sh-h1', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Shortcut', styles: { bold: true } }] },
          { id: 'sh-h2', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Action', styles: { bold: true } }] },
        ],
      },
      {
        id: 'sh-row-1',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'sh-c1-1', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Cmd+B', styles: { code: true } }] },
          { id: 'sh-c1-2', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Bold', styles: { bold: true } }] },
        ],
      },
      {
        id: 'sh-row-2',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'sh-c2-1', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Cmd+I', styles: { code: true } }] },
          { id: 'sh-c2-2', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Italic', styles: { italic: true } }] },
        ],
      },
      {
        id: 'sh-row-3',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'sh-c3-1', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Cmd+U', styles: { code: true } }] },
          { id: 'sh-c3-2', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Underline', styles: { underline: true } }] },
        ],
      },
      {
        id: 'sh-row-4',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'sh-c4-1', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Cmd+Shift+8', styles: { code: true } }] },
          { id: 'sh-c4-2', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Bullet list', styles: {} }] },
        ],
      },
      {
        id: 'sh-row-5',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'sh-c5-1', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Cmd+Shift+9', styles: { code: true } }] },
          { id: 'sh-c5-2', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Checklist', styles: {} }] },
        ],
      },
    ],
  },
  {
    id: 'divider-8',
    type: 'divider',
    props: {},
  },
  {
    id: 'heading-api',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Public API', styles: {} }],
  },
  {
    id: 'paragraph-api',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'Access the editor through ', styles: {} },
      { type: 'text', text: 'editor.pm', styles: { code: true } },
      { type: 'text', text: ' and the serialized blocks through ', styles: {} },
      { type: 'text', text: 'useEditorContent', styles: { code: true } },
      { type: 'text', text: '.', styles: {} },
    ],
  },
  {
    id: 'api-list',
    type: 'bulletList',
    props: {},
    children: [
      { id: 'api-item-1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'editor.pm.view → EditorView', styles: {} }] },
      { id: 'api-item-2', type: 'listItem', props: {}, content: [{ type: 'text', text: 'editor.pm.state → EditorState', styles: {} }] },
      { id: 'api-item-3', type: 'listItem', props: {}, content: [{ type: 'text', text: 'editor.getDocument() → JSON blocks', styles: {} }] },
    ],
  },
  {
    id: 'paragraph-final',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'This example is intentionally dense so the full editor surface stays visible in one place.', styles: {} },
    ],
  },
];

/** Sample résumé: financial analyst with multi-column layout and mixed inline formatting. */
export const financialAnalystCvDocument: Block[] = [
  {
    id: 'cv-name',
    type: 'heading',
    props: { level: 1, textAlign: 'center' },
    content: [{ type: 'text', text: 'Jordan Mercer', styles: {} }],
  },
  {
    id: 'cv-title-line',
    type: 'paragraph',
    props: { textAlign: 'center' },
    content: [
      { type: 'text', text: 'Financial Analyst', styles: { bold: true } },
      { type: 'text', text: ' · ', styles: {} },
      { type: 'text', text: 'FP&A', styles: { italic: true } },
      { type: 'text', text: ' · ', styles: {} },
      { type: 'text', text: 'Equity research support', styles: { italic: true } },
    ],
  },
  {
    id: 'cv-contact',
    type: 'paragraph',
    props: { textAlign: 'center' },
    content: [
      { type: 'text', text: 'London, UK · ', styles: {} },
      {
        type: 'link',
        href: 'mailto:jordan.mercer@example.com',
        title: 'Email',
        target: '_self',
        content: [{ type: 'text', text: 'jordan.mercer@example.com', styles: { underline: true } }],
      },
      { type: 'text', text: ' · +44 20 7946 0958 · ', styles: {} },
      {
        type: 'link',
        href: 'https://www.linkedin.com',
        title: 'LinkedIn profile',
        target: '_blank',
        content: [{ type: 'text', text: 'LinkedIn', styles: {} }],
      },
    ],
  },
  { id: 'cv-div-1', type: 'divider', props: {} },
  {
    id: 'cv-summary-callout',
    type: 'callout',
    props: { calloutType: 'note' },
    content: [
      { type: 'text', text: 'Profile: ', styles: { bold: true } },
      {
        type: 'text',
        text: 'CFA Level II candidate with five years building three-statement models, board packs, and sector dashboards for asset managers and corporate FP&A. Comfortable translating ',
        styles: {},
      },
      { type: 'text', text: 'Bloomberg', styles: { bold: true } },
      { type: 'text', text: ' / ', styles: {} },
      { type: 'text', text: 'FactSet', styles: { bold: true } },
      {
        type: 'text',
        text: ' pulls into Excel and ',
        styles: {},
      },
      { type: 'text', text: 'Python', styles: { code: true } },
      { type: 'text', text: ' automation; strong stakeholder narrative for investment committees.', styles: {} },
    ],
  },
  {
    id: 'cv-heading-exp',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Experience & education', styles: {} }],
  },
  {
    id: 'cv-columns-main',
    type: 'columnList',
    props: { gap: 28 },
    children: [
      {
        id: 'cv-col-exp',
        type: 'column',
        props: { width: 58 },
        children: [
          {
            id: 'cv-h3-senior',
            type: 'heading',
            props: { level: 3 },
            content: [{ type: 'text', text: 'Senior Financial Analyst — Meridian Capital Partners', styles: {} }],
          },
          {
            id: 'cv-senior-dates',
            type: 'paragraph',
            props: {},
            content: [
              { type: 'text', text: '2022 — Present', styles: { italic: true, textColor: '#5c534c' } },
              { type: 'text', text: ' · ', styles: {} },
              { type: 'text', text: 'London', styles: { italic: true } },
            ],
          },
          {
            id: 'cv-senior-bullets',
            type: 'bulletList',
            props: {},
            children: [
              {
                id: 'cv-sb1',
                type: 'listItem',
                props: {},
                content: [
                  { type: 'text', text: 'Own ', styles: {} },
                  { type: 'text', text: 'monthly management reporting', styles: { bold: true } },
                  {
                    type: 'text',
                    text: ' for two long/short equity sleeves: bridge revenue to EBITDA, variance commentary, and liquidity stress notes for the risk committee.',
                    styles: {},
                  },
                ],
              },
              {
                id: 'cv-sb2',
                type: 'listItem',
                props: {},
                content: [
                  {
                    type: 'text',
                    text: 'Built a rolling 13-week cash model tied to AR/AP and capex; reduced forecast error vs. actuals by ',
                    styles: {},
                  },
                  { type: 'text', text: '~18%', styles: { bold: true } },
                  { type: 'text', text: ' YoY through driver-based assumptions.', styles: {} },
                ],
              },
              {
                id: 'cv-sb3',
                type: 'listItem',
                props: {},
                content: [
                  { type: 'text', text: 'Partner with IR on ', styles: {} },
                  { type: 'text', text: 'earnings prep', styles: { italic: true } },
                  { type: 'text', text: ': peer comps, sum-of-the-parts scenarios, and one-page ', styles: {} },
                  { type: 'text', text: 'investment thesis', styles: { bold: true } },
                  { type: 'text', text: ' slides for LP updates.', styles: {} },
                ],
              },
            ],
          },
          {
            id: 'cv-h3-fa',
            type: 'heading',
            props: { level: 3 },
            content: [{ type: 'text', text: 'Financial Analyst — Hartwell Industrials plc', styles: {} }],
          },
          {
            id: 'cv-fa-dates',
            type: 'paragraph',
            props: {},
            content: [
              { type: 'text', text: '2019 — 2022', styles: { italic: true, textColor: '#5c534c' } },
              { type: 'text', text: ' · ', styles: {} },
              { type: 'text', text: 'Birmingham', styles: { italic: true } },
            ],
          },
          {
            id: 'cv-fa-bullets',
            type: 'bulletList',
            props: {},
            children: [
              {
                id: 'cv-fb1',
                type: 'listItem',
                props: {},
                content: [
                  {
                    type: 'text',
                    text: 'Consolidated P&L for three manufacturing divisions; automated eliminations and FX translation in ',
                    styles: {},
                  },
                  { type: 'text', text: 'Workday Adaptive', styles: { code: true } },
                  { type: 'text', text: ' + Excel.', styles: {} },
                ],
              },
              {
                id: 'cv-fb2',
                type: 'listItem',
                props: {},
                content: [
                  {
                    type: 'text',
                    text: 'Supported ',
                    styles: {},
                  },
                  { type: 'text', text: '£240M', styles: { bold: true } },
                  {
                    type: 'text',
                    text: ' refinancing: covenant headroom schedules, sensitivity tables, and lender Q&A.',
                    styles: {},
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'cv-col-edu',
        type: 'column',
        props: { width: 42 },
        children: [
          {
            id: 'cv-h3-edu',
            type: 'heading',
            props: { level: 3 },
            content: [{ type: 'text', text: 'Education', styles: {} }],
          },
          {
            id: 'cv-edu-msc',
            type: 'paragraph',
            props: {},
            content: [
              { type: 'text', text: 'MSc Finance & Economics', styles: { bold: true } },
              { type: 'text', text: ' — University of Warwick, ', styles: {} },
              { type: 'text', text: 'Distinction', styles: { italic: true } },
            ],
          },
          {
            id: 'cv-edu-msc-year',
            type: 'paragraph',
            props: {},
            content: [{ type: 'text', text: '2018', styles: { textColor: '#5c534c' } }],
          },
          {
            id: 'cv-edu-ba',
            type: 'paragraph',
            props: {},
            content: [
              { type: 'text', text: 'BA (Hons) Economics', styles: { bold: true } },
              { type: 'text', text: ' — University of Leeds, First Class', styles: {} },
            ],
          },
          {
            id: 'cv-edu-ba-year',
            type: 'paragraph',
            props: {},
            content: [{ type: 'text', text: '2017', styles: { textColor: '#5c534c' } }],
          },
          {
            id: 'cv-h3-skills',
            type: 'heading',
            props: { level: 3 },
            content: [{ type: 'text', text: 'Highlights', styles: {} }],
          },
          {
            id: 'cv-skills-list',
            type: 'bulletList',
            props: {},
            children: [
              {
                id: 'cv-sk1',
                type: 'listItem',
                props: {},
                content: [{ type: 'text', text: 'DCF, LBO, and trading comps; WACC & terminal value hygiene', styles: {} }],
              },
              {
                id: 'cv-sk2',
                type: 'listItem',
                props: {},
                content: [{ type: 'text', text: 'Budgeting, forecasting, and zero-based review cycles', styles: {} }],
              },
              {
                id: 'cv-sk3',
                type: 'listItem',
                props: {},
                content: [{ type: 'text', text: 'SOX-aligned control narratives for close', styles: {} }],
              },
            ],
          },
        ],
      },
    ],
  },
  { id: 'cv-div-2', type: 'divider', props: {} },
  {
    id: 'cv-heading-tech',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Tools & methods', styles: {} }],
  },
  {
    id: 'cv-columns-tech',
    type: 'columnList',
    props: { gap: 24 },
    children: [
      {
        id: 'cv-col-tools',
        type: 'column',
        props: { width: 50 },
        children: [
          {
            id: 'cv-tools-h',
            type: 'heading',
            props: { level: 3 },
            content: [{ type: 'text', text: 'Stack', styles: {} }],
          },
          {
            id: 'cv-tools-list',
            type: 'bulletList',
            props: {},
            children: [
              {
                id: 'cv-t1',
                type: 'listItem',
                props: {},
                content: [
                  { type: 'text', text: 'Excel / ', styles: {} },
                  { type: 'text', text: 'Power Query', styles: { bold: true } },
                  { type: 'text', text: ', ', styles: {} },
                  { type: 'text', text: 'Power BI', styles: { bold: true } },
                  { type: 'text', text: ', ', styles: {} },
                  { type: 'text', text: 'Tableau', styles: { italic: true } },
                ],
              },
              {
                id: 'cv-t2',
                type: 'listItem',
                props: {},
                content: [{ type: 'text', text: 'Bloomberg Terminal, FactSet, CapIQ (screening & tearsheets)', styles: {} }],
              },
              {
                id: 'cv-t3',
                type: 'listItem',
                props: {},
                content: [
                  { type: 'text', text: 'Python ', styles: {} },
                  { type: 'text', text: '(pandas, NumPy)', styles: { code: true } },
                  { type: 'text', text: ' for data cleaning and scenario engines', styles: {} },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'cv-col-certs',
        type: 'column',
        props: { width: 50 },
        children: [
          {
            id: 'cv-certs-h',
            type: 'heading',
            props: { level: 3 },
            content: [{ type: 'text', text: 'Certifications & languages', styles: {} }],
          },
          {
            id: 'cv-certs-list',
            type: 'bulletList',
            props: {},
            children: [
              {
                id: 'cv-c1',
                type: 'listItem',
                props: {},
                content: [
                  { type: 'text', text: 'CFA ', styles: { bold: true } },
                  { type: 'text', text: 'Level II candidate (Nov 2025)', styles: {} },
                ],
              },
              {
                id: 'cv-c2',
                type: 'listItem',
                props: {},
                content: [{ type: 'text', text: 'FMVA (Corporate Finance Institute)', styles: {} }],
              },
              {
                id: 'cv-c3',
                type: 'listItem',
                props: {},
                content: [
                  { type: 'text', text: 'English ', styles: { bold: true } },
                  { type: 'text', text: '(native) · ', styles: {} },
                  { type: 'text', text: 'German ', styles: { bold: true } },
                  { type: 'text', text: 'B2 — business fluent', styles: {} },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'cv-code-sample',
    type: 'codeBlock',
    props: { language: 'python' },
    content: [
      {
        type: 'text',
        text: "# Example: cohort revenue pivot used in board pack\nimport pandas as pd\ndf = pd.read_csv('revenue_by_segment.csv')\npivot = df.pivot_table(values='revenue_gbp', index='quarter', columns='segment', aggfunc='sum')\nprint(pivot.pct_change(axis=0).round(3))",
        styles: {},
      },
    ],
  },
  {
    id: 'cv-heading-table',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Selected credentials (tabular)', styles: {} }],
  },
  {
    id: 'cv-cred-table',
    type: 'table',
    props: {},
    children: [
      {
        id: 'cv-tr-h',
        type: 'tableRow',
        props: {},
        children: [
          {
            id: 'cv-th-1',
            type: 'tableHeader',
            props: {},
            content: [{ type: 'text', text: 'Credential', styles: { bold: true } }],
          },
          {
            id: 'cv-th-2',
            type: 'tableHeader',
            props: {},
            content: [{ type: 'text', text: 'Issuer', styles: { bold: true } }],
          },
          {
            id: 'cv-th-3',
            type: 'tableHeader',
            props: {},
            content: [{ type: 'text', text: 'Status', styles: { bold: true } }],
          },
        ],
      },
      {
        id: 'cv-tr-1',
        type: 'tableRow',
        props: {},
        children: [
          {
            id: 'cv-td-11',
            type: 'tableCell',
            props: {},
            content: [{ type: 'text', text: 'CFA Program', styles: {} }],
          },
          {
            id: 'cv-td-12',
            type: 'tableCell',
            props: {},
            content: [{ type: 'text', text: 'CFA Institute', styles: {} }],
          },
          {
            id: 'cv-td-13',
            type: 'tableCell',
            props: {},
            content: [{ type: 'text', text: 'Level II — in progress', styles: { italic: true } }],
          },
        ],
      },
      {
        id: 'cv-tr-2',
        type: 'tableRow',
        props: {},
        children: [
          {
            id: 'cv-td-21',
            type: 'tableCell',
            props: {},
            content: [{ type: 'text', text: 'Financial Modeling & Valuation', styles: {} }],
          },
          {
            id: 'cv-td-22',
            type: 'tableCell',
            props: {},
            content: [{ type: 'text', text: 'CFI', styles: {} }],
          },
          {
            id: 'cv-td-23',
            type: 'tableCell',
            props: {},
            content: [{ type: 'text', text: 'Completed 2021', styles: {} }],
          },
        ],
      },
    ],
  },
  {
    id: 'cv-quote',
    type: 'blockquote',
    props: {},
    content: [
      {
        type: 'text',
        text: '“Jordan combines disciplined modeling with clear storytelling — rare in someone who can still drill into the spreadsheet at 11 p.m. before a committee.” ',
        styles: { italic: true },
      },
      { type: 'text', text: '— ', styles: {} },
      { type: 'text', text: 'CFO', styles: { bold: true } },
      { type: 'text', text: ', prior employer (available on request)', styles: {} },
    ],
  },
  {
    id: 'cv-footer',
    type: 'paragraph',
    props: { textAlign: 'right' },
    content: [
      { type: 'text', text: 'References ', styles: { bold: true } },
      { type: 'text', text: 'and ', styles: {} },
      { type: 'text', text: 'writing samples', styles: { bold: true, underline: true } },
      { type: 'text', text: ' available on request.', styles: {} },
    ],
  },
];

/** Controlled SOP-style sections for the compliance authoring demo (each maps to its own editor). */
export interface ComplianceSectionDefinition {
  id: string;
  title: string;
  /** Shown in the UI as a compliance badge */
  required: boolean;
  initialBlocks: Block[];
}

/**
 * Distinct figure URLs for the Gram stain SOP demo. Verify licensing/attribution before production use.
 * - unsplashPremium: Unsplash Plus (license per Unsplash terms).
 * - wikiMixedField: commons.wikimedia.org/wiki/File:Gram_stain_01.jpg (Y tambe, CC BY-SA / GFDL).
 * - wikiStaphylococcus: File:Staphylococcus_aureus_Gram_stain.jpg (Dr Graham Beards, CC BY-SA 4.0).
 * - wikiSchematic: File:Gram_Staining_Bacteria.jpg (ScientificAnimations.com via Wikimedia, CC BY-SA 4.0).
 * - wikiPneumoniae: File:Gram_stain_of_Streptococcus_pneumoniae.jpg (CDC PHIL #21340, CC0).
 * - wikiEcoli: File:Escherichia_coli_Gram.jpg (Y tambe, CC BY-SA 3.0).
 * - wikiBacillus: File:Bacillus_subtilis_gram_stain_CDC_PHIL_19261.jpg (CDC, public domain).
 */
export const gramStainSopFigureUrls = {
  unsplashPremium:
    'https://plus.unsplash.com/premium_photo-1754337720095-51118ab20e48?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  wikiMixedField:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Gram_stain_01.jpg/1280px-Gram_stain_01.jpg',
  wikiStaphylococcus:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Staphylococcus_aureus_Gram_stain.jpg/1280px-Staphylococcus_aureus_Gram_stain.jpg',
  wikiSchematic:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Gram_Staining_Bacteria.jpg/1280px-Gram_Staining_Bacteria.jpg',
  wikiPneumoniae:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Gram_stain_of_Streptococcus_pneumoniae.jpg/1280px-Gram_stain_of_Streptococcus_pneumoniae.jpg',
  wikiEcoli: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Escherichia_coli_Gram.jpg',
  wikiBacillus: 'https://upload.wikimedia.org/wikipedia/commons/c/c0/Bacillus_subtilis_gram_stain_CDC_PHIL_19261.jpg',
} as const;

function complianceParagraph(id: string, text: string): Block {
  return {
    id,
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text, styles: {} }],
  };
}

function complianceImage(id: string, src: string, caption: string, alt: string): Block {
  return {
    id,
    type: 'image',
    props: {
      src,
      alt,
      caption,
      alignment: 'center',
    },
  };
}

/** Gram stain SOP — controlled sections with shared reference imagery for training and QC. */
export const complianceSopSections: ComplianceSectionDefinition[] = [
  {
    id: 'purpose',
    title: '1. Purpose',
    required: true,
    initialBlocks: [
      complianceParagraph(
        'sop-purpose',
        'This procedure describes how laboratory staff perform the Gram stain on clinical and surveillance specimens to differentiate bacteria by cell-wall properties. Results support empiric therapy guidance, infection prevention workflows, and culture work-up. The stain must be performed consistently so purple (Gram-positive) and pink or red (Gram-negative) morphotypes are reported with reproducible quality.'
      ),
      complianceImage(
        'sop-purpose-img',
        gramStainSopFigureUrls.unsplashPremium,
        'Reference micrograph (Unsplash): use contrast between violet-retaining and pink-red cells when training new readers.',
        'Microscopy field illustrating Gram stain color contrast after crystal violet, iodine, decolorization, and safranin counterstain.'
      ),
    ],
  },
  {
    id: 'scope',
    title: '2. Scope',
    required: true,
    initialBlocks: [
      complianceParagraph(
        'sop-scope',
        'Applies to the clinical microbiology laboratory, all shifts, and any site performing a conventional four-step Gram stain (fixation, crystal violet, Gram iodine, decolorization, counterstain) on smears from approved specimen types including sputum, sterile fluids, tissue, and positive blood culture bottles when a smear is indicated.'
      ),
      complianceParagraph(
        'sop-scope-excl',
        'Out of scope: automated Gram alternatives not validated against this SOP, direct molecular reporting without smear review, and research-only projects unless QA approves an addendum. Anaerobic morphotype reporting follows the companion anaerobe SOP.'
      ),
      complianceImage(
        'sop-scope-img',
        gramStainSopFigureUrls.wikiSchematic,
        'Educational schematic (Wikimedia Commons, CC BY-SA 4.0): peptidoglycan thickness and envelope structure drive the Gram reaction this SOP differentiates.',
        'Diagram comparing Gram-positive and Gram-negative bacterial cell walls relevant to Gram staining.'
      ),
    ],
  },
  {
    id: 'definitions',
    title: '3. Definitions',
    required: true,
    initialBlocks: [
      complianceParagraph(
        'sop-defs-intro',
        'Gram-positive organisms retain the crystal violet–iodine complex after alcohol or acetone–alcohol decolorization and appear purple. Gram-negative organisms lose the primary complex, take up the counterstain, and appear pink to red.'
      ),
      complianceImage(
        'sop-defs-img',
        gramStainSopFigureUrls.wikiMixedField,
        'Mixed field ~1000× (Wikimedia Commons, Y tambe, CC BY-SA): violet Staphylococcus aureus cocci with pink Escherichia coli rods — train readers to score both morphotypes.',
        'Gram stain micrograph with purple Gram-positive cocci and pink Gram-negative rods in one field.'
      ),
      {
        id: 'sop-defs-list',
        type: 'bulletList',
        props: {},
        children: [
          {
            id: 'sop-def-li-1',
            type: 'listItem',
            props: {},
            content: [
              { type: 'text', text: 'Primary stain: ', styles: { bold: true } },
              { type: 'text', text: 'Crystal violet (0.5–1% w/v) per validated lot.', styles: {} },
            ],
          },
          {
            id: 'sop-def-li-2',
            type: 'listItem',
            props: {},
            content: [
              { type: 'text', text: 'Mordant: ', styles: { bold: true } },
              { type: 'text', text: 'Gram iodine (Lugol or modified) applied for the time specified on the stain rack card.', styles: {} },
            ],
          },
          {
            id: 'sop-def-li-3',
            type: 'listItem',
            props: {},
            content: [
              { type: 'text', text: 'Decolorizer: ', styles: { bold: true } },
              { type: 'text', text: '95% ethanol, acetone–ethanol, or kit decolorizer per manufacturer IFU — do not interchange without QA sign-off.', styles: {} },
            ],
          },
          {
            id: 'sop-def-li-4',
            type: 'listItem',
            props: {},
            content: [
              { type: 'text', text: 'Counterstain: ', styles: { bold: true } },
              { type: 'text', text: 'Safranin or approved substitute per kit validation.', styles: {} },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'roles',
    title: '4. Roles and responsibilities',
    required: true,
    initialBlocks: [
      {
        id: 'sop-roles-list',
        type: 'bulletList',
        props: {},
        children: [
          {
            id: 'sop-role-tech',
            type: 'listItem',
            props: {},
            content: [
              { type: 'text', text: 'Medical laboratory scientist / technician: ', styles: { bold: true } },
              {
                type: 'text',
                text: 'Prepare smears, run the stain, perform QC at shift start, document exceptions, and escalate ambiguous fields.',
                styles: {},
              },
            ],
          },
          {
            id: 'sop-role-lead',
            type: 'listItem',
            props: {},
            content: [
              { type: 'text', text: 'Microbiology lead / supervisor: ', styles: { bold: true } },
              {
                type: 'text',
                text: 'Investigate QC failures, approve reagent lot changes, and ensure competency is current for all performers.',
                styles: {},
              },
            ],
          },
          {
            id: 'sop-role-med',
            type: 'listItem',
            props: {},
            content: [
              { type: 'text', text: 'Medical director (or delegate): ', styles: { bold: true } },
              { type: 'text', text: 'Defines reportable limits, approves SOP revisions, and adjudicates patient-impact deviations.', styles: {} },
            ],
          },
        ],
      },
      complianceImage(
        'sop-roles-img',
        gramStainSopFigureUrls.wikiEcoli,
        'Gram-negative QC exemplar (Wikimedia Commons, Y tambe, CC BY-SA): Escherichia coli ATCC 11775 should appear pink-red — use for competency and shift QC sign-off photos.',
        'Escherichia coli Gram stain at 1000× showing pink Gram-negative rods.'
      ),
    ],
  },
  {
    id: 'procedure',
    title: '5. Procedure',
    required: true,
    initialBlocks: [
      complianceParagraph(
        'sop-proc-safety',
        'PPE: lab coat, gloves, eye protection when pouring reagents. Work in a certified biosafety cabinet for unfixed patient material when volume or aerosol risk warrants it. Dispose of sharps and chemical waste per institutional EHS policy.'
      ),
      {
        id: 'sop-proc-steps',
        type: 'orderedList',
        props: { start: 1 },
        children: [
          {
            id: 'sop-proc-1',
            type: 'listItem',
            props: {},
            content: [
              {
                type: 'text',
                text: 'Prepare a thin, evenly spread heat-fixed smear on a clean labeled slide; air-dry completely before heat fixation.',
                styles: {},
              },
            ],
          },
          {
            id: 'sop-proc-2',
            type: 'listItem',
            props: {},
            content: [
              {
                type: 'text',
                text: 'Flood with crystal violet for the validated dwell time; rinse gently with tap or deionized water.',
                styles: {},
              },
            ],
          },
          {
            id: 'sop-proc-3',
            type: 'listItem',
            props: {},
            content: [
              {
                type: 'text',
                text: 'Apply Gram iodine; wait for the full mordant interval; rinse.',
                styles: {},
              },
            ],
          },
          {
            id: 'sop-proc-4',
            type: 'listItem',
            props: {},
            content: [
              {
                type: 'text',
                text: 'Decolorize by tilting the slide and adding decolorizer dropwise until runoff is clear — avoid over-decolorization.',
                styles: {},
              },
            ],
          },
          {
            id: 'sop-proc-5',
            type: 'listItem',
            props: {},
            content: [
              {
                type: 'text',
                text: 'Counterstain with safranin for the validated time; rinse, blot dry, and examine under oil immersion (100× objective).',
                styles: {},
              },
            ],
          },
        ],
      },
      complianceImage(
        'sop-proc-img',
        gramStainSopFigureUrls.wikiStaphylococcus,
        'Gram-positive cluster QC (Wikimedia Commons, Dr Graham Beards, CC BY-SA 4.0): Staphylococcus aureus should stain deep violet — compare crisp cocci clusters before releasing screens.',
        'Staphylococcus aureus Gram stain showing purple Gram-positive cocci in clusters.'
      ),
      complianceParagraph(
        'sop-proc-qc',
        'Concurrent QC: stain a known Gram-positive and Gram-negative control slide each shift. If reactions invert or morphology is hazy, halt patient reporting on the affected rack, repeat with fresh reagents, and notify the supervisor.'
      ),
    ],
  },
  {
    id: 'records',
    title: '6. Records and retention',
    required: true,
    initialBlocks: [
      complianceParagraph(
        'sop-records',
        'Retain stained slides or digital images per laboratory policy (minimum aligned with CAP / accreditation checklist). Log QC performance, reagent lot numbers, and stain run identifiers in the LIS or paper QC binder. Retain competency checklists for five years or per institutional records schedule, whichever is longer.'
      ),
      complianceImage(
        'sop-records-img',
        gramStainSopFigureUrls.wikiPneumoniae,
        'Exemplar for archived teaching sets (CDC PHIL #21340 via Wikimedia, CC0): Streptococcus pneumoniae — document source, consent, and retention class in your real records system.',
        'Gram stain of Streptococcus pneumoniae showing lancet-shaped Gram-positive diplococci.'
      ),
    ],
  },
  {
    id: 'references',
    title: '7. References',
    required: false,
    initialBlocks: [
      {
        id: 'sop-refs-list',
        type: 'bulletList',
        props: {},
        children: [
          {
            id: 'sop-ref-1',
            type: 'listItem',
            props: {},
            content: [{ type: 'text', text: 'CLSI. Processing of Body Fluids, Exudates, and Related Specimens. Approved guideline (current edition).', styles: {} }],
          },
          {
            id: 'sop-ref-2',
            type: 'listItem',
            props: {},
            content: [{ type: 'text', text: 'Laboratory chemical hygiene plan and SDS for methanol, acetone, and iodine-containing reagents.', styles: {} }],
          },
          {
            id: 'sop-ref-3',
            type: 'listItem',
            props: {},
            content: [{ type: 'text', text: 'Institutional policy: biosafety, specimen handling, and critical result notification.', styles: {} }],
          },
        ],
      },
      complianceImage(
        'sop-refs-img',
        gramStainSopFigureUrls.wikiBacillus,
        'Atlas entry (CDC PHIL #19261, public domain): Bacillus subtilis Gram-positive rods with possible endospores — cite PHIL ID and photographer in production libraries.',
        'Gram-stained Bacillus subtilis showing purple rods and some endospores.'
      ),
    ],
  },
  {
    id: 'revision',
    title: '8. Revision history',
    required: true,
    initialBlocks: [
      {
        id: 'sop-rev-table',
        type: 'table',
        props: {},
        children: [
          {
            id: 'sop-rev-row-h',
            type: 'tableRow',
            props: {},
            children: [
              {
                id: 'sop-rev-h1',
                type: 'tableHeader',
                props: {},
                content: [{ type: 'text', text: 'Revision', styles: { bold: true } }],
              },
              {
                id: 'sop-rev-h2',
                type: 'tableHeader',
                props: {},
                content: [{ type: 'text', text: 'Date', styles: { bold: true } }],
              },
              {
                id: 'sop-rev-h3',
                type: 'tableHeader',
                props: {},
                content: [{ type: 'text', text: 'Author', styles: { bold: true } }],
              },
              {
                id: 'sop-rev-h4',
                type: 'tableHeader',
                props: {},
                content: [{ type: 'text', text: 'Description of change', styles: { bold: true } }],
              },
            ],
          },
          {
            id: 'sop-rev-row-1',
            type: 'tableRow',
            props: {},
            children: [
              { id: 'sop-rev-c11', type: 'tableCell', props: {}, content: [{ type: 'text', text: '1.0', styles: {} }] },
              { id: 'sop-rev-c12', type: 'tableCell', props: {}, content: [{ type: 'text', text: '(initial)', styles: {} }] },
              { id: 'sop-rev-c13', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Microbiology QA', styles: {} }] },
              {
                id: 'sop-rev-c14',
                type: 'tableCell',
                props: {},
                content: [{ type: 'text', text: 'Issued Gram stain SOP with reference imagery for training and QC.', styles: {} }],
              },
            ],
          },
        ],
      },
    ],
  },
];
