# React Integration Guide

Complete guide for using BeakBlock with React.

## Installation

```bash
npm install @amusendame/beakblock-core @amusendame/beakblock-react
```

## Basic Setup

```tsx
import {
  useBeakBlock,
  BeakBlockView,
  SlashMenu,
  BubbleMenu,
  TableHandles,
} from '@amusendame/beakblock-react';

function Editor() {
  const editor = useBeakBlock({
    initialContent: [
      {
        id: '1',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Hello, World!', styles: {} }],
      },
    ],
  });

  if (!editor) return <div>Loading...</div>;

  return (
    <div className="editor-container">
      <BeakBlockView editor={editor} />
      <SlashMenu editor={editor} />
      <BubbleMenu editor={editor} />
      <TableHandles editor={editor} />
    </div>
  );
}
```

## Hooks

### useBeakBlock

Creates and manages an editor instance.

```tsx
const editor = useBeakBlock({
  // Initial document content
  initialContent: Block[],

  // Whether the editor is editable
  editable?: boolean, // default: true

  // Auto-focus behavior
  autoFocus?: boolean | 'start' | 'end', // default: false

  // Placeholder text
  placeholder?: string | ((block: Block) => string),

  // Input rules configuration
  inputRules?: InputRulesConfig | false,

  // Auto-inject CSS styles
  injectStyles?: boolean, // default: true

  // ProseMirror configuration
  prosemirror?: {
    plugins?: Plugin[],
    nodeViews?: Record<string, NodeViewConstructor>,
  },

  // Event callbacks
  onUpdate?: (blocks: Block[]) => void,
  onSelectionChange?: (blocks: Block[]) => void,
  onFocus?: () => void,
  onBlur?: () => void,
});
```

**Note:** The hook returns `null` initially and creates the editor in a `useEffect`. This is for React 18+ StrictMode compatibility.

### useEditorContent

Subscribes to document changes and returns the current content.

```tsx
import { useEditorContent } from '@amusendame/beakblock-react';

function Editor() {
  const editor = useBeakBlock({ /* ... */ });
  const blocks = useEditorContent(editor);

  return (
    <div>
      <BeakBlockView editor={editor} />
      <pre>{JSON.stringify(blocks, null, 2)}</pre>
    </div>
  );
}
```

### useEditorSelection

Subscribes to selection changes and returns selected blocks.

```tsx
import { useEditorSelection } from '@amusendame/beakblock-react';

function Editor() {
  const editor = useBeakBlock({ /* ... */ });
  const selectedBlocks = useEditorSelection(editor);

  return (
    <div>
      <BeakBlockView editor={editor} />
      <p>Selected: {selectedBlocks.length} blocks</p>
    </div>
  );
}
```

## Components

### BeakBlockView

Renders the ProseMirror editor view.

```tsx
<BeakBlockView
  editor={editor}
  className="my-editor"  // Optional CSS class
/>
```

### SlashMenu

Shows a command palette when typing `/`.

```tsx
<SlashMenu editor={editor} />
```

The menu appears:
- When typing `/` at the start of an empty block
- Shows matching commands as you type
- Navigate with arrow keys, select with Enter
- Press Escape to close

### BubbleMenu

Floating toolbar for text formatting.

```tsx
<BubbleMenu editor={editor} />
```

The menu appears:
- When selecting text
- Shows formatting buttons (bold, italic, link, etc.)
- Includes block type selector
- Includes text alignment

### TableHandles

Row/column manipulation handles for tables.

```tsx
<TableHandles editor={editor} />
```

Shows:
- Row handles on the left (click to add/delete rows)
- Column handles on top (click to add/delete columns)
- Extend buttons to add rows/columns at the end

## Handling Events

### Document Changes

```tsx
function Editor() {
  const editor = useBeakBlock({
    onUpdate: (blocks) => {
      // Save to server
      saveDocument(blocks);
    },
  });

  // Or use the hook
  const blocks = useEditorContent(editor);

  useEffect(() => {
    if (blocks) {
      saveDocument(blocks);
    }
  }, [blocks]);
}
```

### Selection Changes

```tsx
function Editor() {
  const editor = useBeakBlock({
    onSelectionChange: (selectedBlocks) => {
      console.log('Selected:', selectedBlocks);
    },
  });
}
```

### Focus/Blur

```tsx
function Editor() {
  const [isFocused, setIsFocused] = useState(false);

  const editor = useBeakBlock({
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
  });

  return (
    <div className={isFocused ? 'editor-focused' : ''}>
      <BeakBlockView editor={editor} />
    </div>
  );
}
```

## Controlled vs Uncontrolled

### Uncontrolled (Recommended)

Let the editor manage its own state:

```tsx
function Editor() {
  const editor = useBeakBlock({
    initialContent: initialBlocks,
    onUpdate: (blocks) => {
      // Persist changes
      localStorage.setItem('doc', JSON.stringify(blocks));
    },
  });

  return <BeakBlockView editor={editor} />;
}
```

### Controlled

For advanced use cases where you need to control the content:

```tsx
function ControlledEditor({ value, onChange }) {
  const editor = useBeakBlock({
    initialContent: value,
  });

  // Sync external changes to editor
  useEffect(() => {
    if (editor && value) {
      const currentDoc = editor.getDocument();
      if (JSON.stringify(currentDoc) !== JSON.stringify(value)) {
        editor.setDocument(value);
      }
    }
  }, [editor, value]);

  // Notify parent of changes
  const blocks = useEditorContent(editor);
  useEffect(() => {
    if (blocks) {
      onChange(blocks);
    }
  }, [blocks, onChange]);

  return <BeakBlockView editor={editor} />;
}
```

## Building a Toolbar

```tsx
function Toolbar({ editor }) {
  if (!editor) return null;

  return (
    <div className="toolbar">
      <button
        onClick={() => editor.toggleBold()}
        className={editor.pm.isMarkActive('bold') ? 'active' : ''}
      >
        Bold
      </button>
      <button
        onClick={() => editor.toggleItalic()}
        className={editor.pm.isMarkActive('italic') ? 'active' : ''}
      >
        Italic
      </button>
      <button onClick={() => editor.setBlockType('heading', { level: 1 })}>
        H1
      </button>
      <button onClick={() => editor.setBlockType('heading', { level: 2 })}>
        H2
      </button>
      <button onClick={() => editor.setBlockType('bulletList')}>
        Bullet List
      </button>
    </div>
  );
}

function Editor() {
  const editor = useBeakBlock({ /* ... */ });

  return (
    <div>
      <Toolbar editor={editor} />
      <BeakBlockView editor={editor} />
    </div>
  );
}
```

## Accessing ProseMirror

```tsx
function AdvancedEditor() {
  const editor = useBeakBlock({ /* ... */ });

  const handleCustomAction = () => {
    if (!editor) return;

    // Access ProseMirror view
    const view = editor.pm.view;

    // Access current state
    const state = editor.pm.state;

    // Create and dispatch transaction
    const tr = state.tr;
    tr.insertText('Hello!');
    view.dispatch(tr);

    // Or use the helper
    editor.pm.dispatch(state.tr.insertText('Hello!'));
  };

  return (
    <div>
      <button onClick={handleCustomAction}>Insert Text</button>
      <BeakBlockView editor={editor} />
    </div>
  );
}
```

## Server-Side Rendering (SSR)

BeakBlock requires the DOM, so use dynamic imports:

```tsx
// components/Editor.tsx
'use client'; // For Next.js App Router

import dynamic from 'next/dynamic';

const EditorInner = dynamic(
  () => import('./EditorInner'),
  { ssr: false, loading: () => <div>Loading editor...</div> }
);

export default function Editor(props) {
  return <EditorInner {...props} />;
}
```

```tsx
// components/EditorInner.tsx
import { useBeakBlock, BeakBlockView } from '@amusendame/beakblock-react';

export default function EditorInner({ initialContent }) {
  const editor = useBeakBlock({ initialContent });

  if (!editor) return <div>Loading...</div>;

  return <BeakBlockView editor={editor} />;
}
```

## Component Customization

### BubbleMenu Customization

The BubbleMenu supports extensive customization for adding, reordering, or hiding items.

```tsx
import { BubbleMenu, BubbleMenuItem, BUBBLE_MENU_ITEMS } from '@amusendame/beakblock-react';

// Create a custom button
const translateButton: BubbleMenuItem = {
  id: 'translate',
  label: 'Translate',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10" />
    </svg>
  ),
  action: async (editor, state) => {
    const text = editor.pm.state.doc.textBetween(state.from, state.to);
    // Handle translation...
  },
};

// Use with customization props
<BubbleMenu
  editor={editor}
  customItems={[translateButton]}
  itemOrder={[
    'bold', 'italic', 'underline',
    '---',  // Divider
    'translate',
    '---',
    'link', 'color',
  ]}
  hideItems={['strikethrough', 'code']}
/>
```

**Available default item IDs:**
- Block type: `blockType`
- Alignment: `alignLeft`, `alignCenter`, `alignRight`
- Formatting: `bold`, `italic`, `underline`, `strikethrough`
- Style: `code`, `link`, `color`

### SlashMenu Customization

The SlashMenu supports similar customization patterns.

```tsx
import { SlashMenu, SlashMenuItem } from '@amusendame/beakblock-react';

const customItems: SlashMenuItem[] = [
  {
    id: 'emoji',
    title: 'Emoji',
    description: 'Insert an emoji',
    icon: '😀',
    action: (editor) => {
      // Show emoji picker...
    },
  },
];

<SlashMenu
  editor={editor}
  customItems={customItems}
  hideItems={['table', 'video']}
  itemOrder={['paragraph', 'heading', 'bulletList', 'emoji']}
/>
```

**Available default item IDs:**
- Text: `paragraph`, `heading`
- Lists: `bulletList`, `numberedList`, `checkList`
- Blocks: `blockquote`, `codeBlock`, `callout`, `divider`
- Tables: `table`
- Media: `image`, `video`, `audio`, `file`

### ColorPicker Customization

Customize the color palettes for text and background colors.

```tsx
import { ColorPicker, ColorOption, DEFAULT_TEXT_COLORS } from '@amusendame/beakblock-react';

const brandTextColors: ColorOption[] = [
  { value: '', label: 'Default' },
  { value: '#0066cc', label: 'Brand Blue' },
  { value: '#00994d', label: 'Brand Green' },
  { value: '#cc3300', label: 'Brand Red' },
];

const brandBackgroundColors: ColorOption[] = [
  { value: '', label: 'None' },
  { value: '#e6f2ff', label: 'Blue Highlight' },
  { value: '#e6ffe6', label: 'Green Highlight' },
];

<ColorPicker
  editor={editor}
  currentTextColor={textColor}
  currentBackgroundColor={bgColor}
  textColors={brandTextColors}
  backgroundColors={brandBackgroundColors}
  textColorLabel="Text Color"
  backgroundColorLabel="Highlight"
/>
```

## TypeScript

All components and hooks are fully typed:

```tsx
import type { Block, BeakBlockEditor } from '@amusendame/beakblock-core';

interface EditorProps {
  initialContent: Block[];
  onChange: (blocks: Block[]) => void;
}

function MyEditor({ initialContent, onChange }: EditorProps) {
  const editor: BeakBlockEditor | null = useBeakBlock({
    initialContent,
    onUpdate: onChange,
  });

  // ...
}
```

## Performance Tips

1. **Memoize callbacks** — Use `useCallback` for event handlers
2. **Avoid re-renders** — Don't pass new objects as props on each render
3. **Use `useEditorContent` sparingly** — It triggers re-renders on every change
4. **Debounce saves** — Don't save to server on every keystroke

```tsx
import { useMemo, useCallback } from 'react';
import debounce from 'lodash/debounce';

function Editor() {
  const handleUpdate = useCallback((blocks: Block[]) => {
    saveToServer(blocks);
  }, []);

  const debouncedUpdate = useMemo(
    () => debounce(handleUpdate, 1000),
    [handleUpdate]
  );

  const editor = useBeakBlock({
    initialContent,
    onUpdate: debouncedUpdate,
  });

  // Cleanup
  useEffect(() => {
    return () => debouncedUpdate.cancel();
  }, [debouncedUpdate]);

  return <BeakBlockView editor={editor} />;
}
```

## Common Patterns

### Read-only Mode

```tsx
function ReadOnlyEditor({ content }) {
  const editor = useBeakBlock({
    initialContent: content,
    editable: false,
  });

  return <BeakBlockView editor={editor} />;
}
```

### Loading State

```tsx
function Editor() {
  const [content, setContent] = useState<Block[] | null>(null);

  useEffect(() => {
    fetchDocument().then(setContent);
  }, []);

  const editor = useBeakBlock({
    initialContent: content || [],
  });

  if (!content) return <Skeleton />;
  if (!editor) return <div>Initializing...</div>;

  return <BeakBlockView editor={editor} />;
}
```

### Error Boundary

```tsx
import { ErrorBoundary } from 'react-error-boundary';

function EditorError({ error, resetErrorBoundary }) {
  return (
    <div className="error">
      <p>Editor failed to load</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary FallbackComponent={EditorError}>
      <Editor />
    </ErrorBoundary>
  );
}
```
