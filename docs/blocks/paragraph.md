# Block: `paragraph`

Standard text block. Renders as `<p>`.

## JSON shape

```json
{
  "id": "unique-id",
  "type": "paragraph",
  "props": {
    "textAlign": "left"
  },
  "content": [
    { "type": "text", "text": "Body text", "styles": {} }
  ]
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `textAlign` | `'left' \| 'center' \| 'right'` | `'left'` | Horizontal alignment. |

`id` is top-level on the block, not inside `props`.

## Usage

- Created by default for empty documents.
- Input rules: `- ` / `* ` start lists; `# ` headings; etc. (see slash menu and markdown shortcuts).
- **API:** `insertBlocks`, `setDocument`, `getBlock`, `updateBlock` (e.g. update `props.textAlign`).

## Inline content

See **[Inline content](./inline-content.md)**.

## Related

- [Heading](./heading.md) — titled sections.
- [List items](./listItem.md) — first line of a list item is often paragraph content in the editor model.
