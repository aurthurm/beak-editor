# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased — 2.0.0-alpha]

BeakBlock 2.0 is in alpha. Existing `Block[]` content and 0.1.x APIs keep working. See
[`docs/2.0/migration-guide.md`](docs/2.0/migration-guide.md), [`docs/2.0/status.md`](docs/2.0/status.md) and
[`docs/adr/`](docs/adr/) for details and known limitations.

### Added

#### Core (`@amusendame/beakblock-core`)

- **Editor modes** — `EditorConfig.mode` (`'block'` default, `'office'`, `'controlled'`), `getMode()`, `setMode()` with a `modeChange` event, and `data-beakblock-mode` on the root element. `wordBehaviour` (default on outside block mode).
- **Extensions** — `EditorConfig.extensions` (`BeakExtension`: nodes, marks, plugins, node views, block definitions) and `editor.blockRegistry` (`BlockRegistry` with validation codes).
- **Office paragraph properties** — `styleId`, `numbering`, `spacing`, `indent`, `keepNext`, `keepLines`, `pageBreakBefore`, `widowControl`, `tabs`, round-tripped through `Block.props`.
- **Fields and revisions** — `field` inline node (`PAGE`, `NUMPAGES`, `DOCPROPERTY`, `REF`, `SEQ`, `DATE`, `LIMS`), `editor.setFieldResolver()`, and `insertion` and `deletion` marks. `editor.setReviewView('markup' | 'final' | 'original')`.
- **Office tables** — `widthMode`, `widthValue`, `look` on tables; `isHeader`, `cantSplit`, `heightTwips` on rows; cell borders, shading, padding and alignment. Commands for row and column structure, merge and split, widths, borders, sort and distribute.
- **Word keyboard** — `createWordKeymapPlugin()`: Ctrl+Enter page break, Ctrl+Shift+V plain paste, Ctrl+Alt+1–3 headings, Ctrl+Shift+N Normal, Tab list levels, smart quotes and AutoCorrect.

#### Schema (`@amusendame/beakblock-schema`)

- **`BeakDocument` v2** (`schemaVersion: 2`) with sections, a style sheet with `basedOn`, numbering definitions, page setup (A4, Letter, Legal, A3), and document properties.
- **Migrations** — `migrateDocument()` (accepts `Block[]`, v1 wrapper or v2), `MigrationRegistry`, `blocksToDocument`, `documentToBlocks`, and `validateDocumentStructure()`.
- **Units** — points and twips internally, with `ptToTwips`, `twipsToPt`, `twipsToPx`, `pxToTwips` and `mmToTwips`.

#### IR (`@amusendame/beakblock-ir`)

- **BeakDoc IR** (OOXML-shaped): `documentToIR`, `irToDocument`, `blocksToIR`, `validateIR`, and a Python twin in `packages/ir/python`.

#### Commands (`@amusendame/beakblock-commands`)

- **`CommandRegistry`** with policy checks, shortcuts, repeat-last (F4) and a keymap plugin; `createBuiltInCommands()` (31 ids) and `createDefaultRibbon()` (ribbon definition, no UI yet).

#### Permissions (`@amusendame/beakblock-permissions`)

- **Typed operations and scopes** (`OPERATION_SCOPES`, `classifyTransaction`), a **policy engine** (`createPolicyEngine`), a **client guard** (`createPermissionGuardPlugin`, for UX only) and the **server verifier** `verifyDocumentChange()`, which derives operations from the stored and submitted block trees.

#### Review (`@amusendame/beakblock-review`)

- **Durable track changes**: `createRevisionTrackingPlugin`, `acceptRevision`, `rejectRevision`, `acceptAll`, `rejectAll`, `listPendingRevisions`, `proposeChange`, `InMemoryRevisionStore`.
- **Comments on stable anchors**: `InMemoryCommentThreadStore`, `createCommentAnchor`, `reanchorComments`, mentions.
- **Compare and restore**: `compareRevisions`, `renderRedlineHTML`, `restoreSnapshotPreservingRevisions`, and `projectBlocks` for Original, Final and Markup views.

#### Layout (`@amusendame/beakblock-layout`)

- **Layout tree and pagination**: `layoutDocument`, `relayout` (identical to a full layout), keep rules, widow and orphan control, table row splitting, repeated header rows, per-page headers and footers, and field resolution.
- **Measurers**: `createHeuristicMeasurer` (deterministic) and `createDomMeasurer`.
- **Print and editor pages**: `renderPrintHTML` (A4 and other sizes, watermark, controlled-copy notice) and `createPaginationPlugin` (page boundaries as decorations; the document is never changed).

#### DOCX (`@amusendame/beakblock-export-docx`, `@amusendame/beakblock-import-docx`)

- **`exportDocx`, `exportDocxBlob`, `exportDocxWithReport`**: a DOCX writer for the IR subset (styles, numbering, runs, hyperlinks, fields, tracked changes, tables, content controls, sections, headers and footers, images). Byte-identical output across runs, and a loss report.
- **`importDocx`**: DOCX to IR with `ooxmlPassthroughExtension()` for unsupported parts, `detectHeadings()`, and loss codes.

#### Templates (`@amusendame/beakblock-templates`)

- **Controlled templates**: `createTemplate`, `addSection`, `publishTemplate`, `instantiateDocument`, `validateAgainstTemplate`.
- **Lifecycles**: section and document state machines, `freezeSectionRevision` (immutable section revisions).
- **Release**: `composeDocument` (generated parts), `createRelease` (sha256 hashes), `bindSignature`, `attachRendition`, `verifyRelease`, `stampControlledCopy`, and `mapImportToTemplate`.

#### QMS blocks (`@amusendame/beakblock-blocks-qms`)

- **`qmsExtension()`**: `controlledSection` (with the section plugin; the permission guard is composed in when a policy context is supplied), signature, approval, revision history, controlled notice, acknowledgement and document identifier blocks, and QMS commands.

#### Office blocks (`@amusendame/beakblock-blocks-office`)

- **`officeBlocksExtension()`**: footnote, endnote, equation, caption, cross-reference, text box, shape, variable, conditional, repeating section, computed value and reusable content.

#### Clinical blocks (`@amusendame/beakblock-blocks-clinical`)

- **`clinicalExtension()`**: SOP step (with automatic numbering), safety warning, reagent table, test-method specification, specimen requirements, QC criteria and equipment reference.
- **`formsExtension()`**: text, number, date, dropdown, checkbox, radio, calculated fields, repeatable rows and validated sections.

#### AI (`@amusendame/beakblock-ai`)

- **`createAICommandLayer()`**: nine `ai.*` commands. Every result is a tracked proposal, marked AI-generated and attributed. Policy is checked before the provider is called and again before the change is applied. `createFetchProvider`, `createMockProvider`.

#### Tests and reports (`tests/conformance`, private)

- **Conformance suites**: a 20-document synthetic corpus; round trips through the IR; editor load and round trip; DOCX structure, determinism and well-formedness; security (forged operations, guard bypass, replay and stale bases, tenant isolation, signature attributes, AI policy); table invariants (seeded random operations); layout stability, relayout equality and performance budgets; the Phase 4 vertical slice.
- **Fidelity proxy** (`tests/conformance/scripts/fidelity.mjs`): DOCX to PDF with LibreOffice and comparison with layout page counts. Runs in CI.

#### Documentation

- **Architecture Decision Records** [`docs/adr/`](docs/adr/): ADR-0001 to ADR-0006 (print renderer, layout authority, collaboration topology, canonical format, units, fonts).
- **2.0 docs** [`docs/2.0/`](docs/2.0/): migration guide, architecture with the parity checklist, and status against the roadmap.

### Changed

- The core editor's runtime format is still `Block[]`. `getDocument()` and `setDocument()` keep their signatures, and the 2.0 document model is available through `@amusendame/beakblock-schema`.
- **Input blocks** (`PartialBlock`): `initialContent`, `setDocument`, `fromJSON`, `blocksToDoc` and `insertBlocks` accept blocks without `id` or `props`, including nested children. `normalizeBlock()` fills them in. Breaking for types: `PartialBlock.props` is now optional.
- **Inline content narrowing**: extensions register inline node types by augmenting `CustomInlineContentRegistry`, so `if (c.type === 'text') c.styles` narrows without guards. The Office, QMS and Clinical packages register theirs. Breaking for types: an unregistered custom inline object is no longer `InlineContent` (use `UnknownInlineContent` at runtime boundaries), and text runs require `styles`.
- **Collaboration seeding**: `collaboration.sync` (`provider`, `ydoc`, `fragment`, `seed`) defers binding until the provider syncs, then seeds an empty room once. A room marker prevents reseeding, and concurrent seeds converge on one copy. Without `sync`, behaviour is unchanged.

### Fixed

- **Block ids** are unique and stable. Enter, list-item splits, paste and duplicate ids in loaded content no longer produce two blocks with the same id. The block that keeps the original text keeps the id, and remote Yjs changes are never re-identified. Paragraphs inside list items and table cells get a deterministic id (`${ownerId}/p`), so repeated `getDocument()` calls and version diffs no longer report spurious changes.
- **Ctrl+Enter** splits the paragraph around the page break, or adds a new paragraph after it at the end of a block, as in Word.
- **Live collaboration** no longer opens blank in a fresh room: `ySyncPlugin` used to replace the initial content with the empty shared fragment.
- **QMS extension** injects its stylesheet by default (`injectStyles: false` to opt out), like the Office and Clinical extensions.

### Deprecated

- **Core track changes** (decoration-based `enableTrackChanges`, `getPendingTrackChanges`, `acceptTrackedChange`). Use `@amusendame/beakblock-review`.
- **Compliance locks** (`complianceLock` and `attrs.locked` / `lockId`). Use `@amusendame/beakblock-permissions` with `@amusendame/beakblock-blocks-qms`. Client locks are UX only and do not replace server-side checks.

### Known issues

- The IR drops some custom inline nodes and empty checklists silently, and the editor does not load signed signature blocks through `setDocument`. The server verifier does not protect signature attributes. See [`docs/2.0/status.md`](docs/2.0/status.md#known-defects) for the full list and the tests that track each one.

## [0.1.2] - 2026-04-18

### Added

#### Core (`@amusendame/beakblock-core`)

- **`EditorConfig.dragDrop`** — Forwards **`DragDropConfig`** (or **`false`**) into **`createPlugins`**. New **`headingLockBadge`** option: **`'locked-only'`** (default) vs **`'all-headings'`** (show lock control on every heading; **click** toggles **`locked`** with **`COMPLIANCE_LOCK_BYPASS_META`**; assigns **`lockId`** for levels **1–3** when locking if missing).
- **`setDocument`** — Applies **`COMPLIANCE_LOCK_BYPASS_META`** on the replace transaction so full-document updates are allowed when compliance lock is enabled.

#### Documentation

- **[Compliance demo](docs/compliance-demo.md)** — Hierarchical **H1–H3** section boundaries, flat slice shape (`level`, `parentLockId`, `headingBlockId`), template validation, cursor-based **Add H1/H2/H3**, side-menu lock, and **`complianceFullDocument`** API list (**`sliceComplianceDocumentTree`**, **`nextIndexAfterComplianceSlice`**, …).
- **[Compliance lock](docs/compliance-lock.md)** — **`EditorConfig.dragDrop`**, **`headingLockBadge`**, **`setDocument`** bypass, **`.ob-block-lock-badge--interactive`**.
- **[Plugins](docs/plugins.md)**, **[Heading block](docs/blocks/heading.md)**, **[Styling](docs/styling.md)**, **[Core README](packages/core/README.md)** — Cross-references for the above.

#### Examples (`examples/nuxt-vue`)

- Compliance **outline** parsing and UI: nested subsections, workspace indent, **`insertBlocks`** at cursor for template toolbar, **`ComplianceFullDocumentEditor`** **`dragDrop.headingLockBadge: 'all-headings'`**.

## [0.1.1] - 2026-04-18

### Changed

- **Workspace** — all publishable and example `package.json` versions set to **0.1.1** to match git tag `v0.1.1`.
- **npm scope** — published packages use **`@amusendame/*`** instead of `@aurthurm/*` (install paths and imports updated across the workspace).

### Added

#### Core (`@amusendame/beakblock-core`)

- **Compliance lock** — Optional **`EditorConfig.complianceLock`** with **`createComplianceLockPlugin`**: headings can set **`attrs.locked`** (plus optional **`lockReason`**, **`lockId`**). Blocks are read-only for normal edits; reordering vs other locked blocks is gated by **`allowReorder`**. Trusted code may set transaction meta **`COMPLIANCE_LOCK_BYPASS_META`** to apply changes. Integrates with drag-and-drop (handle visibility), bubble menu hiding, multi-block delete, and markdown/HTML round-trip via `data-beakblock-*` attributes.
- **Lock UI** — Default CSS shows a **padlock** at the **start** of locked headings and a **`.ob-block-lock-badge`** in the **hover side menu** (tooltip from **`lockReason`** when present).

#### Documentation

- **[Compliance lock](docs/compliance-lock.md)** — Configuration, policy matrix, bypass, helpers, DOM/CSS hooks, and collaboration notes. Linked from [Plugins](docs/plugins.md), [Heading block](docs/blocks/heading.md), [Styling](docs/styling.md), [Compliance demo](docs/compliance-demo.md), and the root [README](README.md).

## [0.1.0] - 2026-04-18

### Changed

- **Workspace** — all publishable and example `package.json` versions set to **0.1.0** to match git tag `v0.1.0`.

### Added

#### Documentation

- **[Compliance workflow (Nuxt)](docs/compliance-demo.md)** — describes the `examples/nuxt-vue` compliance workspace: section approvals, append-only approval history, author read-only lock after sign-off, optional document-level dual attestation, IndexedDB stores, and export appendices. Cross-linked from [Versioning](docs/versioning.md), [Comments](docs/comments.md), the root [README](README.md), and [Vue package README](packages/vue/README.md).

## [1.0.0] - 2026-01-25

### Added

#### Core Editor (`@amusendame/beakblock-core`)
- **Public ProseMirror API** - Full access to ProseMirror internals via `editor.pm.*`
- **Block-based JSON document format** - Notion-like structure with full TypeScript support
- **Schema System**
  - Block nodes: paragraph, heading (h1-h6), blockquote, callout, codeBlock, divider, bulletList, orderedList, listItem, checkList, checkListItem, columnList, column, table, tableRow, tableCell, tableHeader, image, embed
  - Mark types: bold, italic, underline, strikethrough, code, link, textColor, backgroundColor
- **Plugin System**
  - Slash menu plugin (`/` command palette)
  - Bubble menu plugin (floating toolbar)
  - Drag & drop plugin for block reordering
  - Table plugin with row/column manipulation
  - Media menu plugin for image/video controls
  - Keyboard shortcuts plugin
  - Input rules for auto-formatting (markdown shortcuts)
  - Block ID management plugin
  - Checklist plugin
  - Multi-block selection plugin
- **Table Commands** - addRowAfter, addRowBefore, deleteRow, addColumnAfter, addColumnBefore, deleteColumn, deleteTable, goToNextCell, goToPreviousCell
- **Document Operations** - getDocument, setDocument, getBlock, insertBlocks, updateBlock, removeBlocks
- **Text Formatting Commands** - toggleBold, toggleItalic, toggleUnderline, toggleStrikethrough, toggleCode, setTextColor, setBackgroundColor
- **History Support** - Undo/redo via ProseMirror history
- **CSS Auto-injection** - Automatic style injection with opt-out support

#### React Package (`@amusendame/beakblock-react`)
- **Hooks**
  - `useBeakBlock` - Create and manage editor instances
  - `useEditorContent` - Subscribe to document changes
  - `useEditorSelection` - Track selection changes
  - `useEditorFocus` - Monitor focus state
  - `useCustomSlashMenuItems` - Generate menu items from custom blocks
- **Components**
  - `BeakBlockView` - Main editor view component
  - `SlashMenu` - Command palette UI
  - `BubbleMenu` - Floating formatting toolbar
  - `TableHandles` - Row/column manipulation handles
  - `TableMenu` - Table cell operations menu
  - `MediaMenu` - Image/video controls
  - `ColorPicker` - Color selection UI
  - `LinkPopover` - Link editing popover
- **Custom Blocks API** - `createReactBlockSpec` for creating React-based custom blocks
- **Custom Block Hooks** - `useBlockEditor` and `useUpdateBlock` for custom block implementations

### Documentation
- React integration guide
- Custom blocks guide
- Custom marks guide
- Plugins guide
- Styling and theming guide
- Comprehensive README with API reference

---

## [0.0.1] - 2026-01-17

### Added
- Initial project setup
- Basic editor functionality
- ProseMirror integration
- React bindings foundation
