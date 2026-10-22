# @amusendame/beakblock-import-docx

DOCX (OOXML) to BeakDoc IR importer. The package unzips the file with `fflate` and parses the
WordprocessingML parts by hand. Unsupported Word content is preserved as `ooxmlPassthrough`
blocks, so nothing is dropped silently, and every loss is reported.

Part of BeakBlock 2.0 — see `beakblock-2.0-roadmap.md` (section 5H, Phase 6) and
`docs/2.0/contracts.md` (§6 IR, §7 `import-docx`).

## API

```ts
import {
  importDocx,
  importDocxToDocument,
  ooxmlPassthroughExtension,
  detectHeadings,
  SOP_SECTION_SYNONYMS,
  LOSS_CODES,
} from '@amusendame/beakblock-import-docx';

// IR plus losses
const { ir, losses } = await importDocx(bytes, { domParser, keepPassthrough: true });

// Schema v2 document (passthrough blocks become `ooxmlPassthrough` blocks)
const { document, ir: ir2, losses: l2 } = await importDocxToDocument(bytes);

// Editor extension: registers the `ooxmlPassthrough` block, node spec and preview node view
const editor = new BeakBlockEditor({ mode: 'office', extensions: [ooxmlPassthroughExtension()] });

// Legacy SOP migration: heading candidates for a human to confirm
const candidates = detectHeadings(ir).filter((c) => c.confidence >= 0.8);
```

- `importDocx(bytes: Uint8Array | ArrayBuffer, options?)` → `Promise<{ ir: IRDocument; losses: LossReport[] }>`.
  - `options.domParser` — a `DOMParser`-like object. Defaults to the global `DOMParser` (browsers and jsdom).
    In Node without a DOM, pass one in.
  - `options.keepPassthrough` — default `true`. When `false`, passthrough blocks are removed from the IR.
    Their losses are still reported.
  - Throws only when the input is not a zip archive, has no `word/document.xml`, or the document part is not well-formed XML.
- `importDocxToDocument(bytes, options?)` → `{ document, ir, losses }`, where `document` is `irToDocument(ir)`.
- `LossReport` — `{ code: LossCode; severity: 'info' | 'warning' | 'error'; message: string; location?: string }`.
  `location` is the part and position, e.g. `word/document.xml#p:12`.
- `detectHeadings(ir)` → `HeadingCandidate[]` — `{ index, text, level, confidence, reason }`.
  `index` counts top-level blocks across all sections in order (tables count as one block).
  Confidence is 0 to 1; candidates below 0.5 are omitted.
- `SOP_SECTION_SYNONYMS` — canonical SOP section name to lowercase synonyms.
- `ooxmlPassthroughExtension()` — a `BeakExtension` with an `ooxmlPassthrough` atom block
  (attrs `id`, `xml`, `preview`), a read-only preview card, and a `BeakBlockDefinition`
  (`family: 'office'`, `capabilities.editable: false`).

## Supported subset

| Area | Supported |
|---|---|
| Package | zip, `[Content_Types]`-agnostic; relationships for document, header, footer, media, hyperlinks |
| Styles | paragraph, character and table styles; `basedOn`, `next`, `outlineLvl`; table borders, cell margins, conditional first-row/last-row/first-column/band1 shading |
| Numbering | abstract levels (`numFmt`, `lvlText`, `start`, `pStyle`, `ind`, `rPr`), `num` instances, `startOverride`; style-level `numPr` applied to paragraphs |
| Paragraph | `pStyle`, `numPr`, `jc` (left/center/right/both), `spacing` (before/after/line/lineRule), `ind` (left/hanging/firstLine), `keepNext`, `keepLines`, `pageBreakBefore`, `widowControl`, `tabs` |
| Runs | `rStyle`, `rFonts`, `sz`, `b`, `i`, `u`, `strike`, `vertAlign`, `color`, `highlight`, `shd`; `tab`, `br` (line/page/column), `cr`, `sym`, `noBreakHyphen` |
| Hyperlinks | external (via `r:id`) and internal (`w:anchor`) |
| Fields | `fldChar` complex fields and `fldSimple`: `PAGE`, `NUMPAGES`, `DOCPROPERTY`, `SEQ`, `REF`, `DATE`, `TOC`; other types keep their cached text |
| Revisions | `w:ins`, `w:del`, `w:moveTo`, `w:moveFrom` on runs (id, author, date) |
| Tables | `tblGrid`, `tblW`, `tblStyle`, `tblLook`; rows `tblHeader`, `cantSplit`, `trHeight`; cells `gridSpan`, `vMerge`, `tcBorders`, `shd`, `vAlign`, `tcW`; nested blocks |
| Content controls | block-level `sdt` with `tag`, `alias`, `lock` become `IRSdt`; inline `sdt` is flattened |
| Pictures | `wp:inline` and `pic:pic` with `a:blip`; media becomes a `data:` URI with the correct MIME type; size from `wp:extent` |
| Sections | `sectPr` on paragraphs and the body; `pgSz` (incl. landscape), `pgMar`, `cols`, `titlePg`; default, first and even header and footer parts (inherited from the previous section when omitted) |
| Document properties | `docProps/core.xml` (`title`, `revision`); `docProps/custom.xml` (`docNumber`, `revision`, `effectiveDate`, `owner`, `lab`, others in `custom`) |

## Passthrough and losses

These structures become `IRPassthrough` blocks, with the original element serialised as `xml`
(namespace declarations from ancestors are added) and a plain-text `preview`:

| Code | Severity | Meaning |
|---|---|---|
| `smartart-passthrough` | warning | SmartArt diagram (DrawingML `diagram` graphic data) |
| `chart-passthrough` | warning | Chart (DrawingML `chart` graphic data) |
| `drawing-passthrough` | warning | Other DrawingML shape or group |
| `vml-passthrough` | warning | Legacy VML (`w:pict`) |
| `object-passthrough` | warning | Embedded OLE object (`w:object`) |
| `alternate-content` | warning | `mc:AlternateContent`; the `mc:Fallback` text is the preview |
| `math-passthrough` | info | Office Math (`m:oMath`) |
| `unknown-block` | warning | Unrecognised block-level element (for example `w:customXml` with no paragraphs) |
| `image-missing` | warning | Picture references a missing relationship or media part |
| `float-converted` | warning | Floating (`wp:anchor`) picture; kept as an inline image |
| `footnote-ref` | info | Footnote reference kept; footnote body is not imported |
| `endnote-ref` | info | Endnote reference kept; endnote body is not imported |
| `field-unsupported` | info | Field type not modelled; cached result kept as text |
| `field-spans-paragraphs` | info | Field continues into another paragraph; kept as text |
| `numbering-missing` | info | Paragraph uses a numbering instance that is not defined |
| `numfmt-approximated` | info | Unsupported number format approximated as `decimal` |
| `part-parse-error` | error | A header, footer, styles or numbering part is not well-formed XML and was skipped |

`LOSS_CODES` exports the default severity and a description for each code.

## Known gaps and deviations

- Images that share a paragraph with text are emitted as image blocks after that paragraph,
  because core does not model inline images. Paragraph alignment is lost for image-only paragraphs.
- Paragraph and character style inheritance is not flattened: `styleId` is kept, and only style-level
  numbering is copied onto paragraphs.
- Floating pictures become inline images (`float-converted`); anchor position is not kept.
- Strict OOXML namespaces (ISO 29500 strict) are not recognised; transitional is assumed.
- Fields that span paragraphs (for example a TOC) become static text.
- A `w:sdt` without `w:tag` is flattened into its content rather than emitted as `IRSdt`, so plain
  content controls do not turn into controlled sections.
- Footnote and endnote bodies are not imported.

## Scripts

```bash
pnpm --filter @amusendame/beakblock-import-docx build
pnpm --filter @amusendame/beakblock-import-docx test
```

The round-trip test (`src/roundtrip.test.ts`) runs only when `@amusendame/beakblock-export-docx`
resolves from this package; it is skipped otherwise.
