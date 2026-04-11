# Block: `tableOfContents`

A **live outline** of all **headings** in the document. Entries are **computed automatically** by a ProseMirror plugin whenever the document changes. Clicking an entry moves the selection to that heading and scrolls it into view.

## JSON shape

```json
{
  "id": "toc-1",
  "type": "tableOfContents",
  "props": {
    "items": [
      { "id": "heading-block-id", "level": 2, "text": "Section title" }
    ]
  }
}
```

## Props

| Field | Type | Description |
|-------|------|-------------|
| `items` | `Array<{ id: string; level: number; text: string }>` | Snapshot of headings; **kept in sync** by `createTableOfContentsPlugin`. |

`id` on each item is the **heading block’s** `id` (from the block ID plugin), not the TOC block id.

## Behavior

1. **Insert** via slash menu: **Table of contents** (Layout group), or build a node with `type: 'tableOfContents'` and `items: []` / omit items (plugin fills on next update).
2. **Update**: Any edit that adds, removes, or renames headings updates every TOC block in the document.
3. **Navigation**: The editor uses a **node view** (`tableOfContentsNodeView`) that renders buttons; clicks dispatch a selection and scroll.
4. **Options**: **⋯** in the top-right of the block (also **right-click** on the TOC) opens a menu with **Refresh outline** (usually redundant because the plugin syncs on every edit) and a short note about auto-updates.

## Framework apps

Vue and React `useBeakBlock` merge **`tableOfContentsNodeView`** with your custom `nodeViews` so the interactive TOC is not dropped when you add custom blocks.

## Related

- [Heading](./heading.md)
- Plugin: `createTableOfContentsPlugin` in `@aurthurm/beakblock-core`
