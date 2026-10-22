# @amusendame/beakblock-export-docx

BeakDoc IR to DOCX writer. OOXML (WordprocessingML) is written by hand and zipped with
[fflate](https://github.com/101arrowz/fflate). There is no document library dependency.

Part of BeakBlock 2.0. See `beakblock-2.0-roadmap.md` (publication pipeline, Appendix A
"Output") and `docs/2.0/contracts.md` section 7.

## API

```ts
import { exportDocx, exportDocxBlob, exportDocxWithReport, irToDocumentXml } from '@amusendame/beakblock-export-docx';

const bytes = await exportDocx(ir);                 // Uint8Array (.docx)
const blob = await exportDocxBlob(ir);              // Blob, type application/vnd.openxmlformats-officedocument.wordprocessingml.document
const { bytes: file, report } = await exportDocxWithReport(ir, { fontMap: {} });
report.losses;                                      // [{ code, message, blockId? }]
const xml = irToDocumentXml(ir);                    // word/document.xml as a string (tests, debugging)
```

| Export | Signature |
|---|---|
| `exportDocx` | `(ir: IRDocument, options?: ExportDocxOptions) => Promise<Uint8Array>` |
| `exportDocxBlob` | `(ir, options?) => Promise<Blob>` |
| `exportDocxWithReport` | `(ir, options?) => Promise<{ bytes: Uint8Array; report: ExportReport }>` |
| `irToDocumentXml` | `(ir, options?) => string` |
| `DOCX_MIME`, `DEFAULT_FONT_MAP` | constants |

`ExportDocxOptions`:

| Option | Default | Meaning |
|---|---|---|
| `fontMap` | `DEFAULT_FONT_MAP` | Font name replacements, merged over the defaults. Pass `{}` to keep bundled names. |
| `created` | `1970-01-01T00:00:00Z` | `dcterms:created` and `modified`. The fixed default keeps output byte-identical. |

`DEFAULT_FONT_MAP`: `Carlito → Calibri`, `Caladea → Cambria`, `Liberation Sans → Arial`,
`Liberation Serif → Times New Roman`, `Liberation Mono → Courier New`.

## Package contents

| Part | Notes |
|---|---|
| `[Content_Types].xml`, `_rels/.rels` | Standard content types and root relationships |
| `docProps/core.xml`, `app.xml`, `custom.xml` | Title and owner. `docNumber`, `revision`, `effectiveDate`, `owner`, `lab` are always present as custom properties, so DOCPROPERTY fields resolve |
| `word/document.xml` | Body, sections, `w:sdt` content controls |
| `word/styles.xml` | Doc defaults, paragraph, character and table styles with `basedOn` |
| `word/numbering.xml` | Abstract definitions and numbering instances |
| `word/settings.xml` | `updateFields` on so TOC and fields refresh when opened; `trackRevisions` off; even and odd headers when used |
| `word/fontTable.xml` | Fonts used by the document |
| `word/header*.xml`, `word/footer*.xml` | Default, first and even variants per section, each with its own rels |
| `word/media/*` | Embedded `data:` images (PNG, JPEG, GIF) |

## Supported subset

| IR feature | DOCX output |
|---|---|
| Paragraph styles (`styleId`), `basedOn`, `next`, outline level | `w:pStyle`, `w:basedOn`, `w:next`, `w:outlineLvl` |
| Spacing (pt to twips), line rules, indents, alignment | `w:spacing`, `w:ind`, `w:jc` (`justify` to `both`) |
| `keepNext`, `keepLines`, `widowControl`, `pageBreakBefore` | Same-named elements; `false` writes `w:val="0"` to override inheritance |
| Tab stops with leaders | `w:tabs` |
| Lists (`numbering`) | `w:numPr` with `w:ilvl` and `w:numId`; bullets, decimal, letters, roman, checkboxes |
| Runs: bold, italic, underline, strike, sub and superscript, colour, size, font | `w:b`, `w:i`, `w:u`, `w:strike`, `w:vertAlign`, `w:color`, `w:sz`, `w:rFonts` |
| Highlight | Named colours to `w:highlight`; other colours to `w:shd` |
| Run shading, character style | `w:shd`, `w:rStyle` |
| Hyperlinks | `w:hyperlink` with an external relationship; `#anchor` links use `w:anchor` |
| Line, page and column breaks | `w:br` |
| Fields: `PAGE`, `NUMPAGES`, `DOCPROPERTY`, `SEQ`, `REF`, `DATE`, `TOC`, LIMS | Complex fields (`fldChar`, `instrText`, cached result). `REF` targets get bookmarks on the matching paragraph |
| Tracked insert and delete | `w:ins` and `w:del` with `w:delText`, author and date |
| Tables: grid, width mode (auto, fixed, pct), look, row header, cantSplit, row height | `w:tbl`, `w:tblGrid`, `w:tblW`, `w:tblLook`, `w:tblHeader`, `w:cantSplit`, `w:trHeight` |
| Cells: span, vertical merge, per-edge borders, shading, vertical alignment, width | `w:gridSpan`, `w:vMerge`, `w:tcBorders`, `w:shd`, `w:vAlign`, `w:tcW` |
| Nested blocks in cells | Each cell ends with a paragraph, as OOXML requires |
| Controlled sections (`sdt`) | `w:sdt` with `w:tag` (section id), `w:alias`, numeric `w:id`, `w:lock` |
| Sections: size, orientation, margins, columns, title page | One `w:sectPr` per section, landscape via `w:orient` |
| Headers and footers (default, first, even) | Separate parts with `headerReference` and `footerReference` |
| Images (`data:` URIs) | Inline `wp:inline` drawings, EMU sizes; intrinsic aspect ratio when only one dimension is given |
| Passthrough XML | Written verbatim after a well-formedness and namespace-prefix check |

Text is XML-escaped, and control characters are removed. Output is deterministic: fixed zip
timestamps, sequential ids, and no wall-clock time.

## Known losses

Each loss is returned in `report.losses` with a `code` and, where known, the `blockId`.

| Code | Cause | Result |
|---|---|---|
| `image-remote` | Image `src` is an http(s) URL | Image omitted (only `data:` URIs are embedded) |
| `image-invalid` | `data:` URI cannot be decoded | Image omitted |
| `image-unsupported` | Type other than PNG, JPEG or GIF (for example SVG or WebP) | Image omitted |
| `passthrough-invalid` | Passthrough XML is not well formed or uses an undeclared prefix | Placeholder paragraph with the block preview |
| `footnote-unsupported` | `footnoteRef` (no footnotes part yet) | Reference dropped |
| `field-target-missing` | `REF` target has no paragraph with that id | Field written; Word shows an error after an update |
| `unknown-numbering` | Paragraph uses an undefined numbering instance | Paragraph written without numbering |
| `empty-table` | Table has no rows | Table omitted |

Other gaps:

- Heading numbering is not linked to heading styles (`NumberingLevel.paraStyleId`). Paragraphs carry their own `numPr`.
- Cell margins (`w:tcMar`) are not written; the IR does not carry them.
- Bookmark names are sanitised (for example `h-purpose` becomes `h_purpose`), and `REF` instructions are rewritten to match.
- Document-level DOCPROPERTY values are written as custom properties. Word refreshes them when fields update.

## Tests

```bash
pnpm --filter @amusendame/beakblock-export-docx build
pnpm --filter @amusendame/beakblock-export-docx test
```

The tests use the rich SOP fixture from `@amusendame/beakblock-schema`. The schema is not a
dependency of this package, so `vitest.config.ts` aliases it to the workspace source.

## Sample document

```bash
node packages/export-docx/scripts/write-sample.mjs [outputPath]
```

Writes `sample-sop.docx` (default: the OS temp directory) from the rich fixture so it can be
opened in Word or LibreOffice. Run the package build first. The script imports the built
export and the sibling schema build.
