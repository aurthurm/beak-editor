/**
 * In-memory authoritative store for the BeakBlock 2.0 controlled-document scenario.
 *
 * The browser editor enforces section permissions for UX only. Every change that reaches
 * this store is re-verified here with `verifyDocumentChange` against the stored document,
 * so a malicious client that skips the editor cannot alter approved or foreign sections.
 *
 * Identity is asserted by the client in this demo (there is no login). A real QMS service
 * would derive the actor from the authenticated session instead.
 */
import type { Block } from '@amusendame/beakblock-core';
import { verifyDocumentChange, type PolicyContext, type VerificationResult } from '@amusendame/beakblock-permissions';
import {
  buildPolicyContext,
  contentHash,
  createSectionLifecycle,
  sectionContentHash,
  transitionSection,
  type Actor,
  type SectionAssignments,
  type SectionEvent,
  type SectionLifecycle,
  type TransitionAuditEvent,
} from '@amusendame/beakblock-templates';

export interface ServerComment {
  id: string;
  sectionId: string;
  authorId: string;
  authorName: string;
  body: string;
  at: string;
}

export interface ServerSecurityEvent {
  at: string;
  actorId: string;
  action: string;
  outcome: 'allowed' | 'denied' | 'stale' | 'error';
  reason: string;
}

export interface ServerRelease {
  at: string;
  releasedBy: string;
  documentHash: string;
  sections: Array<{ sectionId: string; templateSectionId: string | null; contentHash: string; revision: string }>;
}

export interface ServerDocument {
  id: string;
  version: number;
  title: string;
  docNumber: string;
  revision: string;
  blocks: Block[];
  assignments: SectionAssignments;
  lifecycles: Record<string, SectionLifecycle>;
  audit: TransitionAuditEvent[];
  comments: ServerComment[];
  security: ServerSecurityEvent[];
  release: ServerRelease | null;
  updatedAt: string;
}

const documents = new Map<string, ServerDocument>();

const now = () => new Date().toISOString();

export function getServerDocument(id: string): ServerDocument | null {
  return documents.get(id) ?? null;
}

export function deleteServerDocument(id: string): void {
  documents.delete(id);
}

function sectionBlocks(doc: ServerDocument): Block[] {
  return doc.blocks.filter((b) => b.type === 'controlledSection');
}

/** The policy context a given actor holds on the stored document (derived server-side). */
export function policyFor(doc: ServerDocument, actor: Actor): PolicyContext {
  const fake = { sections: [{ id: 'sec-1', blocks: doc.blocks }] } as unknown as Parameters<typeof buildPolicyContext>[0];
  return buildPolicyContext(fake, doc.assignments, actor.userId, actor.roles ?? []);
}

export function recordSecurity(doc: ServerDocument, event: Omit<ServerSecurityEvent, 'at'>): void {
  doc.security.unshift({ at: now(), ...event });
  doc.security = doc.security.slice(0, 50);
}

export function createServerDocument(input: {
  id: string;
  title: string;
  docNumber: string;
  revision: string;
  blocks: Block[];
  assignments: SectionAssignments;
}): ServerDocument {
  const lifecycles: Record<string, SectionLifecycle> = {};
  for (const block of input.blocks) {
    if (block.type !== 'controlledSection') continue;
    const sectionId = String(block.props.sectionId);
    const tsid = String(block.props.templateSectionId);
    const owner = input.assignments[tsid]?.ownerId ?? null;
    lifecycles[sectionId] = createSectionLifecycle(sectionId, owner);
  }
  const doc: ServerDocument = {
    id: input.id,
    version: 1,
    title: input.title,
    docNumber: input.docNumber,
    revision: input.revision,
    blocks: structuredClone(input.blocks),
    assignments: structuredClone(input.assignments),
    lifecycles,
    audit: [],
    comments: [],
    security: [],
    release: null,
    updatedAt: now(),
  };
  documents.set(doc.id, doc);
  return doc;
}

export type SaveOutcome =
  | { ok: true; version: number; documentHash: string }
  | { ok: false; status: number; error: string; verification?: VerificationResult; currentVersion?: number };

/**
 * Verifies and stores a full-document save. The client's declared intent is ignored: the server
 * diffs the stored blocks against the submitted blocks and checks every derived operation.
 */
export function saveServerDocument(
  doc: ServerDocument,
  actor: Actor,
  baseVersion: number,
  incoming: Block[]
): SaveOutcome {
  if (doc.release) {
    recordSecurity(doc, { actorId: actor.userId, action: 'save', outcome: 'denied', reason: 'document is released' });
    return { ok: false, status: 409, error: 'The document has been released and is immutable.' };
  }
  if (baseVersion !== doc.version) {
    recordSecurity(doc, {
      actorId: actor.userId,
      action: 'save',
      outcome: 'stale',
      reason: `base version ${baseVersion} is stale (server is at ${doc.version})`,
    });
    return {
      ok: false,
      status: 409,
      error: 'Stale update: the document changed on the server. Reload and re-apply your edit.',
      currentVersion: doc.version,
    };
  }
  const ctx = policyFor(doc, actor);
  const verification = verifyDocumentChange(doc.blocks, incoming, ctx);
  if (!verification.allowed) {
    const first = verification.violations[0];
    recordSecurity(doc, {
      actorId: actor.userId,
      action: 'save',
      outcome: 'denied',
      reason: first?.reason ?? 'operation not permitted',
    });
    return {
      ok: false,
      status: 403,
      error: first?.reason ?? 'Operation not permitted by the section policy',
      verification,
    };
  }
  doc.blocks = structuredClone(incoming);
  doc.version += 1;
  doc.updatedAt = now();
  recordSecurity(doc, {
    actorId: actor.userId,
    action: 'save',
    outcome: 'allowed',
    reason: `version ${doc.version}: ${verification.operations.length} operation(s) verified`,
  });
  return { ok: true, version: doc.version, documentHash: '' };
}

export type TransitionOutcome =
  | { ok: true; lifecycle: SectionLifecycle; audit: TransitionAuditEvent; version: number }
  | { ok: false; status: number; error: string };

const SECTION_EVENT_TO_STATE: Record<SectionEvent, string> = {
  submit: 'submitted',
  review: 'reviewed',
  requestChanges: 'reopened',
  approve: 'approved',
  reopen: 'reopened',
};

/** Runs a section lifecycle event on the server and syncs workflowState and the lock onto the stored section. */
export function transitionServerSection(
  doc: ServerDocument,
  actor: Actor,
  sectionId: string,
  event: SectionEvent,
  comment?: string
): TransitionOutcome {
  if (doc.release) return { ok: false, status: 409, error: 'The document has been released.' };
  const lifecycle = doc.lifecycles[sectionId];
  if (!lifecycle) return { ok: false, status: 404, error: `Unknown section ${sectionId}` };
  try {
    const out = transitionSection(lifecycle, event, actor, { comment });
    doc.lifecycles[sectionId] = out.lifecycle;
    doc.audit.push(out.audit);
    for (const block of sectionBlocks(doc)) {
      if (block.props.sectionId !== sectionId) continue;
      block.props.workflowState = SECTION_EVENT_TO_STATE[event];
      block.props.locked = out.lifecycle.state === 'approved';
    }
    doc.version += 1;
    doc.updatedAt = now();
    recordSecurity(doc, { actorId: actor.userId, action: `section.${event}`, outcome: 'allowed', reason: `${sectionId}: ${out.audit.from} to ${out.audit.to}` });
    return { ok: true, lifecycle: out.lifecycle, audit: out.audit, version: doc.version };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transition rejected';
    recordSecurity(doc, { actorId: actor.userId, action: `section.${event}`, outcome: 'denied', reason: message });
    return { ok: false, status: 409, error: message };
  }
}

export function addServerComment(doc: ServerDocument, actor: Actor, sectionId: string, body: string): ServerComment {
  const comment: ServerComment = {
    id: `cmt-${doc.comments.length + 1}-${Math.random().toString(36).slice(2, 7)}`,
    sectionId,
    authorId: actor.userId,
    authorName: actor.displayName ?? actor.userId,
    body,
    at: now(),
  };
  doc.comments.push(comment);
  doc.updatedAt = now();
  return comment;
}

/** Server-side release: every section must be approved. Hashes are computed from the stored blocks. */
export async function releaseServerDocument(doc: ServerDocument, actor: Actor): Promise<{ ok: true; release: ServerRelease } | { ok: false; status: number; error: string }> {
  if (doc.release) return { ok: false, status: 409, error: 'Already released.' };
  const unapproved = Object.values(doc.lifecycles).filter((l) => l.state !== 'approved');
  if (unapproved.length > 0) {
    return { ok: false, status: 409, error: `${unapproved.length} section(s) are not approved yet.` };
  }
  const sections = [];
  for (const block of sectionBlocks(doc)) {
    sections.push({
      sectionId: String(block.props.sectionId),
      templateSectionId: (block.props.templateSectionId as string | null) ?? null,
      contentHash: await sectionContentHash(block.children ?? []),
      revision: '1.0',
    });
  }
  const release: ServerRelease = {
    at: now(),
    releasedBy: actor.userId,
    documentHash: await contentHash(doc.blocks),
    sections,
  };
  doc.release = release;
  doc.version += 1;
  doc.updatedAt = now();
  for (const block of sectionBlocks(doc)) block.props.locked = true;
  recordSecurity(doc, { actorId: actor.userId, action: 'release', outcome: 'allowed', reason: `document hash ${release.documentHash.slice(0, 12)}` });
  return { ok: true, release };
}

export async function documentHashOfServer(doc: ServerDocument): Promise<string> {
  return contentHash(doc.blocks);
}

export function readActor(body: unknown): Actor | null {
  if (!body || typeof body !== 'object') return null;
  const raw = (body as { actor?: unknown }).actor;
  if (!raw || typeof raw !== 'object') return null;
  const actor = raw as { userId?: unknown; roles?: unknown; displayName?: unknown };
  if (typeof actor.userId !== 'string' || !actor.userId) return null;
  return {
    userId: actor.userId.slice(0, 80),
    displayName: typeof actor.displayName === 'string' ? actor.displayName.slice(0, 80) : actor.userId,
    roles: Array.isArray(actor.roles) ? actor.roles.filter((r): r is string => typeof r === 'string').slice(0, 10) : [],
  };
}
