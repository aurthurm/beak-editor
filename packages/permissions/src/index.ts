/**
 * @amusendame/beakblock-permissions
 *
 * Typed operations, authorization scopes and policy enforcement for controlled sections.
 *
 * Client-side guards (`createPermissionGuardPlugin`) give early rejection and UX. The server must
 * run `verifyDocumentChange` on every submitted document, because it never trusts client-declared
 * operations.
 *
 * @example
 * ```typescript
 * import { verifyDocumentChange } from '@amusendame/beakblock-permissions';
 *
 * const result = verifyDocumentChange(storedBlocks, submittedBlocks, ctx);
 * if (!result.allowed) throw new Error(result.violations[0]?.reason);
 * ```
 *
 * @module
 */

export {
  CONTROLLED_SECTION_NODE,
  PERMISSION_BYPASS_META,
  SYSTEM_ROLE,
} from './types';
export type {
  Capability,
  ServiceOwnedOptions,
  OperationKind,
  PolicyContext,
  PolicyDecision,
  PolicyEngine,
  PolicyEngineOptions,
  PolicyRule,
  PolicyRuleResult,
  TypedOperation,
  VerificationResult,
} from './types';

export {
  OPERATION_SCOPES,
  ALL_CAPABILITIES,
  PROTECTED_SECTION_ATTRS,
  SERVICE_OWNED_BLOCK_TYPES,
  requiredCapabilitiesFor,
} from './scopes';
export { createPolicyEngine, allDecisionsAllowed } from './engine';
export { classifyTransaction, sectionIdOfNode, UNIDENTIFIED_SECTION } from './classify';
export {
  createPermissionGuardPlugin,
  describeDenials,
  PERMISSION_GUARD_PLUGIN_KEY,
} from './guard';
export type { PermissionGuardOptions } from './guard';
export { verifyDocumentChange, canonicalJson } from './verify';
