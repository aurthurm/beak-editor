# Versioning and track changes

BeakBlock can keep **named snapshots** of the document (`Block[]`) through a pluggable adapter, **restore** a snapshot into the editor, and optionally run **track changes** (decoration-based highlights and a change log) without adding marks to the schema.

## Pluggable versioning

Implement `VersioningAdapter` to persist versions (HTTP API, IndexedDB, etc.). For tests and demos, use `InMemoryVersioningAdapter`.

```typescript
import {
  BeakBlockEditor,
  InMemoryVersioningAdapter,
} from '@aurthurm/beakblock-core';

const adapter = new InMemoryVersioningAdapter();

const editor = new BeakBlockEditor({
  element: document.getElementById('editor'),
  versioning: { adapter },
});

await editor.saveVersion({ label: 'Before legal review', meta: { caseId: '42' } });
const versions = await editor.listVersions();
const ok = await editor.restoreVersion(versions[0].id);
```

- `setDocument()` and `restoreVersion()` set transaction meta so **track changes does not treat** full replacements as normal typed edits.
- After `restoreVersion()`, if history was enabled, the undo stack is **reset** (same idea as `disableHistory` / `enableHistory`) so undo does not cross the restore boundary.

### Collaboration (Y.js)

`restoreVersion()` replaces the entire document locally. With an active Y.js sync provider, that can **conflict** with remote state. Prefer `editor.disableCollaboration()` before restoring, or treat restore as undefined behavior under collaboration.

## Track changes (v1)

Enable at init via `trackChanges: true` or `{ authorId: '…' }` in `EditorConfig`, or at runtime:

```typescript
editor.enableTrackChanges({ authorId: 'user-1' });
// …
editor.disableTrackChanges();
```

- **Inserts** are highlighted with `.beakblock-track-insert`.
- **Deletes** (text) appear as inline widgets with `.beakblock-track-delete`.
- `editor.getPendingTrackChanges()` returns the in-memory log; `editor.on('trackChange', ({ entry }) => …)` fires for new entries.

**Limitations (v1):** There is no per-hunk accept/reject. Use **undo**, **restore a saved version**, or **disable track changes** and edit normally. Structural edits may produce log entries with no visible widget.

## Framework helpers

- Vue: `useDocumentVersions(editor, adapter)` from `@aurthurm/beakblock-vue`.
- React: `useDocumentVersions(editor, adapter)` from `@aurthurm/beakblock-react`.

Pass the **same** adapter instance you use in `EditorConfig.versioning.adapter`.
