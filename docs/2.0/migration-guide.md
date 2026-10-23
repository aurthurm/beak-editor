# BeakBlock 2.0 migration guide

Status: **2.0.0-alpha**. The packages are workspace packages in this repository and are not published yet.
Version 0.1.x applications keep working. Each 2.0 feature is opt-in, and the sections below say what to change
and when. The contract for every package is [`contracts.md`](./contracts.md). The plan is
[`beakblock-2.0-roadmap.md`](../../beakblock-2.0-roadmap.md).

## Contents

1. [What is new](#what-is-new)
2. [Compatibility promises](#compatibility-promises)
3. [From `Block[]` to BeakDocument v2](#from-block-to-beakdocument-v2)
4. [Editor modes](#editor-modes)
5. [Extensions API](#extensions-api)
6. [Track changes: deprecated decoration plugin and the review package](#track-changes-deprecated-decoration-plugin-and-the-review-package)
7. [Compliance locks: deprecated in favour of permissions and blocks-qms](#compliance-locks-deprecated-in-favour-of-permissions-and-blocks-qms)
8. [Adopting each package](#adopting-each-package)
9. [Known limitations to plan around](#known-limitations-to-plan-around)

## What is new

- **Versioned document model.** `BeakDocument` (`schemaVersion: 2`) with sections, styles, numbering, page setup
  and document properties. `Block[]` remains the editor's runtime format.
- **Office paragraph properties** on `paragraph` and `heading` (`styleId`, `numbering`, `spacing`, `indent`,
  `keepNext`, `keepLines`, `pageBreakBefore`, `widowControl`, `tabs`).
- **Fields, revision marks and Office tables** (`widthMode`, `look`, `isHeader`, `cantSplit`, cell borders,
  shading, padding, alignment) in core.
- **Packages:** `schema`, `ir`, `commands`, `permissions`, `review`, `layout`, `export-docx`, `import-docx`,
  `templates`, `blocks-qms`, `blocks-office`, `blocks-clinical`, `ai`.
- **A conformance suite** (`tests/conformance`) that checks round trips, DOCX structure, security, table invariants
  and layout against a synthetic corpus.

See [`architecture.md`](./architecture.md) for the package map and [`status.md`](./status.md) for what is
complete and what is not.

## Compatibility promises

- Existing `Block[]` documents load without change. `getDocument()` and `setDocument()` keep their signatures.
- `new BeakBlockEditor(config)` with no new options behaves as in 0.1.x. The new `mode` option defaults to
  `'block'`, which keeps block chrome (drag handles, slash menu). `wordBehaviour` defaults to `false` in block
  mode.
- Core's own test suite (about 290 tests) passes in this repository. Every other package's suite also passes. Run them
  with `pnpm --filter "./packages/*" run test`.
- Breaking changes, if any are introduced before 2.0.0 final, will be listed in `CHANGELOG.md`.

## From `Block[]` to BeakDocument v2

Use `Block[]` as before until you need sections, page setup, styles or numbering. Then migrate once, on load.

```ts
import { migrateDocument, documentToBlocks } from '@amusendame/beakblock-schema';

// Accepts Block[] (v1), { schemaVersion: 1, blocks }, or an existing v2 document.
const doc = migrateDocument(storedJson);

// For a single-section document, the blocks come back deep-equal.
const blocks = documentToBlocks(doc);
editor.setDocument(blocks);
```

Store the v2 document (`JSON.stringify(doc)`) once you start using v2 features. Do not write v2 documents
into a store that the 0.1.x reader will open, because it expects `Block[]`.

Migration is idempotent: `migrateDocument(migrateDocument(x))` equals `migrateDocument(x)` for every corpus
document (tested). Validate the result before you save it:

```ts
import { validateDocumentStructure } from '@amusendame/beakblock-schema';

const errors = validateDocumentStructure(doc).filter((issue) => issue.severity === 'error');
```

Known round-trip limits are listed in [Known limitations](#known-limitations-to-plan-around). Run your own documents
through `migrateDocument` and `documentToBlocks` before you migrate a library, and compare with
`tests/conformance/src/roundtrip.test.ts` for the patterns that are affected.

## Editor modes

```ts
import { BeakBlockEditor } from '@amusendame/beakblock-core';

const editor = new BeakBlockEditor({ element, mode: 'office' });
editor.getMode();            // 'office'
editor.setMode('controlled'); // emits 'modeChange'
```

| Mode | Use for | Block chrome | Word behaviour |
| --- | --- | --- | --- |
| `block` (default) | Knowledge bases, structured authoring | Shown | Off unless `wordBehaviour: true` |
| `office` | General authors who expect a word processor | Hidden | On |
| `controlled` | Lab SOPs and quality manuals with governed sections | Hidden | On |

The root element carries `data-beakblock-mode="<mode>"`. Modes are projections of one document. They do not change
the schema, so switching mode never changes the saved content (tested in `tests/conformance`).

Review views: `editor.setReviewView('markup' | 'final' | 'original')`, with the matching class on the root element.

## Extensions API

Extensions add nodes, marks, ProseMirror plugins, node views and block definitions without forking core.

```ts
import { BeakBlockEditor } from '@amusendame/beakblock-core';
import { qmsExtension } from '@amusendame/beakblock-blocks-qms';
import { officeBlocksExtension } from '@amusendame/beakblock-blocks-office';
import { clinicalExtension, formsExtension } from '@amusendame/beakblock-blocks-clinical';
import { reviewExtension } from '@amusendame/beakblock-review';
import { ooxmlPassthroughExtension } from '@amusendame/beakblock-import-docx';

const editor = new BeakBlockEditor({
  element,
  mode: 'controlled',
  extensions: [
    qmsExtension(),
    officeBlocksExtension(),
    clinicalExtension(),
    formsExtension(),
    reviewExtension({ enabled: true, author: { id: 'u1', name: 'Ada' }, store }),
    ooxmlPassthroughExtension(),
  ],
});
```

Each extension has the shape:

```ts
interface BeakExtension {
  name: string;
  nodes?: Record<string, NodeSpec>;
  marks?: Record<string, MarkSpec>;
  plugins?: (ctx: { schema: Schema; editor: BeakBlockEditor }) => Plugin[];
  nodeViews?: Record<string, NodeViewConstructor>;
  blocks?: BeakBlockDefinition[];   // registered into editor.blockRegistry
}
```

Register your own block with a `BeakBlockDefinition` (type, version, family, capabilities, `validate`,
`renderPrint`, `toIR`, `fromIR`, `migrate`). The registry's `validate(blocks)` returns issues with codes and
severities for the editor and the server.

Two things to know:

- **Extension blocks with children.** `sopStep` and `safetyWarning` hold block content (`children`, paragraphs), not
  inline `content`. Inline text on those types is dropped on load, and the step-numbering plugin then throws.
  See [Known limitations](#known-limitations-to-plan-around).
- **Extension ids.** QMS atoms (`signatureBlock`, `approvalBlock`, `revisionHistory`, `controlledNotice`,
  `acknowledgement`) use the reserved node attribute `id` for the block identity. Do not put a different
  identifier in `props.id`; it is dropped on load.

## Track changes: deprecated decoration plugin and the review package

The 0.1.x track changes (decoration-based, in core) are **deprecated in 2.0**. They keep working in 0.1.x, but new
code should use the durable marks in `@amusendame/beakblock-review`. The old plugin keeps its records in editor
state only (mapped on each transaction and never persisted), so it cannot support Original and Final views,
attribution across sessions, or AI proposals.

| Need | 0.1.x (deprecated) | 2.0 (`@amusendame/beakblock-review`) |
| --- | --- | --- |
| Turn tracking on | `editor.enableTrackChanges({ authorId })` | `createRevisionTrackingPlugin({ enabled: true, author, store })` or `reviewExtension(...)` |
| List pending changes | `editor.getPendingTrackChanges()` | `listPendingRevisions(state)` (from the marks) |
| Accept or reject | `editor.acceptTrackedChange(id)` / `rejectTrackedChange(id)` | `acceptRevision(view, id, by)` / `rejectRevision(view, id, by)` |
| Accept all or reject all | loop over the list | `acceptAll(view, by)` / `rejectAll(view, by)` |
| Views | none | `setReviewView(view.dom, 'markup' \| 'final' \| 'original')` |
| AI or other proposals | none | `proposeChange(view, { from, to, text, author, aiGenerated: true })` |
| Compare two versions | none | `compareRevisions(oldBlocks, newBlocks)` and `renderRedlineHTML` |

Migration steps:

1. Add the `insertion` and `deletion` marks (from `reviewExtension`), then remove the old plugin's configuration.
2. Store revision records in a `RevisionStore` (`InMemoryRevisionStore` for tests; implement the interface for your
   database). Records carry the author, time, status and `resolvedBy`.
3. Replace accept and reject calls as in the table.
4. Existing decoration-only changes are not converted automatically. Accept or reject them before migrating, or
   re-create them with `proposeChange`.

## Compliance locks: deprecated in favour of permissions and blocks-qms

The 0.1.x compliance lock (`complianceLock` in `EditorConfig`, and `attrs.locked` with `lockId` on headings) is
**deprecated in 2.0**. It stays for 0.1.x applications. See [`compliance-lock.md`](../compliance-lock.md).

The 2.0 model separates three things:

- **Section governance** is a `controlledSection` block (`@amusendame/beakblock-blocks-qms`) with a stable `sectionId`,
  `required`, `allowedBlocks`, `workflowState` and `locked` attributes. `locked` is presentation only.
- **Authorisation** is `@amusendame/beakblock-permissions`. The client guard
  (`createPermissionGuardPlugin`) rejects obvious violations for user experience. The server must call
  `verifyDocumentChange(storedBlocks, submittedBlocks, ctx)` on every submission and must never trust the
  client's view of the document or its own lock state.
- **Workflow and signatures** belong to your QMS service. `signatureBlock` attributes are written only by the
  signature service.

```ts
import { createPermissionGuardPlugin, verifyDocumentChange } from '@amusendame/beakblock-permissions';

// Client: early rejection, for UX only.
const guard = createPermissionGuardPlugin({ getContext: () => currentPolicyContext() });

// Server: the authority.
const verdict = verifyDocumentChange(storedBlocks, submittedBlocks, policyContextFor(user, doc));
if (!verdict.allowed) reject(verdict.violations.map((v) => v.reason));
```

Client locks are not authorisation. Conformance tests show that a client without the guard can send a forged
deletion, and the server rejects it. Do not rely on the guard in any path that matters.

Migrating a locked-heading document:

1. Convert locked heading sections into `controlledSection` blocks (the template packages can do this from a
   template, and `mapImportToTemplate` maps legacy headings to template sections).
2. Move the lock state out of the document and into your workflow store. Keep `workflowState` in the document only
   as presentation.
3. Add the server verifier to your save path before you rely on the sections for control.

## Adopting each package

| Package | Use it when | Notes |
| --- | --- | --- |
| `@amusendame/beakblock-schema` | You store documents | `migrateDocument`, `documentToBlocks`, `validateDocumentStructure` |
| `@amusendame/beakblock-ir` | You export, print or validate | `documentToIR`, `irToDocument`, `validateIR` |
| `@amusendame/beakblock-commands` | You need a command registry, shortcuts and the ribbon definition | `CommandRegistry`, `createBuiltInCommands`, `createDefaultRibbon`. No ribbon UI yet |
| `@amusendame/beakblock-permissions` | Any controlled content | Guard for UX, `verifyDocumentChange` on the server |
| `@amusendame/beakblock-review` | Track changes, comments, compare | Replaces the deprecated decoration plugin |
| `@amusendame/beakblock-layout` | Print and page previews | `layoutDocument`, `relayout`, `renderPrintHTML` |
| `@amusendame/beakblock-export-docx` | DOCX output | `exportDocx`, `exportDocxWithReport` (report lists losses) |
| `@amusendame/beakblock-import-docx` | DOCX input | `importDocx` returns the IR and a loss report |
| `@amusendame/beakblock-templates` | Controlled templates, composition, releases | Lifecycle, `composeDocument`, `createRelease`, `verifyRelease` |
| `@amusendame/beakblock-blocks-qms` | Controlled sections and QMS blocks | `qmsExtension()` |
| `@amusendame/beakblock-blocks-office` | Captions, equations, footnotes, text boxes, conditionals | `officeBlocksExtension()` |
| `@amusendame/beakblock-blocks-clinical` | SOP steps, safety warnings, reagent tables, forms | `clinicalExtension()`, `formsExtension()` |
| `@amusendame/beakblock-ai` | AI commands | Every result is a tracked proposal. `createAICommandLayer({ provider, editor, registry, author, getPolicyContext })` |

Example, a controlled SOP that can be rendered and exported:

```ts
import { documentToIR } from '@amusendame/beakblock-ir';
import { migrateDocument } from '@amusendame/beakblock-schema';
import { exportDocx } from '@amusendame/beakblock-export-docx';
import { layoutDocument, renderPrintHTML } from '@amusendame/beakblock-layout';

const ir = documentToIR(migrateDocument(blocks));
const docx = await exportDocx(ir);
const layout = layoutDocument(ir);
const html = renderPrintHTML(ir, layout, { title: 'SOP-LAB-0012', controlledCopy: { copyNumber: 1, issuedTo: 'Bench 4' } });
```

## Known limitations to plan around

The defects the conformance suite found on the 2.0 alpha are fixed (see the "Fixed in 2.0 alpha" table in
[`status.md`](./status.md)). The limitations that remain are below. The full status is in [`status.md`](./status.md).

| Area | Limitation | Workaround |
| --- | --- | --- |
| DOCX | Footnote bodies are not exported (the export reports `footnote-unsupported`). Floating objects, multi-column, watermarks and page-number restart are not written. Control characters are removed. Bookmark names are sanitised. | Read `report.losses` after each export. |
| DOCX | A `REF` field whose target has no bookmark is reported as `field-target-missing`. | Check `report.losses` for `field-target-missing`. |
| Layout | Floating objects, text wrapping, multi-column, footnote allocation, and per-section page-number restart are not laid out. | Expect page counts to drift for those documents. |
| Collaboration | Single-document Y.js only. No reconnect policy and no offline conflict policy. | Test reconnect and offline behaviour in your own application. |
| Fonts | Font files are not bundled. The heuristic measurer approximates metrics. | Bundle Carlito, Caladea and Liberation yourself until they ship. |
