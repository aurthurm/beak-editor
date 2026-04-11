# Block: `bulletList`

Unordered list (`<ul>`). Holds **`listItem`** blocks in **`children`**.

## JSON shape

```json
{
  "id": "list-id",
  "type": "bulletList",
  "props": {},
  "children": [
    {
      "id": "item-1",
      "type": "listItem",
      "props": {},
      "content": [{ "type": "text", "text": "First", "styles": {} }]
    }
  ]
}
```

## Props

Usually `{}` (only `id` is promoted to the block root).

## Usage

- `- ` or `* ` at line start.
- Slash menu.
- Nested lists live inside **`listItem.children`** (see [listItem](./listItem.md)).

## Related

- [orderedList](./orderedList.md)
- [listItem](./listItem.md)
