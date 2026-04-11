# Block: `embed`

Embedded iframe / provider widget (`<figure class="beakblock-embed">`). **Atomic block.**

There is **one** `embed` node type for every supported provider (YouTube, Vimeo, Figma, generic iframe URL, etc.). The slash menu exposes a **single “Embed”** command; typing “youtube” in the slash search still matches it via keywords. Pasting or saving a URL sets `provider` and `embedId` automatically.

## JSON shape

```json
{
  "id": "emb-1",
  "type": "embed",
  "props": {
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "provider": "youtube",
    "embedId": "VIDEO_ID",
    "caption": "Optional caption",
    "width": null,
    "height": null,
    "aspectRatio": "16:9"
  }
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `url` | `string` | `''` | Original pasted URL. |
| `provider` | see below | `'generic'` | Which embed handler to use. |
| `embedId` | `string` | `''` | Provider-specific id (e.g. YouTube video id). |
| `caption` | `string` | `''` | Figcaption. |
| `width` | `number \| string \| null` | `null` | Max width (px or CSS value). |
| `height` | `number \| null` | `null` | Optional height. |
| `aspectRatio` | `string` | `'16:9'` | Container `aspect-ratio` (e.g. `16:9`). |

**`provider`** values (see schema): `youtube`, `vimeo`, `twitter`, `codepen`, `codesandbox`, `figma`, `loom`, `spotify`, `soundcloud`, `generic`.

## URLs and parsing

Use **`parseEmbedUrl(url)`** from `@aurthurm/beakblock-core` / `@beakblock/core` to derive `provider` and `embedId` from a user URL.

When the **editor** updates an embed URL (slash placeholder, **MediaMenu**, or the block’s **options menu**), it uses **`normalizeEmbedAttrsFromUrl(url)`**, which returns `{ url, provider, embedId }` so the iframe `src` stays in sync. **`getEmbedIframeSrc(provider, embedId, url)`** is the resolved iframe URL used for rendering.

## Editing in the UI

The embed is rendered with a **ProseMirror node view** (`EmbedNodeView`), not plain `toDOM` alone.

- **⋯ (options)** — Top-right on the block. Shown when you **hover** the embed, **select** it, or move **focus** inside it (e.g. keyboard). Opens a menu: **Edit URL**, **Caption**, **Aspect ratio** (16:9 / 4:3 / 1:1), **Remove embed**.
- **Right-click** on the embed opens the same menu (at the cursor).
- **Empty placeholder** — Clicking it opens **Edit URL** (menu anchored to the block).
- **MediaMenu** (React/Vue) — When the embed is **selected as a node**, the floating media toolbar still appears (URL, caption, delete, etc.), same as before.

## Usage

- Insert via slash **Embed**, then set the URL from the placeholder, the **⋯** menu, or **MediaMenu**.
- Some providers (e.g. **Twitter/X**) do not get a classic iframe `src` in core; the UI may show a short note and you may need your app’s embed script.
- **Generic** URLs are embedded as `src = url` when no specific parser matches.

## Related

- [image](./image.md)
