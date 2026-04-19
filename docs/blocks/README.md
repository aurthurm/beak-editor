# Block reference

BeakBlock documents are arrays of **`Block`** objects returned by `editor.getDocument()` and accepted by `editor.setDocument()`. Each block has:

- **`id`** — Unique string (UUID when created by the editor).
- **`type`** — Node name from the schema (e.g. `paragraph`, `heading`).
- **`props`** — Attributes other than `id` (alignment, level, URLs, etc.).
- **`content`** — Optional inline array (`text`, `link`, `icon`) for text blocks.
- **`children`** — Optional nested **`Block[]`** for containers (lists, tables, columns).

The root document is **not** a `Block`; `getDocument()` returns **top-level blocks** only. The ProseMirror `doc` node wraps them internally.

Custom blocks from `EditorConfig.customNodes` follow the same shape with their own `type` and `props`.

## Inline content

Rich text inside blocks uses **`content`**, not child blocks. See **[Inline content](./inline-content.md)** for `text`, `link`, `icon`, and **`styles`** (bold, italic, colors, etc.).

## Blocks by category

### Text blocks

| Block | Description |
|-------|-------------|
| [paragraph](./paragraph.md) | Default text block; optional `textAlign`. |
| [heading](./heading.md) | `level` 1–6; optional `textAlign`; optional compliance **`locked`** / `lockReason` / `lockId` (demo: **H1–H3** + `lockId` for outline sections — see [Compliance demo](../compliance-demo.md)). |
| [blockquote](./blockquote.md) | Quotation styling; inline content. |
| [callout](./callout.md) | Info / warning / success / error / note variants. |
| [codeBlock](./codeBlock.md) | Plain code; optional `language`; no marks inside. |

### Structural

| Block | Description |
|-------|-------------|
| [divider](./divider.md) | Horizontal rule; no `content`. |

### Lists

| Block | Description |
|-------|-------------|
| [bulletList](./bulletList.md) | Unordered list; `children` are `listItem`. |
| [orderedList](./orderedList.md) | Numbered list; optional `start`. |
| [listItem](./listItem.md) | Item with `content` and optional nested `children`. |
| [checkList](./checkList.md) | Task list container. |
| [checkListItem](./checkListItem.md) | Item with `checked` and inline `content`. |

### Layout

| Block | Description |
|-------|-------------|
| [tableOfContents](./tableOfContents.md) | Live outline of headings; click to jump; auto-updates; options menu (⋯) to refresh outline. |
| [columnList](./columnList.md) | Multi-column grid; optional `gap`. |
| [column](./column.md) | Single column; `width` ratio; `children` blocks. |

### Table

| Block | Description |
|-------|-------------|
| [table](./table.md) | Table; `children` are `tableRow`. |
| [tableRow](./tableRow.md) | Row of cells. |
| [tableCell](./tableCell.md) | Body cell; `children` blocks; merge attrs. |
| [tableHeader](./tableHeader.md) | Header cell; same attrs as cell. |

### Media

| Block | Description |
|-------|-------------|
| [image](./image.md) | Figure with `src`, `alt`, `caption`, `alignment`, `width`. |
| [embed](./embed.md) | Single block for all providers; slash "Embed"; options menu (⋯, hover, right-click) and MediaMenu for URL, caption, aspect ratio. |

## Working with blocks in code

```typescript
const blocks = editor.getDocument();
editor.setDocument(blocks);
editor.insertBlocks([{ type: 'paragraph', content: [] }], 'some-block-id', 'after');
```

IDs are required on existing blocks; omitted IDs on inserted blocks are generated automatically.

## Source of truth

Schema definitions live under [`packages/core/src/schema/nodes/`](../../packages/core/src/schema/nodes/). JSON serialization rules: [`packages/core/src/blocks/nodeToBlock.ts`](../../packages/core/src/blocks/nodeToBlock.ts) and [`blockToNode.ts`](../../packages/core/src/blocks/blockToNode.ts).
