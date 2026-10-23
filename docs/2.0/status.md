# BeakBlock 2.0 status

As of 2026-10-23, on `main` (the 2.0 work from `feat/beakblock-2.0` is merged), version `2.0.0-alpha`. This is an
honest checklist against the roadmap ([`beakblock-2.0-roadmap.md`](../../beakblock-2.0-roadmap.md) section 6, phases
and exits, and section 8, release gates). Items are ✅ done and tested here, 🟡 partly done, ❌ not started. Each 🟡
says what is missing. The package-level view is in [`architecture.md`](./architecture.md). Release notes are in
[`CHANGELOG.md`](../../CHANGELOG.md). The defects found by the conformance suite are at the end.

## Evidence in this repository

| Evidence | Result (2026-10-23) |
| --- | --- |
| Package unit suites (`pnpm --filter "./packages/*" run test`) | All 16 packages pass. About 1,030 tests at the last full run (core about 290) |
| Conformance suites (`pnpm --filter @amusendame/beakblock-conformance test`) | All pass. About 245 tests at the last full run. No defect is pinned with `it.fails` at present |
| Targeted re-check for this update | `roundtrip`, `docx`, `security`, `tables` and `editor` test files pass (174 tests). Not a full run |
| Typecheck of the conformance package (strict) | Not re-checked for this update. There is no typecheck script; the root has `lint` |
| Synthetic corpus | 20 documents (`tests/conformance/src/corpus`). Not real SOPs (see "Outside the library") |
| Fidelity proxy (ADR-0002) | 20 of 20 page counts match LibreOffice (`tests/conformance/reports/fidelity.md`, 2026-10-22) |
| Layout performance (heuristic measurer, Node) | 50 pages: 56 laid out pages in about 25 ms. 200 pages: 221 pages in about 45 ms. Relayout from the tail: about 2 ms. Budgets: 3 s and 10 s (`tests/conformance/reports/perf.json`) |

Fidelity (`tests/conformance/reports/fidelity.md`, LibreOffice 26.2.6.3, DOCX export, heuristic layout): every
document's page count matched exactly. The mean absolute drift is 0 pages. This is evidence for short, plain
documents only.

## Phase 0: spikes and decisions

| Item | Status | Notes |
| --- | --- | --- |
| ADR-1/2 renderer and layout-oracle spike (page breaks against browser layout, Paged.js baseline) | 🟡 | LibreOffice used as oracle and matches on the corpus. Paged.js and an external OOXML engine not spiked |
| ADR-3 composite Yjs binding spike | ❌ | Not run. ADR-0003 records stacked editors as the first target and says the composite spike was not run |
| ADR-6 font metric parity test (browser against renderer) | ❌ | No font files in the repository. Heuristic metrics are approximations |
| Assemble the first 20 corpus documents | 🟡 | 20 synthetic documents built (`tests/conformance/src/corpus`). Real anonymised SOPs still needed |
| Write the ADRs | ✅ | ADR-0001 to ADR-0006, status "Accepted (initial)". ADR-0003 implementation pending |

**Exit (ADRs signed off, fidelity baseline measured):** 🟡. The fidelity baseline is measured (on synthetic
documents). The ADRs are accepted as initial decisions but are not signed off by the project owners.

## Phase 1: foundation (P0)

| Item | Status | Notes |
| --- | --- | --- |
| Versioned schema, migration registry, `Block[]` to v2 migrator | ✅ | `migrateDocument`, `MigrationRegistry`, `documentToBlocks`, validation codes. Only the v1 to v2 step is registered |
| BeakDoc IR with styles, numbering, page setup and fields | ✅ | IR defects 1 to 3 are fixed (see "Fixed in 2.0 alpha") |
| Stable, unique block ids; `PartialBlock` input; inline type registry | ✅ | Block ids are unique and stable. `PartialBlock` input is normalised by `normalizeBlock()`. Extensions register inline types in `CustomInlineContentRegistry`. See [CHANGELOG](../../CHANGELOG.md) |
| Block registry and unified command registry | ✅ | `BlockRegistry` (core), `CommandRegistry` (commands) |
| Permission contracts (typed operations and scopes), client side | ✅ | `classifyTransaction`, policy engine, guard plugin |
| Compatibility release of existing packages, with a deprecation guide | 🟡 | Guide in [`migration-guide.md`](./migration-guide.md). Core's suite (about 290 tests) passes. Not released; deprecation annotations in code still to add |

**Exit (corpus round-trips through IR with no structural loss, existing apps keep working):** 🟡. The first half is
met on the synthetic corpus: all 20 documents round-trip through IR with no structural loss, and no known bugs are
pinned (`tests/conformance/src/roundtrip.test.ts`). The second half is partly met. Both example apps were extended to
2.0 and browser-verified: `examples/next-app` (`app/v2`) and `examples/nuxt-vue` (`components/v2`). No external
application has been run against 2.0.

## Phase 2: native Office experience (P1)

| Item | Status | Notes |
| --- | --- | --- |
| Office shell: ribbon, contextual tabs, rulers, navigation pane, styles gallery, status bar | 🟡 | React and Vue shells (`packages/react/src/office`, `packages/vue/src/office`) provide the ribbon with contextual tabs, rulers, navigation pane, styles gallery, status bar, find and replace, command search and zoom. Unit tests cover find, ruler maths and find-replace labelling. The example apps exercise the shell. No usability test |
| Word keyboard and typing semantics; IME tests | 🟡 | `createWordKeymapPlugin`: Ctrl+Enter inserts a page break followed by a paragraph (`packages/core/src/plugins/wordKeymapPlugin.test.ts`), Ctrl+Shift+V, Ctrl+Alt+1–3, Ctrl+Shift+N, Tab list levels, smart quotes. F4 repeat in the command registry. IME and RTL input tests not written |
| Advanced tables: all P0 rows, plus styles and the gallery | 🟡 | P0 rows mostly present (see architecture table). Tables are random-tested for grid validity and `colwidth` (`tests/conformance/src/tables.test.ts`). No table style gallery |
| Paste fidelity from Word and Excel | 🟡 | `officePaste` on fixtures only |
| Metric-compatible fonts bundled | ❌ | See ADR-0006 |

**Exit (usability test with lab QA officers creating an SOP without training):** ❌. Not run. It needs real users.
The shell exists, but no usability test has been run.

## Phase 3: layout and publishing (P2)

| Item | Status | Notes |
| --- | --- | --- |
| Layout engine: pagination, headers and footers, section breaks, keep rules, row splitting, repeated headers | ✅ | `packages/layout`, 59 tests. Floating objects, multi-column, footnote allocation not laid out |
| Fields, TOC page numbers, captions, cross-references | ✅ | Resolved in layout (`packages/layout/src/fields.ts`) and DOCX. `crossReference` round-trips through the IR (defect 1 fixed). A REF to a missing bookmark is reported as a DOCX loss |
| Print Layout, Draft, Outline, Print Preview views | 🟡 | All four are view modes of the React and Vue shells. Print HTML backs print preview. Draft and Outline have no tests |
| DOCX writer and PDF rendition | 🟡 | DOCX writer (subset, deterministic). Footnotes are dropped with a loss report (`footnote-unsupported`). PDF comes from a browser or from LibreOffice in CI, not from the library |
| Fidelity CI | 🟡 | `tests/conformance/scripts/fidelity.mjs` runs in CI (`.github/workflows/conformance.yml`) and uploads the report. It does not yet fail on drift |

**Exit (page counts match the server rendition across the corpus; exported DOCX opens cleanly in Word):** 🟡.
Page counts match on the synthetic corpus (20 of 20, LibreOffice). DOCX opens in LibreOffice. Word has not been
tested.

## Phase 4: controlled authoring (P3)

| Item | Status | Notes |
| --- | --- | --- |
| `controlledSection`, template authoring mode, locked boilerplate, form controls, validators | 🟡 | Node, lock, form controls and validators exist. Template authoring is an API (`createTemplate`, `addSection`, `publishTemplate`). No authoring UI |
| `sdt` mapping in DOCX | ✅ | `w:sdt` with `w:tag` = section id, re-imported as `IRSdt` |
| Backend enforcement in the QMS service, with per-section rooms | ❌ | The QMS service is outside this repository. `ServerDocumentStore` in conformance is a test double with the same checks |
| Section lifecycle, immutable section revisions, composer, release manifest, signatures bound to hash | ✅ | `templates` package, 27 tests, including the vertical slice |
| Generated parts: revision history, approval page, controlled notices | ✅ | `composeDocument` generated parts |

**Exit (vertical slice):** ✅ at library level. `tests/conformance/src/verticalSlice.test.ts` runs template,
three authors, a comment, a revision compare, approvals, freezing, composition, release with hashes, A4 print
HTML, DOCX export and import, and a malicious client refused by the server store. There is no UI and no real
service behind it. The malicious-client test covers the section and lock rules. Forged signature blocks are covered
separately in `tests/conformance/src/security.test.ts` (defect 9 fixed), not in the vertical slice.

## Phase 5: collaboration and revision fidelity (P4)

| Item | Status | Notes |
| --- | --- | --- |
| Durable track changes, Original, Final and Markup views | ✅ | `review` package (marks, `setReviewView`, `projectBlocks`), 46 tests |
| Comments on stable anchors, review workflow | 🟡 | Anchors and reanchoring in `review`. Section review events in `templates`. No comment UI or review service |
| Revision compare with change bars and summary | 🟡 | `compareRevisions`, `renderRedlineHTML`. Change-bar styling exists in CSS classes, not visually verified |
| Persistent sessions, reconnect, offline conflict policy | ❌ | Core has single-document Y.js. `collaboration.sync` (`provider`, `ydoc`, `fragment`, `seed`) waits for the provider to sync and seeds an empty room once (`packages/core/src/editor/collaborationSeed.ts`, tested). No reconnect policy and no offline conflict tests |
| Composite editor (ADR-3 option B) | ❌ | Not spiked |

**Exit (concurrency, reconnect and restore tests pass; revision history complete and attributable):** ❌.
Restore keeps pending revisions (`restoreSnapshotPreservingRevisions` is tested in `review`). The only concurrency
test is two clients seeding an empty room (`collaborationSeed.test.ts`). There are no concurrent-edit or reconnect
tests.

## Phase 6: advanced components and AI (P5)

| Item | Status | Notes |
| --- | --- | --- |
| DOCX import wizard and `ooxmlPassthrough` blocks | 🟡 | `importDocx` and passthrough extension exist. No wizard |
| Clinical and lab blocks, calculated forms, charts, equations, footnotes, reusable content | 🟡 | Clinical blocks and forms ✅, calculated fields ✅, equations ✅. Charts ❌ (no chart block). Footnotes 🟡: the IR round-trips them (defect 1 fixed), but DOCX export drops them with a loss report. Reusable content: block exists, resolver supplied by the app |
| AI command layer with tracked-change proposals | ✅ | `ai` package, 34 tests. Policy is checked before the provider call and again before dispatch |
| Floating objects, multi-column, watermarks, line numbering | ❌ | Not laid out. Watermark in print HTML only |
| Accessibility hardening | ❌ | Find and replace has labelling tests. No keyboard-only table or screen-reader suite |

**Exit (legacy SOP library migrates with reported losses only; AI proposals respect policy):** 🟡.
AI proposals are tested against policy (`tests/conformance/src/security.test.ts`, AI proposals). No legacy SOP library
has been migrated (none is available). On the synthetic corpus the IR no longer loses data silently (defects 1 to 3
fixed); DOCX export still reports footnote losses.

## Release gates (roadmap section 8)

| Gate | Status | Evidence and gap |
| --- | --- | --- |
| 1. Server-side section permissions proven against malicious clients | 🟡 | Tested with the reference store: forged edits, locked sections, nested bypass, cross-section moves, renaming, protected attributes, uncontrolled text, replay, stale base, tenant isolation, and signature blocks (`security.test.ts`, defect 9 fixed). Gap: the reference store is not the QMS service |
| 2. Revision histories complete and attributable | 🟡 | Revision records carry author and time. No end-to-end audit test |
| 3. Released artifacts immutable, hashes match the manifest | 🟡 | Frozen revisions (`Object.isFrozen`), `createRelease` hashes, `verifyRelease` detects tampering. No storage layer |
| 4. Correct under concurrent editing and reconnects | ❌ | Two-client seeding race tested. No concurrent-edit or reconnect tests |
| 5. PDF publication verified and export repeatable | 🟡 | DOCX export is byte-identical across runs (tested). PDF not produced by the library |
| 6. Backup and restore tested | ❌ | Outside the library |
| 7. Documented, tested schema migration strategy | 🟡 | `migrateDocument` tested on the corpus, idempotent. Only v1 to v2 exists. [ADR-0004](../adr/0004-canonical-format-and-migration.md) |

Test categories (roadmap section 8 table): schema invariants 🟡 (validation codes, structural tests); tables ✅
(random merge, split, insert and delete keep grids and `colwidth` valid over 40 seeded sequences per corpus document
with tables); permissions 🟡 (see gate 1); collaboration ❌; snapshot restore 🟡; pagination 🟡 (repeatable, matches
LibreOffice on the synthetic corpus); import and export 🟡 (structural round trip with no known losses on the corpus;
footnotes not exported); PDF release ❌; accessibility ❌; performance 🟡 (50 and 200 pages in CI, budgets generous,
keystroke budget not measured in a browser).

## Fixed in 2.0 alpha

These defects were found by the conformance suite on the 2.0 alpha. Each is now covered by a normal passing test that
checks the fixed behaviour. The `it.fails` markers are gone.

| # | Defect | Fix | Covering test |
| --- | --- | --- | --- |
| 1 | IR dropped custom inline nodes (`footnote`, `crossReference`, `inlineEquation`, `variable`, `documentIdentifier`, unknown types) | Custom inline nodes map to IR `custom` runs and back, losslessly | `packages/ir/src/lossless.test.ts` ("custom inline nodes", line 25); `tests/conformance/src/roundtrip.test.ts` (all 20 documents) |
| 2 | IR dropped an empty `checkList` | Empty list containers are kept | `packages/ir/src/lossless.test.ts` (line 77) |
| 3 | Lists nested deeper than eight levels produced undefined numbering levels | Numbering is clamped to level 8 with a `list-depth-clamped` warning; the true depth is kept in `source.list.level` | `packages/ir/src/lossless.test.ts` ("list depth", line 112; clamp test line 127) |
| 4 | `setDocument` silently rejected a signed `signatureBlock` and showed an empty paragraph | A rejected load logs a warning and keeps the previous document. Released documents load with `trustedLoad: true` | `tests/conformance/src/editor.test.ts` (line 161) |
| 5 | `sopStep` and `safetyWarning` dropped inline content; an empty step threw `RangeError` in step numbering | Inline content is kept. Empty steps number without throwing | `tests/conformance/src/editor.test.ts` (line 176); `packages/blocks-clinical/src/clinical/stepNumbering.test.ts` (line 25) |
| 6 | Unregistered block types loaded as empty paragraphs, silently | Unregistered block types are kept as `unknownBlock` with a warning | `tests/conformance/src/editor.test.ts` (`pathological-unknown-types`, previously in `KNOWN_EDITOR_BUGS`) |
| 7 | QMS atoms lost `props.id` when it differed from the block id | Atoms store the domain id as `domainId` through `blockPropAliases: { id: 'domainId' }` | `packages/core/src/blocks/blockPropAliases.test.ts` (line 27); `tests/conformance/src/editor.test.ts` (line 199, `acknowledgement` only) |
| 8 | Caption `number` was dropped on load | `number` is a caption node attribute and survives load and save | `tests/conformance/src/editor.test.ts` (line 189) |
| 9 | `verifyDocumentChange` did not protect signature, approval, revision history or controlled notice attributes | These are service-owned node types (`SERVICE_OWNED_BLOCK_TYPES`, which also includes `documentIdentifier`). Only the `system` role may create, change or delete them | `packages/permissions/src/security.test.ts` ("server-side verification: service-owned nodes", line 156); `tests/conformance/src/security.test.ts` (line 415) |
| 10 | LIMS fields were written as plain fallback text and lost their identity | LIMS fields are written as `DOCVARIABLE beak.lims.<name>`, read back as LIMS fields, with the fallback as cached text | `packages/import-docx/src/roundtrip.test.ts` (line 93); `packages/export-docx/src/export.test.ts` (line 435); `tests/conformance/src/docx.test.ts` |
| 11 | Random merge and delete sequences left a cell's `colwidth` shorter than its `colspan` | No reproduction in the seeded sweep. Not exhaustive | `tests/conformance/src/tables.test.ts` (line 223); `packages/core/src/commands/colwidthLength.test.ts` |

## Known defects

None pinned at present.

Each defect found by the conformance suite gets a test marked `it.fails` whose title names the defect. The suite stays
green while the defect exists and turns red when it is fixed. When you fix one, remove the `it.fails` marker and the
entry in `KNOWN_BUGS` or `KNOWN_EDITOR_BUGS`, and move the defect to the table above in the same change. The file names
refer to the package source. Open limitations that are not defects are listed in the phases above and in
[`migration-guide.md`](./migration-guide.md#known-limitations-to-plan-around).

Design notes, not defects: a guarded editor rejects `setDocument` for every principal, including the system role.
Loaders must dispatch the permission bypass meta as the `system` role (the conformance security suite does this).
Documented normalisations (not losses): empty `content` and `children` are absent; DOCX adds empty paragraphs after
tables, at cell and section ends, and in content controls, which OOXML requires; control characters are removed;
bookmark names turn `-` into `_`; editor defaults (`textAlign: 'left'`, `null` and empty attributes, `aiGenerated:
false`) are equivalent to absent. See `tests/conformance/src/support/canonical.ts` and `docxStructure.ts`.

## Outside the library

These items are needed before any controlled-document feature is production-ready, and none of them is in this repository.

- **Beak QMS backend.** Identity, assignments, authoritative authorization, workflow, e-signatures, audit, releases,
  print register and training acknowledgements (roadmap section 9). The reference `ServerDocumentStore` in the
  conformance suite shows the checks the service must make. It is not the service.
- **Real corpus.** 50 to 100 anonymised real SOPs, forms and manuals (roadmap 5K). The 20 synthetic documents stand in
  for them. Fidelity results on real documents may differ, because the synthetic documents are short and mostly plain.
- **Usability test.** Lab QA officers creating an SOP without training (Phase 2 exit).
- **Word validation.** Opening sample DOCX output in Microsoft Word, and checking that it looks right.
- **Browser measurement.** The keystroke budget (16 ms) and the DOM measurer's accuracy against the heuristic, measured in a real browser.
- **Font files.** Bundling and licence review for Carlito, Caladea and the Liberation families (ADR-0006).
- **Release.** Publishing the packages, the migration guide's deprecation annotations in code, and the first 2.0 release notes.
