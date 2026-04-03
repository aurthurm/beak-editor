import type { Block } from '@labbs/beakblock-core';

/**
 * Sample document with all formatting options for testing.
 */
export const sampleDocument: Block[] = [
  {
    id: 'heading-1',
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: 'Welcome to BeakBlock', styles: {} }],
  },
  {
    id: 'para-intro',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'BeakBlock is a ', styles: {} },
      { type: 'text', text: 'fully open-source', styles: { bold: true } },
      { type: 'text', text: ' rich text editor. All ProseMirror APIs are ', styles: {} },
      { type: 'text', text: 'public', styles: { bold: true, italic: true } },
      { type: 'text', text: '!', styles: {} },
    ],
  },
  {
    id: 'heading-formatting',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Text Formatting', styles: {} }],
  },
  {
    id: 'para-formatting',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'Bold', styles: { bold: true } },
      { type: 'text', text: ', ', styles: {} },
      { type: 'text', text: 'italic', styles: { italic: true } },
      { type: 'text', text: ', ', styles: {} },
      { type: 'text', text: 'underline', styles: { underline: true } },
      { type: 'text', text: ', ', styles: {} },
      { type: 'text', text: 'strikethrough', styles: { strikethrough: true } },
      { type: 'text', text: ', and ', styles: {} },
      { type: 'text', text: 'inline code', styles: { code: true } },
      { type: 'text', text: '.', styles: {} },
    ],
  },
  {
    id: 'para-combined',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'Combined: ', styles: {} },
      { type: 'text', text: 'bold+italic', styles: { bold: true, italic: true } },
      { type: 'text', text: ', ', styles: {} },
      { type: 'text', text: 'bold+underline', styles: { bold: true, underline: true } },
      { type: 'text', text: ', ', styles: {} },
      { type: 'text', text: 'all styles', styles: { bold: true, italic: true, underline: true } },
      { type: 'text', text: '.', styles: {} },
    ],
  },
  {
    id: 'heading-levels',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Heading Levels', styles: {} }],
  },
  {
    id: 'heading-h3',
    type: 'heading',
    props: { level: 3 },
    content: [{ type: 'text', text: 'Heading 3', styles: {} }],
  },
  {
    id: 'heading-h4',
    type: 'heading',
    props: { level: 4 },
    content: [{ type: 'text', text: 'Heading 4', styles: {} }],
  },
  {
    id: 'heading-h5',
    type: 'heading',
    props: { level: 5 },
    content: [{ type: 'text', text: 'Heading 5', styles: {} }],
  },
  {
    id: 'heading-h6',
    type: 'heading',
    props: { level: 6 },
    content: [{ type: 'text', text: 'Heading 6', styles: {} }],
  },
  {
    id: 'heading-blocks',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Block Types', styles: {} }],
  },
  {
    id: 'blockquote-1',
    type: 'blockquote',
    props: {},
    content: [
      { type: 'text', text: 'This is a blockquote. It can contain ', styles: {} },
      { type: 'text', text: 'formatted text', styles: { italic: true } },
      { type: 'text', text: ' too.', styles: {} },
    ],
  },
  {
    id: 'callout-info',
    type: 'callout',
    props: { calloutType: 'info' },
    content: [
      { type: 'text', text: 'Info: ', styles: { bold: true } },
      { type: 'text', text: 'This is an info callout for important information.', styles: {} },
    ],
  },
  {
    id: 'callout-warning',
    type: 'callout',
    props: { calloutType: 'warning' },
    content: [
      { type: 'text', text: 'Warning: ', styles: { bold: true } },
      { type: 'text', text: 'This is a warning callout for cautions.', styles: {} },
    ],
  },
  {
    id: 'callout-success',
    type: 'callout',
    props: { calloutType: 'success' },
    content: [
      { type: 'text', text: 'Success: ', styles: { bold: true } },
      { type: 'text', text: 'This is a success callout for tips and completed tasks.', styles: {} },
    ],
  },
  {
    id: 'callout-error',
    type: 'callout',
    props: { calloutType: 'error' },
    content: [
      { type: 'text', text: 'Error: ', styles: { bold: true } },
      { type: 'text', text: 'This is an error callout for critical information.', styles: {} },
    ],
  },
  {
    id: 'para-code-intro',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Code blocks preserve formatting:', styles: {} }],
  },
  {
    id: 'codeblock-1',
    type: 'codeBlock',
    props: { language: 'typescript' },
    content: [{ type: 'text', text: 'const editor = new BeakBlockEditor();\neditor.pm.view; // EditorView\neditor.pm.state; // EditorState', styles: {} }],
  },
  {
    id: 'divider-1',
    type: 'divider',
    props: {},
  },
  {
    id: 'heading-lists',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Lists', styles: {} }],
  },
  {
    id: 'para-bullet-intro',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Bullet list:', styles: {} }],
  },
  {
    id: 'bullet-list-1',
    type: 'bulletList',
    props: {},
    children: [
      { id: 'bullet-item-1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'First item', styles: {} }] },
      { id: 'bullet-item-2', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Second item with ', styles: {} }, { type: 'text', text: 'bold', styles: { bold: true } }] },
      { id: 'bullet-item-3', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Third item', styles: {} }] },
    ],
  },
  {
    id: 'para-ordered-intro',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Ordered list:', styles: {} }],
  },
  {
    id: 'ordered-list-1',
    type: 'orderedList',
    props: { start: 1 },
    children: [
      { id: 'ordered-item-1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Step one', styles: {} }] },
      { id: 'ordered-item-2', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Step two', styles: {} }] },
      { id: 'ordered-item-3', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Step three', styles: {} }] },
    ],
  },
  {
    id: 'divider-2',
    type: 'divider',
    props: {},
  },
  {
    id: 'heading-columns',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Multi-Column Layout', styles: {} }],
  },
  {
    id: 'para-columns-intro',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Drag the separator between columns to resize:', styles: {} }],
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
            content: [{ type: 'text', text: 'Left Column', styles: {} }],
          },
          {
            id: 'col1-para',
            type: 'paragraph',
            props: {},
            content: [
              { type: 'text', text: 'This is the ', styles: {} },
              { type: 'text', text: 'left', styles: { bold: true } },
              { type: 'text', text: ' column. You can add any blocks here.', styles: {} },
            ],
          },
          {
            id: 'col1-list',
            type: 'bulletList',
            props: {},
            children: [
              { id: 'col1-item-1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Item one', styles: {} }] },
              { id: 'col1-item-2', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Item two', styles: {} }] },
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
            content: [{ type: 'text', text: 'Right Column', styles: {} }],
          },
          {
            id: 'col2-para',
            type: 'paragraph',
            props: {},
            content: [
              { type: 'text', text: 'This is the ', styles: {} },
              { type: 'text', text: 'right', styles: { bold: true } },
              { type: 'text', text: ' column. Resize by dragging the separator!', styles: {} },
            ],
          },
          {
            id: 'col2-quote',
            type: 'blockquote',
            props: {},
            content: [{ type: 'text', text: 'Columns can contain any block type.', styles: { italic: true } }],
          },
        ],
      },
    ],
  },
  {
    id: 'divider-3',
    type: 'divider',
    props: {},
  },
  {
    id: 'heading-tables',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Tables', styles: {} }],
  },
  {
    id: 'para-tables-intro',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Tables support headers, multiple columns, and formatted content:', styles: {} }],
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
          {
            id: 'header-cell-1',
            type: 'tableHeader',
            props: {},
            content: [{ type: 'text', text: 'Feature', styles: { bold: true } }],
          },
          {
            id: 'header-cell-2',
            type: 'tableHeader',
            props: {},
            content: [{ type: 'text', text: 'Status', styles: { bold: true } }],
          },
          {
            id: 'header-cell-3',
            type: 'tableHeader',
            props: {},
            content: [{ type: 'text', text: 'Description', styles: { bold: true } }],
          },
        ],
      },
      {
        id: 'table-row-1',
        type: 'tableRow',
        props: {},
        children: [
          {
            id: 'cell-1-1',
            type: 'tableCell',
            props: {},
            content: [{ type: 'text', text: 'Rich Text', styles: {} }],
          },
          {
            id: 'cell-1-2',
            type: 'tableCell',
            props: {},
            content: [{ type: 'text', text: 'Complete', styles: { bold: true } }],
          },
          {
            id: 'cell-1-3',
            type: 'tableCell',
            props: {},
            content: [{ type: 'text', text: 'Bold, italic, underline, code', styles: {} }],
          },
        ],
      },
      {
        id: 'table-row-2',
        type: 'tableRow',
        props: {},
        children: [
          {
            id: 'cell-2-1',
            type: 'tableCell',
            props: {},
            content: [{ type: 'text', text: 'Columns', styles: {} }],
          },
          {
            id: 'cell-2-2',
            type: 'tableCell',
            props: {},
            content: [{ type: 'text', text: 'Complete', styles: { bold: true } }],
          },
          {
            id: 'cell-2-3',
            type: 'tableCell',
            props: {},
            content: [{ type: 'text', text: 'Resizable multi-column layouts', styles: {} }],
          },
        ],
      },
      {
        id: 'table-row-3',
        type: 'tableRow',
        props: {},
        children: [
          {
            id: 'cell-3-1',
            type: 'tableCell',
            props: {},
            content: [{ type: 'text', text: 'Tables', styles: {} }],
          },
          {
            id: 'cell-3-2',
            type: 'tableCell',
            props: {},
            content: [{ type: 'text', text: 'New', styles: { italic: true } }],
          },
          {
            id: 'cell-3-3',
            type: 'tableCell',
            props: {},
            content: [{ type: 'text', text: 'Header rows and data cells', styles: {} }],
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
    id: 'heading-checklist',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Checklist / To-do', styles: {} }],
  },
  {
    id: 'para-checklist-intro',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Track tasks with interactive checkboxes:', styles: {} }],
  },
  {
    id: 'checklist-1',
    type: 'checkList',
    props: {},
    children: [
      { id: 'check-item-1', type: 'checkListItem', props: { checked: true }, content: [{ type: 'text', text: 'Create BeakBlock editor', styles: {} }] },
      { id: 'check-item-2', type: 'checkListItem', props: { checked: true }, content: [{ type: 'text', text: 'Add image block support', styles: {} }] },
      { id: 'check-item-3', type: 'checkListItem', props: { checked: true }, content: [{ type: 'text', text: 'Implement checklist blocks', styles: {} }] },
      { id: 'check-item-4', type: 'checkListItem', props: { checked: false }, content: [{ type: 'text', text: 'Add more features', styles: { italic: true } }] },
      { id: 'check-item-5', type: 'checkListItem', props: { checked: false }, content: [{ type: 'text', text: 'World domination', styles: { bold: true } }] },
    ],
  },
  {
    id: 'divider-5',
    type: 'divider',
    props: {},
  },
  {
    id: 'heading-images',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Images', styles: {} }],
  },
  {
    id: 'para-images-intro',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Images can be inserted with different alignments:', styles: {} }],
  },
  {
    id: 'image-1',
    type: 'image',
    props: {
      src: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80',
      alt: 'Code on a screen',
      caption: 'A beautiful code editor setup',
      alignment: 'center',
    },
  },
  {
    id: 'para-images-note',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'Use the slash menu ', styles: {} },
      { type: 'text', text: '/image', styles: { code: true } },
      { type: 'text', text: ' to insert images.', styles: {} },
    ],
  },
  {
    id: 'divider-6',
    type: 'divider',
    props: {},
  },
  {
    id: 'heading-embeds',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Embeds', styles: {} }],
  },
  {
    id: 'para-embeds-intro',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Embed content from YouTube, Vimeo, CodePen, Figma, and more:', styles: {} }],
  },
  {
    id: 'embed-youtube',
    type: 'embed',
    props: {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      provider: 'youtube',
      embedId: 'dQw4w9WgXcQ',
      caption: 'A classic YouTube video',
      aspectRatio: '16:9',
    },
  },
  {
    id: 'para-embeds-providers',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Supported providers:', styles: { bold: true } }],
  },
  {
    id: 'embeds-list',
    type: 'bulletList',
    props: {},
    children: [
      { id: 'embed-p1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'YouTube', styles: { bold: true } }, { type: 'text', text: ' - video embeds', styles: {} }] },
      { id: 'embed-p2', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Vimeo', styles: { bold: true } }, { type: 'text', text: ' - video embeds', styles: {} }] },
      { id: 'embed-p3', type: 'listItem', props: {}, content: [{ type: 'text', text: 'CodePen', styles: { bold: true } }, { type: 'text', text: ' - interactive code demos', styles: {} }] },
      { id: 'embed-p4', type: 'listItem', props: {}, content: [{ type: 'text', text: 'CodeSandbox', styles: { bold: true } }, { type: 'text', text: ' - full development environments', styles: {} }] },
      { id: 'embed-p5', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Figma', styles: { bold: true } }, { type: 'text', text: ' - design files', styles: {} }] },
      { id: 'embed-p6', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Loom', styles: { bold: true } }, { type: 'text', text: ' - screen recordings', styles: {} }] },
      { id: 'embed-p7', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Spotify', styles: { bold: true } }, { type: 'text', text: ' - music and podcasts', styles: {} }] },
    ],
  },
  {
    id: 'para-embeds-note',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'Use the slash menu ', styles: {} },
      { type: 'text', text: '/embed', styles: { code: true } },
      { type: 'text', text: ' or ', styles: {} },
      { type: 'text', text: '/youtube', styles: { code: true } },
      { type: 'text', text: ' to insert embeds.', styles: {} },
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
    content: [{ type: 'text', text: 'Keyboard Shortcuts', styles: {} }],
  },
  {
    id: 'para-shortcuts-intro',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'BeakBlock supports many keyboard shortcuts:', styles: {} }],
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
          { id: 'sh-c4-1', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Cmd+Shift+S', styles: { code: true } }] },
          { id: 'sh-c4-2', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Strikethrough', styles: { strikethrough: true } }] },
        ],
      },
      {
        id: 'sh-row-5',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'sh-c5-1', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Cmd+E', styles: { code: true } }] },
          { id: 'sh-c5-2', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Inline code', styles: { code: true } }] },
        ],
      },
      {
        id: 'sh-row-6',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'sh-c6-1', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Cmd+Z', styles: { code: true } }] },
          { id: 'sh-c6-2', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Undo', styles: {} }] },
        ],
      },
      {
        id: 'sh-row-7',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'sh-c7-1', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Cmd+Shift+Z', styles: { code: true } }] },
          { id: 'sh-c7-2', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Redo', styles: {} }] },
        ],
      },
      {
        id: 'sh-row-8',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'sh-c8-1', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Cmd+Alt+1/2/3', styles: { code: true } }] },
          { id: 'sh-c8-2', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Heading 1/2/3', styles: {} }] },
        ],
      },
      {
        id: 'sh-row-9',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'sh-c9-1', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Cmd+Shift+8', styles: { code: true } }] },
          { id: 'sh-c9-2', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Bullet list', styles: {} }] },
        ],
      },
      {
        id: 'sh-row-10',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'sh-c10-1', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Cmd+Shift+9', styles: { code: true } }] },
          { id: 'sh-c10-2', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Checklist', styles: {} }] },
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
    id: 'para-api',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'Access ProseMirror via ', styles: {} },
      { type: 'text', text: 'editor.pm', styles: { code: true } },
      { type: 'text', text: ':', styles: {} },
    ],
  },
  {
    id: 'api-list',
    type: 'bulletList',
    props: {},
    children: [
      { id: 'api-item-1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'editor.pm.view', styles: { code: true } }, { type: 'text', text: ' → EditorView', styles: {} }] },
      { id: 'api-item-2', type: 'listItem', props: {}, content: [{ type: 'text', text: 'editor.pm.state', styles: { code: true } }, { type: 'text', text: ' → EditorState', styles: {} }] },
      { id: 'api-item-3', type: 'listItem', props: {}, content: [{ type: 'text', text: 'editor.pm.dispatch(tr)', styles: { code: true } }, { type: 'text', text: ' → dispatch transaction', styles: {} }] },
    ],
  },
  {
    id: 'para-final',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'Try editing this document!', styles: { bold: true } },
      { type: 'text', text: ' Use Cmd+B for bold, Cmd+I for italic, Cmd+U for underline.', styles: {} },
    ],
  },
];
