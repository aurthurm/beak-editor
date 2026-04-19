# Compliance locks (read-only blocks)

BeakBlock can treat certain blocks as **compliance-locked**: their text, marks, and attributes are protected from ordinary editing, while sibling blocks can still be added or edited. This is aimed at **fixed section titles**, regulatory headings, or content signed off in an external workflow.

Locks are **enforced in the editor** via a ProseMirror plugin (`filterTransaction`). They are **not** a security boundary: treat them as UX and accident prevention; remote collaborators or custom code paths may still need server-side rules if you require hard guarantees.

## Enabling locks

Pass **`complianceLock`** on `EditorConfig` when creating the editor. Set it to `false` to disable the plugin entirely.

```typescript
import { BeakBlockEditor } from '@amusendame/beakblock-core';

const editor = new BeakBlockEditor({
  element: document.getElementById('editor'),
  complianceLock: {
    // When false (default), locked blocks cannot be reordered relative to each other
    // via drag-and-drop; the drag handle is hidden for those blocks.
    // When true, reordering locked blocks is allowed if your product policy permits it.
    allowReorder: false,
  },
});
```

Omit `complianceLock` or set it to `false` if you do not need this behavior.

## Drag-and-drop plugin options (`EditorConfig.dragDrop`)

The block **side menu** (add block, drag handle, lock badge) is created by the built-in drag-and-drop plugin. You can pass **`dragDrop`** on **`EditorConfig`** (or configure the plugin when using **`createPlugins`** directly). Set **`dragDrop: false`** to disable the plugin entirely.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `headingLockBadge` | `'locked-only' \| 'all-headings'` | `'locked-only'` | **`locked-only`** — show the padlock in the side menu only for blocks with **`attrs.locked`** (any block type). **`all-headings`** — show the control on **every** heading; **click** toggles **`locked`** (transaction includes **`COMPLIANCE_LOCK_BYPASS_META`**). When turning a heading **on**, if **`lockId`** is missing and the heading level is **1–3**, a new **`lockId`** is assigned (UUID). |

Other fields match **`DragDropConfig`** in the core package (`showHandles`, `showAddButton`, `onDrop`, `allowLockedBlockDrag`, …). When **`complianceLock.allowReorder`** is not `true`, **`allowLockedBlockDrag`** is forced **`false`** for locked blocks.

```typescript
import { BeakBlockEditor } from '@amusendame/beakblock-core';

const editor = new BeakBlockEditor({
  element: document.getElementById('editor'),
  complianceLock: { allowReorder: false },
  dragDrop: {
    headingLockBadge: 'all-headings',
  },
});
```

The interactive badge uses **`.ob-block-lock-badge--interactive`** (pointer cursor, hover state). Toggling from the side menu does not run when **`editor.isEditable`** is false.

## Full document replacement (`setDocument`)

**`editor.setDocument(blocks)`** dispatches a replace transaction that sets **`COMPLIANCE_LOCK_BYPASS_META`** so trusted full-document loads (for example workspace **Unlock title** / template saves) are not rejected by the compliance lock plugin when locked headings change.

## Which nodes can be locked?

Today, **heading** nodes support lock metadata in the schema. Set **`props.locked`** (and optional **`lockReason`**, **`lockId`**) on the block JSON, or set the corresponding ProseMirror attributes.

See **[Block: heading](./blocks/heading.md)** for the full prop list and persistence details.

## Behavior summary

| Action | Default |
|--------|---------|
| Edit text or marks inside a locked block | Blocked |
| Change locked block attrs (level, alignment, …) | Blocked |
| Delete a locked block | Blocked |
| Insert blocks before/after a locked block | Allowed |
| Reorder locked blocks (drag) | Allowed only if `allowReorder: true` |

The **bubble menu** stays hidden when the selection is inside locked content. **Multi-block delete** skips locked blocks.

## Trusted updates (bypass)

Workflow code that must mutate locked content (for example after an approval step) can dispatch transactions with meta **`beakblockComplianceLockBypass`** set to truthy. The constant **`COMPLIANCE_LOCK_BYPASS_META`** is exported from `@amusendame/beakblock-core`.

```typescript
import { COMPLIANCE_LOCK_BYPASS_META } from '@amusendame/beakblock-core';

const tr = editor.pm.state.tr;
// … apply steps …
tr.setMeta(COMPLIANCE_LOCK_BYPASS_META, true);
editor.pm.dispatch(tr);
```

Use this only for trusted, audited code paths.

## Helpers

- **`nodeIsComplianceLocked(node)`** — returns whether a ProseMirror node carries `attrs.locked` (`true` or `'true'`).
- **`selectionTouchesComplianceLocked(state)`** — whether the current selection overlaps locked block content (used internally for menus).

## UI affordances

When default styles are loaded (auto-injection or `editor.css`):

1. **Heading gutter** — Locked headings render a small **padlock** at the **start of the line** (`::before`), with extra inline padding so the title clears the icon.
2. **Block side menu** — On hover, the floating **add / drag** strip can show a **lock badge** to the left of the add button. With **`headingLockBadge: 'locked-only'`**, it appears only when the hovered block is compliance-locked. With **`'all-headings'`**, it appears on **every** heading: **closed lock** when locked, **open shackle** when unlocked; **click** toggles lock state (see above). Tooltips reflect **`lockReason`** or short **Lock / Unlock** hints.

Relevant CSS classes:

| Class | Role |
|-------|------|
| `.ob-block-lock-badge` | Lock badge container in the side menu |
| `.ob-block-lock-badge--interactive` | Clickable badge (pointer, hover background) |
| `[data-beakblock-locked="true"]` | DOM marker on locked headings (also `data-beakblock-lock-reason`, `data-beakblock-lock-id` when present) |

You can override these rules in your own stylesheet if you disable default injection and ship custom CSS.

## Markdown and HTML

Locked headings round-trip through markdown/HTML with HTML comment markers and `data-beakblock-*` attributes where applicable. See **[Markdown](./markdown.md)** and the heading block reference for serialization notes.

## Collaboration (Yjs)

`filterTransaction` runs on **each client**. Peers applying incompatible steps can still change the shared document unless your sync or server layer applies the same policy. Plan validation accordingly.

## Related

- **[Plugins](./plugins.md)** — where the compliance lock plugin sits among built-ins
- **[Compliance workflow (Nuxt)](./compliance-demo.md)** — example app combining approvals, read-only policy, and export
- **[Versioning](./versioning.md)** — track changes and governance patterns
