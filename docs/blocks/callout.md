# Block: `callout`

Highlighted callout (Notion-style); renders as a styled `<div>`.

## JSON shape

```json
{
  "id": "unique-id",
  "type": "callout",
  "props": {
    "calloutType": "info"
  },
  "content": [
    { "type": "text", "text": "Important note for readers.", "styles": {} }
  ]
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `calloutType` | `'info' \| 'warning' \| 'success' \| 'error' \| 'note'` | `'info'` | Visual variant / semantics. |

DOM classes: `beakblock-callout`, `beakblock-callout--{type}`.

## Usage

- Slash menu (if exposed in your build).
- Programmatic `insertBlocks` with `type: 'callout'`.

## Inline content

See **[Inline content](./inline-content.md)**.

## Related

- [Blockquote](./blockquote.md)
