# Block: `tableCell`

Body cell (`<td>`). **`children`** are block nodes (typically paragraphs or lists).

## JSON shape

```json
{
  "id": "cell-1",
  "type": "tableCell",
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
      "content": [{ "type": "text", "text": "Cell text", "styles": {} }]
    }
  ]
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `colspan` | `number` | `1` | Column span. |
| `rowspan` | `number` | `1` | Row span. |
| `colwidth` | `number[] \| null` | `null` | Column width hints (px); first value used for style when set. |
| `backgroundColor` | `string \| null` | `null` | CSS background on cell. |

## Usage

- Lives under **`tableRow`**.
- Merged cells use `colspan` / `rowspan` &gt; 1.

## Related

- [tableHeader](./tableHeader.md) — same props, `<th>` semantics.
- [tableRow](./tableRow.md)
