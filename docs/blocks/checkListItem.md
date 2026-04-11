# Block: `checkListItem`

One row in a **`checkList`**. Inline **`content`** plus a **`checked`** flag.

## JSON shape

```json
{
  "id": "cli-1",
  "type": "checkListItem",
  "props": { "checked": true },
  "content": [
    { "type": "text", "text": "Done task", "styles": {} }
  ]
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | `boolean` | `false` | Whether the task is completed. |

## Usage

- Always nested under **`checkList`** in valid documents.
- UI renders a real checkbox; toggling syncs to `props.checked`.

## Inline content

See **[Inline content](./inline-content.md)**.

## Related

- [checkList](./checkList.md)
