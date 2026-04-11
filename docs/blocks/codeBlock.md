# Block: `codeBlock`

Preformatted code (`<pre><code>`). **Plain text only** inside: the schema does not apply bold/italic marks to code block content.

## JSON shape

```json
{
  "id": "unique-id",
  "type": "codeBlock",
  "props": {
    "language": "typescript"
  },
  "content": [
    { "type": "text", "text": "const x = 1;\n", "styles": {} }
  ]
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `language` | `string` | `''` | Hint for highlighters (e.g. `typescript`, `bash`); stored on `<code>`. |

Use **`styles: {}`** on text nodes; formatting marks are not preserved in the schema for this node.

## Usage

- Markdown fence: triple backticks on a line.
- Slash menu.

## Related

- [Paragraph](./paragraph.md) — use inline `styles.code` for short `code` spans, not whole blocks.
