# Block: `tableRow`

One row (`<tr>`). **`children`** are **`tableCell`** and/or **`tableHeader`** nodes.

## JSON shape

```json
{
  "id": "row-1",
  "type": "tableRow",
  "props": {},
  "children": [
    {
      "id": "cell-1",
      "type": "tableCell",
      "props": { "colspan": 1, "rowspan": 1 },
      "children": [
        {
          "id": "p1",
          "type": "paragraph",
          "props": {},
          "content": [{ "type": "text", "text": "A1", "styles": {} }]
        }
      ]
    }
  ]
}
```

## Props

Usually `{}` (row `id` on block root).

## Related

- [table](./table.md)
- [tableCell](./tableCell.md)
- [tableHeader](./tableHeader.md)
