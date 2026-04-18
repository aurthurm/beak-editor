# @aurthurm/beakblock-vue

Vue 3 bindings for the BeakBlock rich text editor.

## Installation

```bash
pnpm add @aurthurm/beakblock-core @aurthurm/beakblock-vue vue
```

## Quick Start

```vue
<script setup lang="ts">
import { useBeakBlock, BeakBlockView, SlashMenu, BubbleMenu } from '@aurthurm/beakblock-vue';
import { createChartBlockSpec } from '@aurthurm/beakblock-vue';

const editor = useBeakBlock({
  initialContent: [
    {
      id: '1',
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: 'Hello Vue', styles: {} }],
    },
    {
      id: '2',
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: 'Start editing...', styles: {} }],
    },
  ],
  customBlocks: [createChartBlockSpec()],
});
</script>

<template>
  <BeakBlockView :editor="editor" class-name="my-editor" />
  <SlashMenu :editor="editor" />
  <BubbleMenu :editor="editor" />
</template>
```

## Composables

### `useBeakBlock`

Creates and manages an `BeakBlockEditor` instance.

```ts
const editor = useBeakBlock({
  initialContent: [...],
  editable: true,
  autoFocus: 'end',
  injectStyles: true,
});
```

### `useEditorContent`

Subscribe to document changes.

```ts
const blocks = useEditorContent(editor);
```

### `useEditorSelection`

Subscribe to selection changes.

```ts
const selectedBlocks = useEditorSelection(editor);
```

### `useEditorFocus`

Track editor focus state.

```ts
const isFocused = useEditorFocus(editor);
```

### `useCustomSlashMenuItems`

Build slash menu items from custom Vue blocks.

```ts
const customSlashItems = useCustomSlashMenuItems(editor, customBlocks);
```

## Comments

Inline comments use **`CommentStore`** and **`createCommentPlugin`** from `@aurthurm/beakblock-core`, plus Vue components:

- **`CommentRail`** — marker rail and flyouts around the editor (wraps `BeakBlockView` in the default slot).
- **`CommentModal`** — modal to add a thread from the current selection and manage overlapping threads.

Hook **`BubbleMenu`** with `@comment` to open the modal. On every editor transaction with a document change, call **`store.mapAnchors(transaction.mapping)`** so highlights stay aligned (see guide).

Full API, anchoring, persistence, and troubleshooting: **[Comments guide](../../docs/comments.md)**.

Example: [`examples/nuxt-vue/components/ComplianceSectionEditor.vue`](../examples/nuxt-vue/components/ComplianceSectionEditor.vue) — also wires **section approvals**, **approval history**, **post-approval read-only lock** for authors, and lives inside the broader compliance workspace (**[Compliance workflow](../../docs/compliance-demo.md)**).

## Components

### `BeakBlockView`

Renders the editor view.

```vue
<BeakBlockView
  :editor="editor"
  class-name="my-editor"
  tag="section"
/>
```

The component exposes `container` and `editor` via `ref`.

### `SlashMenu`

Command palette triggered by `/`.

```vue
<SlashMenu :editor="editor" />
```

Supports `items`, `customItems`, `itemOrder`, `hideItems`, and `renderItem`.

### `createChartBlockSpec`

Adds a Chart.js-backed block with editable data and inline slash menu support.

```ts
import { createChartBlockSpec, useCustomSlashMenuItems, useBeakBlock } from '@aurthurm/beakblock-vue';

const customBlocks = [createChartBlockSpec()];
const editor = useBeakBlock({
  customBlocks,
});
const customSlashItems = useCustomSlashMenuItems(editor, customBlocks);
```

Pass `customSlashItems` into `<SlashMenu :custom-items="customSlashItems" />` so the chart command appears in the `/` menu.

The chart block exposes a chart editor modal and serializes chart data through the document JSON.

### `BubbleMenu`

Floating formatting toolbar.

```vue
<BubbleMenu :editor="editor" />
```

Supports `customItems`, `itemOrder`, `hideItems`, and `children`.

### `ColorPicker`

Color picker for text and background colors.

```vue
<ColorPicker
  :editor="editor"
  :current-text-color="textColor"
  :current-background-color="backgroundColor"
/>
```

### `TableMenu`

Table editing menu for rows, columns, and delete actions.

```vue
<TableMenu :editor="editor" />
```

### `TableHandles`

Row and column handles for table manipulation.

```vue
<TableHandles :editor="editor" />
```

### `MediaMenu`

Media block menu for image and embed controls.

```vue
<MediaMenu :editor="editor" />
```

### `LinkPopover`

Link editing popover for inline text selections.

```vue
<LinkPopover
  :editor="editor"
  :current-url="currentUrl"
  :position="{ left: 0, top: 0 }"
  :on-close="closePopover"
/>
```

## BubbleMenu Customization

The `BubbleMenu` supports the same item ordering and custom item model as the React package.

### Props

```ts
interface BubbleMenuProps {
  editor: BeakBlockEditor | null;
  customItems?: BubbleMenuItem[];
  itemOrder?: string[];
  hideItems?: string[];
  className?: string;
  children?: (props: { editor: BeakBlockEditor; state: BubbleMenuState }) => VNodeChild;
}
```

### Default Item IDs

- Block type: `blockType`
- Alignment: `alignLeft`, `alignCenter`, `alignRight`
- Formatting: `bold`, `italic`, `underline`, `strikethrough`
- Style: `code`, `link`, `color`

### Example: Add a Custom Button

```vue
<script setup lang="ts">
import { BubbleMenu } from '@aurthurm/beakblock-vue';

const translateButton = {
  id: 'translate',
  label: 'Translate',
  icon: 'Translate',
  action: async (editor, state) => {
    const text = editor.pm.state.doc.textBetween(state.from, state.to);
    const translated = await translateAPI(text);
    console.log(translated);
  },
};
</script>

<template>
  <BubbleMenu
    :editor="editor"
    :custom-items="[translateButton]"
  />
</template>
```

### Example: Reorder Items

```vue
<BubbleMenu
  :editor="editor"
  :item-order="['bold', 'italic', 'underline', '---', 'link', 'color', '---', 'translate']"
/>
```

### Example: Minimal Toolbar

```vue
<BubbleMenu
  :editor="editor"
  :item-order="['bold', 'italic', '---', 'link']"
/>
```

### Example: Hide Items

```vue
<BubbleMenu
  :editor="editor"
  :hide-items="['strikethrough', 'code', 'alignLeft', 'alignCenter', 'alignRight']"
/>
```

## SlashMenu Customization

The `SlashMenu` supports customization similar to `BubbleMenu`.

### Props

```ts
interface SlashMenuProps {
  editor: BeakBlockEditor | null;
  items?: SlashMenuItem[];
  customItems?: SlashMenuItem[];
  itemOrder?: string[];
  hideItems?: string[];
  renderItem?: (item: SlashMenuItem, isSelected: boolean) => VNodeChild;
  className?: string;
}
```

### Default Item IDs

- Text: `paragraph`, `heading`
- Lists: `bulletList`, `numberedList`, `checkList`
- Blocks: `blockquote`, `codeBlock`, `callout`, `divider`
- Tables: `table`
- Media: `image`, `video`, `audio`, `file`

### Example: Add Custom Items

```vue
<script setup lang="ts">
import { SlashMenu } from '@aurthurm/beakblock-vue';

const customItems = [
  {
    id: 'emoji',
    title: 'Emoji',
    description: 'Insert an emoji picker',
    icon: '😀',
    action: (editor) => {
      console.log('open emoji picker', editor);
    },
  },
  {
    id: 'template',
    title: 'Template',
    description: 'Insert a predefined template',
    icon: '📄',
    action: (editor) => {
      console.log('insert template', editor);
    },
  },
];
</script>

<template>
  <SlashMenu
    :editor="editor"
    :custom-items="customItems"
  />
</template>
```

### Example: Custom Order

```vue
<SlashMenu
  :editor="editor"
  :item-order="['paragraph', 'heading', 'bulletList', 'emoji', 'template']"
/>
```

### Example: Hide Items

```vue
<SlashMenu
  :editor="editor"
  :hide-items="['table', 'video', 'audio', 'file']"
/>
```

## ColorPicker Customization

The `ColorPicker` component accepts custom palettes.

### Props

```ts
interface ColorPickerProps {
  editor: BeakBlockEditor;
  currentTextColor: string | null;
  currentBackgroundColor: string | null;
  textColors?: ColorOption[];
  backgroundColors?: ColorOption[];
  textColorLabel?: string;
  backgroundColorLabel?: string;
  onClose?: () => void;
}
```

### Default Palettes

```ts
import { DEFAULT_TEXT_COLORS, DEFAULT_BACKGROUND_COLORS } from '@aurthurm/beakblock-vue';
```

### Example: Brand Color Palette

```vue
<script setup lang="ts">
import { ColorPicker } from '@aurthurm/beakblock-vue';

const brandTextColors = [
  { value: '', label: 'Default' },
  { value: '#1a1a1a', label: 'Black' },
  { value: '#0066cc', label: 'Primary' },
  { value: '#00994d', label: 'Success' },
  { value: '#cc3300', label: 'Error' },
];

const brandBackgroundColors = [
  { value: '', label: 'None' },
  { value: '#e6f2ff', label: 'Blue' },
  { value: '#e6ffe6', label: 'Green' },
  { value: '#ffe6e6', label: 'Red' },
];
</script>

<template>
  <ColorPicker
    :editor="editor"
    :current-text-color="textColor"
    :current-background-color="bgColor"
    :text-colors="brandTextColors"
    :background-colors="brandBackgroundColors"
    text-color-label="Text Color"
    background-color-label="Highlight"
  />
</template>
```

## Accessing ProseMirror

The editor instance exposes the public ProseMirror surface directly:

```vue
<script setup lang="ts">
import { useBeakBlock, BeakBlockView } from '@aurthurm/beakblock-vue';

const editor = useBeakBlock({});

const handleBold = () => {
  editor.value?.toggleBold();
};

const handleCustomAction = () => {
  const currentEditor = editor.value;
  if (!currentEditor) return;

  const tr = currentEditor.pm.createTransaction();
  tr.insertText('Custom text');
  currentEditor.pm.dispatch(tr);
};
</script>

<template>
  <button type="button" @click="handleBold">Bold</button>
  <button type="button" @click="handleCustomAction">Insert</button>
  <BeakBlockView :editor="editor" />
</template>
```

## Example Apps

- [`examples/vite-vue`](../../examples/vite-vue) - Vite + Vue demo
- [`examples/nuxt-vue`](../../examples/nuxt-vue) - Nuxt + Vue demo
