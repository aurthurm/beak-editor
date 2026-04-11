# Block: `columnList`

CSS grid of **`column`** nodes side by side.

## JSON shape

```json
{
  "id": "cols-1",
  "type": "columnList",
  "props": { "gap": 16 },
  "children": [
    {
      "id": "col-a",
      "type": "column",
      "props": { "width": 50 },
      "children": [
        {
          "id": "p1",
          "type": "paragraph",
          "props": {},
          "content": [{ "type": "text", "text": "Left", "styles": {} }]
        }
      ]
    },
    {
      "id": "col-b",
      "type": "column",
      "props": { "width": 50 },
      "children": [
        {
          "id": "p2",
          "type": "paragraph",
          "props": {},
          "content": [{ "type": "text", "text": "Right", "styles": {} }]
        }
      ]
    }
  ]
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `gap` | `number` | `16` | Gap between columns in pixels. |

Column widths are driven by each **`column.props.width`** (grid `fr` units).

## Usage

- Slash menu: columns layout.
- **Do not** insert `column` as a top-level block; it must live inside `columnList`.

## Related

- [column](./column.md)
