# ADR-0004: Canonical format and migration

- **Status:** Accepted (initial)
- **Date:** 2026-10-22
- **Roadmap:** ADR-4, section 4

## Context

The editor's JSON has been `Block[]` since 0.1.x, and apps store it. The 2.0 model needs document-level
data (sections, page setup, styles, numbering, properties) that a flat list cannot carry. Options were to
keep `Block[]` as the canonical format, or to introduce a versioned document tree with a lossless migrator.

## Decision

Introduce a versioned document tree, `BeakDocument` with `schemaVersion: 2` (`@amusendame/beakblock-schema`,
contract section 2), and keep `Block[]` as the editor's runtime and interchange format through
`getDocument()` and `setDocument()`.

- `migrateDocument(input)` accepts `Block[]` (v1), `{ schemaVersion: 1, blocks }`, or a v2 document.
- `MigrationRegistry` applies ordered steps. The built-in step is v1 to v2.
- `documentToBlocks` writes the blocks back. Single-section documents round-trip exactly (tested in
  `packages/ir/src/roundtrip.test.ts` and in `tests/conformance`).

## Evidence

- Round trip Block[] to `migrateDocument` to IR to `irToDocument` to `documentToBlocks` on the 20-document
  synthetic corpus: 15 documents round-trip with no structural loss. Five have known losses, and one
  (deep nesting) fails IR validation. These are recorded in `tests/conformance/src/roundtrip.test.ts`
  (`KNOWN_BUGS`) and in `docs/2.0/status.md`.
- Migration is idempotent on the corpus (`migrateDocument(migrateDocument(x))` equals `migrateDocument(x)`).

## Consequences

- Stored v1 content keeps working. New features that need document-level data are only available after
  migration, which the application triggers.
- The IR is the lossless bridge for DOCX. Anything the IR cannot represent must be carried by
  `source.raw` or be a reported loss. Today five corpus documents lose custom inline nodes or empty
  containers silently in the IR. Silent loss breaks the "no structural loss" exit, so these are treated as
  defects, not design choices.
- Migration of a document with multiple sections depends on `sectionBreak` blocks. Their semantics are
  documented in the schema README.

## Follow-ups

- Fix the known IR losses, then remove the matching `KNOWN_BUGS` entries so the suite enforces them.
- Add a v2 to v3 migration test as soon as a v3 shape is proposed (roadmap release gate 7).
- Write the deprecation and migration steps for applications in `docs/2.0/migration-guide.md` and keep them
  up to date with the code.

## References

- `packages/schema/README.md` (Migrating legacy documents, Migrations)
- `docs/2.0/migration-guide.md`
