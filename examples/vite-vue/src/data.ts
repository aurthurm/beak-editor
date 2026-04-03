import type { Block } from '@labbs/beakblock-core';
import { createDefaultChartData } from '@labbs/beakblock-vue';

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
