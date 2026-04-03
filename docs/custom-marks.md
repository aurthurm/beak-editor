# Creating Custom Marks in BeakBlock

Marks are inline formatting styles applied to text (bold, italic, links, colors, etc.).

## Overview

Unlike blocks which define document structure, marks define how text within blocks is styled. Multiple marks can be applied to the same text range.

## Built-in Marks

BeakBlock includes these marks:

| Mark | Description | Attributes |
|------|-------------|------------|
| `bold` | Bold text | - |
| `italic` | Italic text | - |
| `underline` | Underlined text | - |
| `strikethrough` | Strikethrough text | - |
| `code` | Inline code | - |
| `link` | Hyperlink | `href`, `title` |
| `textColor` | Text color | `color` |
| `backgroundColor` | Background highlight | `color` |

## Creating a Custom Mark

### Example: Highlight Mark with Custom Color

```typescript
import type { MarkSpec } from 'prosemirror-model';

export const highlightMark: MarkSpec = {
  // Attributes for this mark
  attrs: {
    color: { default: 'yellow' },
  },

  // How to parse from HTML (for copy/paste)
  parseDOM: [
    {
      tag: 'mark',
      getAttrs: (dom) => {
        const element = dom as HTMLElement;
        return {
          color: element.style.backgroundColor || 'yellow',
        };
      },
    },
    {
      style: 'background-color',
      getAttrs: (value) => {
        return { color: value };
      },
    },
  ],

  // How to render to HTML
  toDOM: (mark) => {
    return [
      'mark',
      {
        style: `background-color: ${mark.attrs.color}`,
      },
      0, // 0 means "render content here"
    ];
  },
};
```

### Example: Subscript/Superscript

```typescript
export const subscriptMark: MarkSpec = {
  parseDOM: [{ tag: 'sub' }],
  toDOM: () => ['sub', 0],
};

export const superscriptMark: MarkSpec = {
  parseDOM: [{ tag: 'sup' }],
  toDOM: () => ['sup', 0],
};
```

### Example: Keyboard Shortcut Display

```typescript
export const kbdMark: MarkSpec = {
  parseDOM: [{ tag: 'kbd' }],
  toDOM: () => [
    'kbd',
    {
      class: 'keyboard-shortcut',
      style: 'font-family: monospace; padding: 2px 4px; background: #f4f4f4; border-radius: 3px;',
    },
    0,
  ],
};
```

## Adding Marks to Schema

Modify `createSchema.ts`:

```typescript
import { highlightMark, subscriptMark, superscriptMark } from './marks';

export const DEFAULT_MARKS = {
  // ... existing marks
  highlight: highlightMark,
  subscript: subscriptMark,
  superscript: superscriptMark,
};
```

## Adding Toggle Methods to Editor

In `Editor.ts`, add convenience methods:

```typescript
/** Toggle highlight on the current selection. */
toggleHighlight(color: string = 'yellow'): boolean {
  return this.pm.toggleMark('highlight', { color });
}

/** Set highlight color on the current selection. */
setHighlight(color: string): void {
  this.pm.addMark('highlight', { color });
}

/** Remove highlight from the current selection. */
removeHighlight(): void {
  this.pm.removeMark('highlight');
}
```

## Mark Exclusivity

Marks can exclude other marks. For example, you might want `code` to exclude other formatting:

```typescript
export const codeMark: MarkSpec = {
  // Exclude all other marks when code is applied
  excludes: '_',  // '_' means "all marks"

  parseDOM: [{ tag: 'code' }],
  toDOM: () => ['code', 0],
};
```

Or exclude specific marks:

```typescript
export const subscriptMark: MarkSpec = {
  // Can't have both subscript and superscript
  excludes: 'superscript',

  parseDOM: [{ tag: 'sub' }],
  toDOM: () => ['sub', 0],
};
```

## Mark Groups

Group marks for easier management:

```typescript
export const boldMark: MarkSpec = {
  group: 'textStyle',
  parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
  toDOM: () => ['strong', 0],
};

export const italicMark: MarkSpec = {
  group: 'textStyle',
  parseDOM: [{ tag: 'em' }, { tag: 'i' }],
  toDOM: () => ['em', 0],
};
```

## Adding Keyboard Shortcuts

In your plugins configuration:

```typescript
import { keymap } from 'prosemirror-keymap';
import { toggleMark } from 'prosemirror-commands';

const shortcuts = keymap({
  'Mod-Shift-h': toggleMark(schema.marks.highlight),
  'Mod-,': toggleMark(schema.marks.subscript),
  'Mod-.': toggleMark(schema.marks.superscript),
});
```

## Adding to Bubble Menu

Modify `BubbleMenu.tsx` to include your mark:

```tsx
// Add button for highlight
<button
  className={`ob-bubble-menu-btn ${isMarkActive('highlight') ? 'ob-bubble-menu-btn--active' : ''}`}
  onClick={() => editor.toggleHighlight()}
  title="Highlight"
>
  <HighlightIcon />
</button>
```

## CSS Styling

Add styles in `editor.css`:

```css
/* Highlight */
.beakblock-editor mark {
  padding: 0.1em 0.2em;
  border-radius: 2px;
}

/* Keyboard shortcut */
.beakblock-editor kbd {
  font-family: var(--ob-font-mono);
  font-size: 0.85em;
  padding: 2px 6px;
  background: hsl(var(--ob-muted));
  border: 1px solid hsl(var(--ob-border));
  border-radius: 4px;
  box-shadow: 0 1px 0 hsl(var(--ob-border));
}

/* Subscript & Superscript */
.beakblock-editor sub,
.beakblock-editor sup {
  font-size: 0.75em;
  line-height: 0;
  position: relative;
  vertical-align: baseline;
}

.beakblock-editor sup {
  top: -0.5em;
}

.beakblock-editor sub {
  bottom: -0.25em;
}
```

## Block Content with Marks

In your Block type definition:

```typescript
interface StyledText {
  type: 'text';
  text: string;
  styles: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    code?: boolean;
    textColor?: string;
    backgroundColor?: string;
    highlight?: string;      // Add your custom marks
    subscript?: boolean;
    superscript?: boolean;
  };
}
```

## Using Custom Marks

```typescript
const editor = new BeakBlockEditor({
  initialContent: [
    {
      id: '1',
      type: 'paragraph',
      props: {},
      content: [
        { type: 'text', text: 'Normal text ', styles: {} },
        { type: 'text', text: 'highlighted', styles: { highlight: 'yellow' } },
        { type: 'text', text: ' and ', styles: {} },
        { type: 'text', text: 'H', styles: { subscript: true } },
        { type: 'text', text: '2', styles: {} },
        { type: 'text', text: 'O', styles: { subscript: true } },
      ],
    },
  ],
});
```

## Tips

1. **Keep marks simple** — Marks should only style text, not change structure
2. **Use attributes sparingly** — Simple marks (bold, italic) don't need attributes
3. **Handle copy/paste** — Ensure `parseDOM` handles pasted content correctly
4. **Test exclusivity** — Make sure excluded marks behave correctly
5. **Add keyboard shortcuts** — Users expect shortcuts for common formatting
