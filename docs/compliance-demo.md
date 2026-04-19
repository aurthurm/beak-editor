# Compliance workflow (Nuxt example)

The **`examples/nuxt-vue`** app includes a **multi-section compliance workspace** built on BeakBlock. It is **sample product code**, not part of `@amusendame/beakblock-core` APIs. Use it as a reference for combining versioning, track changes, comments, approvals, and export.

## What it demonstrates

| Area | Behavior |
|------|-----------|
| **Per-section snapshots** | Named versions per section via `InMemoryVersioningAdapter` patterns and IndexedDB persistence (`sectionVersions` store). |
| **Track changes** | Author-driven highlights and pending hunks; reviewers stay read-only at the editor layer when `reviewerOnly` is set. |
| **Comments** | `CommentRail`, `CommentModal`, and `mapAnchors` — see [Comments](./comments.md). |
| **Section approvals** | States: `draft` → `in_review` → `approved`. Authors submit for review; reviewers approve or send back. |
| **Lock after sign-off** | When a section is **`approved`**, the body is **read-only** for non-reviewers (version restore, pending track actions, and similar controls are disabled). A reviewer may **revoke** approval to unlock editing. |
| **Approval history** | Each section keeps an append-only **`history`** of transitions (actor, timestamp, optional note, capped length). The UI exposes a collapsible log. |
| **Document release** | After **every** section is approved, reviewers can record **document-level attestation** in IndexedDB. Optional **two distinct approvers** (demo: primary author persona vs QA lead — see `complianceIdentity.ts`). |
| **Export** | HTML bundle includes optional **`documentRelease`**, an approvals summary table, **approval history** appendix, and comments — see `utils/complianceExport.ts`. |
| **Templates** | Full-document **templates**: optional **H1 title** (no `lockId`), then an **outline of controlled headings** (**H1–H3** with **`lockId`**) and body content. Templates are stored in IndexedDB; **Template** studio authors them with compliance lock **off**. **New document** clones a template with fresh block ids and scopes approvals, versions, comments, and document release to a **`documentInstanceId`**. |
| **Seeded template** | On first open, if the template store is empty, a **Gram stain SOP** template is inserted from `data.ts` (`buildGramStainSeedTemplate`). |

### Section boundaries (hierarchical H1–H3)

Controlled documents and templates share one block tree:

- Optional **H1** **document title** — typically **without** `lockId` (title line only). An **H1 with `lockId`** is a valid top-level **part** in the outline.
- **Controlled headings** are **H1, H2, or H3** with a non-empty **`props.lockId`** (stable section id). Enforcement uses **`props.locked`** (read-only title) independently of `lockId`; slicing and manifests key off **`lockId`**.
- **Outline rule:** each section’s **direct body** is the blocks after its heading until the next controlled heading whose **level is less than or equal to** that section’s level. Deeper headings become **nested subsections** (children in the parse tree). The workspace flattens sections in depth-first order for validation, approvals, and export; rows show **indent** by heading level.
- Runtime slicing and validation use [`sliceComplianceDocumentByLockedHeadings`](../examples/nuxt-vue/utils/complianceFullDocument.ts) (returns a **flat** list with `level`, `parentLockId`, `headingBlockId`). Lower-level helpers include **`sliceComplianceDocumentTree`**, **`flattenComplianceSectionSlices`**, and **`nextIndexAfterComplianceSlice`** (template validation).
- **`required`** per section is stored on the template record (`sectionRequiredByLockId`), not on the heading schema.

### Authoring UX (full document editor)

- **Side menu lock** — `ComplianceFullDocumentEditor` passes core **`EditorConfig.dragDrop`** with **`headingLockBadge: 'all-headings'`** so **every** heading shows a lock control on hover; **click** toggles enforcement (`locked`) using **`COMPLIANCE_LOCK_BYPASS_META`**. Locking assigns **`lockId`** for **H1–H3** when missing (see [Compliance lock](./compliance-lock.md)).
- **Template toolbar** — **Add H1 part**, **Add H2 section**, **Add H3 subsection** insert a locked heading + paragraph **at the cursor** via **`editor.insertBlocks`** (before the block if the caret is at the **start** of that block; otherwise **after** it). Fallback appends to the document if insertion cannot resolve a reference block.
- **Unlock / Lock title** — Rows in the controlled-sections list still toggle `props.locked` by `lockId` (any level). **`editor.setDocument`** applies **`COMPLIANCE_LOCK_BYPASS_META`** so full-document replacements remain allowed when compliance lock is on.

## Key files

| Path | Role |
|------|------|
| [`examples/nuxt-vue/components/ComplianceDocumentWorkspace.vue`](../examples/nuxt-vue/components/ComplianceDocumentWorkspace.vue) | Orchestrates sections, loads/saves IDB state, reviewer toggle, document-release UI, export gate. |
| [`examples/nuxt-vue/components/ComplianceFullDocumentEditor.vue`](../examples/nuxt-vue/components/ComplianceFullDocumentEditor.vue) | Full SOP surface: `dragDrop.headingLockBadge`, template **Add H1/H2/H3** at cursor, `setSectionHeadingLockState`, comments, versions, track changes. |
| [`examples/nuxt-vue/components/ComplianceTemplateStudio.vue`](../examples/nuxt-vue/components/ComplianceTemplateStudio.vue) | List / create / edit / delete templates; sidebar for **required** flags; reuses full document editor in template mode. |
| [`examples/nuxt-vue/components/ComplianceSectionEditor.vue`](../examples/nuxt-vue/components/ComplianceSectionEditor.vue) | Single section editor: approval UI, lock banner, history panel, versioning + comments. |
| [`examples/nuxt-vue/utils/complianceDb.ts`](../examples/nuxt-vue/utils/complianceDb.ts) | IndexedDB **`beakblock-compliance-demo`** (version **5**): `sectionVersions`, `sectionComments`, `sectionApprovals`, `documentRelease`, **`complianceTemplates`**. |
| [`examples/nuxt-vue/utils/complianceTemplates.ts`](../examples/nuxt-vue/utils/complianceTemplates.ts) | Template CRUD, **outline validation** (H1–H3 + `lockId`), clone-for-new-document, Gram stain seed. |
| [`examples/nuxt-vue/utils/complianceFullDocument.ts`](../examples/nuxt-vue/utils/complianceFullDocument.ts) | **`isComplianceSectionBoundaryHeading`** (H1–H3 + `lockId`), **`sliceComplianceDocumentTree`**, **`sliceComplianceDocumentByLockedHeadings`**, **`nextIndexAfterComplianceSlice`**, **`buildMergeManifestFromFullDoc`**, **`findComplianceSectionIdForBlockId`**, legacy **`buildComplianceFullDocumentBlocks`** / **`sliceComplianceFullDocument`**. |
| [`examples/nuxt-vue/utils/complianceApproval.ts`](../examples/nuxt-vue/utils/complianceApproval.ts) | `SectionApprovalRecord`, `history`, `applySectionApprovalTransition`, **`formatApprovalSectionKey`**, **`loadSectionApprovalsForDocument`**. |
| [`examples/nuxt-vue/utils/complianceDocumentRelease.ts`](../examples/nuxt-vue/utils/complianceDocumentRelease.ts) | Document release record, completeness check, persistence. |
| [`examples/nuxt-vue/utils/complianceExport.ts`](../examples/nuxt-vue/utils/complianceExport.ts) | Export payload, HTML appendices (document release → approvals table → per-section history → comments). |
| [`examples/nuxt-vue/utils/complianceIdentity.ts`](../examples/nuxt-vue/utils/complianceIdentity.ts) | Demo user ids (`COMPLIANCE_DEMO_USER`, `COMPLIANCE_SECOND_APPROVER` for dual sign-off). |

## Relationship to core guides

- **[Compliance lock](./compliance-lock.md)** — Core **`EditorConfig.complianceLock`**, **`EditorConfig.dragDrop`** (`headingLockBadge`, side-menu lock click), heading **`locked` / `lockId`**, **`COMPLIANCE_LOCK_BYPASS_META`**, and **`setDocument`**. The Nuxt demo may combine this with Vue-level `setEditable` for section bodies.
- **[Versioning and track changes](./versioning.md)** — Core APIs for snapshots and track-change accept/reject. In the demo, **approval lock** is implemented in Vue (`setEditable`, disabling controls), not inside the core package.
- **[Comments](./comments.md)** — Thread model and `CommentStore`; the compliance section editor is the richest Vue example wiring comments with approvals.

## Running the demo

From the repo root:

```bash
pnpm --filter @amusendame/beakblock-example-nuxt-vue dev
```

Use the **Document** / **Templates** tabs in the compliance toolbar: manage templates, pick a template, then **New document** to start a scoped instance. Toggle **reviewer mode** to exercise approve / revoke and document release. Export is blocked until validation rules pass (including complete document release when that option is enabled).

**Note:** Upgrading from DB version4 to 5 creates `complianceTemplates` only; existing approval rows keyed as bare section ids are not migrated—use **New document** after upgrade so keys match `${documentInstanceId}::${sectionLockId}`.
