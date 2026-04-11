# Block: `tableHeader`

Header cell (`<th>`). Same attribute model as **`tableCell`**; use in header rows for semantics and styling.

## JSON shape

```json
{
  "id": "th-1",
  "type": "tableHeader",
  "props": {
    "colspan": 1,
    "rowspan": 1,
    "colwidth": null,
    "backgroundColor": null
  },
  "children": [
    {
      "id": "p1",
      "type": "paragraph",
      "props": {},
      "content": [{ "type": "text", "text": "Column A", "styles": {} }]
    }
  ]
}
```

## Props

Same as [tableCell](./tableCell.md): `colspan`, `rowspan`, `colwidth`, `backgroundColor`.

## Usage

- First row of a table often uses `tableHeader` children instead of `tableCell`.

## Related

- [tableCell](./tableCell.md)
- [tableRow](./tableRow.md)
