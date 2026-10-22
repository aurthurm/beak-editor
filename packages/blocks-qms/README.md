# @amusendame/beakblock-blocks-qms

QMS control blocks for BeakBlock 2.0 (roadmap 5F, contract section 7).

- `controlledSection`: a block container (`block+`) with `sectionId`, `templateSectionId`, `policyRef`,
  `required`, `allowedBlocks`, `title`, `ownerName`, `workflowState` and a presentation-only `locked`.
  It holds no authorization data. The node view is an Office-style content control: a thin bracket on
  hover or focus and a small header tab (title, owner, state, lock icon).
- Atoms: `signatureBlock`, `approvalBlock`, `revisionHistory`, `controlledNotice`, `acknowledgement`,
  and the inline `documentIdentifier`.

## Usage

```ts
import { BeakBlockEditor } from '@amusendame/beakblock-core';
import { qmsExtension, createQmsCommands, injectQmsStyles } from '@amusendame/beakblock-blocks-qms';

injectQmsStyles();
const editor = new BeakBlockEditor({
  element,
  mode: 'controlled',
  extensions: [qmsExtension({ getPolicyContext: (state) => policyFor(state) })],
});
registry.register(createQmsCommands()); // from @amusendame/beakblock-commands registry
```

## Enforcement

`createControlledSectionPlugin(options)` (also bundled by `qmsExtension`) rejects transactions that:

- insert a block type not in the section's `allowedBlocks` (set `enforceAllowedBlocks: false` to disable),
- delete a required section,
- change a protected section attribute (`sectionId`, `templateSectionId`, `policyRef`, `required`,
  `allowedBlocks`, `ownerName`, `workflowState`). Only the QMS service (`QMS_SERVICE_META`) may do this,
  and `qms.submitSection` may change `workflowState` through `QMS_WORKFLOW_META`,
- change, delete or pre-sign a signature block. Only the signature service (`SIGNATURE_SERVICE_META`)
  may write one. Inserting an unsigned placeholder is allowed.

With `getPolicyContext`, the permissions guard is composed in and sections the principal cannot edit get
`data-editable="false"` and `contenteditable="false"`.

**The server is authoritative.** These checks are UX and early rejection. Client meta keys are not a
security boundary. The server must run `verifyDocumentChange` from `@amusendame/beakblock-permissions`
and reject the submission on any violation.

**Loading a released document.** A default `setDocument` is checked as an edit, so a document that contains
signed signature blocks is refused (the old document stays and a warning is logged). To display a released
document, load it with `editor.setDocument(blocks, { trustedLoad: true })`. Only then do the controlled-section
checks allow pre-signed signature blocks and service-owned attributes. This is UX only: the server must still
verify the submitted document with `verifyDocumentChange`. Do not pass `trustedLoad` for content from a client.

## Block definitions

`qmsBlockDefinitions` (family `qms`) provide `validate` (for example a missing `sectionId`, disallowed
children, a signed block without hash or signer, a controlled copy without a copy number), `renderPrint`
(escaped print HTML) and a lossy `toIR` (a paragraph summary with the original block in `source`).
`controlledSection` is mapped to `sdt` by the IR package itself.

## Commands

`createQmsCommands()` returns command definitions shaped like `CommandDefinition` from the commands
package, without depending on it: `qms.insertSection`, `qms.submitSection`, `qms.lockSection`,
`qms.insertSignature`, `qms.insertNotice`, `qms.insertRevisionHistory`.

## Tests

`pnpm --filter @amusendame/beakblock-blocks-qms test` runs plugin, command, definition and editor tests.
