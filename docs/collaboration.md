# Real-Time Collaboration with Y.js

BeakBlock has built-in support for real-time collaboration via [Y.js](https://yjs.dev/). You can enable and disable collaboration at runtime without reloading the page.

## Prerequisites

Install the required peer dependencies:

```bash
npm install yjs y-prosemirror y-websocket
# or
pnpm add yjs y-prosemirror y-websocket
```

> `yjs` and `y-prosemirror` are optional peer dependencies of `@beakblock/core`. They are only needed if you use collaboration features.

## Quick Start

```typescript
import { BeakBlockEditor } from '@beakblock/core';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { ySyncPlugin, yCursorPlugin, yUndoPlugin } from 'y-prosemirror';

// 1. Create the Y.js document and provider
const ydoc = new Y.Doc();
const provider = new WebsocketProvider('ws://localhost:1234', 'my-room', ydoc);
const fragment = ydoc.getXmlFragment('prosemirror');

// 2. Create the editor
const editor = new BeakBlockEditor({
  element: document.getElementById('editor'),
});

// 3. Enable collaboration (this disables prosemirror-history automatically)
editor.enableCollaboration({
  plugins: [
    ySyncPlugin(fragment),
    yCursorPlugin(provider.awareness),
    yUndoPlugin(),
  ],
});
```

## API Reference

### `editor.enableCollaboration(config)`

Enables real-time collaboration. This method:
- Automatically **disables** the built-in `prosemirror-history` plugin (it conflicts with Y.js)
- Adds the provided collaboration plugins to the editor
- Reconfigures the editor state in place — **no reload needed**

```typescript
interface CollaborationConfig {
  /** ProseMirror plugins for collaboration (e.g., from y-prosemirror). */
  plugins: Plugin[];
}
```

If collaboration was already enabled, calling this again will first remove the previous collaboration plugins.

### `editor.disableCollaboration()`

Disables collaboration. This method:
- Removes all collaboration plugins
- Re-enables the built-in `prosemirror-history` plugin (fresh history stack)
- Reconfigures the editor state in place — **no reload needed**

```typescript
editor.disableCollaboration();
```

### `editor.isCollaborating`

Read-only boolean indicating whether collaboration is currently active.

```typescript
if (editor.isCollaborating) {
  console.log('Collaboration is active');
}
```

## History Management

### Why is `prosemirror-history` disabled?

`prosemirror-history` and Y.js's `yUndoPlugin` both manage undo/redo, but they do it differently:

- **`prosemirror-history`** tracks local state changes sequentially. It has no concept of "who" made a change.
- **`yUndoPlugin`** integrates with Y.js's undo manager to only undo **your own changes**, which is the expected behavior in a collaborative editor.

Running both at the same time causes conflicts (double undos, corrupted state). BeakBlock handles this automatically: `enableCollaboration()` disables history, `disableCollaboration()` re-enables it.

### Manual History Control

You can also toggle history independently, without collaboration:

```typescript
// Disable history
editor.disableHistory();
editor.isHistoryEnabled; // false

// Re-enable history (creates a fresh undo stack)
editor.enableHistory();
editor.isHistoryEnabled; // true
```

### Disable History at Initialization

If you know collaboration will be enabled from the start, you can skip creating the history plugin entirely:

```typescript
const editor = new BeakBlockEditor({
  history: false,
});
```

You can still call `editor.enableHistory()` later to add it at runtime.

## Full Example: Toggle Collaboration On/Off

```typescript
import { BeakBlockEditor } from '@beakblock/core';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { ySyncPlugin, yCursorPlugin, yUndoPlugin } from 'y-prosemirror';

const editor = new BeakBlockEditor({
  element: document.getElementById('editor'),
});

let ydoc: Y.Doc | null = null;
let provider: WebsocketProvider | null = null;

function startCollaboration() {
  ydoc = new Y.Doc();
  provider = new WebsocketProvider('ws://localhost:1234', 'my-room', ydoc);
  const fragment = ydoc.getXmlFragment('prosemirror');

  editor.enableCollaboration({
    plugins: [
      ySyncPlugin(fragment),
      yCursorPlugin(provider.awareness),
      yUndoPlugin(),
    ],
  });
}

function stopCollaboration() {
  editor.disableCollaboration();
  provider?.destroy();
  ydoc?.destroy();
  provider = null;
  ydoc = null;
}

// Toggle with a button
document.getElementById('collab-toggle')?.addEventListener('click', () => {
  if (editor.isCollaborating) {
    stopCollaboration();
  } else {
    startCollaboration();
  }
});
```

## Using with React

```tsx
import { useBeakBlockEditor } from '@beakblock/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { ySyncPlugin, yCursorPlugin, yUndoPlugin } from 'y-prosemirror';
import { useEffect, useRef } from 'react';

function CollaborativeEditor({ roomId }: { roomId: string }) {
  const { editor, ref } = useBeakBlockEditor({});
  const providerRef = useRef<WebsocketProvider | null>(null);

  useEffect(() => {
    if (!editor) return;

    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider('ws://localhost:1234', roomId, ydoc);
    providerRef.current = provider;
    const fragment = ydoc.getXmlFragment('prosemirror');

    editor.enableCollaboration({
      plugins: [
        ySyncPlugin(fragment),
        yCursorPlugin(provider.awareness),
        yUndoPlugin(),
      ],
    });

    return () => {
      editor.disableCollaboration();
      provider.destroy();
      ydoc.destroy();
    };
  }, [editor, roomId]);

  return <div ref={ref} />;
}
```

## Cursor Styles

When using `yCursorPlugin`, remote cursors and selections are rendered with CSS classes. Add styles to make them visible:

```css
/* Remote cursor */
.yRemoteSelection {
  background-color: rgba(59, 130, 246, 0.3);
}

/* Remote cursor caret */
.yRemoteSelectionHead {
  position: absolute;
  border-left: 2px solid rgb(59, 130, 246);
  border-top: 2px solid rgb(59, 130, 246);
  height: 1.2em;
}

/* Remote cursor label */
.yRemoteSelectionHead::after {
  content: attr(data-user);
  position: absolute;
  top: -1.4em;
  left: -2px;
  font-size: 0.75rem;
  padding: 1px 4px;
  background: rgb(59, 130, 246);
  color: white;
  border-radius: 3px;
  white-space: nowrap;
}
```

## Provider Options

Y.js supports multiple network providers. Here are common choices:

| Provider | Package | Use Case |
|----------|---------|----------|
| WebSocket | `y-websocket` | Simple server-based sync |
| WebRTC | `y-webrtc` | Peer-to-peer, no server needed |
| Hocuspocus | `@hocuspocus/provider` | Production-ready WebSocket server |
| Liveblocks | `@liveblocks/yjs` | Managed service |
| PartyKit | `y-partykit` | Edge-deployed collaboration |

All providers work the same way — just swap the provider import and configuration:

```typescript
// WebRTC example (peer-to-peer)
import { WebrtcProvider } from 'y-webrtc';

const provider = new WebrtcProvider('my-room', ydoc);

editor.enableCollaboration({
  plugins: [
    ySyncPlugin(fragment),
    yCursorPlugin(provider.awareness),
    yUndoPlugin(),
  ],
});
```
