# Creating Custom Blocks in BeakBlock

This guide explains how to create custom block types for the BeakBlock editor.

## Overview

BeakBlock provides two ways to create custom blocks:

1. **React Blocks (Recommended)** - Use `createReactBlockSpec` for React-based blocks with minimal boilerplate
2. **ProseMirror Blocks** - Define node specs directly for full control

## React Custom Blocks (Recommended)

The easiest way to create custom blocks in React applications is using `createReactBlockSpec`.

### Quick Example

```tsx
import { createReactBlockSpec } from '@aurthurm/beakblock-react';

// Define your custom block
const AlertBlock = createReactBlockSpec(
  {
    type: 'alert',
    propSchema: {
      alertType: { default: 'info' as 'info' | 'warning' | 'error' },
      title: { default: '' },
    },
    content: 'none', // or 'inline' for editable text content
  },
  {
    render: ({ block, editor, isEditable }) => (
      <div className={`alert alert-${block.props.alertType}`}>
        <strong>{block.props.title || 'Alert'}</strong>
        {/* Your custom UI here */}
      </div>
    ),
    slashMenu: {
      title: 'Alert',
      description: 'Insert an alert box',
      icon: 'alert',
      aliases: ['warning', 'info', 'error'],
      group: 'Basic',
    },
  }
);
```

### Using Custom Blocks

Register your custom blocks with the editor:

```tsx
import { useBeakBlock, BeakBlockView, SlashMenu, useCustomSlashMenuItems } from '@aurthurm/beakblock-react';

// Define all your custom blocks
const CUSTOM_BLOCKS = [AlertBlock, EmbedBlock, DatabaseBlock];

function Editor() {
  const editor = useBeakBlock({
    initialContent: [...],
    customBlocks: CUSTOM_BLOCKS,
  });

  // Generate slash menu items from custom blocks
  const customSlashMenuItems = useCustomSlashMenuItems(editor, CUSTOM_BLOCKS);

  return (
    <>
      <BeakBlockView editor={editor} />
      <SlashMenu editor={editor} additionalItems={customSlashMenuItems} />
    </>
  );
}
```

### API Reference

#### `createReactBlockSpec(spec, implementation)`

Creates a custom React block specification.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `spec.type` | `string` | Unique block type identifier |
| `spec.propSchema` | `PropSchema` | Property definitions with defaults |
| `spec.content` | `'none' \| 'inline'` | Content model |
| `implementation.render` | `React.ComponentType` | React component to render |
| `implementation.slashMenu` | `SlashMenuConfig` | Optional slash menu configuration |

**PropSchema:**

```typescript
interface PropSchema {
  [key: string]: {
    default: unknown;  // Default value for the property
  };
}
```

**SlashMenuConfig:**

```typescript
interface SlashMenuConfig {
  title: string;           // Display title in menu
  description?: string;    // Description shown below title
  icon?: string;           // Icon identifier (e.g., 'heading1', 'list')
  aliases?: string[];      // Alternative search keywords
  group?: string;          // Category (e.g., 'Basic', 'Embeds')
}
```

**Render Props:**

| Prop | Type | Description |
|------|------|-------------|
| `block` | `{ id, type, props }` | Block data with typed props |
| `editor` | `BeakBlockEditor` | Editor instance |
| `isEditable` | `boolean` | Whether editing is enabled |
| `contentRef` | `React.RefObject` | For `content: 'inline'` blocks |

#### `useCustomSlashMenuItems(editor, customBlocks)`

Generates slash menu items from custom blocks that have `slashMenu` configured.

```tsx
const customItems = useCustomSlashMenuItems(editor, CUSTOM_BLOCKS);
return <SlashMenu editor={editor} additionalItems={customItems} />;
```

#### `useUpdateBlock(editor, blockId)`

Hook to update block properties from within a block component.

```tsx
function MyBlockRender({ block, editor }) {
  const updateBlock = useUpdateBlock(editor, block.id);

  return (
    <button onClick={() => updateBlock({ title: 'New Title' })}>
      Update Title
    </button>
  );
}
```

### Content Types

| Type | Description | Use Case |
|------|-------------|----------|
| `'none'` | No editable content | Embeds, widgets, databases |
| `'inline'` | Editable text content | Notes, callouts with text |

For `content: 'inline'`, use the `contentRef` to place the editable area:

```tsx
render: ({ block, contentRef }) => (
  <div className="my-block">
    <div className="my-block-header">{block.props.title}</div>
    <div ref={contentRef} className="my-block-content" />
  </div>
)
```

### Complete Example: Database Block

```tsx
import { createReactBlockSpec, useUpdateBlock } from '@aurthurm/beakblock-react';

const DatabaseBlock = createReactBlockSpec(
  {
    type: 'database',
    propSchema: {
      databaseId: { default: '' },
      showHeader: { default: true },
      rowLimit: { default: null as number | null },
    },
    content: 'none',
  },
  {
    render: ({ block, editor, isEditable }) => {
      const updateBlock = useUpdateBlock(editor, block.id);
      const { databaseId, showHeader, rowLimit } = block.props;

      if (!databaseId) {
        return (
          <DatabaseSelector
            onSelect={(id) => updateBlock({ databaseId: id })}
          />
        );
      }

      return (
        <DatabaseView
          databaseId={databaseId}
          showHeader={showHeader}
          rowLimit={rowLimit}
          isEditable={isEditable}
        />
      );
    },
    slashMenu: {
      title: 'Database',
      description: 'Insert an inline database',
      icon: 'database',
      aliases: ['db', 'table', 'spreadsheet'],
      group: 'Embeds',
    },
  }
);
```

---

## ProseMirror Custom Blocks

For advanced use cases requiring full control over the ProseMirror integration, you can define blocks directly.

BeakBlock is built on ProseMirror and uses a block-based document model. Each block type is defined by:

1. **Node Spec** - ProseMirror schema definition
2. **Block Converter** - Converts between Block format and ProseMirror nodes
3. **CSS Styles** - Visual styling for the block
4. **Slash Menu Item** (optional) - Entry in the `/` command menu

## Quick Example: Creating a "Note" Block

Let's create a simple note block with a title and content.

### Step 1: Define the Node Spec

Create a file `noteNode.ts`:

```typescript
import type { NodeSpec } from 'prosemirror-model';

export type NoteType = 'tip' | 'warning' | 'important';

export const noteNode: NodeSpec = {
  // Content model: what can go inside this block
  content: 'inline*',  // Allow inline content (text, marks)

  // Block group: makes it a top-level block
  group: 'block',

  // Attributes: custom properties for this block
  attrs: {
    id: { default: null },           // Required: unique block ID
    noteType: { default: 'tip' as NoteType },
    title: { default: '' },
  },

  // How to parse from HTML (for copy/paste)
  parseDOM: [
    {
      tag: 'div.custom-note',
      getAttrs: (dom) => {
        const element = dom as HTMLElement;
        return {
          id: element.getAttribute('data-block-id'),
          noteType: element.getAttribute('data-note-type') || 'tip',
          title: element.getAttribute('data-title') || '',
        };
      },
    },
  ],

  // How to render to HTML
  toDOM: (node) => {
    return [
      'div',
      {
        class: `custom-note custom-note--${node.attrs.noteType}`,
        'data-block-id': node.attrs.id,
        'data-note-type': node.attrs.noteType,
        'data-title': node.attrs.title,
      },
      // 0 means "render content here"
      0,
    ];
  },
};
```

### Step 2: Add to Schema

Modify `createSchema.ts` to include your block:

```typescript
import { noteNode } from './nodes/noteNode';

export const DEFAULT_NODES = {
  // ... existing nodes
  note: noteNode,
};
```

### Step 3: Update Block Converters

Add conversion logic in `blocks/blockToNode.ts`:

```typescript
case 'note':
  return schema.nodes.note.create(
    {
      id: block.id,
      noteType: block.props?.noteType || 'tip',
      title: block.props?.title || '',
    },
    convertInlineContent(schema, block.content)
  );
```

And in `blocks/nodeToBlock.ts`:

```typescript
case 'note':
  return {
    id: node.attrs.id || generateId(),
    type: 'note',
    props: {
      noteType: node.attrs.noteType,
      title: node.attrs.title,
    },
    content: extractInlineContent(node),
  };
```

### Step 4: Add CSS Styles

Add styles to `editor.css`:

```css
/* Note Block */
.beakblock-editor .custom-note {
  margin: 0;
  padding: 1em;
  border-radius: var(--ob-radius);
  border-left: 4px solid;
}

.beakblock-editor .custom-note--tip {
  border-left-color: hsl(142 76% 36%);
  background: hsl(142 76% 36% / 0.1);
}

.beakblock-editor .custom-note--warning {
  border-left-color: hsl(38 92% 50%);
  background: hsl(38 92% 50% / 0.1);
}

.beakblock-editor .custom-note--important {
  border-left-color: hsl(0 84% 60%);
  background: hsl(0 84% 60% / 0.1);
}
```

### Step 5: Add to Slash Menu (Optional)

In `plugins/slashMenuPlugin.ts`, add menu items:

```typescript
{
  id: 'note-tip',
  title: 'Tip',
  description: 'Add a tip note',
  icon: `<svg>...</svg>`,
  action: (view) => {
    insertBlock(view, 'note', { noteType: 'tip' });
  },
},
```

## Block Types Reference

### Content Models

| Model | Description | Example |
|-------|-------------|---------|
| `inline*` | Zero or more inline nodes | Paragraph, Heading |
| `block+` | One or more block nodes | List items, Columns |
| `text*` | Plain text only | Code block |
| `(paragraph \| heading)+` | Specific blocks | Custom container |

### Common Attributes

Every block should have an `id` attribute:

```typescript
attrs: {
  id: { default: null },  // Always include this
  // ... your custom attrs
},
```

### Group Types

| Group | Description |
|-------|-------------|
| `block` | Top-level block that can appear in document |
| `inline` | Inline element (text, links) |

## Advanced: Nested Blocks

For blocks that contain other blocks (like columns or lists):

```typescript
export const containerNode: NodeSpec = {
  // Contains other blocks
  content: 'block+',
  group: 'block',
  attrs: {
    id: { default: null },
  },
  toDOM: () => ['div', { class: 'custom-container' }, 0],
};
```

## Advanced: Custom Node Views

For complex interactive blocks, use ProseMirror NodeViews:

```typescript
const editor = new BeakBlockEditor({
  prosemirror: {
    nodeViews: {
      note: (node, view, getPos) => {
        // Return a custom NodeView implementation
        const dom = document.createElement('div');
        dom.className = 'custom-note-view';

        // Add interactive elements
        const titleInput = document.createElement('input');
        titleInput.value = node.attrs.title;
        titleInput.onchange = () => {
          const pos = getPos();
          if (typeof pos === 'number') {
            view.dispatch(
              view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                title: titleInput.value,
              })
            );
          }
        };

        dom.appendChild(titleInput);

        const contentDOM = document.createElement('div');
        dom.appendChild(contentDOM);

        return {
          dom,
          contentDOM,
          update: (updatedNode) => {
            if (updatedNode.type.name !== 'note') return false;
            titleInput.value = updatedNode.attrs.title;
            return true;
          },
        };
      },
    },
  },
});
```

## Using Custom Blocks

Once registered, use blocks in your document:

```typescript
const editor = new BeakBlockEditor({
  initialContent: [
    {
      id: 'note-1',
      type: 'note',
      props: {
        noteType: 'tip',
        title: 'Pro Tip',
      },
      content: [
        { type: 'text', text: 'This is a helpful tip!', styles: {} },
      ],
    },
  ],
});
```

## Existing Block Types

BeakBlock includes these built-in blocks:

| Type | Description | Props |
|------|-------------|-------|
| `paragraph` | Basic text block | `textAlign` |
| `heading` | Heading (h1-h6) | `level`, `textAlign` |
| `bulletList` | Bullet list | - |
| `orderedList` | Numbered list | - |
| `listItem` | List item | - |
| `blockquote` | Quote block | - |
| `callout` | Callout box | `calloutType` (info, warning, success, error, note) |
| `codeBlock` | Code block | `language` |
| `divider` | Horizontal rule | - |
| `table` | Table | - |
| `columnList` | Multi-column layout | - |
| `column` | Column in layout | `width` |

## Tips

1. **Always test with copy/paste** - Ensure `parseDOM` handles pasted content correctly
2. **Use semantic HTML** - Helps with accessibility and SEO
3. **Keep blocks simple** - Complex UI should use NodeViews
4. **Export types** - Export your block types from `index.ts` for consumers
5. **Update injectStyles.ts** - If using auto-injection, add your CSS to the embedded styles

## Full Example: Callout Block

See the built-in callout implementation:
- Node spec: `packages/core/src/schema/nodes/callout.ts`
- Styles: `packages/core/src/styles/editor.css` (search for `.beakblock-callout`)
- Slash menu: `packages/core/src/plugins/slashMenuPlugin.ts`
