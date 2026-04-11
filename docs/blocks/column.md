# Block: `column`

A single column inside **`columnList`**. Contains normal **`children`** blocks (paragraphs, lists, etc.).

## JSON shape

```json
{
  "id": "col-1",
  "type": "column",
  "props": { "width": 50 },
  "children": [
    {
      "id": "p1",
      "type": "paragraph",
      "props": {},
      "content": [{ "type": "text", "text": "Column body", "styles": {} }]
    }
  ]
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `number` | `50` | Relative width (1–100); used with sibling columns to build `grid-template-columns` `fr` tracks. |

## Usage

- Only valid as a child of **`columnList`**.
- Slash menu creates `columnList` + `column` structure.

## Related

- [columnList](./columnList.md)
