# BeakBlock 2.0 architecture

Status: **2.0.0-alpha**, as of 2026-10-22. This document describes what exists in the repository. The target
design is in [`beakblock-2.0-roadmap.md`](../../beakblock-2.0-roadmap.md) (section 3 and section 7), and the
binding package contracts are in [`contracts.md`](./contracts.md). Where the two differ, this file says so.
Decisions are recorded in [`docs/adr/`](../adr/). Progress is in [`status.md`](./status.md).

## Package map

Test counts are the suites on this branch (`pnpm --filter "./packages/*" run test`, 2026-10-22).

| Roadmap package (section 7) | In repository | Status | What exists | Tests |
| --- | --- | --- | --- | --- |
| `core` | `packages/core` | ✅ | ProseMirror kernel: editor, schema, blocks, plugins, markdown, comments, versioning, Y.js (single document), office paste, Word keymap, legacy track changes and compliance locks (deprecated) | 175 |
| `schema` | `packages/schema` | ✅ | `BeakDocument` v2, sections, style sheet, numbering, page setup, units, migrations, structural validation | 33 |
| `ir` | `packages/ir` (+ `python/beakdoc_ir`) | ✅ | BeakDoc IR, `documentToIR`, `irToDocument`, `validateIR`, Python twin package | 40 |
| `commands` | `packages/commands` | 🟡 | Command registry, 31 built-in ids, keymap normalisation, ribbon definition. No ribbon UI | 36 |
| `blocks-basic` | not a package | 🟡 | Text, list and layout blocks live in `core` | (core) |
| `blocks-office` | `packages/blocks-office` | ✅ | Equation, caption, text box, shape, variable, conditional, repeating section, computed value, reusable content, footnote, endnote, cross-reference | 35 |
| `blocks-clinical` | `packages/blocks-clinical` | ✅ | SOP step, safety warning, reagent table, test-method spec, specimen requirements, QC criteria, equipment reference, form controls | 63 |
| `blocks-qms` | `packages/blocks-qms` | ✅ | `controlledSection`, signature, approval, revision history, controlled notice, acknowledgement, document identifier | 44 |
| `permissions` | `packages/permissions` | ✅ | Typed operations, scopes, policy engine, client guard, `verifyDocumentChange` (server) | 36 |
| `templates` | `packages/templates` | ✅ | Templates, instantiation, validation, section and document lifecycles, composer, release manifests, controlled print stamp, mapping | 25 |
| `layout` | `packages/layout` | ✅ | Layout tree, pagination, headers and footers per page, fields, incremental relayout, print HTML, pagination plugin | 59 |
| `render-dom` | not a package | 🟡 | Page boundaries are widget decorations in the pagination plugin (`layout`) | (layout) |
| `render-print` | not a package | 🟡 | `renderPrintHTML` in `layout`. No PDF writer | (layout) |
| `export-docx` | `packages/export-docx` | ✅ | DOCX writer (subset), deterministic, loss report | 25 |
| `export-pdf` | not a package | ❌ | No PDF output inside the library. LibreOffice is used only in the CI fidelity script | — |
| `import-docx` | `packages/import-docx` | ✅ | DOCX reader to IR, passthrough blocks, loss codes, heading detection | 27 |
| `collaboration` | not a package | 🟡 | Y.js single-document binding in `core`. No per-section rooms and no service | (core) |
| `review` | `packages/review` | ✅ | Durable track changes, review operations, comment threads and anchors, compare, views, snapshot restore | 37 |
| `ai` | `packages/ai` | ✅ | AI command layer. Every output is a tracked proposal, policy checked twice | 24 |
| `ui` | not a package | ❌ | No design system, ribbon, navigation pane or rulers | — |
| `react` | `packages/react` | ✅ | Existing React bindings (0.1.x) | 18 |
| `vue` | `packages/vue` | ✅ | Existing Vue bindings (0.1.x) | 46 |
| `apps/` | `examples/` (0.1.x apps) | ❌ | No 2.0 playground, office demo or QMS demo | — |
| `services/collaboration` | not a package | ❌ | No authenticated sync service | — |
| `tests/` | `tests/conformance` | ✅ | Synthetic corpus, round trip, editor, DOCX, security, tables, layout, fidelity script, vertical slice | 243 |

Lab-specific rules are in the extension packages (`blocks-clinical`, `blocks-qms`), not in the kernel, as the
roadmap requires. Core imports nothing from them.

## Data flow

```
                       ┌───────────────────── client (untrusted) ─────────────────────┐
  user input ──► core editor (ProseMirror) ──► permission guard (UX only, classify + decide)
                       │
                       │ getDocument()                                  submit Block[] + base hash
                       ▼                                                        │
                  Block[] (v1 JSON, runtime format)                             ▼
                       │  migrateDocument                          ┌──── server (authority) ────┐
                       ▼                                           │ stored blocks + grants      │
                  BeakDocument v2 (schema)                         │ verifyDocumentChange(...)   │
                       │  documentToIR                             │ base hash, replay, tenant   │
                       ▼                                           └─────────────┬───────────────┘
                  BeakDoc IR (ir)                                                  │ accept → store
                  ├──► layoutDocument ──► LayoutResult ──► renderPrintHTML  ──► print / PDF by browser
                  │                         └──► pagination plugin (editor page boundaries)
                  ├──► exportDocx ──► .docx ──► importDocx ──► IR + loss report
                  └──► validateIR, validateDocumentStructure

  Controlled release (templates):
  TemplateDefinition ─ instantiateDocument ─► document ─ validateAgainstTemplate
     ─ section lifecycles (submit / review / approve) ─ freezeSectionRevision (immutable)
     ─ composeDocument (generated parts, numbering) ─► createRelease (sha256 hashes)
     ─ bindSignature (to document hash) ─ attachRendition ─ verifyRelease (tamper detection)
```

Key rules that follow from the design:

- The IR is the only input to layout, DOCX and print. Editor JSON is never exported directly.
- Layout never mutates the document. The pagination plugin only adds widget decorations.
- Authorisation is decided on the server from the stored state. The client guard only rejects early.
- Pixels appear only in the editor's CSS and in print measurement. Everything stored is points and twips (ADR-0005).
- Extension packages add nodes and block definitions through `BeakExtension`. Core does not depend on them.

## Parity checklist status (roadmap Appendix A)

Legend: ✅ done and tested in this repository; 🟡 partly done (the notes say what is missing); ❌ not started.
"Editor" means the core editing surface, and "library" means a package API without UI.

**Text and styles**

| Item | Status | Notes |
| --- | --- | --- |
| Named paragraph and character styles with inheritance | 🟡 | Paragraph styles with `basedOn` in schema, IR and DOCX (`resolveParagraphStyle`). One character style (`Code`). The editor stores `styleId` but does not apply style inheritance |
| Styles gallery and pane | ❌ | Ribbon definition has a `gallery` item kind only |
| Direct formatting: font, size, bold, italic, underline, strike, sub/superscript, colour, highlight | 🟡 | Editor marks: bold, italic, underline, strikethrough, code, text colour, background colour, font size. Subscript and superscript exist in schema, IR and DOCX but have no editor mark. No font-family mark. Highlight is stored as background colour |
| Spacing, line rules, indents, tab stops with leaders, alignment | 🟡 | Spacing, indents, alignment and tabs are in schema, IR and DOCX. Layout ignores tab stops and leaders, and the editor does not draw them |
| Keep with next, keep lines, widow and orphan, page break before | ✅ | Applied by layout (print and page boundaries) and written to DOCX. Not yet a visible editor rule |

**Lists and numbering**

| Item | Status | Notes |
| --- | --- | --- |
| Bullets, numbered and multilevel lists, restart and continue | 🟡 | Numbering definitions in schema, IR and DOCX (`numbering.xml`). Restart is read from DOCX `startOverride`. Editor list commands are the 0.1.x ones |
| Heading numbering continuous across sections | 🟡 | Composer numbers headings through paragraph numbering. DOCX heading numbering is not linked to heading styles (documented export gap) |

**Tables** (roadmap section 5D, P0 and P1 rows)

| Item | Status | Notes |
| --- | --- | --- |
| P0: insert and delete rows and columns, cell-range selection | ✅ | Core table commands on `prosemirror-tables`; random sequences keep grids valid (`tables.test.ts`) |
| P0: merge and split with rowspan and colspan | ✅ | Grids stay valid. See the colwidth known issue in `status.md` |
| P0: column widths in twips with ruler and drag resize; fixed, auto or % width | 🟡 | Width modes and `setTableWidth` / `setColumnWidthTwips` exist. Widths are stored as pixel `colwidth` in the editor. No ruler UI |
| P0: cell borders per edge, shading, padding, vertical and horizontal alignment | ✅ | Core commands (`setCellBorders`, `setCellShading`, `setCellPadding`, `setCellVerticalAlign`, `setCellHorizontalAlign`) and IR and DOCX output |
| P0: paragraphs and lists inside cells | ✅ | Cells hold block content; IR and DOCX round trip (complex-tables corpus document) |
| P0: paste from Word and Excel (`mso-` HTML) | 🟡 | `officePaste` normalises Office HTML (widths, shading, merges). Tested on fixtures only, not on real Word or Excel output |
| P0: Tab, Shift-Tab and arrow navigation; Tab in last cell adds a row | ✅ | `goToNextCell`, `goToPreviousCell`, and `addRowOnTab` in the table plugin |
| P1: table styles with conditional parts, style gallery | 🟡 | `TableStyle` with conditional parts in schema and DOCX. No gallery |
| P1: repeat header row across pages; row splitting; keep with caption | ✅ | Layout repeats header rows and honours `cantSplit`. Keep-with-caption is not a separate rule |
| P1: captions and SEQ numbering | ✅ | `caption` block and `SEQ` field in layout and DOCX |
| P1: sort, formulas, distribute columns | 🟡 | Sort and distribute exist. No formulas |
| P1: typed cells (number with units, date, LIMS select) | ❌ | Typed form controls exist in `blocks-clinical` (form fields), not as table cell types |
| P2: conditional formatting | ❌ | |
| P2: nested tables | 🟡 | Tables inside cells are editable, round trip through IR and DOCX. Read-only mode is not separate |
| P2: required columns, protected rows, cell-level permissions | 🟡 | Required columns for reagent tables are validated. Permissions have `table.editStructure` and `table.editMandatoryColumns`. Protected rows are not implemented |

**Pages**

| Item | Status | Notes |
| --- | --- | --- |
| Size, orientation, margins and section breaks | ✅ | Schema, IR, DOCX (one `sectPr` per section), layout (per-section page setup), editor `sectionBreak` |
| Headers and footers: first page, odd and even | 🟡 | IR, DOCX and layout support default, first and even. No editor UI for headers; templates generate them |
| Page numbers, watermark | 🟡 | `PAGE` and `NUMPAGES` in layout and DOCX. Watermark only in print HTML, not in DOCX |

**References**

| Item | Status | Notes |
| --- | --- | --- |
| TOC, captions, SEQ, cross-references | 🟡 | TOC, SEQ and REF resolve in layout and DOCX. The `crossReference` inline is dropped by `documentToIR` (known bug) |
| Footnotes | 🟡 | Footnote inline and block in `blocks-office`. DOCX drops the reference (`footnote-unsupported`), the IR drops the inline, and layout has no footnote area |

**Review**

| Item | Status | Notes |
| --- | --- | --- |
| Comments, track changes, compare, accept and reject | 🟡 | All in the `review` library (durable marks, comment threads, `compareRevisions`, `acceptRevision`). No review UI. Legacy track changes in core are deprecated |

**Fields**

| Item | Status | Notes |
| --- | --- | --- |
| Document number, revision, effective date, page X of Y, owner | ✅ | `DOCPROPERTY` from document properties in layout; written as custom properties in DOCX; `PAGE` and `NUMPAGES` resolve |

**Output**

| Item | Status | Notes |
| --- | --- | --- |
| DOCX export that opens cleanly in Word | 🟡 | Deterministic and tested. LibreOffice opens the files used in the fidelity report. Not yet validated in Microsoft Word |
| PDF rendition | 🟡 | Print HTML is produced. The PDF is made by a browser or, in CI only, by LibreOffice. No PDF writer in the library |
| Print with controlled-copy notice | ✅ | `renderPrintHTML` with `controlledCopy`, and the controlled print stamp in `templates` |

**Input**

| Item | Status | Notes |
| --- | --- | --- |
| Paste from Word and Excel | 🟡 | See the tables section |
| DOCX import with passthrough | ✅ | `importDocx` returns IR and losses. Unsupported parts become `ooxmlPassthrough` blocks (`ooxmlPassthroughExtension`) |

## Honest reading of the table

The library layer is in place for most rows: styles, layout, DOCX, review, controlled sections, templates
and AI. The gaps are mostly user interface (ribbon, galleries, rulers, navigation, header editing), and
output validation (Word, PDF, real Office paste). Two items need engineering work before they can be called
done: the subscript and superscript editor mark, and the tab-stop layout.
