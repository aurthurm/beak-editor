# @amusendame/beakblock-templates

Controlled templates for BeakBlock 2.0 (roadmap 5F and 5G, contract section 7).

## Pipeline

1. **Author** a template: `createTemplate`, `addSection`, `updateSection`, `moveSection`, `removeSection`.
   Drafts only. `publishTemplate` returns a frozen, versioned copy with a `contentHash`.
   `templateFromDocument` derives a draft from an existing controlled document.
2. **Instantiate** with `instantiateDocument(template, { properties, docNumber, assignments })`. Each template
   section becomes a `controlledSection` with locked boilerplate and placeholders. Header and footer carry
   DOCPROPERTY and PAGE fields. `docNumber` is supplied by the QMS service when the rule is `generated`.
3. **Authorize**: `buildPolicyContext(doc, assignments, userId, roles)` returns the permissions `PolicyContext`.
   Owners get `section.editText`, `insertBlock`, `deleteBlock`, `changeStyle` and `table.editStructure` on their own
   section. Mandatory-column and approved-value rights (`table.editMandatoryColumns`, `table.editApprovedValues`) are
   withheld. Approved
   sections are locked. `system` gets every capability, and `qualityManager` gets its default grants. Nobody gets
   `section.delete` (required sections cannot be removed). Check every change with `verifyDocumentChange`.
4. **Validate**: `validateAgainstTemplate(doc, template, { fromWorkflow, registry, procedureBlockTypes })`.
   Checks: missing and out-of-order sections, allowed and required blocks, minimum blocks, boilerplate tampering
   (hash compare), placeholders left in place, procedure steps, property rules (generated, required, max length,
   pattern, workflow-only fields), and block-level issues through a `BlockRegistry`. Client results are feedback.
   The server runs the authoritative check.
5. **Lifecycle**: `transitionSection` (draft, submitted, reviewed, approved, reopened) and `transitionDocument`
   (draft, review, approved, effective, periodicReview, superseded, obsolete). Both are pure, return an audit
   event `{ at, actor, from, to, sectionId, event, comment }`, and throw `InvalidTransitionError` or
   `GuardViolationError` (with a `code`). Guards cover roles, separation of duties, owner-only submit, and comments.
   `freezeSectionRevision` turns an approved section into a deep-frozen revision.
6. **Compose**: `composeDocument({ template, sectionRevisions, properties, generatedParts, watermark })` returns
   `{ document, ir, manifestDraft }`. Sections follow template order and page masters. Heading numbering is
   continuous (numId = the heading numbering instance). Generated parts: notice, revision history, distribution
   list, and approval page with signature blocks. Watermark goes in `properties.custom.watermark`.
7. **Release**: `createRelease` builds a `ReleaseManifest` with the document hash and section hashes.
   `bindSignature` binds a signature to the document hash and rejects any other hash. `attachRendition` adds the
   PDF hash. `verifyRelease` recomputes everything and reports mismatches.
8. **Print**: `stampControlledCopy` returns `{ watermark, controlledCopy: { copyNumber, issuedTo }, ... }` for the
   layout renderer's options. `createPrintRegisterEntry` builds a row for the QMS print register.
9. **Migrate legacy documents**: `mapImportToTemplate(headings, template)` suggests section mappings from
   import-docx headings (normalised titles, synonyms, token and edit-distance scoring, monotonic order).

## Hashing

`contentHash(value)` is SHA-256 (Web Crypto) over canonical JSON. `sectionContentHash(blocks)` excludes the
heading `numbering` and `styleId`. Those are derived at composition, so composition never changes an approved
section's hash. Block text, structure and every other prop are included.

## Gaps and open decisions

- Reusable content, TOC, cross-references, captions and bibliography are not resolved by the composer.
- Concentration units, equipment-from-LIMS and safety-warning rules are not implemented. Use `requiredBlocks` and
  property rules for now.
- `transitionDocument` audit events use `sectionId` for the document id.
- Controlled-copy watermark and rendering belong to `@amusendame/beakblock-layout` and are not rendered here.

## Tests

`pnpm --filter @amusendame/beakblock-templates test` runs the unit tests and `verticalSlice.test.ts`, the
end-to-end scenario from the roadmap exit criteria (four sections, three authors, approvals, composition, release,
signature binding, and tamper detection).
