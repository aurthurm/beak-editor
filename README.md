# BeakBlock

BeakBlock is a monorepo for a block-based rich text editor built on ProseMirror. The core idea is simple: the editor keeps a public ProseMirror surface instead of hiding it behind a private wrapper, and the framework packages expose that core cleanly for React and Vue.

<p align="center">
  <img src=".github/beakblock-vue-showcase.png" alt="BeakBlock Vue showcase" width="720" />
</p>

## What's in this repo

- `packages/core` - the editor engine, schema, plugins, markdown tools, collaboration hooks, comments, versioning, track changes, and compliance lock support
- `packages/react` - React hooks and components for embedding the editor
- `packages/vue` - Vue 3 composables and components for embedding the editor
- `examples/basic` - React demo with toolbar actions, JSON inspection, markdown export, and DOCX/PDF export
- `examples/vite-vue` - Vue showcase with rich blocks, AI, comments, and custom chart blocks
- `examples/nuxt-vue` - a larger Nuxt app showing collaboration, approvals, templates, and compliance workflows
- `docs` - the reference docs for blocks, markdown, comments, collaboration, styling, versioning, and publishing

## Why BeakBlock

BeakBlock is designed for teams that want a real editor runtime, not a black box.

- Public access to ProseMirror through `editor.pm.*`
- A JSON block model that can be stored, transformed, and restored
- First-class React and Vue integrations on top of the same core
- Built-in support for menus, tables, media, embeds, comments, AI entry points, versioning, track changes, and compliance locks
- Markdown import/export and clipboard paste support
- Optional collaboration via Y.js
- Custom block and custom mark support

## Packages

| Package | Purpose |
| --- | --- |
| `@amusendame/beakblock-core` | Core editor engine, schema, commands, plugins, markdown, comments, versioning, collaboration, and styling |
| `@amusendame/beakblock-react` | React hooks, editor view, slash menu, bubble menu, AI modal, comments modal, table tools, and custom block helpers |
| `@amusendame/beakblock-vue` | Vue 3 composables, editor view, slash menu, bubble menu, AI modal, comments UI, table tools, chart block helpers, and custom block helpers |

## Installation

Install only what you need:

```bash
pnpm add @amusendame/beakblock-core
pnpm add @amusendame/beakblock-core @amusendame/beakblock-react
pnpm add @amusendame/beakblock-core @amusendame/beakblock-vue
```

For collaboration features, also install:

```bash
pnpm add yjs y-prosemirror y-websocket
```

## Quick Start

### Core

```ts
import { BeakBlockEditor } from '@amusendame/beakblock-core';
import '@amusendame/beakblock-core/styles/editor.css';

const editor = new BeakBlockEditor({
  element: document.getElementById('editor'),
  initialContent: [
    {
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: 'Hello BeakBlock', styles: {} }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Start editing...', styles: {} }],
    },
  ],
});

console.log(editor.getDocument());
console.log(editor.pm.state);
```

### React

```tsx
import {
  useBeakBlock,
  BeakBlockView,
  SlashMenu,
  BubbleMenu,
  TableHandles,
} from '@amusendame/beakblock-react';
import '@amusendame/beakblock-core/styles/editor.css';

function Editor() {
  const editor = useBeakBlock({
    initialContent: [
      {
        id: '1',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Hello, React', styles: {} }],
      },
    ],
  });

  return (
    <>
      <BeakBlockView editor={editor} />
      <SlashMenu editor={editor} />
      <BubbleMenu editor={editor} />
      <TableHandles editor={editor} />
    </>
  );
}
```

`useBeakBlock()` returns `null` until the editor is mounted, and `BeakBlockView` accepts that null state while it initializes.

### Vue

```vue
<script setup lang="ts">
import { useBeakBlock, BeakBlockView } from '@amusendame/beakblock-vue';

const editor = useBeakBlock({
  initialContent: [
    {
      id: '1',
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: 'Hello, Vue', styles: {} }],
    },
  ],
});
</script>

<template>
  <BeakBlockView :editor="editor" />
</template>
```

## Core Capabilities

### Public editor runtime

The core package exposes the editor instance and the underlying ProseMirror objects directly. The main escape hatch is intentional, not hidden:

```ts
editor.pm.view
editor.pm.state
editor.pm.dispatch(tr)
```

### Document model

Documents are stored as arrays of `Block` objects. Built-in block families include:

- Text blocks such as `paragraph`, `heading`, `blockquote`, `callout`, and `codeBlock`
- Structural blocks such as `divider`
- Lists such as `bulletList`, `orderedList`, `listItem`, `checkList`, and `checkListItem`
- Layout blocks such as `columnList`, `column`, and `tableOfContents`
- Tables such as `table`, `tableRow`, `tableCell`, and `tableHeader`
- Media blocks such as `image` and `embed`

See the block reference in [`docs/blocks/README.md`](docs/blocks/README.md).

### Markdown

The core supports Markdown import/export and Markdown-aware paste handling.

- `markdownToBlocks`
- `blocksToMarkdown`
- `blocksToMdastRoot`
- `mdastToBlocks`
- `looksLikeMarkdown`

See [`docs/markdown.md`](docs/markdown.md).

### Comments

Comments are selection-anchored threads stored outside the document JSON.

- Use `createCommentPlugin(store)` to render annotations
- Use `CommentStore` or `InMemoryCommentStore`
- Call `store.mapAnchors(transaction.mapping)` on document-changing transactions

See [`docs/comments.md`](docs/comments.md).

### Versioning and track changes

The core supports snapshot storage through a pluggable adapter and a separate track-changes flow.

- `VersioningAdapter`
- `InMemoryVersioningAdapter`
- `saveVersion`, `listVersions`, `getVersion`, `restoreVersion`
- `enableTrackChanges`, `disableTrackChanges`, `acceptTrackedChange`, `rejectTrackedChange`

See [`docs/versioning.md`](docs/versioning.md).

### Collaboration

Y.js collaboration is supported through optional peers:

- `yjs`
- `y-prosemirror`
- `y-websocket`

See [`docs/collaboration.md`](docs/collaboration.md).

### Compliance locks

The core includes compliance lock support for read-only headings and lock-aware drag/drop behavior.

- `complianceLock`
- `dragDrop.headingLockBadge`
- `COMPLIANCE_LOCK_BYPASS_META`

See [`docs/compliance-lock.md`](docs/compliance-lock.md) and the compliance example in [`docs/compliance-demo.md`](docs/compliance-demo.md).

### Styling

Styles are auto-injected by default. If you want to control CSS yourself, disable injection and import the stylesheet manually.

```ts
import '@amusendame/beakblock-core/styles/editor.css';

const editor = new BeakBlockEditor({
  injectStyles: false,
});
```

See [`docs/styling.md`](docs/styling.md).

## Framework Adapters

### React

`@amusendame/beakblock-react` exports:

- `useBeakBlock`
- `useEditorContent`
- `useEditorSelection`
- `useEditorFocus`
- `useDocumentVersions`
- `BeakBlockView`
- `SlashMenu`
- `BubbleMenu`
- `AIModal`
- `CommentModal`
- `TableMenu`
- `TableHandles`
- `MediaMenu`
- `ColorPicker`

It also exports custom block helpers like `createReactBlockSpec`, `useBlockEditor`, and `useUpdateBlock`.

### Vue

`@amusendame/beakblock-vue` exports:

- `useBeakBlock`
- `useEditorContent`
- `useEditorSelection`
- `useEditorFocus`
- `useDocumentVersions`
- `BeakBlockView`
- `SlashMenu`
- `BubbleMenu`
- `AIModal`
- `CommentModal`
- `CommentRail`
- `LinkPopover`
- `TableMenu`
- `TableHandles`
- `MediaMenu`
- `ColorPicker`

It also exports Vue custom block helpers such as `createVueBlockSpec`, `createChartBlockSpec`, `useBlockEditor`, and `useUpdateBlock`.

## AI Integration

BeakBlock treats AI as a workflow entry point rather than a hardcoded model integration.

- The core provides AI context helpers and preset sets
- React and Vue provide an `AIModal`
- Slash menu and bubble menu can surface AI actions
- The shared example helper lives in [`examples/shared/ai.ts`](examples/shared/ai.ts)

Useful core exports include:

- `buildAIContext`
- `BUBBLE_AI_PRESETS`
- `SLASH_AI_PRESETS`
- `getAIPresets`

## Examples

- [`examples/basic`](examples/basic) demonstrates a React editor, toolbar controls, document JSON, Markdown output, and Office export helpers
- [`examples/vite-vue`](examples/vite-vue) demonstrates the Vue package with AI, comments, a custom chart block, and a broad block showcase
- [`examples/nuxt-vue`](examples/nuxt-vue) demonstrates collaboration, approvals, templates, document release, comments, and export in a compliance-oriented workspace

Run them from the repo root with:

```bash
pnpm --filter @amusendame/beakblock-example-basic dev
pnpm --filter @amusendame/beakblock-example-vite-vue dev
pnpm --filter @amusendame/beakblock-example-nuxt-vue dev
```

## Documentation

Start here:

- [`docs/blocks/README.md`](docs/blocks/README.md)
- [`docs/markdown.md`](docs/markdown.md)
- [`docs/comments.md`](docs/comments.md)
- [`docs/versioning.md`](docs/versioning.md)
- [`docs/collaboration.md`](docs/collaboration.md)
- [`docs/custom-blocks.md`](docs/custom-blocks.md)
- [`docs/custom-marks.md`](docs/custom-marks.md)
- [`docs/plugins.md`](docs/plugins.md)
- [`docs/styling.md`](docs/styling.md)
- [`docs/compliance-lock.md`](docs/compliance-lock.md)
- [`docs/compliance-demo.md`](docs/compliance-demo.md)
- [`docs/publishing.md`](docs/publishing.md)

## Development

From the repository root:

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm lint
```

Package-level build and watch scripts live in each package and example app. The workspace is configured for Node 18+ and pnpm 8+.

## License

Apache-2.0
