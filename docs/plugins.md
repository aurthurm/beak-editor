# Creating Plugins for BeakBlock

Plugins extend the editor's functionality. BeakBlock is built on ProseMirror, so you can use any ProseMirror plugin.

## Overview

Plugins can:
- Add keyboard shortcuts
- Handle events (click, paste, drop)
- Maintain state (like tracking selections)
- Add decorations (highlights, widgets)
- Transform transactions

## Adding Plugins

### Via Editor Configuration

```typescript
import { Plugin } from 'prosemirror-state';

const myPlugin = new Plugin({
  // Plugin configuration
});

const editor = new BeakBlockEditor({
  prosemirror: {
    plugins: [myPlugin],
  },
});
```

### Built-in Plugins

BeakBlock includes these plugins by default:

| Plugin | Description |
|--------|-------------|
| `history` | Undo/redo support (can be disabled at runtime for y.js) |
| `keymap` | Keyboard shortcuts |
| `inputRules` | Markdown-style shortcuts |
| `dropCursor` | Visual cursor when dragging |
| `gapCursor` | Cursor in empty positions |
| `blockIdPlugin` | Manages block IDs |
| `slashMenuPlugin` | Slash command menu |
| `bubbleMenuPlugin` | Formatting toolbar |
| `dragDropPlugin` | Block drag and drop |
| `tablePlugin` | Table functionality |

### Disabling the History Plugin

The `history` plugin can be disabled at initialization or toggled at runtime. This is required when using Y.js collaboration, as `y-prosemirror` provides its own undo manager.

```typescript
// Disable at initialization
const editor = new BeakBlockEditor({ history: false });

// Or toggle at runtime (no reload needed)
editor.disableHistory();
editor.enableHistory();
editor.isHistoryEnabled; // boolean
```

See the [Collaboration guide](./collaboration.md) for full details on using Y.js with BeakBlock.

## Creating a Simple Plugin

### Example: Word Counter

```typescript
import { Plugin, PluginKey } from 'prosemirror-state';

export const WORD_COUNT_KEY = new PluginKey<{ count: number }>('wordCount');

export function createWordCountPlugin(onChange?: (count: number) => void) {
  return new Plugin({
    key: WORD_COUNT_KEY,

    state: {
      // Initial state
      init(_, state) {
        return { count: countWords(state.doc.textContent) };
      },

      // Update state on each transaction
      apply(tr, value, _, newState) {
        if (tr.docChanged) {
          const count = countWords(newState.doc.textContent);
          onChange?.(count);
          return { count };
        }
        return value;
      },
    },
  });
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Usage
const editor = new BeakBlockEditor({
  prosemirror: {
    plugins: [
      createWordCountPlugin((count) => {
        console.log(`Word count: ${count}`);
      }),
    ],
  },
});

// Get current count
const state = WORD_COUNT_KEY.getState(editor.pm.state);
console.log(state?.count);
```

### Example: Character Limit

```typescript
import { Plugin } from 'prosemirror-state';

export function createCharacterLimitPlugin(maxChars: number) {
  return new Plugin({
    filterTransaction(tr, state) {
      const newDoc = tr.doc;
      const charCount = newDoc.textContent.length;

      // Block transaction if it exceeds limit
      if (charCount > maxChars) {
        return false;
      }
      return true;
    },
  });
}
```

### Example: Auto-save

```typescript
import { Plugin } from 'prosemirror-state';
import debounce from 'lodash/debounce';

export function createAutoSavePlugin(
  onSave: (content: string) => void,
  delayMs: number = 1000
) {
  const debouncedSave = debounce(onSave, delayMs);

  return new Plugin({
    view() {
      return {
        update(view, prevState) {
          if (!view.state.doc.eq(prevState.doc)) {
            debouncedSave(JSON.stringify(view.state.doc.toJSON()));
          }
        },
      };
    },
  });
}
```

## Plugin Structure

### State Plugin

Plugins that maintain state:

```typescript
import { Plugin, PluginKey } from 'prosemirror-state';

interface MyPluginState {
  // Your state shape
  isActive: boolean;
  data: string[];
}

export const MY_PLUGIN_KEY = new PluginKey<MyPluginState>('myPlugin');

export const myPlugin = new Plugin<MyPluginState>({
  key: MY_PLUGIN_KEY,

  state: {
    // Initialize state
    init() {
      return { isActive: false, data: [] };
    },

    // Update state
    apply(tr, value) {
      // Check for metadata
      const meta = tr.getMeta(MY_PLUGIN_KEY);
      if (meta) {
        return { ...value, ...meta };
      }
      return value;
    },
  },
});

// Update state via transaction
function setActive(view: EditorView, isActive: boolean) {
  view.dispatch(
    view.state.tr.setMeta(MY_PLUGIN_KEY, { isActive })
  );
}
```

### View Plugin

Plugins that interact with the DOM:

```typescript
import { Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

export const myViewPlugin = new Plugin({
  view(editorView) {
    // Called when plugin is added
    console.log('Plugin mounted');

    return {
      // Called after each state update
      update(view, prevState) {
        if (view.state.selection !== prevState.selection) {
          console.log('Selection changed');
        }
      },

      // Called when editor is destroyed
      destroy() {
        console.log('Plugin destroyed');
      },
    };
  },
});
```

### Props Plugin

Plugins that modify editor behavior:

```typescript
import { Plugin } from 'prosemirror-state';

export const myPropsPlugin = new Plugin({
  props: {
    // Handle click events
    handleClick(view, pos, event) {
      console.log('Clicked at position:', pos);
      return false; // Let other handlers run
    },

    // Handle paste
    handlePaste(view, event, slice) {
      console.log('Pasting content');
      return false;
    },

    // Handle keyboard events
    handleKeyDown(view, event) {
      if (event.key === 'Escape') {
        // Handle escape
        return true; // Prevent default
      }
      return false;
    },

    // Transform pasted content
    transformPasted(slice) {
      // Modify pasted content
      return slice;
    },
  },
});
```

## Decorations

Add visual elements to the editor:

### Node Decorations

```typescript
import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const highlightEmptyPlugin = new Plugin({
  props: {
    decorations(state) {
      const decorations: Decoration[] = [];

      state.doc.descendants((node, pos) => {
        if (node.type.name === 'paragraph' && node.content.size === 0) {
          decorations.push(
            Decoration.node(pos, pos + node.nodeSize, {
              class: 'empty-paragraph',
            })
          );
        }
      });

      return DecorationSet.create(state.doc, decorations);
    },
  },
});
```

### Widget Decorations

```typescript
import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const lineNumbersPlugin = new Plugin({
  props: {
    decorations(state) {
      const decorations: Decoration[] = [];
      let lineNumber = 1;

      state.doc.descendants((node, pos) => {
        if (node.isBlock && node.type.name !== 'doc') {
          const widget = document.createElement('span');
          widget.className = 'line-number';
          widget.textContent = String(lineNumber++);

          decorations.push(
            Decoration.widget(pos, widget, { side: -1 })
          );
        }
      });

      return DecorationSet.create(state.doc, decorations);
    },
  },
});
```

### Inline Decorations

```typescript
import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const highlightSearchPlugin = (searchTerm: string) =>
  new Plugin({
    props: {
      decorations(state) {
        if (!searchTerm) return DecorationSet.empty;

        const decorations: Decoration[] = [];
        const regex = new RegExp(searchTerm, 'gi');

        state.doc.descendants((node, pos) => {
          if (node.isText) {
            const text = node.text!;
            let match;
            while ((match = regex.exec(text)) !== null) {
              decorations.push(
                Decoration.inline(
                  pos + match.index,
                  pos + match.index + match[0].length,
                  { class: 'search-highlight' }
                )
              );
            }
          }
        });

        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
```

## Input Rules

Create markdown-style shortcuts:

```typescript
import { inputRules, InputRule } from 'prosemirror-inputrules';

// Convert "---" to horizontal rule
const hrRule = new InputRule(
  /^---$/,
  (state, match, start, end) => {
    const hr = state.schema.nodes.divider.create();
    return state.tr.replaceWith(start - 1, end, hr);
  }
);

// Convert "```" to code block
const codeBlockRule = new InputRule(
  /^```$/,
  (state, match, start, end) => {
    const codeBlock = state.schema.nodes.codeBlock.create();
    return state.tr.replaceWith(start - 1, end, codeBlock);
  }
);

// Add to editor
const editor = new BeakBlockEditor({
  prosemirror: {
    plugins: [inputRules({ rules: [hrRule, codeBlockRule] })],
  },
});
```

## Combining with BeakBlock's Plugin System

Extend the built-in plugin creator:

```typescript
import { createPlugins } from '@labbs/beakblock-core';

const plugins = createPlugins({
  schema: mySchema,
  inputRules: {
    headings: true,
    bulletLists: true,
    orderedLists: false, // Disable ordered lists
  },
  additionalPlugins: [
    myCustomPlugin,
    createWordCountPlugin(updateWordCount),
    createAutoSavePlugin(saveToServer),
  ],
});
```

## Tips

1. **Use PluginKey** — Makes it easy to access plugin state
2. **Return false from handlers** — Let other plugins handle events too
3. **Be efficient** — Plugins run on every transaction
4. **Clean up** — Use `destroy()` to remove event listeners
5. **Test with undo/redo** — Ensure your plugin handles history correctly
