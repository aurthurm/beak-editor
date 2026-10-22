# BeakBlock 2.0 — Cross-package contracts

This file is the **binding interface agreement** between the 2.0 packages. It lets
packages be built in parallel. If you need to deviate, keep the names below and
extend (add optional fields) rather than rename. Roadmap: `/beakblock-2.0-roadmap.md`.

Package scope: `@amusendame/beakblock-<name>`. All packages are ESM, TypeScript strict,
built with vite (`pnpm --filter <pkg> build`), tested with vitest (`pnpm --filter <pkg> test`).
Units: **pt and twips internally** (1pt = 20 twips, 1in = 72pt = 1440 twips); px only at render (96px = 72pt).

---

## 1. Core additions (`packages/core`)

### 1.1 Office paragraph properties (on `paragraph` and `heading` nodes)
New optional attrs, all default `null`, round-trip through `Block.props` under the same names:

| attr | type |
|---|---|
| `styleId` | `string \| null` — e.g. `"Normal"`, `"Heading2"`, `"Caption"` |
| `numbering` | `{ numId: string; level: number } \| null` |
| `spacing` | `{ beforePt: number; afterPt: number; line: number; lineRule: 'auto'\|'exact'\|'atLeast' } \| null` |
| `indent` | `{ leftPt: number; hangingPt?: number; firstLinePt?: number } \| null` |
| `keepNext`, `keepLines`, `pageBreakBefore`, `widowControl` | `boolean \| null` |
| `tabs` | `{ posPt: number; kind: 'left'\|'center'\|'right'\|'decimal'; leader?: 'dot'\|'none' }[] \| null` |

Alignment keeps the existing `textAlign` attr.

**Units of `spacing`:**
- `beforePt`, `afterPt`: points.
- `line` with `lineRule: 'auto'`: OOXML **240ths of a line** (240 = single, 276 = 1.15, 360 = 1.5). This is the only canonical form for `auto`.
- `line` with `lineRule: 'exact'` or `'atLeast'`: **twips** (20 twips = 1pt).

Legacy data may store `auto` as a multiplier (e.g. `1.15`). Any `auto` value `<= 10` is read as a legacy multiplier and normalised to 240ths (`normalizeLineSpacing` in `packages/schema`) on migration, on style resolution and in renderers. Writers must emit 240ths.

### 1.2 New core nodes
- `pageBreak` — block atom, no attrs besides `id`. Block type `pageBreak`.
- `sectionBreak` — block atom, attrs `{ id, pageSetup: PageSetup | null }` (PageSetup below). Starts a new section with that page setup.
- `field` — **inline** atom, attrs:
  `{ fieldType: 'PAGE'|'NUMPAGES'|'DOCPROPERTY'|'REF'|'SEQ'|'LIMS'|'DATE', name: string|null, format: string|null, fallback: string|null, id }`.
  `name` = property name (DOCPROPERTY: `docNumber`, `revision`, `effectiveDate`, `owner`, `lab`, `title`), SEQ identifier (`Figure`, `Table`), REF target block id, or LIMS key.
  Renders as `<span class="beakblock-field" data-field-type data-field-name>` showing `fallback` or a resolved value supplied via `editor.setFieldResolver(fn)`.
  Inline JSON: `{ type: 'field', fieldType, name, format?, fallback? }` added to `InlineContent`.

### 1.3 Revision marks (durable track changes)
Marks `insertion` and `deletion`, attrs
`{ revisionId: string, authorId: string|null, authorName: string|null, at: string /*ISO*/, aiGenerated: boolean }`.
`insertion` → `<ins class="beakblock-ins" data-revision-id>`; `deletion` → `<del class="beakblock-del" data-revision-id>`.
In `TextStyles` they serialise as `revision?: { kind: 'insert'|'delete'; revisionId; authorId?; authorName?; at; aiGenerated? }`.
Editor root class `beakblock-review-view-{markup|final|original}` controls visibility (final hides `del`, original hides `ins`).

### 1.4 Editor modes and extensions
```ts
type EditorMode = 'block' | 'office' | 'controlled';
interface BeakExtension {
  name: string;
  nodes?: Record<string, NodeSpec>;
  marks?: Record<string, MarkSpec>;
  plugins?: (ctx: { schema: Schema; editor: BeakBlockEditor }) => Plugin[];
  nodeViews?: Record<string, NodeViewConstructor>;
  blocks?: BeakBlockDefinition[];          // registered into editor.blockRegistry
}
// EditorConfig additions
mode?: EditorMode;              // default 'block'
extensions?: BeakExtension[];
customMarks?: Record<string, MarkSpec>;
wordBehaviour?: boolean;        // default: mode !== 'block'
// Editor additions
editor.getMode(); editor.setMode(mode)   // emits 'modeChange'
editor.blockRegistry: BlockRegistry
editor.setFieldResolver(fn: (attrs) => string | null)
editor.setReviewView('markup'|'final'|'original')
```
Root element gets `data-beakblock-mode="<mode>"`. Block chrome (drag handles, slash menu) is disabled in `office` and `controlled` mode.

### 1.5 Block registry (`BlockRegistry` in core)
```ts
interface ValidationIssue { severity: 'error'|'warning'|'info'; code: string; message: string; blockId?: string; sectionId?: string; path?: string }
interface ValidationContext { blocks: Block[]; sectionId?: string|null; [k: string]: unknown }
interface BeakBlockDefinition {
  type: string; version: number;
  family: 'text'|'office'|'smart'|'clinical'|'qms'|'forms';
  schema?: NodeSpec;
  capabilities: { editable: boolean; nested: boolean; printable: boolean; splittable: boolean; collaborative: boolean };
  validate?: (block: Block, ctx: ValidationContext) => ValidationIssue[];
  renderPrint?: (block: Block) => string;       // print HTML fragment
  toIR?: (block: Block, ctx: unknown) => unknown; // consumed by @beakblock-ir
  fromIR?: (ir: unknown, ctx: unknown) => Block | null;
  migrate?: { from: number; to: number; up: (props: Record<string, unknown>) => Record<string, unknown> }[];
}
class BlockRegistry { register(def); get(type); has(type); list(family?); validate(blocks: Block[], ctx?): ValidationIssue[] }
```

### 1.6 Tables (Office-class)
Built on `prosemirror-tables` (already a core dependency). Node names `table`, `tableRow`, `tableCell`, `tableHeader` are kept.
- table attrs: `id, widthMode: 'auto'|'fixed'|'pct', widthValue: number|null (twips or pct*50), styleId, look: {headerRow, bandedRows, firstColumn, lastRow}`.
- row attrs: `id, isHeader (repeat as header row), cantSplit, heightTwips`.
- cell attrs: `id, colspan, rowspan, colwidth (px array, prosemirror-tables), widthTwips, borders: {top,right,bottom,left: {style:'single'|'double'|'dashed'|'dotted'|'none', sizePt, color}|null}, shading: string|null, padding: {topPt,rightPt,bottomPt,leftPt}|null, vAlign: 'top'|'center'|'bottom', hAlign`.
Cells contain block content (paragraphs, lists).

### 1.7 Word keyboard behaviour
`createWordKeymapPlugin(options)` exported by core: Ctrl+Enter page break, Ctrl+Shift+V plain paste, Ctrl+Alt+1–3 headings, Ctrl+Shift+N Normal, Tab/Shift-Tab list level, empty-item Enter exits list, Word-style Backspace, smart quotes + AutoCorrect. **F4 repeat** is owned by the command registry (§3).

---

## 2. Schema v2 (`@amusendame/beakblock-schema`)
Owns the canonical document tree and the OOXML-aligned property model.
```ts
interface BeakDocument {
  schemaVersion: 2;
  id: string;
  properties: DocumentProperties;     // { title?, docNumber?, revision?, effectiveDate?, owner?, lab?, language?, custom?: Record<string,string> }
  styles: StyleSheet;                 // { paragraph: Record<id, ParagraphStyle>, character: Record<id, CharacterStyle>, table: Record<id, TableStyle> } with basedOn
  numbering: NumberingDefinitions;    // { abstract: Record<id, AbstractNumbering>, instances: Record<numId, { abstractId, overrides? }> }
  sections: DocumentSection[];
}
interface DocumentSection {
  id: string;
  pageSetup: PageSetup;               // { size:{widthTwips,heightTwips}, orientation, margins:{top,right,bottom,left,header,footer,gutter} in twips, columns?:{count, spaceTwips} }
  headers?: { default?: Block[]; first?: Block[]; even?: Block[] };
  footers?: { default?: Block[]; first?: Block[]; even?: Block[] };
  titlePage?: boolean;
  blocks: Block[];                    // core Block JSON; controlled sections are `controlledSection` blocks inside
}
```
Exports: types above + `ParaProps`, `RunProps`, `PageSetup`, `PAGE_SIZES` (A4, Letter), unit helpers (`ptToTwips`, `twipsToPt`, `twipsToPx`, `pxToTwips`), `createDefaultStyleSheet()`, `createDefaultNumbering()`, `MigrationRegistry`, `migrateDocument(input: unknown): BeakDocument` (accepts legacy `Block[]` = v1), `blocksToDocument`, `documentToBlocks`, `validateDocumentStructure`, `resolveParagraphStyle(styles, styleId)` (basedOn flattening).

## 3. Commands (`@amusendame/beakblock-commands`)
```ts
interface CommandContext { editor: BeakBlockEditor; args?: unknown }
interface CommandDefinition { id: string; label: string; description?: string; icon?: string; group?: string;
  shortcut?: string | string[];   // ProseMirror keymap syntax, e.g. 'Mod-b'
  operation?: string;             // OperationKind from permissions, for policy checks
  isEnabled?(ctx): boolean; isActive?(ctx): boolean; run(ctx): boolean; repeatable?: boolean }
class CommandRegistry { register(def | def[]); unregister(id); get(id); list(group?); search(query);
  execute(id, args?): boolean; canExecute(id); isActive(id); repeatLast(): boolean;
  setPolicyCheck(fn: (cmd, ctx) => boolean | string); onExecute(listener): unsubscribe;
  bind(editor): void; createKeymapPlugin(): Plugin }
interface RibbonDefinition { tabs: RibbonTab[] }
interface RibbonTab { id; label; contextual?: string /* 'table'|'picture'|'chart'|'controlledSection' */; groups: { id; label; items: { command: string; size?: 'large'|'small'; kind?: 'button'|'toggle'|'dropdown'|'gallery'|'color' }[] }[] }
createDefaultRibbon(): RibbonDefinition  // Home, Insert, Layout, References, Review, View, QMS + contextual tabs
createBuiltInCommands(): CommandDefinition[]
getContextualTabs(editor): string[]
```
Command ids are dotted: `format.bold`, `paragraph.style.heading1`, `insert.pageBreak`, `table.mergeCells`, `review.acceptRevision`, `view.mode.print`, `ai.rewriteSelection`, …

## 4. Permissions (`@amusendame/beakblock-permissions`)
```ts
type OperationKind = 'insertBlock'|'deleteBlock'|'replaceText'|'formatText'|'moveBlock'|'moveSection'|'deleteSection'
  |'renameSection'|'updateTableCell'|'changeTableStructure'|'changeStyle'|'editAttrs'|'acceptRevision'|'rejectRevision';
interface TypedOperation { kind: OperationKind; sectionId: string | null; blockId?: string; blockType?: string; from?: number; to?: number; details?: Record<string, unknown> }
type Capability = 'section.editText'|'section.insertBlock'|'section.deleteBlock'|'section.delete'|'section.rename'|'section.move'
  |'section.moveContentOut'|'section.changeStyle'|'table.editStructure'|'table.editMandatoryColumns'|'table.editApprovedValues'
  |'revision.accept'|'revision.reject'|'document.editUncontrolled';
interface PolicyContext { userId: string; roles: string[]; sectionGrants: Record<string /*sectionId*/, Capability[]>; defaultGrants?: Capability[]; lockedSections?: string[] }
interface PolicyDecision { allowed: boolean; operation: TypedOperation; reason?: string; requiredCapability?: Capability }
interface PolicyEngine { decide(ops: TypedOperation[], ctx: PolicyContext): PolicyDecision[] }
```
A controlled section is any node of type **`controlledSection`** with attr **`sectionId`**. Exports: `OPERATION_SCOPES` (kind → capability), `createPolicyEngine()`, `classifyTransaction(tr)`, `createPermissionGuardPlugin({ getContext, engine?, onDenied? })` (atomic: one denied op rejects the whole transaction), and server-side **`verifyDocumentChange(before, after, ctx)`** which diffs two block trees and does not trust client-declared operations.

## 5. Review (`@amusendame/beakblock-review`)
```ts
interface RevisionRecord { id; kind: 'insert'|'delete'|'replace'|'move'|'format'; authorId; authorName?; at; status: 'pending'|'accepted'|'rejected';
  resolvedBy?; resolvedAt?; aiGenerated?: boolean; sectionId?: string|null; blockId?: string; text?: string; note?: string }
interface RevisionStore { list(): RevisionRecord[]; get(id); upsert(r); subscribe(fn): unsubscribe }
interface AnchoredComment { id; anchor: { sectionId: string|null; blockId: string; quote: string; offset: number; length: number };
  thread: { id; authorId; authorName?; body; mentions: string[]; at }[]; status: 'open'|'resolved'; resolvedBy?; resolvedAt? }
```
Exports: `createRevisionTrackingPlugin({ enabled, author, store })` (writes `insertion`/`deletion` marks instead of deleting), `acceptRevision(view, id, by)`, `rejectRevision`, `acceptAll`, `rejectAll`, `listPendingRevisions(state)`, `InMemoryRevisionStore`, `proposeChange(view, {from,to,text, author, aiGenerated})` (inserts a tracked replacement — used by AI), comment store + `reanchorComments(blocks, comments)`, `compareRevisions(oldBlocks, newBlocks) → { diffs: BlockDiff[]; summary }`, `renderRedlineHTML(diff)`, `restoreSnapshotPreservingRevisions`.

## 6. BeakDoc IR (`@amusendame/beakblock-ir`)
OOXML-shaped, flat-ish tree. Lists are paragraphs with `numbering`; headings are paragraphs with `styleId`.
```ts
interface IRDocument { properties; styles: StyleSheet; numbering: NumberingDefinitions; sections: IRSection[] }
interface IRSection { id; pageSetup: PageSetup; titlePage?; headers?: {default?,first?,even?: IRBlock[]}; footers?: same; body: IRBlock[] }
type IRBlock = IRParagraph | IRTable | IRSdt | IRPassthrough | IRImageBlock;
interface IRParagraph { type: 'paragraph'; props: ParaProps; runs: IRInline[]; source?: IRSource }
interface IRTable { type: 'table'; props: { styleId?, widthMode, widthValue?, look? }; grid: number[] /*twips*/; rows: IRTableRow[]; source? }
interface IRTableRow { props: { isHeader?, cantSplit?, heightTwips?, id? }; cells: IRTableCell[] }
interface IRTableCell { props: { gridSpan: number; vMerge?: 'restart'|'continue'; borders?; shading?; vAlign?; widthTwips?; id? }; blocks: IRBlock[] }
interface IRSdt { type: 'sdt'; tag: string /* controlled section id */; alias?: string; lock?: 'sdtLocked'|'contentLocked'|'sdtContentLocked'|null; blocks: IRBlock[]; source? }
interface IRPassthrough { type: 'passthrough'; xml: string; preview?: string; source? }
interface IRImageBlock { type: 'image'; src: string; widthPt?; heightPt?; alt?; source? }
type IRInline = { type: 'run'; text: string; props: RunProps; revision?: { kind: 'insert'|'delete'; id; author?; at } }
  | { type: 'field'; fieldType; instr: string; name?: string|null; cachedText: string }
  | { type: 'break'; kind: 'line'|'page'|'column' }
  | { type: 'image'; src; widthPt?; heightPt?; alt? }
  | { type: 'footnoteRef'; id: string };
interface IRSource { blockType: string; blockId: string; props?: Record<string, unknown> }  // enables lossless fromIR
```
Exports: `documentToIR(doc: BeakDocument, { registry? })`, `irToDocument(ir)`, `blocksToIR(blocks)`, `validateIR`, `IR_VERSION`. Python twin lives at `packages/ir/python/`.

## 7. Downstream packages (built on §1–6)
- `layout`: `layoutDocument(ir, { measurer? }) → LayoutResult { pages: LayoutPage[]; fieldValues; toc; pageCount }`, `relayout(prev, ir, fromBlockIndex)`, `createHeuristicMeasurer()`, `createDomMeasurer()`, `renderPrintHTML(ir, layout?)`, `createPaginationPlugin({ getIR? })` (widget decorations, never mutates the doc).
- `export-docx`: `exportDocx(ir): Promise<Uint8Array>`, `exportDocxBlob(ir)`.
- `import-docx`: `importDocx(bytes) → { ir; losses: LossReport[] }`, `ooxmlPassthroughExtension()`, `detectHeadings(ir)`.
- `templates`: `TemplateDefinition`, `publishTemplate`, `instantiateDocument`, `validateAgainstTemplate`, section and document lifecycle machines, `composeDocument`, `createRelease` (sha256 content hashes), `ReleaseManifest`, `bindSignature`, generated parts, `mapImportToTemplate`.
- `blocks-qms`: `controlledSection` node (attrs `id, sectionId, templateSectionId, policyRef, required, allowedBlocks: string[]|null, title, ownerName, workflowState`), signature/approval/revisionHistory/documentIdentifier/controlledNotice/acknowledgement blocks, `qmsExtension(options)`.
- `blocks-office`: footnote, endnote, equation, caption, crossReference, textBox, shape, variable, conditional, repeatingSection, computedValue, reusableContent → `officeBlocksExtension(options)`.
- `blocks-clinical`: sopStep, safetyWarning, reagentTable, testMethodSpec, specimenRequirements, qcCriteria, equipmentReference + form controls → `clinicalExtension(options)`, `formsExtension(options)`.
- `ai`: `createAICommandLayer({ provider, registry, getPolicyContext, author })` registering `ai.*` commands; outputs are always `proposeChange` tracked revisions with `aiGenerated: true`.
