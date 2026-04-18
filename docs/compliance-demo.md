# Compliance workflow (Nuxt example)

The **`examples/nuxt-vue`** app includes a **multi-section compliance workspace** built on BeakBlock. It is **sample product code**, not part of `@aurthurm/beakblock-core` APIs. Use it as a reference for combining versioning, track changes, comments, approvals, and export.

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

## Key files

| Path | Role |
|------|------|
| [`examples/nuxt-vue/components/ComplianceDocumentWorkspace.vue`](../examples/nuxt-vue/components/ComplianceDocumentWorkspace.vue) | Orchestrates sections, loads/saves IDB state, reviewer toggle, document-release UI, export gate. |
| [`examples/nuxt-vue/components/ComplianceSectionEditor.vue`](../examples/nuxt-vue/components/ComplianceSectionEditor.vue) | Single section editor: approval UI, lock banner, history panel, versioning + comments. |
| [`examples/nuxt-vue/utils/complianceDb.ts`](../examples/nuxt-vue/utils/complianceDb.ts) | IndexedDB **`beakblock-compliance-demo`** (version **4**): `sectionVersions`, `sectionComments`, `sectionApprovals`, `documentRelease`. |
| [`examples/nuxt-vue/utils/complianceApproval.ts`](../examples/nuxt-vue/utils/complianceApproval.ts) | `SectionApprovalRecord`, `history`, `applySectionApprovalTransition`, load/save helpers. |
| [`examples/nuxt-vue/utils/complianceDocumentRelease.ts`](../examples/nuxt-vue/utils/complianceDocumentRelease.ts) | Document release record, completeness check, persistence. |
| [`examples/nuxt-vue/utils/complianceExport.ts`](../examples/nuxt-vue/utils/complianceExport.ts) | Export payload, HTML appendices (document release → approvals table → per-section history → comments). |
| [`examples/nuxt-vue/utils/complianceIdentity.ts`](../examples/nuxt-vue/utils/complianceIdentity.ts) | Demo user ids (`COMPLIANCE_DEMO_USER`, `COMPLIANCE_SECOND_APPROVER` for dual sign-off). |

## Relationship to core guides

- **[Versioning and track changes](./versioning.md)** — Core APIs for snapshots and track-change accept/reject. In the demo, **approval lock** is implemented in Vue (`setEditable`, disabling controls), not inside the core package.
- **[Comments](./comments.md)** — Thread model and `CommentStore`; the compliance section editor is the richest Vue example wiring comments with approvals.

## Running the demo

From the repo root:

```bash
pnpm --filter @aurthurm/beakblock-example-nuxt-vue dev
```

Toggle **reviewer mode** in the workspace to exercise approve / revoke and document release. Export is blocked until validation rules pass (including complete document release when that option is enabled).
