# @amusendame/beakblock-react

React bindings for the BeakBlock rich text editor.

## Installation

```bash
npm install @amusendame/beakblock-react @amusendame/beakblock-core
# or
pnpm add @amusendame/beakblock-react @amusendame/beakblock-core
```

## Quick Start

```tsx
import { useBeakBlock, BeakBlockView, SlashMenu, BubbleMenu } from '@amusendame/beakblock-react';
import '@amusendame/beakblock-core/styles/editor.css';

function MyEditor() {
  const editor = useBeakBlock({
    initialContent: [
      {
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: 'Hello World', styles: {} }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Start editing...', styles: {} }],
      },
    ],
  });

  if (!editor) return <div>Loading...</div>;

  return (
    <div className="editor-container">
      <BeakBlockView editor={editor} />
      <SlashMenu editor={editor} />
      <BubbleMenu editor={editor} />
    </div>
  );
}
```

## Hooks

### useBeakBlock

Creates and manages an BeakBlockEditor instance.

```tsx
const editor = useBeakBlock({
  initialContent: [...],
  editable: true,
  autoFocus: 'end',
  onUpdate: (blocks) => console.log(blocks),
  deps: [someValue], // Recreate editor when deps change
});
```

### useEditorContent

Subscribe to document changes.

```tsx
const blocks = useEditorContent(editor);
// blocks updates whenever the document changes
```

### useEditorSelection

Subscribe to selection changes.

```tsx
const selectedBlocks = useEditorSelection(editor);
// selectedBlocks updates when selection changes
```

### useEditorFocus

Track editor focus state.

```tsx
const isFocused = useEditorFocus(editor);
```

## Comments

Use **`CommentStore`** and **`createCommentPlugin`** from `@amusendame/beakblock-core`, and **`CommentModal`** from this package. There is no React `CommentRail` yet; use the modal and bubble menu.

Wire **`BubbleMenu`** with `onComment` to open the modal. On every editor transaction with a document change, call **`store.mapAnchors(transaction.mapping)`** so thread anchors match the document.

Full API and patterns: **[Comments guide](../../docs/comments.md)**.

## Components

### BeakBlockView

Renders the editor view.

```tsx
<BeakBlockView
  editor={editor}
  className="my-editor"
/>
```

With ref for imperative access:

```tsx
const viewRef = useRef<BeakBlockViewRef>(null);

<BeakBlockView
  ref={viewRef}
  editor={editor}
/>

// Later: viewRef.current?.focus()
```

### SlashMenu

Command palette triggered by typing `/`.

```tsx
<SlashMenu editor={editor} />
```

See [SlashMenu Customization](#slashmenu-customization) for advanced usage.

### BubbleMenu

Floating toolbar for text formatting.

```tsx
<BubbleMenu editor={editor} />
```

See [BubbleMenu Customization](#bubblemenu-customization) for advanced usage.

### ColorPicker

Color picker for text and background colors.

```tsx
import { ColorPicker } from '@amusendame/beakblock-react';

<ColorPicker
  editor={editor}
  currentTextColor={textColor}
  currentBackgroundColor={bgColor}
/>
```

See [ColorPicker Customization](#colorpicker-customization) for advanced usage.

### TableHandles

Row/column manipulation handles for tables.

```tsx
<TableHandles editor={editor} />
```

### MediaMenu

Menu for media blocks (images, videos, files).

```tsx
<MediaMenu editor={editor} />
```

---

## Customization API

### BubbleMenu Customization

The BubbleMenu supports extensive customization through props.

#### Props

```tsx
interface BubbleMenuProps {
  editor: BeakBlockEditor | null;
  customItems?: BubbleMenuItem[];  // Add custom buttons
  itemOrder?: string[];            // Control order (use '---' for dividers)
  hideItems?: string[];            // Hide default items
  className?: string;
  children?: React.ReactNode;
}
```

#### Default Item IDs

- **Block type:** `blockType`
- **Alignment:** `alignLeft`, `alignCenter`, `alignRight`
- **Formatting:** `bold`, `italic`, `underline`, `strikethrough`
- **Style:** `code`, `link`, `color`

#### Example: Add a Custom Button

```tsx
import { BubbleMenu, BubbleMenuItem } from '@amusendame/beakblock-react';

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
    const translated = await translateAPI(text);
    // Replace selection...
  },
};

<BubbleMenu
  editor={editor}
  customItems={[translateButton]}
/>
```

#### Example: Reorder Items

```tsx
<BubbleMenu
  editor={editor}
  itemOrder={[
    'bold', 'italic', 'underline',
    '---',  // Divider
    'link', 'color',
    '---',
    'translate',  // Custom item
  ]}
/>
```

#### Example: Minimal Toolbar

```tsx
<BubbleMenu
  editor={editor}
  itemOrder={['bold', 'italic', '---', 'link']}
/>
```

#### Example: Hide Items

```tsx
<BubbleMenu
  editor={editor}
  hideItems={['strikethrough', 'code', 'alignLeft', 'alignCenter', 'alignRight']}
/>
```

---

### SlashMenu Customization

The SlashMenu supports customization similar to BubbleMenu.

#### Props

```tsx
interface SlashMenuProps {
  editor: BeakBlockEditor | null;
  items?: SlashMenuItem[];         // Replace all defaults
  customItems?: SlashMenuItem[];   // Add to defaults
  itemOrder?: string[];            // Control order (only listed items shown)
  hideItems?: string[];            // Hide specific items
  renderItem?: (item: SlashMenuItem, isSelected: boolean) => React.ReactNode;
  className?: string;
}
```

#### Default Item IDs

- **Text:** `paragraph`, `heading`
- **Lists:** `bulletList`, `numberedList`, `checkList`
- **Blocks:** `blockquote`, `codeBlock`, `callout`, `divider`
- **Tables:** `table`
- **Media:** `image`, `video`, `audio`, `file`

#### Example: Add Custom Items

```tsx
import { SlashMenu, SlashMenuItem } from '@amusendame/beakblock-react';

const customItems: SlashMenuItem[] = [
  {
    id: 'emoji',
    title: 'Emoji',
    description: 'Insert an emoji picker',
    icon: '😀',
    action: (editor) => {
      // Show emoji picker...
    },
  },
  {
    id: 'template',
    title: 'Template',
    description: 'Insert a predefined template',
    icon: '📄',
    action: (editor) => {
      // Insert template...
    },
  },
];

<SlashMenu
  editor={editor}
  customItems={customItems}
/>
```

#### Example: Custom Order

```tsx
<SlashMenu
  editor={editor}
  itemOrder={['paragraph', 'heading', 'bulletList', 'emoji', 'template']}
/>
```

#### Example: Hide Items

```tsx
<SlashMenu
  editor={editor}
  hideItems={['table', 'video', 'audio', 'file']}
/>
```

---

### ColorPicker Customization

The ColorPicker component allows custom color palettes.

#### Props

```tsx
interface ColorPickerProps {
  editor: BeakBlockEditor;
  currentTextColor: string | null;
  currentBackgroundColor: string | null;
  textColors?: ColorOption[];       // Custom text color palette
  backgroundColors?: ColorOption[]; // Custom background color palette
  textColorLabel?: string;          // Label for text color section
  backgroundColorLabel?: string;    // Label for background section
  onClose?: () => void;
}

interface ColorOption {
  value: string;  // CSS color value ('' for default/remove)
  label: string;  // Display label
}
```

#### Default Palettes

```tsx
import { DEFAULT_TEXT_COLORS, DEFAULT_BACKGROUND_COLORS } from '@amusendame/beakblock-react';

// DEFAULT_TEXT_COLORS includes:
// Default, Gray, Red, Orange, Yellow, Green, Blue, Purple, Pink

// DEFAULT_BACKGROUND_COLORS includes:
// Default, Gray, Red, Orange, Yellow, Green, Blue, Purple, Pink (lighter versions)
```

#### Example: Brand Color Palette

```tsx
import { ColorPicker, ColorOption } from '@amusendame/beakblock-react';

const brandTextColors: ColorOption[] = [
  { value: '', label: 'Default' },
  { value: '#1a1a1a', label: 'Black' },
  { value: '#0066cc', label: 'Primary' },
  { value: '#00994d', label: 'Success' },
  { value: '#cc3300', label: 'Error' },
];

const brandBackgroundColors: ColorOption[] = [
  { value: '', label: 'None' },
  { value: '#e6f2ff', label: 'Blue' },
  { value: '#e6ffe6', label: 'Green' },
  { value: '#ffe6e6', label: 'Red' },
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

---

## Accessing ProseMirror

The editor instance provides full ProseMirror access:

```tsx
function MyEditor() {
  const editor = useBeakBlock({...});

  const handleBold = () => {
    editor.toggleBold();
  };

  const handleCustomAction = () => {
    // Direct ProseMirror access
    const tr = editor.pm.createTransaction();
    tr.insertText('Custom text');
    editor.pm.dispatch(tr);
  };

  return (
    <>
      <button onClick={handleBold}>Bold</button>
      <button onClick={handleCustomAction}>Insert</button>
      <BeakBlockView editor={editor} />
    </>
  );
}
```

---

## Exports

### Components

- `BeakBlockView` - Main editor view
- `SlashMenu` - Command palette
- `BubbleMenu` - Floating toolbar
- `ColorPicker` - Color selection
- `TableMenu` - Table manipulation menu
- `TableHandles` - Table row/column handles
- `MediaMenu` - Media block menu
- `LinkPopover` - Link editing popover

### Hooks

- `useBeakBlock` - Create editor instance
- `useEditorContent` - Subscribe to content
- `useEditorSelection` - Subscribe to selection
- `useEditorFocus` - Track focus state

### Constants

- `BUBBLE_MENU_ITEMS` - Default bubble menu items map
- `DEFAULT_BUBBLE_MENU_ORDER` - Default bubble menu item order
- `DEFAULT_TEXT_COLORS` - Default text color palette
- `DEFAULT_BACKGROUND_COLORS` - Default background color palette

### Types

- `BeakBlockViewProps`, `BeakBlockViewRef`
- `SlashMenuProps`, `SlashMenuItem`
- `BubbleMenuProps`, `BubbleMenuItem`
- `ColorPickerProps`, `ColorOption`
- `TableMenuProps`, `TableHandlesProps`
- `MediaMenuProps`, `LinkPopoverProps`

---

## Documentation

For complete documentation, see:

- [React Integration Guide](../../docs/react-integration.md)
- [Styling Guide](../../docs/styling.md)
- [Custom Blocks](../../docs/custom-blocks.md)
- [Plugins](../../docs/plugins.md)

## License

Apache-2.0
