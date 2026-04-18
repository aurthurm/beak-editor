# Comments

BeakBlock comments are **selection-anchored discussion threads** stored outside the document JSON. Each thread has ProseMirror document positions `from` / `to`, a list of replies, optional resolve state, and reactions. Highlights in the editor are drawn with a ProseMirror **decoration plugin**; data lives in a **`CommentStore`** you provide (or `InMemoryCommentStore` for demos).

## Concepts

| Concept | Meaning |
|--------|---------|
| **Thread** | A range `[from, to)` in the current ProseMirror document plus metadata and `comments[]`. |
| **Comment (entry)** | One message inside a thread (`authorId`, `body`, timestamps, `reactions`). |
| **Anchor** | Integer positions in the **document** coordinate system (same as `editor.pm.selection`). They must stay in sync when the user edits text. |
| **Annotation** | Inline decoration over `[from, to)` with classes `beakblock-comment-annotation` (and `--resolved` when resolved). |

Threads are **not** blocks in `getDocument()`. Persist threads separately (API, IndexedDB, etc.) if you need them across reloads.

## Core exports

From `@amusendame/beakblock-core` (or `@beakblock/core` depending on publish name):

```typescript
import {
  createCommentPlugin,
  COMMENT_PLUGIN_KEY,
  InMemoryCommentStore,
} from '@amusendame/beakblock-core';
import type {
  CommentStore,
  CommentThread,
  CommentEntry,
  CommentStoreSnapshot,
} from '@amusendame/beakblock-core';
```

- **`CommentStore`** — Interface your app implements for production (or use `InMemoryCommentStore`).
- **`InMemoryCommentStore`** — In-process store; threads are lost when the tab closes unless you serialize them yourself.
- **`createCommentPlugin(store)`** — Returns a `Plugin` that paints annotations and refreshes when the store notifies subscribers.

Full method list: [`packages/core/src/comments/types.ts`](../packages/core/src/comments/types.ts).

## Wire the plugin into the editor

Pass the plugin through **`prosemirror.plugins`** so it loads with the editor state:

```typescript
import { BeakBlockEditor } from '@amusendame/beakblock-core';
import { createCommentPlugin, InMemoryCommentStore } from '@amusendame/beakblock-core';

const commentStore = new InMemoryCommentStore();

const editor = new BeakBlockEditor({
  element: document.getElementById('editor'),
  prosemirror: {
    plugins: [createCommentPlugin(commentStore)],
  },
});
```

The plugin:

- Builds `Decoration.inline` spans from `store.getThreads()` (skips deleted threads and empty ranges).
- Subscribes to `store.subscribe` and dispatches a transaction with meta `COMMENT_PLUGIN_KEY` `{ refresh: true }` so decorations update when threads change **without** a doc change.

You can combine this with other plugins (slash menu, collaboration, versioning, etc.) by spreading them in the same array.

## Keep anchors in sync: `mapAnchors`

When the document changes (typing, paste, undo, collaborative steps), thread `[from, to)` must be **mapped** through the transaction’s position mapping. Otherwise highlights drift or point at the wrong text.

`CommentStore` includes:

```typescript
mapAnchors(mapping: Mapping): void;
```

**Call it on every document-changing transaction** from your app:

```typescript
editor.on('transaction', ({ transaction }) => {
  if (!transaction.docChanged) return;
  commentStore.mapAnchors(transaction.mapping);
});
```

`InMemoryCommentStore.mapAnchors`:

- Maps `from` / `to` with `mapResult` (association `-1` / `1` on the ends).
- If both ends land in deleted ranges, sets `thread.deletedAt` (soft tombstone).
- Emits to subscribers so UI and decorations refresh.

If you skip this in production, comments will appear “stuck” or misaligned after edits.

## Store operations (cheat sheet)

Typical flow:

1. User selects text and opens the comment UI.
2. **`createThread({ from, to, authorId, body })`** — creates thread + first comment.
3. **`addComment({ threadId, authorId, body })`** — reply.
4. **`updateComment` / `deleteComment`** — edit or remove entries (deleting the last comment removes the thread in `InMemoryCommentStore`).
5. **`resolveThread` / `unresolveThread`** — workflow state; resolved threads use a different decoration class.
6. **`addReaction` / `deleteReaction`** — emoji reactions per comment.
7. **`subscribe(listener)`** — `listener(threads)` whenever data changes; used by Vue/React UIs and by the comment plugin’s refresh.

Read helpers:

- **`getThreads()`**, **`getThread(id)`**, **`getThreadsAt(pos)`**, **`getActiveThreadAtRange(from, to)`**
- **`snapshot()`** — same as threads list for binding; returns clones in `InMemoryCommentStore`.

## Custom `CommentStore` for persistence

Implement the `CommentStore` interface with your backend:

- On load, hydrate threads (ensure `from`/`to` are valid for the **current** doc, or remap from saved block offsets if you use a different anchoring strategy).
- On each mutation, persist and call your `emit`/subscriber pattern like `InMemoryCommentStore`.
- Always implement **`mapAnchors`** the same way as the in-memory class (or forward to server-side remap if you store absolute positions only—usually you still map client-side on each transaction).

## Styling

Annotations use theme-friendly classes (see injected / `editor.css`):

- **`.beakblock-comment-annotation`** — active thread highlight.
- **`.beakblock-comment-annotation--resolved`** — resolved thread.

Vue **`CommentRail`** adds rail markers, flyouts, and connectors using classes such as `beakblock-comment-shell`, `beakblock-comment-marker__bubble`, etc. Override in your app CSS as needed.

## Vue: `CommentRail` and `CommentModal`

Package: `@amusendame/beakblock-vue`.

### `CommentRail`

Wraps the editor column and shows a **marker rail** + **flyout** for threads. Props:

| Prop | Type | Description |
|------|------|-------------|
| `editor` | `BeakBlockEditor \| null` | Editor instance. |
| `store` | `CommentStore` | Same store passed to `createCommentPlugin`. |
| `currentUserId` | `string` (optional) | Default `'you'`; used when creating comments/replies. |

Default slot: editor content (e.g. `BeakBlockView`).

```vue
<CommentRail :editor="editor" :store="commentStore" current-user-id="user-123">
  <BeakBlockView :editor="editor" class-name="editor-view" />
</CommentRail>
```

The rail subscribes to the store and listens to editor transactions for layout; **you should still register `mapAnchors`** on the editor (e.g. in the parent `setup`) so anchors survive edits.

### `CommentModal`

Modal for creating threads from the **current selection** and viewing/overlapping threads. Props:

| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Visibility. |
| `editor` | `BeakBlockEditor \| null` | Required when open. |
| `store` | `CommentStore` | Same store. |
| `currentUserId` | `string` (optional) | Author id for new content. |
| `title` / `subtitle` | `string` | Header copy. |
| `onClose` | `() => void` | Close handler. |

When `open` becomes true, the modal captures `selection.from` / `selection.to`. If `from === to`, there is **no range**—the UI typically won’t create a thread until the user selects text.

Hook **`BubbleMenu`** with `@comment` (or `onComment`) to open the modal:

```vue
<BubbleMenu :editor="editor" @comment="openCommentModal" />
```

### Full Vue example

See [`examples/nuxt-vue/components/ComplianceSectionEditor.vue`](../examples/nuxt-vue/components/ComplianceSectionEditor.vue): `InMemoryCommentStore`, `createCommentPlugin`, `CommentRail`, `CommentModal`, and bubble `@comment`. The same component sits inside a **compliance workspace** that adds **section approvals** (draft / in review / approved), an append-only **approval history** per section, **read-only lock** after sign-off for authors, **document-level release** attestation (optional two approvers), and **export** bundling comments plus approval metadata — described in **[Compliance workflow (Nuxt example)](./compliance-demo.md)**.

## React: `CommentModal`

Package: `@amusendame/beakblock-react`.

There is **no `CommentRail` in React** yet; use **`CommentModal`** with the same props pattern as Vue (`open`, `editor`, `store`, `currentUserId`, `title`, `subtitle`, `onClose`).

```tsx
<BubbleMenu editor={editor} onComment={() => setCommentOpen(true)} />
<CommentModal
  open={commentOpen}
  editor={editor}
  store={commentStore}
  currentUserId="user-123"
  title="Comments"
  onClose={() => setCommentOpen(false)}
/>
```

Use the same **`createCommentPlugin`** + **`mapAnchors`** pattern on `editor.on('transaction', …)`.

## AI and comments

Optional: thread metadata can carry machine-readable fields (`metadata` on threads and comments) for integrations. Keep `authorId` meaningful for your auth model.

## Troubleshooting

| Symptom | Likely cause |
|--------|----------------|
| Highlights don’t move with text | Not calling **`mapAnchors(transaction.mapping)`** on doc changes. |
| Highlights disappear after edit | Range fully deleted; store marked thread with `deletedAt`. |
| Modal won’t create thread | Selection is collapsed (`from === to`); expand selection first. |
| Decorations stale after programmatic store update | Store should notify subscribers; `InMemoryCommentStore` does this automatically. |

## See also

- [Collaboration](./collaboration.md) — Y.js and comments: still call `mapAnchors` for local steps; remote sync may need equivalent mapping when applying remote transactions.
- [Versioning](./versioning.md) — Restoring a version replaces the document; re-load or remap comment anchors for the new doc.
- [Compliance demo](./compliance-demo.md) — Nuxt sample tying comments to approvals, audit history, and export.
