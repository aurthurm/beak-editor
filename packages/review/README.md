# @amusendame/beakblock-review

Durable track changes, review operations, anchored comments, revision compare and snapshot restore for BeakBlock.

Part of BeakBlock 2.0. Interfaces follow section 5 of `docs/2.0/contracts.md`.

## Install and build

```bash
pnpm --filter @amusendame/beakblock-review build
pnpm --filter @amusendame/beakblock-review test
```

The package depends on `@amusendame/beakblock-core` (types only at runtime) and on the ProseMirror packages.

## Schema

Revisions are stored as marks, so they survive JSON round trips. Add the marks to your schema:

```typescript
import { Schema } from 'prosemirror-model';
import { DEFAULT_NODES, DEFAULT_MARKS } from '@amusendame/beakblock-core';
import { insertionMarkSpec, deletionMarkSpec } from '@amusendame/beakblock-review';

const schema = new Schema({
  nodes: DEFAULT_NODES,
  marks: { ...DEFAULT_MARKS, insertion: insertionMarkSpec, deletion: deletionMarkSpec },
});
```

Or use the extension: `reviewExtension(options)` returns `{ name: 'review', marks, plugins }`.

Mark attributes are `revisionId`, `authorId`, `authorName`, `at`, `aiGenerated`, and `groupId`. `groupId` is an extra optional attribute. It ties the deletion and insertion halves of a replacement together. Marks render as `<ins class="beakblock-ins">` and `<del class="beakblock-del">`.

## Track changes

```typescript
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import {
  createRevisionTrackingPlugin,
  InMemoryRevisionStore,
  setTrackChangesEnabledTransaction,
  listPendingRevisions,
  acceptRevision,
  rejectAll,
} from '@amusendame/beakblock-review';

const store = new InMemoryRevisionStore();
const plugin = createRevisionTrackingPlugin({
  enabled: true,                       // default false
  author: { id: 'u1', name: 'Ada' },
  store,                               // optional RevisionStore
  getSectionId: undefined,             // optional override of the controlledSection lookup
});
const view = new EditorView(el, { state: EditorState.create({ schema, doc, plugins: [plugin] }) });

view.dispatch(view.state.tr.insertText('new ', 10));                 // inserted text gets an insertion mark
view.dispatch(view.state.tr.delete(20, 25));                         // deleted text stays, marked deleted
view.dispatch(setTrackChangesEnabledTransaction(view.state.tr, false)); // toggle off
```

How edits are tracked:

- **Insertions** get an `insertion` mark with a new revision id. Typing that continues the same author's adjacent insertion reuses its revision id.
- **Deletions** keep the text and add a `deletion` mark. Deleting your own pending insertion removes it for real, and its store record becomes `rejected` with `resolvedBy` set to you.
- **Replacements** produce a deletion and an insertion that share a `groupId`.
- **Formatting** is applied directly. It is recorded as a `format` record in the store, not as a mark.
- **Overlaps**: typing inside another author's insertion creates a nested revision for the new author. The text carries both marks.
- Transactions with the `REVIEW_META_SKIP` meta (`beakblock:review:skip`) are not tracked. Use it for loading content.

Limits:

- Tracking works from a diff of the document before and after each transaction. Edits are tracked at character granularity, so a shared space or letter before a change stays plain.
- Paragraph splits (Enter) and joins (Backspace at a block start) are applied untracked, because no text is removed. A cross-paragraph deletion that removes text marks the text, but the paragraph boundary stays until the revision is accepted.
- Accepting a deletion or rejecting an insertion removes a textblock whose text is entirely removed, as long as its parent is not the last child and keeps at least one child. Empty list items and table cells are left in place.
- Inline atoms (icons, hard breaks) and blocks without text (dividers, images) are not struck through. Deleting them is applied directly.
- If inserted content cannot be placed, the edit is left untracked for that transaction.

## Review operations

```typescript
acceptRevision(view, id, 'reviewer');   // insertion: unmark. deletion: remove text.
rejectRevision(view, id, 'reviewer');   // the inverse.
acceptAll(view, 'reviewer');
rejectAll(view, 'reviewer');
listPendingRevisions(view.state);        // derived from the marks, in document order
```

Accepting or rejecting one half of a replacement resolves the whole group. Each resolution sets `status`, `resolvedBy`, and `resolvedAt` in the store. Records are created if they are missing.

### Propose a change (AI and other proposals)

```typescript
import { proposeChange } from '@amusendame/beakblock-review';

const { groupId, deletionRevisionId, insertionRevisionId } = proposeChange(view, {
  from, to, text: 'replacement text',
  author: { id: 'assistant', name: 'Assistant' },
  aiGenerated: true,
  note: 'Clearer wording',
});
```

The proposal is always a tracked replacement and is never accepted automatically. It works whether or not tracking is on.

## Views

```typescript
import { setReviewView, projectBlocks } from '@amusendame/beakblock-review';

setReviewView(view.dom, 'final');     // 'markup' | 'final' | 'original'
const finalBlocks = projectBlocks(blocks, 'final');
```

`setReviewView` sets the `beakblock-review-view-*` class on the root element. Core CSS handles the visibility. `projectBlocks` works on Block JSON whose text carries `styles.revision` (contract 1.3). Final drops deleted text, and Original drops inserted text. Blocks that are entirely removed by a projection are dropped. The input is not mutated.

## Comments

```typescript
import { InMemoryCommentThreadStore, createCommentAnchor, reanchorComments } from '@amusendame/beakblock-review';

const comments = new InMemoryCommentThreadStore();
const anchor = createCommentAnchor(blocks, 'p2', 11, 21);   // block id plus plain-text range
const c = comments.add({ anchor, authorId: 'ada', body: 'Confirm with @qa-lead' });
comments.reply(c.id, { authorId: 'qa', body: 'Done' });     // thread.mentions parsed from body
comments.resolve(c.id, 'qa');
comments.reopen(c.id);

// After edits:
const updated = reanchorComments(newBlocks, comments.list());
```

`reanchorComments` returns new objects. It finds the quote again in the anchored block (nested children included) and updates the offset. It sets `orphaned: true` when the block or the quote is gone. Persist results with `comments.update(comment)`.

`CommentThreadStore` is the interface for your own persistence.

## Revision compare

```typescript
import { compareRevisions, renderRedlineHTML } from '@amusendame/beakblock-review';

const result = compareRevisions(releasedBlocks, draftBlocks);
result.summary;   // { added, removed, modified, moved, sectionsChanged }
result.diffs;     // BlockDiff[] in merged display order, with inline word diffs for changed text
const html = renderRedlineHTML(result);
```

Blocks are matched by id. Moves come from a longest common subsequence of surviving blocks. Containers are compared on their own fields, so children are reported separately. Changed blocks carry `beakblock-change-bar`. Text is HTML-escaped.

## Snapshot restore

```typescript
import { restoreSnapshotPreservingRevisions } from '@amusendame/beakblock-review';

const { blocks, droppedRevisions } = restoreSnapshotPreservingRevisions(currentBlocks, snapshotBlocks);
```

For a block present in both trees with pending revisions, the current block is kept, with its revisions, when its base text (pending inserts removed) equals the snapshot text. Props and children come from the snapshot. Other blocks take the snapshot content. Revisions that cannot be carried over are returned in `droppedRevisions`, with `reason: 'block-removed' | 'text-changed'`. Nothing is dropped silently.

## Stores

- `InMemoryRevisionStore` and `InMemoryCommentThreadStore` are for tests and single-session use.
- Implement `RevisionStore` and `CommentThreadStore` over your own persistence to keep review history across sessions.
- The marks in the document are the source of truth for pending insert and delete revisions. A store is needed for provenance, format records, and resolved history.
