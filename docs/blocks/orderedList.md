# Block: `orderedList`

Numbered list (`<ol>`). Holds **`listItem`** blocks in **`children`**.

## JSON shape

```json
{
  "id": "list-id",
  "type": "orderedList",
  "props": { "start": 1 },
  "children": [
    {
      "id": "item-1",
      "type": "listItem",
      "props": {},
      "content": [{ "type": "text", "text": "Step one", "styles": {} }]
    }
  ]
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `start` | `number` | `1` | First list number (HTML `start` attribute when not 1). |

## Usage

- `1. ` at line start.
- Slash menu.

## Related

- [bulletList](./bulletList.md)
- [listItem](./listItem.md)
