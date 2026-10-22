# BeakBlock 2.0 status

As of 2026-10-22, branch `feat/beakblock-2.0`, version `2.0.0-alpha`. This is an honest checklist against the
roadmap ([`beakblock-2.0-roadmap.md`](../../beakblock-2.0-roadmap.md) section 6, phases and exits, and section 8,
release gates). Items are ✅ done and tested here, 🟡 partly done, ❌ not started. Each 🟡 says what is missing.
The package-level view is in [`architecture.md`](./architecture.md). The defect list is at the end.

## Evidence in this repository

| Evidence | Result (2026-10-22) |
| --- | --- |
| Package unit suites (`pnpm --filter "./packages/*" run test`) | 723 tests pass across 16 packages. Core: 175 |
| Conformance suites (`pnpm --filter @amusendame/beakblock-conformance test`) | 243 pass. Known defects are asserted with `it.fails` and counted as passing while they exist |
| Typecheck of the conformance package (strict) | Clean |
| Synthetic corpus | 20 documents (`tests/conformance/src/corpus`). Not real SOPs (see "Outside the library") |
| Fidelity proxy (ADR-0002) | 20 of 20 page counts match LibreOffice (see below) |
| Layout performance (heuristic measurer, Node) | 50 pages: 56 laid out pages in about 11 ms. 200 pages: 221 pages in about 54 ms. Relayout from the tail: 1 to 3 ms. Budgets: 3 s and 10 s |

Fidelity (`tests/conformance/reports/fidelity.md`, LibreOffice 26.2.6.3, DOCX export, heuristic layout): every
document's page count matched exactly. The mean absolute drift is 0 pages. This is evidence for short, plain
documents only.

## Phase 0: spikes and decisions

| Item | Status | Notes |
| --- | --- | --- |
| ADR-1/2 renderer and layout-oracle spike (page breaks against browser layout, Paged.js baseline) | 🟡 | LibreOffice used as oracle and matches on the corpus. Paged.js and an external OOXML engine not spiked |
| ADR-3 composite Yjs binding spike | ❌ | Not run. ADR-0003 records stacked editors as the first target |
| ADR-6 font metric parity test (browser against renderer) | ❌ | Font files not bundled; heuristic metrics are approximations |
| Assemble the first 20 corpus documents | 🟡 | 20 synthetic documents built (`tests/conformance/src/corpus`). Real anonymised SOPs still needed |
| Write the ADRs | ✅ | ADR-0001 to ADR-0006, status "Accepted (initial)" |

**Exit (ADRs signed off, fidelity baseline measured):** 🟡. The fidelity baseline is measured (on synthetic
documents). The ADRs are accepted as initial decisions but are not signed off by the project owners.

## Phase 1: foundation (P0)

| Item | Status | Notes |
| --- | --- | --- |
| Versioned schema, migration registry, `Block[]` to v2 migrator | ✅ | `migrateDocument`, `MigrationRegistry`, `documentToBlocks`, validation codes |
| BeakDoc IR with styles, numbering, page setup and fields | ✅ | With the IR defects listed below |
| Block registry and unified command registry | ✅ | `BlockRegistry` (core), `CommandRegistry` (commands) |
| Permission contracts (typed operations and scopes), client side | ✅ | `classifyTransaction`, policy engine, guard plugin |
| Compatibility release of existing packages, with a deprecation guide | 🟡 | Guide in [`migration-guide.md`](./migration-guide.md). Core's 175 tests pass. Not released; deprecation annotations in code still to add |

**Exit (corpus round-trips through IR with no structural loss, existing apps keep working):** ❌ for the first
half. 15 of 20 corpus documents round-trip with no structural loss. Five lose data silently (see defects 1 to 2
below), and one fails IR validation (defect 3). For the second half, core's suite and every other package
suite pass, but no existing application has been run against 2.0.

## Phase 2: native Office experience (P1)

| Item | Status | Notes |
| --- | --- | --- |
| Office shell: ribbon, contextual tabs, rulers, navigation pane, styles gallery, status bar | ❌ | `createDefaultRibbon()` defines the tabs and groups. No UI |
| Word keyboard and typing semantics; IME tests | 🟡 | `createWordKeymapPlugin` (Ctrl+Enter, Ctrl+Shift+V, Ctrl+Alt+1–3, Ctrl+Shift+N, Tab list levels, smart quotes). F4 repeat in the command registry. IME and RTL input tests not written |
| Advanced tables: all P0 rows, plus styles and the gallery | 🟡 | P0 rows mostly present (see architecture table). No ruler, no gallery. Tables are random-tested for grid validity |
| Paste fidelity from Word and Excel | 🟡 | `officePaste` on fixtures only |
| Metric-compatible fonts bundled | ❌ | See ADR-0006 |

**Exit (usability test with lab QA officers creating an SOP without training):** ❌. Not run. It needs a UI and
real users, neither of which exists in this repository.

## Phase 3: layout and publishing (P2)

| Item | Status | Notes |
| --- | --- | --- |
| Layout engine: pagination, headers and footers, section breaks, keep rules, row splitting, repeated headers | ✅ | `packages/layout`, 59 tests. Floating objects, multi-column, footnote allocation not laid out |
| Fields, TOC page numbers, captions, cross-references | 🟡 | Resolved in layout and DOCX. The `crossReference` inline is dropped by the IR (defect 1) |
| Print Layout, Draft, Outline, Print Preview views | 🟡 | Print HTML (print preview) and the pagination plugin (print layout boundaries). Draft and Outline not built |
| DOCX writer and PDF rendition | 🟡 | DOCX writer (subset, deterministic). PDF comes from a browser or from LibreOffice in CI, not from the library |
| Fidelity CI | 🟡 | `tests/conformance/scripts/fidelity.mjs` runs in CI and uploads the report. It does not yet fail on drift |

**Exit (page counts match the server rendition across the corpus; exported DOCX opens cleanly in Word):** 🟡.
Page counts match on the synthetic corpus (20 of 20, LibreOffice). DOCX opens in LibreOffice. Word has not been
tested.

## Phase 4: controlled authoring (P3)

| Item | Status | Notes |
| --- | --- | --- |
| `controlledSection`, template authoring mode, locked boilerplate, form controls, validators | 🟡 | Node, lock, form controls and validators exist. Template authoring is an API (`createTemplate`, `addSection`, `publishTemplate`). No authoring UI |
| `sdt` mapping in DOCX | ✅ | `w:sdt` with `w:tag` = section id, re-imported as `IRSdt` |
| Backend enforcement in the QMS service, with per-section rooms | ❌ | The QMS service is outside this repository. `ServerDocumentStore` in conformance is a test double with the same checks |
| Section lifecycle, immutable section revisions, composer, release manifest, signatures bound to hash | ✅ | `templates` package, 25 tests, including the vertical slice |
| Generated parts: revision history, approval page, controlled notices | ✅ | `composeDocument` generated parts |

**Exit (vertical slice):** ✅ at library level. `tests/conformance/src/verticalSlice.test.ts` runs template,
three authors, a comment, a revision compare, approvals, freezing, composition, release with hashes, A4 print
HTML, DOCX export and import, and a malicious client refused by the server store. There is no UI and no real
service behind it. The malicious-client test covers the section and lock rules. It does not yet cover signature
blocks, because of defect 9.

## Phase 5: collaboration and revision fidelity (P4)

| Item | Status | Notes |
| --- | --- | --- |
| Durable track changes, Original, Final and Markup views | ✅ | `review` package (marks, `setReviewView`, `projectBlocks`), tested |
| Comments on stable anchors, review workflow | 🟡 | Anchors and reanchoring in `review`. Section review events in `templates`. No comment UI or review service |
| Revision compare with change bars and summary | 🟡 | `compareRevisions`, `renderRedlineHTML`. Change-bar styling exists in CSS classes, not visually verified |
| Persistent sessions, reconnect, offline conflict policy | ❌ | Core has single-document Y.js. No reconnect policy, no tests |
| Composite editor (ADR-3 option B) | ❌ | Not spiked |

**Exit (concurrency, reconnect and restore tests pass; revision history complete and attributable):** ❌.
Restore keeps pending revisions (`restoreSnapshotPreservingRevisions` is tested in `review`), but there are no
concurrency or reconnect tests.

## Phase 6: advanced components and AI (P5)

| Item | Status | Notes |
| --- | --- | --- |
| DOCX import wizard and `ooxmlPassthrough` blocks | 🟡 | `importDocx` and passthrough extension exist. No wizard |
| Clinical and lab blocks, calculated forms, charts, equations, footnotes, reusable content | 🟡 | Clinical blocks and forms ✅, calculated fields ✅, equations ✅. Charts ❌. Footnotes 🟡 (defect 1 and DOCX gap). Reusable content: block exists, resolver supplied by the app |
| AI command layer with tracked-change proposals | ✅ | `ai` package, 24 tests. Policy is checked before the provider call and again before dispatch |
| Floating objects, multi-column, watermarks, line numbering | ❌ | Not laid out. Watermark in print HTML only |
| Accessibility hardening | ❌ | No keyboard-only table or screen-reader tests |

**Exit (legacy SOP library migrates with reported losses only; AI proposals respect policy):** 🟡.
AI proposals are tested against policy (`security.test.ts`). No legacy SOP library has been migrated (none is
available), and the IR still loses data silently in five cases.

## Release gates (roadmap section 8)

| Gate | Status | Evidence and gap |
| --- | --- | --- |
| 1. Server-side section permissions proven against malicious clients | 🟡 | Tested with the reference store: forged edits, locked sections, nested bypass, cross-section moves, renaming, protected attributes, uncontrolled text, replay, stale base, tenant isolation. Gap: signature attributes (defect 9) |
| 2. Revision histories complete and attributable | 🟡 | Revision records carry author and time. No end-to-end audit test |
| 3. Released artifacts immutable, hashes match the manifest | 🟡 | Frozen revisions (`Object.isFrozen`), `createRelease` hashes, `verifyRelease` detects tampering. No storage layer |
| 4. Correct under concurrent editing and reconnects | ❌ | Not tested |
| 5. PDF publication verified and export repeatable | 🟡 | DOCX export is byte-identical across runs (tested). PDF not produced by the library |
| 6. Backup and restore tested | ❌ | Outside the library |
| 7. Documented, tested schema migration strategy | 🟡 | `migrateDocument` tested on the corpus, idempotent. Only v1 to v2 exists. [ADR-0004](../adr/0004-canonical-format-and-migration.md) |

Test categories (roadmap section 8 table): schema invariants 🟡 (validation codes, structural tests); tables ✅
(random merge, split, insert and delete keep grids valid, with one known colwidth issue); permissions 🟡 (see
gate 1); collaboration ❌; snapshot restore 🟡; pagination 🟡 (repeatable, matches LibreOffice on the synthetic
corpus); import and export 🟡 (structural round trip, with known losses); PDF release ❌; accessibility ❌;
performance 🟡 (50 and 200 pages in CI, budgets generous, keystroke budget not measured in a browser).

## Known defects

Each defect below has a test that fails while the defect exists. The test is marked `it.fails` and its title names
the defect, so the suite stays green and turns red when the defect is fixed. When you fix one, remove the matching
entry and the `it.fails` marker in the same change. The file names refer to the package source.

| # | Area | Defect | Where |
| --- | --- | --- | --- |
| 1 | IR (`ir`) | Custom inline nodes (`footnote`, `crossReference`, `inlineEquation`, `variable`, `documentIdentifier`, unknown inline types) are dropped silently by `documentToIR`. Affects five corpus documents | `tests/conformance/src/roundtrip.test.ts` (`KNOWN_BUGS`) |
| 2 | IR (`ir`) | An empty `checkList` block (no items) is dropped silently | same |
| 3 | IR (`ir`) | Lists nested deeper than eight levels produce numbering levels 9 and above, which are not defined. OOXML allows nine levels (0 to 8). The IR should clamp and report | same (validation test) |
| 4 | Editor (`core`, `blocks-qms`) | `setDocument` silently rejects the whole transaction if the document contains a signed `signatureBlock`. The editor shows one empty paragraph and returns no error | `tests/conformance/src/editor.test.ts` |
| 5 | Clinical (`blocks-clinical`) | `sopStep` and `safetyWarning` take block children. Inline `content` is dropped on load, and an empty step makes the step-numbering plugin throw `RangeError: Invalid content for node type sopStep` | `editor.test.ts`, `stepNumbering.ts` |
| 6 | Editor (`core`) | Unregistered block types (`hologram`, `telemetry` in the corpus) load as empty paragraphs, and unknown inline nodes are dropped, silently | `editor.test.ts` |
| 7 | QMS (`blocks-qms`) | QMS atoms (`signatureBlock`, `approvalBlock`, `revisionHistory`, `controlledNotice`, `acknowledgement`) lose `props.id` when it differs from the block id. The node's reserved `id` attribute collides with it | `editor.test.ts` (allowances are listed there) |
| 8 | Office (`blocks-office`) | The `caption` definition reads `props.number`, but the node has no `number` attribute, so the number is dropped on load | `editor.test.ts` |
| 9 | Permissions (`permissions`) | `verifyDocumentChange` protects only `controlledSection` attributes. `signatureBlock`, `approvalBlock` and `revisionHistory` attributes can be changed by a principal with `document.editUncontrolled`. This is a release-gate issue (gate 1) | `tests/conformance/src/security.test.ts` |
| 10 | DOCX (`export-docx`, `import-docx`) | LIMS fields are not OOXML fields. They are written as their fallback text and read back as plain text, so the field identity is lost. The IR's `cachedText` is empty for them, while the writer uses the fallback | `tests/conformance/src/docx.test.ts` |
| 11 | Tables (`core`) | Random merge and delete sequences leave a cell's `colwidth` shorter than its `colspan` (TableMap reports `colwidth mismatch`). Grids stay valid. Not yet minimised | `tests/conformance/src/tables.test.ts` |

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
