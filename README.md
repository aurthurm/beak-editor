<p align="center">
  <h1 align="center">BeakBlock</h1>
  <p align="center">
    A block editor with a fully public ProseMirror API, shipped as Core, React, and Vue packages.
  </p>
</p>

<p align="center">
  <a href="#what-you-get">What you get</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#examples">Examples</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#packages">Packages</a>
</p>

---

## What BeakBlock Is

BeakBlock is a framework-agnostic rich text editor built on ProseMirror. It is designed for teams that want:

- direct access to the editor internals
- typed APIs instead of hidden implementation details
- a block-based document model
- React and Vue bindings over the same core
- built-in UI for menus, tables, media, charts, and custom blocks

Unlike editors that hide ProseMirror behind wrappers, BeakBlock exposes the editor state, view, document, and transaction layer directly through `editor.pm.*`.

```ts
editor.pm.view
editor.pm.state
editor.pm.dispatch(tr)
editor.pm.setNodeAttrs(pos, attrs)
```

## What You Get

- **Core editor package** with the ProseMirror schema, commands, plugins, and block model
- **React bindings** with hooks and components
- **Vue bindings** with composables and components
- **Built-in blocks** for headings, paragraphs, lists, checklists, code, tables, columns, images, embeds, icons, charts, and callouts
- **Built-in menus** for slash commands, bubble formatting, tables, media, and links
- **Block JSON** that can be stored, transformed, and reloaded
- **Custom block support** for React and Vue
- **TypeScript-first APIs** across the workspace

## Installation

BeakBlock packages are published under the `@labbs` scope.

Add the GitHub Packages registry to your project `.npmrc`:

```ini
@labbs:registry=https://npm.pkg.github.com
```

Install the packages you need:

```bash
pnpm add @labbs/beakblock-core @labbs/beakblock-react @labbs/beakblock-vue
```

If you only want a single binding layer, install just the package you need.

## Quick Start

### React

```tsx
import { useBeakBlock, BeakBlockView, SlashMenu, BubbleMenu, TableHandles } from '@labbs/beakblock-react';

function Editor() {
  const editor = useBeakBlock({
    initialContent: [
      {
        id: '1',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Hello, world!', styles: {} }],
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

### Vue

```vue
<script setup lang="ts">
import { useBeakBlock, BeakBlockView } from '@labbs/beakblock-vue';

const editor = useBeakBlock({
  initialContent: [
    {
      id: '1',
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: 'Hello, Vue!', styles: {} }],
    },
  ],
});
</script>

<template>
  <BeakBlockView :editor="editor" />
</template>
```

### Vanilla JavaScript

```ts
import { BeakBlockEditor } from '@labbs/beakblock-core';

const editor = new BeakBlockEditor({
  initialContent: [],
});

editor.mount(document.getElementById('editor'));
```

> BeakBlock injects its base editor styles by default. If you want to supply your own stylesheet, set `injectStyles: false` in the editor config.

## Examples

The workspace includes two BeakBlock Vue demos:

```bash
pnpm --filter @labbs/beakblock-example-vite-vue dev
pnpm --filter @labbs/beakblock-example-nuxt-vue dev
```

The examples are intentionally dense and show:

- editorial page layout
- multi-column content
- tables and table actions
- charts
- images and embeds
- slash menu commands
- bubble formatting
- inline icons and emojis
- links and colors

## Core API

### Document Operations

```ts
editor.getDocument()
editor.setDocument(blocks)
editor.getBlock(id)
editor.insertBlocks(blocks, ref, pos)
editor.updateBlock(id, update)
editor.removeBlocks(ids)
```

### Text Formatting

```ts
editor.toggleBold()
editor.toggleItalic()
editor.toggleUnderline()
editor.toggleStrikethrough()
editor.toggleCode()
editor.setTextColor(color)
editor.setBackgroundColor(color)
```

### Block Types

```ts
editor.setBlockType('heading', { level: 1 })
editor.setBlockType('codeBlock', { language: 'typescript' })
editor.setBlockType('bulletList')
editor.setBlockType('orderedList')
editor.setBlockType('blockquote')
editor.setBlockType('table')
```

### ProseMirror Access

```ts
editor.pm.view
editor.pm.state
editor.pm.doc
editor.pm.dispatch(tr)
editor.pm.setNodeAttrs(pos, attrs)
```

## Custom Blocks

BeakBlock supports custom blocks in both React and Vue.

- React: `createReactBlockSpec`
- Vue: `createVueBlockSpec`

Custom blocks can provide:

- node schema
- node view rendering
- slash menu entries
- update hooks
- custom props

See the full guide in [`docs/custom-blocks.md`](docs/custom-blocks.md).

## Documentation

| Guide | Description |
| --- | --- |
| [`docs/react-integration.md`](docs/react-integration.md) | React hooks, components, and integration patterns |
| [`docs/custom-blocks.md`](docs/custom-blocks.md) | Create custom block types |
| [`docs/custom-marks.md`](docs/custom-marks.md) | Create inline formatting marks |
| [`docs/plugins.md`](docs/plugins.md) | Build and extend ProseMirror plugins |
| [`docs/styling.md`](docs/styling.md) | Style the editor and its blocks |
| [`docs/collaboration.md`](docs/collaboration.md) | Use collaborative editing with Y.js |

## Packages

| Package | Description |
| --- | --- |
| [`@labbs/beakblock-core`](packages/core) | Framework-agnostic editor core |
| [`@labbs/beakblock-react`](packages/react) | React bindings and components |
| [`@labbs/beakblock-vue`](packages/vue) | Vue bindings and components |

## Repository Layout

- `packages/core` - schema, commands, plugins, editor core, and shared styles
- `packages/react` - React hooks and components
- `packages/vue` - Vue composables and components
- `examples/basic` - vanilla example
- `examples/vite-vue` - Vite + Vue showcase
- `examples/nuxt-vue` - Nuxt + Vue showcase
- `docs` - integration and customization guides

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm dev
```

## Notes

- CSS is auto-injected by default in the editor core.
- The document model is block-based and serializable.
- React and Vue bindings are thin wrappers over the same ProseMirror core.
- The repository uses GitHub Packages for published artifacts.

## License

[Apache-2.0](LICENSE)
