/**
 * Client-side permission guard: a ProseMirror plugin that rejects transactions the policy denies.
 *
 * The guard is a UX and early-rejection layer. It is not a security boundary: the server must
 * run `verifyDocumentChange` on the submitted document.
 *
 * @module
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import { BEAKBLOCK_META_LOAD_DOCUMENT } from '@amusendame/beakblock-core';

import { classifyTransaction } from './classify';
import { createPolicyEngine } from './engine';
import { PERMISSION_BYPASS_META, SYSTEM_ROLE } from './types';
import type { PolicyContext, PolicyDecision, PolicyEngine, ServiceOwnedOptions } from './types';

/** Plugin key of the permission guard. */
export const PERMISSION_GUARD_PLUGIN_KEY = new PluginKey('beakblock-permissions-guard');

/** Options for `createPermissionGuardPlugin`. */
export interface PermissionGuardOptions extends ServiceOwnedOptions {
  /** Returns the principal and grants for the given state. Called for every content-changing transaction. */
  getContext: (state: EditorState) => PolicyContext;
  /** Policy engine. Defaults to `createPolicyEngine()`. */
  engine?: PolicyEngine;
  /** Called with every decision (allowed and denied) when a transaction is rejected. */
  onDenied?: (decisions: PolicyDecision[], tr: Transaction) => void;
}

/** Summarises the denied decisions for a console message. */
export function describeDenials(decisions: PolicyDecision[]): string {
  return decisions
    .filter((d) => !d.allowed)
    .map((d) => `${d.operation.kind}${d.operation.sectionId ? ` in section "${d.operation.sectionId}"` : ''}: ${d.reason ?? 'denied'}`)
    .join('; ');
}

/**
 * Create the guard plugin. A transaction is rejected as a whole when any of its operations is denied.
 *
 * Only content-changing transactions are classified. Selection and meta-only transactions pass.
 * A trusted document load (`trustedLoad: true` on `setDocument`) is not classified (UX only).
 * Creating, deleting or changing a service-owned node (see `SERVICE_OWNED_BLOCK_TYPES`) is denied
 * unless the principal has the `system` role.
 * The bypass meta `beakblock-permissions-bypass` is honoured only for principals with the `system` role.
 *
 * @example
 * ```typescript
 * const plugin = createPermissionGuardPlugin({
 *   getContext: () => ({ userId: 'u1', roles: ['author'], sectionGrants: { S1: ['section.editText'] } }),
 *   onDenied: (decisions) => console.warn(decisions.filter((d) => !d.allowed)),
 * });
 * ```
 */
export function createPermissionGuardPlugin(options: PermissionGuardOptions): Plugin {
  const engine = options.engine ?? createPolicyEngine();
  return new Plugin({
    key: PERMISSION_GUARD_PLUGIN_KEY,
    filterTransaction(tr, state) {
      if (!tr.docChanged) return true;
      // A trusted load (`setDocument(blocks, { trustedLoad: true })`) shows already-saved content.
      // This skip is for UX only; the server's verifyDocumentChange remains authoritative.
      if (tr.getMeta(BEAKBLOCK_META_LOAD_DOCUMENT) === true) return true;
      const ctx = options.getContext(state);
      if (tr.getMeta(PERMISSION_BYPASS_META) === true && ctx.roles.includes(SYSTEM_ROLE)) return true;

      const ops = classifyTransaction(tr, { serviceOwnedTypes: options.serviceOwnedTypes });
      if (ops.length === 0) return true;

      const decisions = engine.decide(ops, ctx);
      if (decisions.every((d) => d.allowed)) return true;

      if (options.onDenied) {
        options.onDenied(decisions, tr);
      } else {
        console.warn(`BeakBlock permissions: a change was rejected. ${describeDenials(decisions)}`);
      }
      return false;
    },
  });
}
