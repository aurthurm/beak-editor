# @amusendame/beakblock-permissions

Typed operations, authorization scopes, and policy enforcement for controlled sections.

Two layers enforce the policy:

- **Client guard** (`createPermissionGuardPlugin`). Rejects a transaction early, for UX. It is not a security boundary.
- **Server verifier** (`verifyDocumentChange`). The authority. It diffs the stored and submitted block trees itself and never trusts client-declared operations.

## Controlled sections

A controlled section is a node of type `controlledSection` with a `sectionId` attribute. Permissions are granted per section id:

```typescript
const ctx: PolicyContext = {
  userId: 'u1',
  roles: ['author'],
  sectionGrants: { S1: ['section.editText', 'section.insertBlock'], S2: ['section.editText'] },
  defaultGrants: [],          // applies to every section, including uncontrolled content
  lockedSections: ['S3'],     // denies everything, regardless of grants
};
```

Content outside any section needs `document.editUncontrolled`, either in `defaultGrants` or as the operation's own capability.

## Operations and scopes

`OPERATION_SCOPES` maps each `OperationKind` to its primary capability:

| Operation | Capability |
|---|---|
| `insertBlock` | `section.insertBlock` |
| `deleteBlock` | `section.deleteBlock` |
| `replaceText`, `formatText`, `updateTableCell`, `editAttrs` | `section.editText` |
| `moveBlock`, `moveSection` | `section.move` |
| `deleteSection` | `section.delete` |
| `renameSection` | `section.rename` |
| `changeStyle` | `section.changeStyle` |
| `changeTableStructure` | `table.editStructure` |
| `acceptRevision` / `rejectRevision` | `revision.accept` / `revision.reject` |

Extra checks:

- A move `out` of a section also requires `section.moveContentOut`. A move `in` also requires `section.insertBlock`.
- `details.requiresCapabilities` adds capabilities, for example `table.editMandatoryColumns`.

## Default engine

`createPolicyEngine({ rules? })` decides in this order:

1. Locked section: deny.
2. `details.invalid`: deny.
3. Protected attribute (`required`, `workflowState`, `sectionId`, ...) without the `system` role: deny.
4. Deleting a required section without `system`: deny.
5. Custom rules. The first verdict wins and cannot override steps 1 to 4.
6. Uncontrolled content: allowed with `document.editUncontrolled` (or the operation's capability) in `defaultGrants`.
7. Controlled content: every required capability must be in `sectionGrants[sectionId]` or `defaultGrants`.

```typescript
const engine = createPolicyEngine({
  rules: [(op, ctx) => (op.kind === 'deleteBlock' && !ctx.roles.includes('editor') ? { allowed: false, reason: 'editors only' } : undefined)],
});
const decisions = engine.decide(ops, ctx);
```

## Client guard

```typescript
const plugin = createPermissionGuardPlugin({
  getContext: (state) => currentPolicyContext(),
  onDenied: (decisions, tr) => showDenied(decisions.filter((d) => !d.allowed)),
});
const state = EditorState.create({ schema, doc, plugins: [plugin] });
```

- Only content-changing transactions are classified.
- A transaction is rejected as a whole if any operation is denied.
- The meta key `beakblock-permissions-bypass` is honoured only for principals with the `system` role.

## Classifying transactions

`classifyTransaction(tr)` walks each step against the document it applies to:

- Text inside a textblock becomes `replaceText`, or `updateTableCell` inside a cell.
- Mark steps become `formatText`.
- Deleting a section becomes `deleteSection`, and its nested blocks are checked against their own sections.
- A change to `title` becomes `renameSection`.
- Removing and re-inserting a block with the same id becomes `moveBlock` (`out` and `in` across sections).
- A range that spans several sections yields one operation per section.

## Server verification

```typescript
import { verifyDocumentChange } from '@amusendame/beakblock-permissions';

const result = verifyDocumentChange(storedBlocks, submittedBlocks, ctx);
if (!result.allowed) {
  reject(result.violations.map((v) => v.reason));
}
```

- Both trees are indexed by `props.sectionId`. Operations are derived from their canonical JSON.
- Every removed section and block is checked on its own, including nested ones.
- A moved section is checked on its own id as well as on its old and new containers.
- Malformed structure (duplicate or missing ids) produces an `invalid` operation that is always denied.
- Pure TypeScript, with no DOM dependency.

## Limitations

- Accepting and rejecting tracked changes is only partly distinguishable at the step level. Removing a `deletion` or `insertion` mark is classified as `acceptRevision`. Removing the text itself is classified as an ordinary text change. The review package should set the authorisation context.
- Blocks inside a newly inserted section are covered by the insertion of the section itself, which is checked against its parent. They do not receive their own grant checks.
