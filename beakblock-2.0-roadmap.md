# BeakBlock 2.0 — Editor Modernisation Roadmap

> **Repository:** `aurthurm/beak-editor` (`@amusendame/beakblock-*`)
> **Primary consumer:** Beak QMS (controlled documents for Beak LIMS), but kept reusable as a general editor
> **Status:** Draft roadmap. Target structures and APIs below are proposals, not current code.

---

## 0. Vision

Turn BeakBlock into a **headless, block-native, Office-quality document engine**. It should feel familiar to Microsoft Word users, while the content underneath stays structured, semantically meaningful, and governed section by section.

One editor, one document model, three modes:

| Mode | Experience | Typical user |
|---|---|---|
| **Office mode** | Ribbon, rulers, printable pages, styles, rich tables, headers and footers, track changes, Word keyboard behaviour | General authors who expect a word processor |
| **Block mode** | Drag handles, slash commands, nested blocks, callouts, charts, reusable components | Structured authoring, knowledge bases, template design |
| **Controlled mode** | Office look plus enforced templates, section ownership, validation, review and approval gates | Lab SOPs, quality manuals, validation protocols |

These are **projections of the same document**. They share the schema, commands, serialization, history, and extension API. There is never a second document model for Office mode.

**Target.** Full Word parity would take many years. The target is **SOP-grade parity**: everything controlled lab documents actually use (styles, multilevel numbering, real tables, page setup, headers and footers, fields, TOC, captions, track changes, signatures), done to a professional standard.

**Four architectural pillars.** Everything else extends these:

1. Canonical, versioned document schema and IR
2. Office-class tables
3. Section-level governance and permissions
4. Composition and publishing engine

---

## 1. Guiding principles

1. **One canonical document model.** Visual modes are projections, not separate editors.
2. **OOXML-aligned semantics.** Formatting is modelled the way Word models it: points and twips, named styles, numbering definitions, fields, and sections. CSS is only a render target. This alignment is where most of the "native feel" comes from.
3. **Stable identity.** Documents, sections, blocks, tables, rows, cells, figures, fields, and revisions carry stable IDs.
4. **Semantics separate from appearance.** A `procedureStep` stays a procedure step even when it renders as a plain numbered paragraph. Semantic blocks never have to look like cards.
5. **The renderer is replaceable.** Screen editing, print preview, PDF, and DOCX are separate concerns behind a shared layout contract.
6. **Permissions are first-class, and the server is authoritative.** The editor emits policy-aware, typed operations. Client locks are UX only. Y.js awareness and client locks are never treated as authorization.
7. **Modular extensions.** Advanced tables, math, charts, QMS, clinical blocks, and AI are independent packages.
8. **Commands, not buttons.** One command registry drives the ribbon, shortcuts, context menus, slash menu, AI, and the programmatic API.
9. **Evolve, don't rewrite.** Keep ProseMirror and the existing packages. Ship migrations and a compatibility release.

---

## 2. Current state assessment

| Existing capability | Assessment | Action |
|---|---|---|
| ProseMirror kernel, public `editor.pm.*` surface | Strong foundation | Retain |
| JSON `Block[]` model | Good | Version it and map it to the canonical IR |
| React and Vue adapters | Good | Retain both, add an Office shell preset |
| Markdown import and export | Good | Retain |
| Paragraphs, lists, tables, images | Basic | Extend significantly, especially tables |
| Slash and bubble menus | Good for block mode | Keep, and hide them in Office mode |
| Y.js collaboration | Optional peer | Harden: auth, persistence, per-section rooms |
| Comments (anchored, external store) | Good base | Anchor to stable IDs, add review workflow |
| Track changes | Partly decoration-based, documented limits on structural edits | Redesign as durable revision records |
| Versioning adapter | Snapshots | Add immutable section revisions and release manifests |
| Compliance locks | Client-side only, so not a security boundary | Redesign inside a governed permission system |
| AI entry points (presets, modal) | Present | Turn into a typed, policy-aware command layer |
| Nuxt example (approvals, templates, release) | Useful prototype | Becomes the `qms-demo` reference app |

---

## 3. Target architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Editor Shell: Office mode · Block mode · Controlled mode         │
│ React / Vue adapters · Ribbon · Rulers · Panels · Status bar     │
├──────────────────────────────────────────────────────────────────┤
│ Command & Extension Engine                                       │
│ Command registry · Keymaps · Plugins · Selection · History       │
├──────────────────────────────────────────────────────────────────┤
│ Structured Document Kernel                                       │
│ ProseMirror schema · Block registry · Styles & numbering         │
│ Semantic sections · Schema constraints · Permission contracts    │
├──────────────────┬───────────────────┬───────────────────────────┤
│ Layout &         │ Collaboration &   │ Document I/O              │
│ pagination       │ review            │ IR · DOCX · PDF · MD      │
├──────────────────┴───────────────────┴───────────────────────────┤
│ Service contracts (Beak QMS): policy decisions · audit ·         │
│ approval · e-signatures · immutable releases                     │
└──────────────────────────────────────────────────────────────────┘
```

### Publication pipeline

```
BeakBlock document tree (ProseMirror / Block JSON)
        │  validate + resolve sections, reusable content, fields
        ▼
Composition tree (one logical document, pinned section revisions)
        │
        ▼
BeakDoc IR (OOXML-aligned: styles, numbering, sections, fields)
        │
        ├──► Layout engine ──► paginated editing view / print preview
        ├──► DOCX writer (OOXML)
        ├──► PDF (controlled rendition)
        ├──► HTML / Markdown / structured JSON
        ▲
DOCX importer ──┘ (with passthrough preservation)
```

All exporters consume the IR, so no exporter invents its own idea of document structure.

---

## 4. Key decisions (ADRs to settle in Phase 0)

| # | Decision | Options | Leaning |
|---|---|---|---|
| ADR-1 | **Print and PDF renderer** | (a) Native IR → DOCX writer plus our own print composer. (b) Paged.js as a pagination and print baseline. (c) An external OOXML engine (e.g. betteroffice, Apache-2.0, with Python and WASM packages) used only as a headless renderer or layout oracle behind the renderer interface | Own the IR and DOCX writer either way. Keep the renderer pluggable. Spike (b) and (c) and pick by fidelity, not convenience. Never embed a third-party *editor*. |
| ADR-2 | **Layout authority** | Browser DOM measurement vs the server renderer as the source of page breaks | Browser layout for interactive editing. The server-rendered PDF is authoritative for the released artifact. CI fails on page-count drift between the two. |
| ADR-3 | **Collaboration topology** | (A) Stacked editors, one per section in a shared page flow. (B) Composite editor: one view, with each `controlledSection` bound to its own Y.XmlFragment / room | Ship A first. Spike B in parallel and adopt it if cross-section selection, find, and undo prove stable. |
| ADR-4 | **Canonical format and migration** | Keep `Block[]` as the canonical format vs a new versioned document tree | Versioned tree (`schemaVersion`) with a lossless migrator from current `Block[]` |
| ADR-5 | **Units** | px vs pt and twips | pt and twips internally, px only at render time |
| ADR-6 | **Fonts** | System fonts vs bundled metric-compatible fonts | Bundle Carlito, Caladea, and Liberation (metric-compatible with Calibri, Cambria, Arial, and Times), identical on screen and in print |

---

## 5. Workstreams

### A. Canonical schema and BeakDoc IR

- Versioned document tree with `schemaVersion` and a migration registry.
- OOXML-aligned property model:

```ts
type ParaProps = {
  styleId?: string;                         // "Heading2", "Normal", "Caption"
  numbering?: { numId: string; level: number };
  spacing?: { beforePt: number; afterPt: number; line: number;
              lineRule: 'auto' | 'exact' | 'atLeast' };
  indent?: { leftPt: number; hangingPt?: number; firstLinePt?: number };
  align?: 'left' | 'center' | 'right' | 'justify';
  keepNext?: boolean; keepLines?: boolean;
  pageBreakBefore?: boolean; widowControl?: boolean;
  tabs?: { posPt: number; kind: 'left' | 'center' | 'right' | 'decimal';
           leader?: 'dot' | 'none' }[];
};
```

- **Style sheet** per document, inherited from the template: paragraph, character, and table styles, with `basedOn` inheritance.
- **Numbering definitions** (abstract and concrete numbering, multilevel). Heading numbering such as 1 / 1.1 / 1.1.1 continues across sections written by different authors.
- **Page setup and section breaks:** size, orientation, margins, and columns per section, so a landscape appendix can sit inside a portrait SOP.
- **Field nodes** (typed atoms): `PAGE`, `NUMPAGES`, `DOCPROPERTY` (doc no, revision, effective date, owner, lab), `REF`, `SEQ`, plus LIMS-bound fields (equipment code, test method).
- Shared TypeScript types, with a Python twin for the QMS service.

### B. Block registry

A typed registry where each block declares its schema, capabilities, validation, permissions, renderers, serializers, and migrations:

```ts
interface BeakBlockDefinition {
  type: string;
  version: number;
  schema: NodeSpec;
  capabilities: { editable: boolean; nested: boolean; printable: boolean;
                  splittable: boolean; collaborative: boolean };
  validate?: (node: PMNode, ctx: ValidationContext) => ValidationIssue[];
  permissions?: CapabilityResolver;
  renderHTML: RenderHTML;     // editing view
  renderPrint: RenderPrint;   // layout and print
  toIR: IRSerializer;         // → BeakDoc IR → DOCX and PDF
  fromIR?: IRParser;
  migrate?: BlockMigration[];
}
```

Block families:

| Family | Blocks |
|---|---|
| Text and structure | Paragraph, H1–H6, lists, task lists, blockquote, callout, divider, columns, page and section break |
| Office and layout | Advanced table, image, floating image, text box, caption, chart, equation, footnote, endnote, TOC, cross-reference, shapes |
| Smart content | Metadata field, variable, conditional block, repeating section, computed value, reusable (transcluded) content |
| Clinical and lab | SOP step, safety warning, reagent table, test-method specification, specimen requirements, QC criteria, equipment reference |
| QMS control | Controlled section, approval block, revision history, signature block, document identifier, controlled notice, acknowledgement |
| Forms | Text, number, date, dropdown, checkbox, radio, repeatable row, calculated field, validated form section |

Semantic blocks and layout blocks are different things. `specimenAcceptanceCriteria` *uses* the table renderer but validates its required columns and units. Lab-specific rules live in extension packages, never in the kernel.

### C. Office shell and native typing behaviour

- **Ribbon** built from the command registry: Home, Insert, Layout, References, Review, View, QMS. Contextual tabs appear for Table, Picture, Chart, and Controlled Section.
- **Shell features:** quick-access toolbar, command search, and shortcut hints.
- **Navigation pane:** headings, sections, comments, search results, and page thumbnails.
- **Rulers:** horizontal (indents, tab stops, table column markers) and vertical (margins).
- **Galleries and tools:** styles gallery and styles pane, format painter, find and replace (with regex), zoom, single or multi-page view, page width, focus mode.
- **Status bar:** page X of Y, word count, section owner and state, language, presence.
- **Word-compatible behaviour:**
  - List continuation, and Enter on an empty list item exits the list.
  - Tab and Shift-Tab change list level.
  - Backspace at a paragraph start behaves as in Word.
  - Smart quotes and AutoCorrect.
  - Ctrl+Enter inserts a page break; Ctrl+Shift+V pastes as plain text.
  - Ctrl+Alt+1–3 apply headings, Ctrl+Shift+N applies Normal, F4 repeats the last action.
- **Input and accessibility tests:** IME and composition, RTL text, screen readers, and keyboard-only use.
- Block chrome (drag handles, slash menu) is available in block mode and hidden in Office mode.

### D. Office-class tables (flagship)

Built on `prosemirror-tables` (cell selection, rowspan and colspan, invariants), extended with OOXML table semantics:

| Capability | Priority |
|---|---|
| Insert and delete rows and columns, cell-range selection | P0 |
| Merge and split, rowspan and colspan (including vertical merge) | P0 |
| Column widths in twips with ruler and drag resize; fixed, auto, or % table width | P0 |
| Cell borders per edge, shading, padding, vertical and horizontal alignment | P0 |
| Paragraphs and lists inside cells | P0 |
| Paste from Word and Excel (parse `mso-` HTML: widths, merges, shading) | P0 |
| Tab, Shift-Tab, and arrow navigation; Tab in last cell adds a row | P0 |
| Table styles with conditional parts (header row, banded rows, first column), style gallery | P1 |
| Repeat header row across pages; allow or prevent row splitting; keep-with-caption | P1 |
| Captions and `SEQ` numbering | P1 |
| Sort, formulas, distribute columns | P1 |
| Typed cells (number with units, date, LIMS select) for form-like tables | P1 |
| Conditional formatting | P2 |
| Nested tables (read-only first, then editable within strict limits) | P2 |
| Required columns, protected rows, cell-level permissions | P2 |

Measuring, min and preferred width calculation, overflow, and row fragmentation belong in the **layout engine**, not in UI components.

### E. Layout and pagination

- A dedicated `layout` package produces a layout tree from the IR:

```
Document → Section → Page → { Header, Body(fragments), Footnotes, Footer }
```

- **Incremental pass:**
  1. Measure changed blocks and their line boxes.
  2. Paginate with keep-with-next, keep-lines, widow and orphan control, and page-break-before.
  3. Split tables at row boundaries.
  4. Resolve fields (PAGE, NUMPAGES, TOC page numbers, cross-references, `SEQ`).
- **Rendering in the editor:** widget decorations draw the page boundary (footer, gap, header, margins) and cloned repeated table headers. Layout never mutates the document, so a paragraph or row that crosses pages stays one logical object.
- **View modes:** Print Layout (default for controlled documents), Draft (continuous), Outline (headings only, drag to reorder sections), Print Preview (the real server rendition).
- **Progression:**
  1. Reliable print pagination and PDF.
  2. Paginated editing view reusing the same layout contract.
  3. Complex tables, floating objects, footnote allocation, multi-column, line numbers, watermarks.
- **Performance budget:** under 16 ms per keystroke on a 100-page SOP, with re-layout only from the first changed block onward.

### F. Controlled documents and permissions

- **`controlledSection` node:** stable section ID, `templateSectionId`, `policyRef`, `required`, allowed blocks, and a workflow state reference. Authorization decisions are **not** stored in document JSON.
- **Content controls:** sections map to OOXML `w:sdt` structured document tags, so DOCX exports keep section boundaries and re-imports recognise them.
- **Typed operations:** `insertBlock`, `replaceText`, `moveSection`, `updateTableCell`, `deleteSection`, `changeStyle`, `acceptRevision`. Each has a defined authorization scope. A single drag that crosses several controlled boundaries is checked **atomically**.
- **Fine-grained rights:** edit text but not delete the section, rename its title, change mandatory columns, change approved values, accept changes, or move content out of the section.
- **Template authoring mode:**
  - Slots, locked boilerplate, required blocks, default roles, styles, page masters, and header and footer.
  - Templates are published as versioned objects.
- **Placeholders and form controls:**

| Field | Rule |
|---|---|
| SOP number | Generated, read-only |
| Title | Required, max length |
| Effective date | Set by the approval workflow |
| Concentration or reference range | Numeric with allowed units or limits |
| Equipment | Selected from authorised LIMS equipment |
| Procedure steps | At least one |
| Safety warning | Mandatory for configured procedure types |
| Signature | Written only by the signature service |

- **Validation** runs in the editor as feedback and on the server as the authoritative check.
- **Section lifecycle** (draft → submitted → reviewed → approved → reopened) is independent of the document lifecycle (draft → review → approved → effective → periodic review → superseded or obsolete).
- **Generated parts:** revision history table, approval and signature page, distribution list, and "uncontrolled when printed" or controlled-copy notices.

### G. Composition and publishing

- **Document Composer:**
  - Resolves the template manifest, sections, and reusable content pinned to approved revisions.
  - Resolves numbering, styles, TOC, cross-references, captions, and bibliography.
  - Applies page masters, headers and footers, watermarks, and controlled-copy notices.
  - Works the same way for single-section and multi-section documents.
- **Release:**
  - Every section revision is frozen and a content hash is computed.
  - Signatures are bound to that hash.
  - The PDF is rendered once and stored as the immutable controlled rendition.
  - A release manifest lists exact section revisions.
- **Controlled printing:** stamps a copy number and watermark, and is logged in the print register by the QMS service.

### H. Import and export

- **DOCX writer:** IR to OOXML with real styles, numbering, sections, `sdt` content controls, fields, and `w:ins`/`w:del` tracked changes.
- **DOCX importer:**
  - Converts OOXML to IR to blocks.
  - Unsupported structures (SmartArt, complex floats) become an `ooxmlPassthrough` block holding the original XML slice, shown as a preview and written back untouched.
  - Lossy conversions are reported explicitly.
- **Legacy SOP migration wizard:** import Word SOPs, auto-detect headings, map them to template slots, and confirm with the user.
- **Paste fidelity:** Word, Excel, and Google Docs HTML, normalised into styles rather than inline CSS.
- **Other formats:** Markdown, HTML, and structured JSON stay supported.

### I. Collaboration and review

- **Sync service:**
  - Authenticated sync with room admission and write authority enforced server-side.
  - Persistent Y.js state, reconnect handling, and replay protection.
  - Tenant isolation.
- **Per-section rooms** for sections that need security separation (ADR-3).
- **Track changes redesign:**
  - Durable revision records (insert, delete, replace, move, format) with stable IDs, author, and timestamp.
  - Review status and accept/reject provenance.
  - Original, Final, and Markup views.
  - Overlap conflict handling.
  - Pending changes survive sessions and collaboration.
  - Snapshot restore never silently clears revision history.
- **Comments** anchor to stable section and block IDs plus mapped ranges, with threads, mentions, and resolve and reopen.
- **Revision compare:** block-level redline between released revisions, change bars, and a change summary listing the sections that changed since the last release.

### J. AI command layer

- A provider-agnostic, typed command layer:

```
ai.rewriteSelection      ai.summarizeSection       ai.proposeProcedureSteps
ai.compareRevisions      ai.detectMissingReferences ai.reviewDocumentConsistency
ai.generateTable         ai.explainTechnicalTerm   ai.suggestControlledTemplate
```

- Every AI call goes through the normal command and policy system. A request is rejected if the user can't edit the target.
- Output is **always a proposed tracked change**, attributed and marked as AI-generated, and never auto-applied.
- AI output is not treated as verified clinical guidance. Validation against configured terminology and approved references is advisory.

### K. Engineering quality

- **Conformance corpus:**
  - 50–100 real, anonymised SOPs, forms, and manuals.
  - Complex tables, multilingual text, large documents.
  - Mixed-permission documents.
  - Pathological input.
- **Test types:** unit tests, property-based tests (table invariants, schema normalisation), Playwright editor tests, and visual regression.
- **Fidelity CI:**
  - Compare the editor print layout against the server rendition per page (SSIM).
  - Fail on page-count mismatch.
  - DOCX round-trip structural diff.
- **Security tests:** forged operations, bypassed client locks, stale or replayed Y.js updates, cross-tenant access.
- **Performance budgets:** keystroke latency, layout time, and first render at 50 and 200 pages.
- **Accessibility:** keyboard-only table editing, ARIA roles for pages and controls, and announcements of section ownership.

---

## 6. Phased roadmap

### Phase 0 — Spikes and decisions

Answer the risky questions before building.

- [ ] ADR-1/2 renderer and layout-oracle spike: does the candidate renderer return page breaks and match browser layout? Paged.js baseline comparison.
- [ ] ADR-3 composite Yjs binding spike (one view, per-section fragments)
- [ ] ADR-6 font metric parity test, browser vs renderer
- [ ] Assemble the first 20 corpus documents
- [ ] Write the ADRs

**Exit:** ADRs signed off, and a fidelity baseline measured.

### Phase 1 — Foundation (P0)

- [ ] Versioned schema, migration registry, `Block[]` → v2 migrator
- [ ] BeakDoc IR with styles, numbering, page setup, and fields
- [ ] Block registry and unified command registry
- [ ] Permission contracts (typed operations and scopes) on the client side
- [ ] Compatibility release of existing packages with a deprecation guide

**Exit:** the corpus round-trips through IR with no structural loss, and existing apps keep working.

### Phase 2 — Native Office experience (P1)

- [ ] Office shell: ribbon, contextual tabs, rulers, navigation pane, styles gallery, status bar
- [ ] Word keyboard and typing semantics, IME tests
- [ ] Advanced tables, all P0 rows plus styles and the gallery
- [ ] Paste fidelity from Word and Excel
- [ ] Metric-compatible fonts bundled

**Exit:** a usability test with lab QA officers creating an SOP without training.

### Phase 3 — Layout and publishing (P2)

- [ ] Layout engine: pagination, headers and footers, section breaks, keep rules, table row splitting, repeated headers
- [ ] Fields, TOC page numbers, captions, cross-references
- [ ] Print Layout, Draft, Outline, and Print Preview views
- [ ] DOCX writer and PDF rendition
- [ ] Fidelity CI

**Exit:** page counts match the server rendition across the corpus, and exported DOCX opens cleanly in Word.

### Phase 4 — Controlled authoring (P3)

- [ ] `controlledSection`, template authoring mode, locked boilerplate, form controls, validators
- [ ] `sdt` mapping in DOCX
- [ ] Backend enforcement in the QMS service, with per-section rooms (ADR-3 option A)
- [ ] Section lifecycle, immutable section revisions, Composer, release manifest, signatures bound to hash
- [ ] Generated parts: revision history, approval page, controlled notices

**Exit — the vertical-slice milestone:**

> A Quality Manager creates a controlled template. Three authors are assigned different sections and each edits only their own, including formatted tables. Reviewers comment and request changes, and approved sections become immutable. The final approver releases the document. BeakBlock assembles it, numbers everything, and produces an A4 PDF that looks like a normal Office document, while the source stays fully structured and governed. A malicious-client test fails to alter protected sections.

### Phase 5 — Collaboration and revision fidelity (P4)

- [ ] Durable track changes redesign, Original, Final, and Markup views
- [ ] Comments on stable anchors, review workflow
- [ ] Revision compare with change bars and change summary
- [ ] Persistent sessions, reconnect, offline conflict policy
- [ ] Composite editor (ADR-3 option B), if the spike succeeded

**Exit:** concurrency, reconnect, and restore tests pass, and revision history is complete and attributable.

### Phase 6 — Advanced components and AI (P5)

- [ ] DOCX import wizard and `ooxmlPassthrough` blocks
- [ ] Clinical and lab blocks, calculated forms, charts, equations, footnotes, reusable content
- [ ] AI command layer with tracked-change proposals
- [ ] Floating objects, multi-column, watermarks, line numbering
- [ ] Accessibility hardening

**Exit:** the legacy SOP library migrates with reported losses only, and AI proposals respect policy.

> **Parallel workstream:** the Beak QMS backend (identity, assignments, authoritative authorization, workflow, e-signatures, audit, releases, print register, training acknowledgements) runs alongside Phases 1–5. Controlled features are not production-ready without it.

---

## 7. Target monorepo layout

Extract packages only once their APIs stabilise.

```
beak-editor/
├── packages/
│   ├── core/            # ProseMirror kernel
│   ├── schema/          # canonical schema + migrations
│   ├── ir/              # BeakDoc IR (TS) + Python twin
│   ├── commands/        # unified command registry
│   ├── blocks-basic/    # text, lists, layout blocks
│   ├── blocks-office/   # tables, images, charts, fields, TOC
│   ├── blocks-clinical/ # lab semantic blocks
│   ├── blocks-qms/      # controlled sections, signatures, notices
│   ├── permissions/     # policy contracts + client guards
│   ├── templates/       # template definitions + validation
│   ├── layout/          # layout tree + pagination
│   ├── render-dom/      # editing presentation
│   ├── render-print/    # print composition
│   ├── export-docx/     # OOXML writer
│   ├── export-pdf/      # controlled rendition
│   ├── import-docx/     # OOXML → IR, passthrough
│   ├── collaboration/   # Y.js integration
│   ├── review/          # comments + tracked changes
│   ├── ai/              # AI command protocol
│   ├── ui/              # design system, ribbon, rulers
│   ├── react/
│   └── vue/
├── apps/ playground · office-demo · qms-demo
├── services/ collaboration (authenticated sync)
├── tests/ conformance · security · fidelity · performance
└── docs/
```

---

## 8. Release gates for controlled-document features

1. Server-side enforcement of section permissions has been proven against malicious clients.
2. Revision histories are complete and attributable.
3. Released artifacts are immutable, with hashes matching the manifest.
4. Behaviour is correct under concurrent editing and reconnects.
5. PDF publication is verified and export is repeatable.
6. Backup and restore have been tested.
7. A documented, tested schema migration strategy exists.

| Test category | Required proof |
|---|---|
| Schema invariants | Invalid structures are rejected or safely normalised |
| Tables | No corrupted grids after merge, split, or paste |
| Permissions | Unauthorized operations cannot alter protected content |
| Collaboration | Concurrent edits keep structure valid and authorized |
| Snapshot restore | No loss of pending review changes |
| Pagination | Repeatable breaks that match the rendition |
| Import and export | Supported content round-trips without loss |
| PDF release | Content and revision hashes match the manifest |
| Accessibility | Keyboard and assistive-technology workflows work |
| Performance | Responsive at 200 pages |

---

## 9. Product boundaries

| Responsibility | Owner |
|---|---|
| Blocks, editing, layout, commands, schema rules | BeakBlock |
| Controlled-section editor behaviour | BeakBlock QMS extension |
| Policy enforcement contracts | Shared |
| Identity, assignments, authoritative authorization | Beak QMS service |
| Workflow, approvals, e-signatures | Beak QMS service |
| Immutable releases, audit, print register | Beak QMS service |
| Equipment and test-method data | Beak LIMS integration |
| Distribution, training, acknowledgements | Beak QMS service |

This keeps BeakBlock commercially reusable for contracts, manuals, reports, forms, and knowledge bases, while the QMS extensions provide the regulated features.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Screen and print pagination drift | Bundled metric-compatible fonts, fidelity CI, server rendition authoritative for release |
| Table subsystem complexity | Build on `prosemirror-tables`, property-based invariant tests, layout logic outside UI |
| Per-section CRDT binding is hard | Ship stacked editors first, keep the composite binding behind a spike |
| Scope creep toward full Word parity | SOP-grade parity checklist, corpus-driven priorities |
| Breaking existing users | Versioned schema, migrator, compatibility release |
| DOCX is enormous | Support a defined subset, passthrough blocks, explicit loss reports |
| Client-trusted security | Typed operations checked server-side, malicious-client test suite |
| AI producing unverified clinical content | Proposals only, tracked and attributed, advisory validation |

---

## 11. Deliberately avoided

- A second document model for Office mode
- Storing canonical documents as HTML
- Coupling workflow states to toolbar buttons
- Treating Y.js awareness or client locks as authorization
- Forcing semantic blocks to look like cards
- Implementing every DOCX feature before producing useful output
- Lab-specific rules inside the generic kernel
- Embedding a third-party office editor as the authoring surface
- Writing a low-level typography or rendering engine before a tested DOM editor and print composer exist

---

## Appendix A — SOP-grade parity checklist

**Text and styles**
- [ ] Named paragraph and character styles with inheritance
- [ ] Styles gallery and pane
- [ ] Direct formatting: font, size, bold, italic, underline, strike, sub- and superscript, colour, highlight
- [ ] Spacing before and after, line rules, indents, tab stops with leaders, alignment
- [ ] Keep with next, keep lines together, widow and orphan control, page break before

**Lists and numbering**
- [ ] Bullets, numbered, and multilevel lists, restart and continue
- [ ] Heading numbering continuous across sections

**Tables**
- [ ] All P0 and P1 rows from section 5D

**Pages**
- [ ] Size, orientation, margins, and section breaks
- [ ] Headers and footers: first page, odd and even
- [ ] Page numbers, watermark

**References**
- [ ] TOC, captions, `SEQ`, cross-references
- [ ] Footnotes

**Review**
- [ ] Comments, track changes, compare, accept and reject

**Fields**
- [ ] Doc number, revision, effective date, page X of Y, owner

**Output**
- [ ] DOCX export (opens cleanly in Word), PDF rendition, print with controlled-copy notice

**Input**
- [ ] Paste from Word and Excel, DOCX import with passthrough
