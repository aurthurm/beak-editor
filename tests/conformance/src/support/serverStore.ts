/**
 * A reference server-side document store for the security suite.
 *
 * It models what the QMS service must do on every submission, without any client trust:
 *
 * 1. Tenant isolation: a document is only visible inside the tenant that owns it. Other tenants get
 *    `not-found`, so existence is not leaked.
 * 2. Replay protection: a submission id is accepted once. A repeated id is `replayed`.
 * 3. Base check: the client must submit against the current stored hash, otherwise `stale-base`.
 * 4. Authorisation: `verifyDocumentChange` diffs the stored blocks with the submitted blocks. The
 *    stored blocks are the "before" state, never the client's claim. Sections whose workflow state is
 *    `approved` are locked on the server, whatever the client sends.
 *
 * It is a test double. The real service adds identity, persistence, signatures and audit.
 *
 * @module
 */
import { createHash } from 'node:crypto';

import type { Block } from '@amusendame/beakblock-core';
import {
  canonicalJson,
  verifyDocumentChange,
  type Capability,
  type PolicyContext,
  type PolicyDecision,
} from '@amusendame/beakblock-permissions';

export interface PrincipalGrants {
  roles: string[];
  sectionGrants: Record<string, Capability[]>;
  defaultGrants?: Capability[];
}

export interface StoredDocument {
  id: string;
  tenantId: string;
  revision: number;
  hash: string;
  blocks: Block[];
  submissions: Set<string>;
}

export interface SubmitRequest {
  documentId: string;
  userId: string;
  /** The hash the client based its edit on. */
  baseHash: string;
  /** Unique id per submission, for replay detection. */
  submissionId: string;
  blocks: Block[];
}

export type SubmitResult =
  | { ok: true; revision: number; hash: string }
  | { ok: false; code: 'not-found' | 'forbidden-principal' | 'replayed' | 'stale-base' | 'forbidden'; reason: string; violations: PolicyDecision[] };

export function hashBlocks(blocks: Block[]): string {
  return createHash('sha256').update(canonicalJson(blocks)).digest('hex');
}

/** Sections the server treats as locked: anything in the approved workflow state. */
export function lockedSectionsOf(blocks: Block[]): string[] {
  const locked: string[] = [];
  const walk = (nodes: Block[]) => {
    for (const node of nodes) {
      if (node.type === 'controlledSection' && node.props.workflowState === 'approved' && typeof node.props.sectionId === 'string') {
        locked.push(node.props.sectionId);
      }
      if (node.children) walk(node.children);
    }
  };
  walk(blocks);
  return locked;
}

interface Tenant {
  documents: Map<string, StoredDocument>;
  principals: Map<string, PrincipalGrants>;
}

export class ServerDocumentStore {
  private readonly tenants = new Map<string, Tenant>();

  private tenant(tenantId: string): Tenant {
    let found = this.tenants.get(tenantId);
    if (!found) {
      found = { documents: new Map(), principals: new Map() };
      this.tenants.set(tenantId, found);
    }
    return found;
  }

  /** Grants a principal rights inside one tenant. Grants never apply across tenants. */
  grant(tenantId: string, userId: string, grants: PrincipalGrants): void {
    this.tenant(tenantId).principals.set(userId, grants);
  }

  createDocument(tenantId: string, id: string, blocks: Block[]): StoredDocument {
    const doc: StoredDocument = { id, tenantId, revision: 1, hash: hashBlocks(blocks), blocks: structuredClone(blocks), submissions: new Set() };
    this.tenant(tenantId).documents.set(id, doc);
    return doc;
  }

  /** Returns the stored document for a tenant, or null. Cross-tenant reads return null. */
  read(tenantId: string, userId: string, documentId: string): { revision: number; hash: string; blocks: Block[] } | null {
    const doc = this.tenant(tenantId).documents.get(documentId);
    if (!doc || !this.tenant(tenantId).principals.has(userId)) return null;
    return { revision: doc.revision, hash: doc.hash, blocks: structuredClone(doc.blocks) };
  }

  submit(tenantId: string, request: SubmitRequest): SubmitResult {
    const scope = this.tenant(tenantId);
    const doc = scope.documents.get(request.documentId);
    if (!doc) return { ok: false, code: 'not-found', reason: 'document not found', violations: [] };

    const grants = scope.principals.get(request.userId);
    if (!grants) return { ok: false, code: 'forbidden-principal', reason: 'principal has no grants in this tenant', violations: [] };

    if (doc.submissions.has(request.submissionId)) {
      return { ok: false, code: 'replayed', reason: `submission ${request.submissionId} was already applied`, violations: [] };
    }
    if (request.baseHash !== doc.hash) {
      return { ok: false, code: 'stale-base', reason: 'base hash does not match the current revision', violations: [] };
    }

    const ctx: PolicyContext = {
      userId: request.userId,
      roles: grants.roles,
      sectionGrants: grants.sectionGrants,
      defaultGrants: grants.defaultGrants ?? [],
      lockedSections: lockedSectionsOf(doc.blocks),
    };
    const verdict = verifyDocumentChange(doc.blocks, request.blocks, ctx);
    if (!verdict.allowed) {
      return { ok: false, code: 'forbidden', reason: verdict.violations.map((v) => v.reason ?? 'denied').join('; '), violations: verdict.violations };
    }

    doc.blocks = structuredClone(request.blocks);
    doc.revision += 1;
    doc.hash = hashBlocks(doc.blocks);
    doc.submissions.add(request.submissionId);
    return { ok: true, revision: doc.revision, hash: doc.hash };
  }
}
