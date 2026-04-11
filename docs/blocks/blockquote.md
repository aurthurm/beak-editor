# Block: `blockquote`

Quoted or emphasized passage; renders as `<blockquote>`.

## JSON shape

```json
{
  "id": "unique-id",
  "type": "blockquote",
  "props": {},
  "content": [
    { "type": "text", "text": "Quoted text.", "styles": { "italic": true } }
  ]
}
```

## Props

No block-specific props beyond the implicit schema attrs; **`props`** is usually `{}`.

## Usage

- Input rule: `> ` at line start.
- Slash menu.

## Inline content

See **[Inline content](./inline-content.md)**.

## Related

- [Callout](./callout.md) — for tinted info/warning boxes.
