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

- `setDocument()` and `restoreVersion()` set transaction meta so **track changes does not treat** full replacements as normal typed edits. A full-document replace also **clears** the track-change log (`BEAKBLOCK_META_TRACK_CLEAR_LOG`).
- After `restoreVersion()`, if history was enabled, the undo stack is **reset** (same idea as `disableHistory` / `enableHistory`) so undo does not cross the restore boundary.

### Collaboration (Y.js)

`restoreVersion()` replaces the entire document locally. With an active Y.js sync provider, that can **conflict** with remote state. Prefer `editor.disableCollaboration()` before restoring, or treat restore as undefined behavior under collaboration.

## Track changes

Enable at init via `trackChanges: true` or `{ authorId: '…' }` in `EditorConfig`, or at runtime:

```typescript
editor.enableTrackChanges({ authorId: 'user-1' });
// …
editor.disableTrackChanges();
```

- **Inserts** are highlighted with `.beakblock-track-insert`.
- **Deletes** (text) appear as inline widgets with `.beakblock-track-delete`.
- `editor.getPendingTrackChanges()` returns the in-memory log; `editor.on('trackChange', ({ entry }) => …)` fires for new entries.
- **`editor.acceptTrackedChange(id)`** — keep the document as-is and drop this hunk from the log (removes highlights for that change).
- **`editor.rejectTrackedChange(id)`** — for inserts/replaces, delete the inserted range; for deletes/replaces with stored text, re-insert the deleted text at the widget position; then remove the hunk from the log.

Each `TrackedChangeRecord` includes mapped **`insertRange`** and **`deleteWidgetPos`** fields while the change is pending so accept/reject can target the right spans.

**Reviewer-only workflows:** use `editor.setEditable(false)` so authors cannot change body text while reviewers use comments (or your own UI) for feedback. Track-change accept/reject should stay disabled for reviewers if they must not modify content.

**Limitations:** Structural or multi-step edits may still produce log entries with incomplete range metadata; complex replace hunks are best reviewed with versioning snapshots alongside track changes.

### Compliance-style lock (example app)

The Nuxt compliance workspace shows one way to combine track changes with **governance**: when a section is **signed off** (`approved`), authors get a **read-only** body until a reviewer revokes approval. That behavior is implemented in Vue (`ComplianceSectionEditor` / `ComplianceDocumentWorkspace`), not in the core editor. It also persists an **approval audit trail** and optional **document-level attestation** before export. See **[Compliance workflow (Nuxt example)](./compliance-demo.md)**.

## Framework helpers

- Vue: `useDocumentVersions(editor, adapter)` from `@aurthurm/beakblock-vue`.
- React: `useDocumentVersions(editor, adapter)` from `@aurthurm/beakblock-react`.

Pass the **same** adapter instance you use in `EditorConfig.versioning.adapter`.

## See also

- [Compliance demo](./compliance-demo.md) — multi-section approvals, approval history, document release, and export in `examples/nuxt-vue`.
