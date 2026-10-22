/**
 * Mapping from operation kinds to the capability each one requires inside a controlled section.
 *
 * @module
 */

import type { Capability, OperationKind } from './types';

/** Primary capability required for each operation kind inside a controlled section. */
export const OPERATION_SCOPES: Readonly<Record<OperationKind, Capability>> = {
  insertBlock: 'section.insertBlock',
  deleteBlock: 'section.deleteBlock',
  replaceText: 'section.editText',
  formatText: 'section.editText',
  moveBlock: 'section.move',
  moveSection: 'section.move',
  deleteSection: 'section.delete',
  renameSection: 'section.rename',
  updateTableCell: 'section.editText',
  changeTableStructure: 'table.editStructure',
  changeStyle: 'section.changeStyle',
  editAttrs: 'section.editText',
  acceptRevision: 'revision.accept',
  rejectRevision: 'revision.reject',
};

/** Every capability, in a stable order. */
export const ALL_CAPABILITIES: readonly Capability[] = [
  'section.editText',
  'section.insertBlock',
  'section.deleteBlock',
  'section.delete',
  'section.rename',
  'section.move',
  'section.moveContentOut',
  'section.changeStyle',
  'table.editStructure',
  'table.editMandatoryColumns',
  'table.editApprovedValues',
  'revision.accept',
  'revision.reject',
  'document.editUncontrolled',
];

/** Attributes of a controlled section that only the system may change. */
export const PROTECTED_SECTION_ATTRS: readonly string[] = [
  'sectionId',
  'templateSectionId',
  'policyRef',
  'required',
  'allowedBlocks',
  'ownerName',
  'workflowState',
];

/**
 * Node types owned by services rather than authors: signature blocks, approval blocks, revision
 * history, controlled notices and document identifiers. Only a principal with the `system` role
 * (the signature service or a workflow) may create, delete or change them, in any section and in
 * uncontrolled content. Inline node types (such as `documentIdentifier`) are matched by name too.
 * Override per call with `ServiceOwnedOptions.serviceOwnedTypes`.
 */
export const SERVICE_OWNED_BLOCK_TYPES: readonly string[] = [
  'signatureBlock',
  'approvalBlock',
  'revisionHistory',
  'controlledNotice',
  'documentIdentifier',
];

/** Capabilities required for an operation kind, given its details. */
export function requiredCapabilitiesFor(
  kind: OperationKind,
  details: Record<string, unknown> | undefined
): Capability[] {
  const caps: Capability[] = [OPERATION_SCOPES[kind]];
  if (kind === 'moveBlock' || kind === 'moveSection') {
    if (details?.direction === 'out') caps.push('section.moveContentOut');
    if (details?.direction === 'in') caps.push('section.insertBlock');
  }
  const extra = details?.requiresCapabilities;
  if (Array.isArray(extra)) {
    for (const cap of extra) {
      if (typeof cap === 'string' && !caps.includes(cap as Capability)) caps.push(cap as Capability);
    }
  }
  return caps;
}
