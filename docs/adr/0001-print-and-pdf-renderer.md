# ADR-0001: Print and PDF renderer

- **Status:** Accepted (initial)
- **Date:** 2026-10-22
- **Roadmap:** ADR-1, section 4

## Context

Controlled documents must print and export as Office-quality A4 output, and the released artifact
must be repeatable. Three routes were considered in the roadmap:

- **(a)** Own the document model: a BeakDoc IR, a hand-written DOCX writer, and our own print composer.
- **(b)** Paged.js as the pagination and print baseline.
- **(c)** An external OOXML engine (for example betteroffice, Apache-2.0, with Python and WASM packages)
  used only as a headless renderer or layout oracle, behind the renderer interface.

The roadmap leaning is to own the IR and DOCX writer whichever route is taken, keep the renderer
pluggable, spike (b) and (c), and choose by fidelity rather than convenience. It also rules out embedding
a third-party editor.

## Options

| Option | Strength | Weakness |
| --- | --- | --- |
| (a) Own IR, DOCX writer, print composer | No runtime dependency, deterministic output, full control of the subset | We maintain the pagination model and the OOXML subset |
| (b) Paged.js | Mature print CSS pagination | Pagination in the browser only, no DOCX, output depends on the browser |
| (c) External OOXML engine as renderer | Real Word-style layout | Adds a runtime dependency; only usable as an oracle or a server renderer |

## Decision

Route (a) is the implementation today. The repository owns:

- the IR (`@amusendame/beakblock-ir`, contract section 6) and its Python twin,
- the DOCX writer (`@amusendame/beakblock-export-docx`, written by hand and zipped with fflate),
- the print composer (`renderPrintHTML` in `@amusendame/beakblock-layout`, one `section.bb-page` per page,
  exact point sizes, named `@page` rules).

The renderer is pluggable at the measurement seam (`Measurer`: `createHeuristicMeasurer` and
`createDomMeasurer`). There is no formal PDF renderer interface yet. Route (c) is used only as a
headless oracle: `scripts/fidelity.mjs` converts each exported DOCX with `soffice --headless --convert-to pdf`
and compares page counts (see ADR-0002). Paged.js (b) and the external engine (c) were not spiked, so
they are not selected.

## Consequences

- Output is byte-identical across runs (`exportDocx` uses a fixed `created` timestamp and fixed zip
  timestamps), which the release gate on repeatable export depends on.
- We do not produce a PDF inside the library. The print HTML is printed by a browser or a server
  headless browser. The released PDF therefore depends on that step, which is not yet implemented as a
  service.
- DOCX output is a defined subset. Known losses are reported through `report.losses`. Footnote bodies,
  floating objects, multi-column, and LIMS fields are not written as native Word constructs.
- Word-compatibility is not yet verified. LibreOffice opens the files used in the fidelity report.

## Follow-ups

- Define a `RendererPort` interface (`render(ir, layout, options) → Uint8Array`) so a server renderer can
  be swapped in without touching callers.
- Spike Paged.js (b) against the print HTML and record the fidelity comparison.
- Spike route (c) as a headless oracle on the corpus and record the result in this ADR.
- Validate a sample of DOCX output in Microsoft Word (roadmap Phase 3 exit).
- Decide whether the released PDF is produced by LibreOffice, by a headless browser, or by a licensed
  engine, and record the decision here.

## References

- `packages/export-docx/README.md`, `packages/layout/README.md`
- `tests/conformance/src/docx.test.ts`, `tests/conformance/scripts/fidelity.mjs`
