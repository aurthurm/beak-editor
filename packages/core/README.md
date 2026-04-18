# @beakblock/core

Framework-agnostic core for the BeakBlock rich text editor.

## Key Features

- **Public API** - All ProseMirror internals are accessible via `editor.pm.*`
- **Block-based** - JSON document format similar to BlockNote
- **Extensible** - Add custom blocks, marks, and plugins
- **TypeScript** - Full type safety
- **Markdown** - `markdownToBlocks` / `blocksToMarkdown`, optional GFM, and clipboard paste (see **[docs/markdown](../../docs/markdown.md)**)

## Block reference

Every built-in block type (`paragraph`, `heading`, `table`, …) is documented with JSON examples and props in **[docs/blocks](../../docs/blocks/README.md)**. Start at the index, or open **[inline content](../../docs/blocks/inline-content.md)** for `text` / `link` / `icon` inside blocks.

## Installation

```bash
npm install @beakblock/core
# or
pnpm add @beakblock/core
```

## Quick Start

```typescript
import { BeakBlockEditor } from '@beakblock/core';
import '@beakblock/core/styles/editor.css';

const editor = new BeakBlockEditor({
  element: document.getElementById('editor'),
  initialContent: [
    {
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: 'Hello World', styles: {} }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Start editing...', styles: {} }],
    },
  ],
});

// Access document
const blocks = editor.getDocument();

// Listen to changes
editor.on('change', ({ blocks }) => {
  console.log('Document changed:', blocks);
});
```

## ProseMirror Access

Unlike other editors, BeakBlock exposes the full ProseMirror API:

```typescript
// Direct access to ProseMirror view and state
editor.pm.view;        // EditorView
editor.pm.state;       // EditorState
editor.pm.doc;         // Document node

// Create and dispatch transactions
const tr = editor.pm.createTransaction();
tr.insertText('Hello');
editor.pm.dispatch(tr);

// Modify node attributes
editor.pm.setNodeAttrs(pos, { level: 2 });

// Toggle marks
editor.pm.toggleMark('bold');

// Add plugins at runtime
editor.pm.addPlugin(myPlugin);
```

## Styling

Import the default styles, which use CSS variables compatible with shadcn/ui:

```typescript
import '@beakblock/core/styles/editor.css';
```

Or create your own styles targeting `.beakblock-editor` and `.ProseMirror`.

## API Reference

### BeakBlockEditor

The main editor class.

```typescript
// Constructor
new BeakBlockEditor(config?: EditorConfig)

// Document operations
editor.getDocument(): Block[]
editor.setDocument(blocks: Block[]): void
editor.getBlock(id: string): Block | undefined
editor.getSelectedBlocks(): Block[]

// Block operations
editor.insertBlocks(blocks, referenceBlock, placement): void
editor.updateBlock(block, update): void
editor.removeBlocks(blocks): void

// Formatting
editor.toggleBold(): boolean
editor.toggleItalic(): boolean
editor.toggleUnderline(): boolean
editor.toggleStrikethrough(): boolean
editor.toggleCode(): boolean
editor.setLink(href, title?): void
editor.removeLink(): void

// Focus
editor.focus(position?): void
editor.blur(): void
editor.hasFocus: boolean

// Serialization
editor.toJSON(): Block[]
editor.fromJSON(blocks): void

// History (undo/redo)
editor.undo(): boolean
editor.redo(): boolean
editor.enableHistory(): void
editor.disableHistory(): void
editor.isHistoryEnabled: boolean

// Collaboration (Y.js)
editor.enableCollaboration({ plugins }): void
editor.disableCollaboration(): void
editor.isCollaborating: boolean

// Versioning (configure versioning.adapter)
editor.saveVersion(options?): Promise<DocumentVersion>
editor.listVersions(): Promise<DocumentVersion[]>
editor.getVersion(id): Promise<DocumentVersion | null>
editor.restoreVersion(id): Promise<boolean>

// Track changes
editor.enableTrackChanges({ authorId? }): void
editor.disableTrackChanges(): void
editor.isTrackChangesEnabled: boolean
editor.getPendingTrackChanges(): TrackedChangeRecord[]
editor.acceptTrackedChange(id: string): boolean
editor.rejectTrackedChange(id: string): boolean

// Lifecycle
editor.mount(element): void
editor.destroy(): void
editor.isDestroyed: boolean
editor.isEditable: boolean
editor.setEditable(editable): void

// Events
editor.on(event, handler): () => void
editor.off(event, handler): void
```

### ProseMirrorAPI

Public access to all ProseMirror functionality via `editor.pm`.

See [ProseMirrorAPI.ts](src/pm/ProseMirrorAPI.ts) for the full API.

## Real-Time Collaboration

BeakBlock supports real-time collaboration via Y.js. Enable and disable it at runtime without reloading the page:

```typescript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { ySyncPlugin, yCursorPlugin, yUndoPlugin } from 'y-prosemirror';

const ydoc = new Y.Doc();
const provider = new WebsocketProvider('ws://localhost:1234', 'room', ydoc);
const fragment = ydoc.getXmlFragment('prosemirror');

// Enable (auto-disables prosemirror-history)
editor.enableCollaboration({
  plugins: [
    ySyncPlugin(fragment),
    yCursorPlugin(provider.awareness),
    yUndoPlugin(),
  ],
});

// Disable (auto-restores prosemirror-history)
editor.disableCollaboration();
```

See the [Collaboration guide](../../docs/collaboration.md) for full documentation.

## Comments

- Use a **`CommentStore`** (`InMemoryCommentStore` or your own) plus **`createCommentPlugin(store)`** in `EditorConfig.prosemirror.plugins`.
- On every **`transaction`** with **`docChanged`**, call **`store.mapAnchors(transaction.mapping)`** so thread anchors stay aligned with the document.
- Vue: **`CommentRail`**, **`CommentModal`**, and **`BubbleMenu`** `@comment` — see `@aurthurm/beakblock-vue`.
- React: **`CommentModal`** and **`BubbleMenu`** — see `@aurthurm/beakblock-react`.

See [Comments](../../docs/comments.md) for the full API, anchoring rules, persistence notes, and troubleshooting.

## Versioning and track changes

- Configure `versioning: { adapter }` and use `saveVersion`, `listVersions`, `getVersion`, and `restoreVersion`.
- Optional `trackChanges` in config, or `enableTrackChanges` / `disableTrackChanges` at runtime.

See [Versioning and track changes](../../docs/versioning.md) for adapter details, Y.js caveats, per-hunk accept/reject, and reviewer workflows.

## License

Apache-2.0
