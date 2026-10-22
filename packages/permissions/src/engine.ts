/**
 * Default policy engine.
 *
 * Decision order for each operation:
 * 1. Locked section: deny.
 * 2. Invalid structure: deny. Service-owned node without the `system` role: deny; with `system`: allow.
 * 2b. Protected section attribute without the `system` role: deny.
 * 3. Deleting a required section: deny (unless `system`).
 * 4. Custom rules, first verdict wins.
 * 5. Uncontrolled content: allowed when `defaultGrants` has `document.editUncontrolled` or the operation's capability.
 * 6. Controlled content: every required capability must be in `sectionGrants[sectionId]` or `defaultGrants`.
 *
 * @module
 */

import { OPERATION_SCOPES, requiredCapabilitiesFor } from './scopes';
import type {
  Capability,
  PolicyContext,
  PolicyDecision,
  PolicyEngine,
  PolicyEngineOptions,
  PolicyRule,
  TypedOperation,
} from './types';
import { SYSTEM_ROLE } from './types';

function deny(operation: TypedOperation, reason: string, requiredCapability?: Capability): PolicyDecision {
  return { allowed: false, operation, reason, requiredCapability };
}

function allow(operation: TypedOperation): PolicyDecision {
  return { allowed: true, operation };
}

function decideOne(
  op: TypedOperation,
  ctx: PolicyContext,
  rules: readonly PolicyRule[]
): PolicyDecision {
  const isSystem = ctx.roles.includes(SYSTEM_ROLE);
  const details = op.details ?? {};

  if (!(op.kind in OPERATION_SCOPES)) {
    return deny(op, `unknown operation kind "${String(op.kind)}"`);
  }

  if (op.sectionId !== null && ctx.lockedSections?.includes(op.sectionId)) {
    return deny(op, `section "${op.sectionId}" is locked`);
  }

  if (details.invalid === true) {
    return deny(op, 'invalid document structure');
  }

  if (details.serviceOwned === true) {
    if (isSystem) return allow(op);
    return deny(op, 'service-owned node can only be created, deleted or changed by the system (signature service or workflow)');
  }

  if (details.protected === true && !isSystem) {
    return deny(op, 'protected section attribute can only be changed by the system');
  }

  if (op.kind === 'deleteSection' && details.required === true && !isSystem) {
    return deny(op, 'required section cannot be deleted', OPERATION_SCOPES.deleteSection);
  }

  for (const rule of rules) {
    const verdict = rule(op, ctx);
    if (verdict !== undefined) {
      return {
        allowed: verdict.allowed,
        operation: op,
        reason: verdict.reason ?? (verdict.allowed ? undefined : 'denied by policy rule'),
        requiredCapability: verdict.requiredCapability,
      };
    }
  }

  const required = requiredCapabilitiesFor(op.kind, details);
  const defaults = ctx.defaultGrants ?? [];

  if (op.sectionId === null) {
    if (defaults.includes('document.editUncontrolled') || defaults.includes(required[0] as Capability)) {
      return allow(op);
    }
    return deny(op, 'uncontrolled content requires document.editUncontrolled', 'document.editUncontrolled');
  }

  const granted = ctx.sectionGrants[op.sectionId] ?? [];
  for (const cap of required) {
    if (!granted.includes(cap) && !defaults.includes(cap)) {
      return deny(op, `missing capability ${cap} for section "${op.sectionId}"`, cap);
    }
  }
  return allow(op);
}

/**
 * Create the default policy engine.
 *
 * @example
 * ```typescript
 * const engine = createPolicyEngine({
 *   rules: [(op, ctx) => (op.kind === 'deleteBlock' && !ctx.roles.includes('editor') ? { allowed: false, reason: 'editors only' } : undefined)],
 * });
 * const decisions = engine.decide(ops, ctx);
 * ```
 */
export function createPolicyEngine(options: PolicyEngineOptions = {}): PolicyEngine {
  const rules = options.rules ?? [];
  return {
    decide(ops, ctx) {
      return ops.map((op) => decideOne(op, ctx, rules));
    },
  };
}

/** True when every decision is allowed. An empty list is allowed. */
export function allDecisionsAllowed(decisions: readonly PolicyDecision[]): boolean {
  return decisions.every((d) => d.allowed);
}
