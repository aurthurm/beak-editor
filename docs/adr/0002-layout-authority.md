# ADR-0002: Layout authority

- **Status:** Accepted (initial)
- **Date:** 2026-10-22
- **Roadmap:** ADR-2, section 4

## Context

Pagination can be computed in the browser (DOM measurement) or on the server (a renderer). Browser layout
is needed for interactive editing. The released artifact must not depend on the browser that happened to
edit it. The roadmap requires that CI fails on page-count drift between the two.

## Options

1. Browser DOM measurement is the only layout authority. Simple, but releases depend on the viewer.
2. The server renderer is the only layout authority. Authoritative, but editing needs a round trip for every
   page-boundary change.
3. Split authority: browser layout for editing, and the server rendition authoritative for the released
   artifact, with drift reported between the two.

## Decision

Option 3. The implementation has three parts:

- `@amusendame/beakblock-layout` computes pages from the IR with a deterministic heuristic measurer
  (`createHeuristicMeasurer`, metrics approximating Carlito, Caladea and Liberation). The same engine
  drives `renderPrintHTML` and the pagination plugin for the editor. It never mutates the document.
- `createDomMeasurer` uses canvas `measureText` when a canvas exists and falls back to the heuristic
  otherwise. It is the browser-side measurer for editing.
- The server rendition for the fidelity proxy is LibreOffice's rendering of the DOCX export.
  `tests/conformance/scripts/fidelity.mjs` writes `reports/fidelity.md` and `reports/fidelity.json`.

**Measured baseline (2026-10-22, synthetic corpus of 20 documents, LibreOffice 26.2, heuristic measurer):**
the page count matched exactly for 20 of 20 documents, with a mean absolute drift of 0 pages. The 50-page
generated SOP laid out to 56 pages in both measures. This is evidence for the proxy on short, plain
documents. It is not evidence for real SOPs, which use more tables, fonts and spacing than the corpus.

The CI step runs the fidelity script and uploads the report. It does not yet fail the build on drift.

## Consequences

- Editing never waits on the server. The cost is that the browser estimate can differ from the released
  artifact until the drift gate is enforced.
- `relayout(prev, ir, fromBlockIndex)` gives the same result as a full `layoutDocument` (tested on every
  corpus document), so incremental pagination is safe to use while typing.
- Performance on synthetic documents is well inside the budgets (50 pages about 11 ms, 200 pages about
  54 ms for a full layout, heuristic measurer, Node; `tests/conformance/reports/perf.json`). These numbers
  are not browser keystroke budgets.
- Floating objects, multi-column, footnote allocation and per-section page numbering are not laid out.
  Page counts for documents that use them will drift.

## Follow-ups

- Add the drift gate in CI: fail on page-count mismatch, with an explicit allow-list for known drift.
- Add a per-page visual comparison (SSIM) between the editor's print layout and the server rendition.
- Replace the synthetic corpus with anonymised real SOPs (roadmap section 5K). The current evidence is
  based on synthetic documents only.
- Measure the browser DOM measurer against the heuristic on the same corpus.
- Extend the layout tree with floating objects, multi-column and footnote allocation before those features
  are advertised.

## References

- `packages/layout/README.md` (Position on layout authority, Pagination rules, Known gaps)
- `tests/conformance/reports/fidelity.md`
