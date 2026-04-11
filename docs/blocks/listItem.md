# Block: `listItem`

Single item inside **`bulletList`** or **`orderedList`**.

In ProseMirror the schema is `paragraph block*`: the **first paragraph’s text** becomes **`content`** (inline), and any **further blocks** (e.g. nested lists) become **`children`**.

## JSON shape (simple)

```json
{
  "id": "item-1",
  "type": "listItem",
  "props": {},
  "content": [{ "type": "text", "text": "Item text", "styles": {} }]
}
```

## JSON shape (nested list)

```json
{
  "id": "parent-item",
  "type": "listItem",
  "props": {},
  "content": [{ "type": "text", "text": "Parent", "styles": {} }],
  "children": [
    {
      "id": "nested-list",
      "type": "bulletList",
      "props": {},
      "children": [
        {
          "id": "nested-item",
          "type": "listItem",
          "props": {},
          "content": [{ "type": "text", "text": "Child", "styles": {} }]
        }
      ]
    }
  ]
}
```

## Props

Typically `{}`.

## Usage

- Created only as a child of list nodes (not usually a top-level block).
- Serialization: see [`nodeToBlock`](../../packages/core/src/blocks/nodeToBlock.ts) for `listItem` handling.

## Related

- [bulletList](./bulletList.md)
- [orderedList](./orderedList.md)
