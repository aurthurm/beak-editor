# Block: `image`

Figure with image (`<figure>` + `<img>`). **Atomic block:** no `content`; all data in **`props`**.

## JSON shape

```json
{
  "id": "img-1",
  "type": "image",
  "props": {
    "src": "https://example.com/photo.jpg",
    "alt": "Description",
    "caption": "Optional caption",
    "width": 640,
    "alignment": "center"
  }
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | `''` | Image URL. Empty shows placeholder UI in editor. |
| `alt` | `string` | `''` | Accessibility text. |
| `caption` | `string` | `''` | Figcaption text. |
| `width` | `number \| null` | `null` | Display width in pixels (optional). |
| `alignment` | `'left' \| 'center' \| 'right'` | `'center'` | Layout class `beakblock-image--{alignment}`. |

## Usage

- Media menu / slash menu / drag-drop (depending on app).
- **API:** `insertBlocks` with `type: 'image'` and props; use `editor.pm` for lower-level updates if needed.

## Related

- [embed](./embed.md) — video / third-party embeds.
