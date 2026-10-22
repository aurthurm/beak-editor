# @amusendame/beakblock-layout

Layout tree, pagination and field resolution from BeakDoc IR. Print HTML rendering and a
ProseMirror plugin for the editor's Print Layout view.

Part of BeakBlock 2.0 — see `beakblock-2.0-roadmap.md` (section 5E, ADR-1, ADR-2, ADR-5, ADR-6)
and `docs/2.0/contracts.md` (section 7).

## Position on layout authority (ADR-2)

Browser layout is used for interactive editing: the Print Layout view measures the DOM and
draws page boundaries. The server rendition (PDF or DOCX rendered by the server) is the
authoritative artifact. This package produces the layout that drives print HTML and the
editor's page boundaries; CI should compare its page count against the server rendition and
fail on drift.

## API

```ts
import {
  layoutDocument, relayout,
  createHeuristicMeasurer, createDomMeasurer,
  renderPrintHTML, renderPrintToWindow,
  createPaginationPlugin, paginationPluginKey, computePageBreaks,
} from '@amusendame/beakblock-layout';

const layout = layoutDocument(ir, { measurer: createHeuristicMeasurer(), now: new Date() });
layout.pageCount;          // number of pages
layout.pages[0].body;      // LayoutFragment[] (paragraph, tableRows, image, sdtStart, sdtEnd, passthrough)
layout.fieldValues;        // { 's0/3:1': '2', ... } keyed by `${path}:${inlineIndex}`
layout.toc;                // Heading1-3 entries with page numbers

// After an edit that starts at IR block `fromBlockIndex`:
const next = relayout(layout, irAfterEdit, fromBlockIndex);

const html = renderPrintHTML(ir, layout, { watermark: 'DRAFT', controlledCopy: { copyNumber: 3, issuedTo: 'Lab A' } });
renderPrintToWindow(html); // browser only; returns false without a document
```

### Layout tree

- `LayoutResult` — `pages`, `pageCount`, `fieldValues`, `toc`, `sections` (first page and
  page count per section), `resumePoints` (pagination state at each page start, used by relayout).
- `LayoutPage` — `index` (0-based), `number` (1-based display), `sectionId`, `sizePt`,
  `marginsPt`, `header`, `footer`, `body`, `footnotes`, `variant` (`first` | `even` |
  `default`), plus `headerText` and `footerText` (resolved per page).
- `LayoutFragment` — `kind`, `blockIndex`, `path`, `yPt`, `heightPt`, `lines`, `lineRange`,
  `rowRange`, `repeatedHeaderRows`, `continued`, `continues`.

`blockIndex` is the ordinal of the IR leaf block (paragraph, table, image, passthrough) in
document order; controlled-section children count. `path` is the IR path: `s0/3` is section 0,
body block 3; `s0/3/1` is child 1 of an sdt; `s0/3/r2c0.1` is block 1 in row 2, cell 0.

### Measurers

`Measurer` has two methods: `measureText(text, run, sizePt)` and
`lineHeightPt(sizePt, spacing?, font?)`.

- `createHeuristicMeasurer()` is deterministic and DOM-free. It uses per-character advance
  tables derived from Helvetica/Arial metrics (sans) and Times metrics (serif), scaled to
  approximate Carlito (about 0.9 of Arial) and Caladea (about 1.05 of Times). Bold widens by
  about 4-7%. Monospace uses 600/1000 em. These are approximations, not the font programs'
  exact metrics; they are documented here and in `measure.ts`.
- `createDomMeasurer(doc?)` uses canvas `measureText` when a canvas context exists and falls
  back to the heuristic otherwise (Node, jsdom).

Line heights: `auto` is a multiplier (`line: 1.15`, as the IR stores it). Values above 10 with
`auto` are read as OOXML 240ths. `exact` is points. `atLeast` is `max(line, natural height)`.

### Pagination rules

- Greedy line breaking at spaces; a word wider than the line is broken by character; `\n`
  and line-break runs force a line.
- Paragraph spacing before is dropped at the top of a page; spacing after applies to the last part.
- Keep-with-next: a paragraph moves when it and the first lines of the next content do not fit
  (chains are followed up to 8 deep). Keep-lines: the paragraph never splits.
- Widow and orphan control (on unless `widowControl` is false): at least two lines on each side.
- `pageBreakBefore` and page-break runs start a new page. Page-break runs split the paragraph.
- Sections: each section starts a new page with its own page setup. Empty sections still get a page.
- Tables: split only at row boundaries. `cantSplit` rows never split. Header rows (`isHeader`)
  repeat at the top of each continuation page.
- Header and footer per page: `titlePage` gives the first page of a section the `first` set;
  even pages use `even` (falling back to `default`); other pages use `default`. Header height
  pushes the body down; footer height pulls the body end up.

### Fields

Resolved after pagination: `PAGE`, `NUMPAGES`, `SEQ` (counters per identifier in document
order), `REF` (target's SEQ number when it has one, otherwise its plain text), `DOCPROPERTY`
(from `ir.properties`, then `custom`), `DATE` (Word-style `\@` pattern; `now` option), `TOC`
(entries of Heading1-3 paragraphs with their pages, one `text\tpage` line each).

Fields are measured with placeholders (`cachedText`, then `fallback`, then `00`), so pagination
never depends on field values and a single pagination pass is enough. There is no second pass.

### Incremental relayout

`relayout(prev, ir, fromBlockIndex, options)` reuses every page that starts strictly before the
first affected unit, backing up over keep-with-next chains and sdt markers. It re-paginates
from the resume point of the page that contains the change, then resolves fields over the whole
document. It returns a result identical to `layoutDocument(ir)` (tested).

Contract: `ir` may differ from the IR behind `prev` only at or after `fromBlockIndex`. A changed
page setup, header, or footer counts as a change: pass the index of the first block of that section.

### Print HTML

`renderPrintHTML(ir, layout?, options?)` returns a standalone document with one
`<section class="bb-page">` per page, exact point sizes, a named `@page` rule per section, and
`@font-face` hints for Carlito, Caladea and Liberation (with the Office fallbacks). Text is escaped.
Colours, fonts and image sources are validated before they enter a style or attribute (`javascript:`
URLs are dropped; only https and raster data URIs are kept). Options: `title`, `watermark`,
`controlledCopy`.

### Pagination plugin

`createPaginationPlugin({ getLayout?, pageSetup?, pageGapPx?, showHeaders?, measureBlock? })`
measures top-level blocks (`measureBlock` is injectable; the default reads the DOM height),
accumulates heights against the content height of `pageSetup`, and draws a boundary widget
(`Page X of Y`, gap, next page's header) before each block that starts a page. Its transactions
carry metadata only; tests assert that the document object and JSON are unchanged.

## Known gaps

- Floating objects, text wrapping around images, and anchored shapes are not laid out.
- Multi-column sections: `pageSetup.columns` is ignored (one column).
- Footnote allocation is simplified: `footnotes` is always empty; footnote references are
  measured as small atoms.
- Line numbers and watermarks in the layout are not modelled (watermarks are print-only).
- Non-`cantSplit` rows are not split inside the row (rows are atomic).
- Page-number restart per section is not supported (`number` runs through the document).
- `lines[].text` shows field placeholders where a field appears; use `fieldValues` or the print HTML
  for resolved text. Split paragraphs in print HTML are rendered as their line text, so field values in
  split paragraphs appear as placeholders.
- Field values are attributed to the page where the paragraph starts, even when the paragraph later splits.
- Passthrough blocks are a fixed 24pt height with their preview text.
- Header and footer fragments are measured with placeholders, so their heights do not change per page.
- The heuristic metrics are approximations; fidelity against the server rendition is the job of the CI page-count check.

## Performance (heuristic measurer, `src/perf.test.ts`)

Generated document: 1500 top-level blocks (about one table in 25, one Heading1 in 60, 150-190
words per paragraph), 210 pages in this run. Measured in the vitest jsdom environment:

| Operation | Budget | Measured (3 runs, typical) |
|---|---|---|
| Full `layoutDocument` | < 1500 ms | about 100-140 ms |
| `relayout` from the last 5% | < 100 ms | about 8-10 ms |

## Tests

```bash
pnpm --filter @amusendame/beakblock-layout test
```

Suites: `measure.test.ts` (measurers and line rules), `layout.test.ts` (line breaking, keep-with-next,
widow and orphan, page breaks, tables, sections, fields, header variants), `incremental.test.ts`
(relayout equivalence), `print.test.ts` (escaping, page counts, watermark and stamp),
`plugin.test.ts` (plugin non-mutation with injected measurement), `fixtures.test.ts` (the shared rich
SOP fixture), `perf.test.ts`.

`fixtures.test.ts` imports `@amusendame/beakblock-schema` by relative path because this package does
not declare it as a dependency. Declaring it as a devDependency would remove the relative import.
