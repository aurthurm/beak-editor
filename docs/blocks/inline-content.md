# Inline content

Blocks such as `paragraph`, `heading`, `callout`, and `checkListItem` use a **`content`** array of inline nodes. These are **not** separate top-level `Block` entries in `getDocument()`.

## `text`

Plain text with optional **styles** (maps to ProseMirror marks).

```json
{
  "type": "text",
  "text": "Hello",
  "styles": {
    "bold": true,
    "italic": false,
    "underline": true,
    "strikethrough": false,
    "code": false,
    "textColor": "#c00",
    "backgroundColor": "#ff0",
    "fontSize": 14
  }
}
```

Omitted style keys are treated as off / default. Valid style keys match [`TextStyles`](../../packages/core/src/blocks/types.ts): `bold`, `italic`, `underline`, `strikethrough`, `code`, `textColor`, `backgroundColor`, `fontSize`.

## `link`

Hyperlink wrapping one or more text runs with the same `href` / `title` / `target`.

```json
{
  "type": "link",
  "href": "https://example.com",
  "title": "Optional title",
  "target": "_blank",
  "content": [
    { "type": "text", "text": "Click here", "styles": {} }
  ]
}
```

`target` is typically `_blank` or `_self`.

## `icon`

Inline decorative icon (Iconify-style key + fallback symbol).

```json
{
  "type": "icon",
  "icon": "mdi:heart",
  "symbol": "\u2665",
  "size": 36
}
```

`size` is optional (pixels).

## `codeBlock` text

`codeBlock` uses **`content`** with **`text`** items only; marks are not applied inside code blocks in the schema.

## Empty content

A block may omit **`content`** or use `[]` for an empty text block. The editor often normalizes empty documents to a single empty paragraph.

## Related

- [Paragraph](./paragraph.md) — typical host for inline content.

