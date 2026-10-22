# ADR-0003: Collaboration topology

- **Status:** Accepted (initial). Implementation pending.
- **Date:** 2026-10-22
- **Roadmap:** ADR-3, section 4, Phase 4 and Phase 5

## Context

Controlled documents have sections owned by different people. Two topologies were proposed:

- **(A) Stacked editors:** one editor per section, stacked in one visual page flow, each bound to its own
  room. Enforcement and sync are per section.
- **(B) Composite editor:** one view and one ProseMirror state, with each `controlledSection` bound to its
  own Y.XmlFragment or room.

The roadmap says to ship (A) first and spike (B) in parallel, adopting (B) only if cross-section selection,
find and undo prove stable.

## Options

| Option | Strength | Weakness |
| --- | --- | --- |
| (A) Stacked editors | Simple per-section enforcement, works with the existing single-editor code | Cross-section selection, find and undo are hard; page flow must be stitched |
| (B) Composite editor | One selection and undo model, one page flow | Per-section CRDT binding is hard (roadmap risk table) |

## Decision

Accept (A) as the first implementation target. Keep (B) behind a spike.

## Current state in this repository

- The editor is still one ProseMirror instance. Core has single-document Y.js collaboration
  (`enableCollaboration` in `packages/core/src/editor/Editor.ts`).
- Controlled sections are blocks inside one document (`controlledSection`, `@amusendame/beakblock-blocks-qms`).
  They are protected by the permission guard (UX only) and by `verifyDocumentChange` on the server
  (`packages/permissions`).
- No stacked-editor implementation exists. No per-section room binding exists. The composite spike was not run.
- Server-side enforcement of section ownership is proven only against the reference `ServerDocumentStore`
  in `tests/conformance/src/support/serverStore.ts`. The QMS service that would own rooms does not exist
  in this repository.

## Consequences

- Section isolation today depends on server-side verification of whole-document submissions, not on
  separate rooms. This is correct for authorisation but gives no per-section concurrency.
- Concurrency, reconnect and offline behaviour (roadmap Phase 5 exit) are untested. Adding them is the
  work that decides between (A) and (B).

## Follow-ups

- Build (A): one room per controlled section in the QMS service, with a server-side merge that rejects
  changes outside the author's grants, using `verifyDocumentChange` on each room's section.
- Run the composite spike (B): bind one `Y.XmlFragment` per section in one editor, then test cross-section
  selection, find and undo. Record the result and update this ADR.
- Add concurrency tests (two clients editing different sections, reconnect, offline conflict policy) to
  `tests/conformance` once a collaboration service exists.

## References

- Roadmap section 4 (ADR-3), section 5F, section 8 (Collaboration row)
- `tests/conformance/src/security.test.ts` (stale and replayed submissions, tenant isolation)
