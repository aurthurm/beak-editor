# Block: `table`

Table wrapper (`<table><tbody>…`). **`children`** are **`tableRow`** nodes.

## JSON shape

```json
{
  "id": "tbl-1",
  "type": "table",
  "props": {},
  "children": [
    {
      "id": "row-1",
      "type": "tableRow",
      "props": {},
      "children": [
        {
          "id": "th-1",
          "type": "tableHeader",
          "props": { "colspan": 1, "rowspan": 1 },
          "children": [
            {
              "id": "c1",
              "type": "paragraph",
              "props": {},
              "content": [{ "type": "text", "text": "Name", "styles": {} }]
            }
          ]
        }
      ]
    }
  ]
}
```

## Props

Typically `{}` on the table node (`id` on the block root).

## Usage

- Slash menu / table commands in the editor.
- Table editing (add/remove rows and columns) goes through editor commands and updates this structure.

## Related

- [tableRow](./tableRow.md)
