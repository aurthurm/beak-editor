/**
 * Public types for BeakBlock section permissions.
 *
 * @module
 */

/** Node type name of a controlled section. Its `sectionId` attribute identifies the section. */
export const CONTROLLED_SECTION_NODE = 'controlledSection';

/** Kinds of typed operation. Each has a default authorization scope (see `OPERATION_SCOPES`). */
export type OperationKind =
  | 'insertBlock'
  | 'deleteBlock'
  | 'replaceText'
  | 'formatText'
  | 'moveBlock'
  | 'moveSection'
  | 'deleteSection'
  | 'renameSection'
  | 'updateTableCell'
  | 'changeTableStructure'
  | 'changeStyle'
  | 'editAttrs'
  | 'acceptRevision'
  | 'rejectRevision';

/** Capabilities a principal can hold on a section. */
export type Capability =
  | 'section.editText'
  | 'section.insertBlock'
  | 'section.deleteBlock'
  | 'section.delete'
  | 'section.rename'
  | 'section.move'
  | 'section.moveContentOut'
  | 'section.changeStyle'
  | 'table.editStructure'
  | 'table.editMandatoryColumns'
  | 'table.editApprovedValues'
  | 'revision.accept'
  | 'revision.reject'
  | 'document.editUncontrolled';

/**
 * A change classified from a transaction or derived from two document states.
 *
 * `sectionId` is null for content outside any controlled section. `details` carries
 * operation-specific data. The reserved keys the engine reads are:
 * - `direction`: `'out' | 'in' | 'within'` for moves (`out` also needs `section.moveContentOut`, `in` needs `section.insertBlock`)
 * - `required`: true when deleting a required section (always denied)
 * - `protected`: true for protected section attributes (denied unless the principal has the `system` role)
 * - `invalid`: true when the structure is malformed (always denied)
 * - `requiresCapabilities`: extra capabilities that must also be granted
 * - `serviceOwned`: true when the operation creates, deletes or changes a service-owned node (see `SERVICE_OWNED_BLOCK_TYPES`); allowed only with the `system` role
 */
export interface TypedOperation {
  kind: OperationKind;
  sectionId: string | null;
  blockId?: string;
  blockType?: string;
  from?: number;
  to?: number;
  details?: Record<string, unknown>;
}

/** The principal and grants a policy decision is made for. */
export interface PolicyContext {
  userId: string;
  roles: string[];
  /** Capabilities per section id. */
  sectionGrants: Record<string, Capability[]>;
  /** Capabilities that apply to every section, including uncontrolled content. */
  defaultGrants?: Capability[];
  /** Sections that deny every operation, regardless of grants. */
  lockedSections?: string[];
}

/** The outcome for one operation. */
export interface PolicyDecision {
  allowed: boolean;
  operation: TypedOperation;
  reason?: string;
  requiredCapability?: Capability;
}

/** Verdict returned by a custom rule. Returning `undefined` defers to the next rule. */
export interface PolicyRuleResult {
  allowed: boolean;
  reason?: string;
  requiredCapability?: Capability;
}

/**
 * Custom rule. Rules run after the built-in lock, system-only and required-section checks,
 * and before the default grant check. A rule can deny an operation or allow it, but it cannot
 * override a locked section.
 */
export type PolicyRule = (operation: TypedOperation, ctx: PolicyContext) => PolicyRuleResult | undefined;

/** Decides a batch of operations atomically. */
export interface PolicyEngine {
  decide(ops: TypedOperation[], ctx: PolicyContext): PolicyDecision[];
}

/** Options for `createPolicyEngine`. */
export interface PolicyEngineOptions {
  rules?: PolicyRule[];
}

/** Options for the server verifier, the client classifier and the guard. */
export interface ServiceOwnedOptions {
  /** Node types treated as service-owned. Defaults to `SERVICE_OWNED_BLOCK_TYPES`. */
  serviceOwnedTypes?: readonly string[];
}

/** Transaction meta key that bypasses the guard. Honoured only when `ctx.roles` includes `system`. */
export const PERMISSION_BYPASS_META = 'beakblock-permissions-bypass';

/** Role required for bypass and for protected attribute changes. */
export const SYSTEM_ROLE = 'system';

/** Result of server-side verification. */
export interface VerificationResult {
  /** True only when every derived operation is allowed. */
  allowed: boolean;
  /** Operations derived from the diff of the two documents. */
  operations: TypedOperation[];
  /** One decision per derived operation. */
  decisions: PolicyDecision[];
  /** The denied decisions (empty when `allowed`). */
  violations: PolicyDecision[];
}
