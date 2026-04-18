# Block: `heading`

Section heading (`<h1>`–`<h6>`).

## JSON shape

```json
{
  "id": "unique-id",
  "type": "heading",
  "props": {
    "level": 2,
    "textAlign": "left",
    "locked": false,
    "lockReason": null,
    "lockId": null
  },
  "content": [
    { "type": "text", "text": "Section title", "styles": {} }
  ]
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `level` | `1`–`6` | `1` | Heading level (semantic h1–h6). |
| `textAlign` | `'left' \| 'center' \| 'right'` | `'left'` | Alignment. |
| `locked` | `boolean` | `false` | When `true` and **[compliance lock](../compliance-lock.md)** is enabled, the heading is read-only (no edit/delete/attr changes; reorder depends on `allowReorder`). |
| `lockReason` | `string \| null` | `null` | Optional human-readable reason (tooltip in the block side menu; exported in HTML attrs). |
| `lockId` | `string \| null` | `null` | Optional stable id for the lock policy (exported as `data-beakblock-lock-id`). |

When `locked` is true, the DOM uses **`data-beakblock-locked="true"`** and default CSS shows a **padlock** at the start of the heading and in the **hover side menu**.

## Usage

- Markdown-style input: `# ` … `###### ` at line start.
- Slash menu: heading actions.
- **API:** same as other blocks; set `props.level` to change depth.

## Inline content

See **[Inline content](./inline-content.md)**.

## Related

- [Paragraph](./paragraph.md)
- [Compliance lock](../compliance-lock.md)
