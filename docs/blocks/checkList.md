# Block: `checkList`

Task list container (`<ul class="beakblock-checklist">`). **`children`** must be **`checkListItem`** nodes.

## JSON shape

```json
{
  "id": "cl-1",
  "type": "checkList",
  "props": {},
  "children": [
    {
      "id": "cli-1",
      "type": "checkListItem",
      "props": { "checked": false },
      "content": [{ "type": "text", "text": "Todo", "styles": {} }]
    }
  ]
}
```

## Props

Usually `{}` at the list level.

## Usage

- Slash menu (checklist).
- Checkbox toggling updates `checkListItem.props.checked` in the editor.

## Related

- [checkListItem](./checkListItem.md)
