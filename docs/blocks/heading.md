# Block: `heading`

Section heading (`<h1>`–`<h6>`).

## JSON shape

```json
{
  "id": "unique-id",
  "type": "heading",
  "props": {
    "level": 2,
    "textAlign": "left"
  },
  "content": [
    { "type": "text", "text": "Section title", "styles": {} }
  ]
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `level` | `1`–`6` | `1` | Heading level (semantic h1–h6). |
| `textAlign` | `'left' \| 'center' \| 'right'` | `'left'` | Alignment. |

## Usage

- Markdown-style input: `# ` … `###### ` at line start.
- Slash menu: heading actions.
- **API:** same as other blocks; set `props.level` to change depth.

## Inline content

See **[Inline content](./inline-content.md)**.

## Related

- [Paragraph](./paragraph.md)
