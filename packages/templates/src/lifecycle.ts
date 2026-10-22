/**
 * Section and document lifecycle state machines (roadmap 5F), and immutable section revisions.
 *
 * Pure functions. Each transition returns the next state and an audit event. Invalid transitions
 * and guard failures throw typed errors. Persisting the state and the audit trail is the caller's job.
 *
 * Section: draft -> submitted -> reviewed -> approved -> (reopened -> submitted ...).
 * Document: draft -> review -> approved -> effective -> periodicReview -> superseded | obsolete.
 *
 * @module
 */

import type { Block } from './types';
import type {
  Actor,
  DocumentLifecycle,
  DocumentState,
  SectionLifecycle,
  SectionRevision,
  SectionWorkflowState,
  TransitionAuditEvent,
} from './types';
import { sectionContentHash } from './hash';
import { cloneDeep, deepFreeze } from './blocks';

/** Base class of lifecycle errors. `code` is stable for programmatic handling. */
export class LifecycleError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'LifecycleError';
    this.code = code;
  }
}

/** The event is not allowed from the current state. */
export class InvalidTransitionError extends LifecycleError {
  constructor(from: string, event: string) {
    super('invalid-transition', `Event "${event}" is not allowed from state "${from}"`);
    this.name = 'InvalidTransitionError';
  }
}

/** A guard failed: missing role, separation of duties, missing comment, not the owner, ... */
export class GuardViolationError extends LifecycleError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = 'GuardViolationError';
  }
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

/** Events that move a section. */
export type SectionEvent = 'submit' | 'review' | 'requestChanges' | 'approve' | 'reopen';

interface SectionRule {
  from: readonly SectionWorkflowState[];
  to: SectionWorkflowState;
  /** Actor must hold one of these roles. */
  roles?: readonly string[];
  /**
   * Separation of duties. `submitter`: the actor must not be the submitter.
   * `all`: the actor must not be anyone who has already acted (submitter or reviewer).
   */
  separation?: 'submitter' | 'all';
  /** The actor must be the section owner. */
  owner?: boolean;
  /** A comment is required. */
  comment?: boolean;
}

const SECTION_RULES: Readonly<Record<SectionEvent, SectionRule>> = {
  submit: { from: ['draft', 'reopened'], to: 'submitted', owner: true },
  review: { from: ['submitted'], to: 'reviewed', roles: ['reviewer'], separation: 'submitter' },
  requestChanges: { from: ['submitted', 'reviewed'], to: 'reopened', roles: ['reviewer', 'approver'], separation: 'submitter', comment: true },
  approve: { from: ['reviewed'], to: 'approved', roles: ['approver'], separation: 'all' },
  reopen: { from: ['approved'], to: 'reopened', roles: ['approver'], comment: true },
};

/** Creates the lifecycle record of a section in `draft`. */
export function createSectionLifecycle(sectionId: string, ownerId: string | null = null): SectionLifecycle {
  return { sectionId, state: 'draft', ownerId, submittedBy: null, reviewedBy: null, approvedBy: null, approvedAt: null };
}

function requireRole(actor: Actor, roles: readonly string[]): void {
  const held = actor.roles ?? [];
  if (!roles.some((role) => held.includes(role))) {
    throw new GuardViolationError('role-required', `Actor "${actor.userId}" needs one of roles: ${roles.join(', ')}`);
  }
}

/**
 * Moves a section by one event.
 *
 * Guards: the source state; the role (`reviewer`, `approver`); separation of duties (the actor
 * cannot be a previous submitter or reviewer); owner-only submit; a comment on reopen and
 * requested changes.
 *
 * @throws {InvalidTransitionError} when the event is not allowed from the current state
 * @throws {GuardViolationError} when a guard fails
 */
export function transitionSection(
  lifecycle: SectionLifecycle,
  event: SectionEvent,
  actor: Actor,
  options: { comment?: string; at?: string } = {}
): { lifecycle: SectionLifecycle; audit: TransitionAuditEvent } {
  const rule = SECTION_RULES[event];
  if (!rule) throw new InvalidTransitionError(lifecycle.state, event);
  if (!rule.from.includes(lifecycle.state)) throw new InvalidTransitionError(lifecycle.state, event);
  if (rule.owner && lifecycle.ownerId !== null && actor.userId !== lifecycle.ownerId) {
    throw new GuardViolationError('not-owner', `Only the section owner can ${event} this section`);
  }
  if (rule.roles) requireRole(actor, rule.roles);
  if (rule.separation) {
    const acted = rule.separation === 'all'
      ? [lifecycle.submittedBy, lifecycle.reviewedBy]
      : [lifecycle.submittedBy];
    if (acted.some((id) => id !== null && id === actor.userId)) {
      throw new GuardViolationError('separation-of-duties', `Actor "${actor.userId}" already acted on this section`);
    }
  }
  if (rule.comment && !options.comment?.trim()) {
    throw new GuardViolationError('comment-required', `Event "${event}" needs a comment`);
  }

  const at = options.at ?? new Date().toISOString();
  const next: SectionLifecycle = { ...lifecycle, state: rule.to };
  switch (event) {
    case 'submit':
      next.submittedBy = actor.userId;
      next.reviewedBy = null;
      next.approvedBy = null;
      next.approvedAt = null;
      break;
    case 'review':
      next.reviewedBy = actor.userId;
      break;
    case 'approve':
      next.approvedBy = actor.userId;
      next.approvedAt = at;
      break;
    case 'reopen':
      next.approvedBy = null;
      next.approvedAt = null;
      break;
    default:
      break;
  }

  const audit: TransitionAuditEvent = {
    at,
    actor: { ...actor, roles: actor.roles ? [...actor.roles] : undefined },
    from: lifecycle.state,
    to: rule.to,
    sectionId: lifecycle.sectionId,
    event,
    ...(options.comment?.trim() ? { comment: options.comment.trim() } : {}),
  };
  return { lifecycle: next, audit };
}

/**
 * Freezes an approved section into an immutable revision.
 *
 * The blocks are deep-cloned and frozen. The hash covers the content, not derived heading numbering.
 *
 * @throws {InvalidTransitionError} when the section is not approved
 */
export async function freezeSectionRevision(section: {
  sectionId: string;
  templateSectionId?: string | null;
  revision: string;
  blocks: readonly Block[];
  lifecycle: SectionLifecycle;
}): Promise<SectionRevision> {
  const { lifecycle } = section;
  if (lifecycle.state !== 'approved' || !lifecycle.approvedBy || !lifecycle.approvedAt) {
    throw new InvalidTransitionError(lifecycle.state, 'freeze');
  }
  const blocks = deepFreeze(cloneDeep([...section.blocks]));
  return {
    sectionId: section.sectionId,
    templateSectionId: section.templateSectionId ?? null,
    revision: section.revision,
    contentHash: await sectionContentHash(blocks),
    blocks,
    approvedBy: lifecycle.approvedBy,
    approvedAt: lifecycle.approvedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                  */
/* -------------------------------------------------------------------------- */

/** Events that move a document. */
export type DocumentEvent =
  | 'submitForReview'
  | 'reject'
  | 'approve'
  | 'makeEffective'
  | 'startPeriodicReview'
  | 'completePeriodicReview'
  | 'supersede'
  | 'obsolete';

interface DocumentRule {
  from: readonly DocumentState[];
  to: DocumentState;
  roles?: readonly string[];
  separation?: boolean;
  comment?: boolean;
}

const DOCUMENT_RULES: Readonly<Record<DocumentEvent, DocumentRule>> = {
  submitForReview: { from: ['draft'], to: 'review' },
  reject: { from: ['review'], to: 'draft', roles: ['reviewer', 'approver'], separation: true, comment: true },
  approve: { from: ['review'], to: 'approved', roles: ['approver'], separation: true },
  makeEffective: { from: ['approved'], to: 'effective', roles: ['qualityManager'] },
  startPeriodicReview: { from: ['effective'], to: 'periodicReview', roles: ['qualityManager'] },
  completePeriodicReview: { from: ['periodicReview'], to: 'effective', roles: ['qualityManager'] },
  supersede: { from: ['effective', 'periodicReview'], to: 'superseded', roles: ['qualityManager'] },
  obsolete: { from: ['draft', 'effective', 'periodicReview', 'superseded'], to: 'obsolete', roles: ['qualityManager'], comment: true },
};

/** Creates a document lifecycle in `draft`. */
export function createDocumentLifecycle(documentId: string): DocumentLifecycle {
  return { documentId, state: 'draft', submittedBy: null, approvedBy: null, effectiveDate: null };
}

/**
 * Moves a document by one event.
 *
 * `approve` requires every section to be approved (`sectionsApproved: true`). `makeEffective`
 * requires the effective date from the workflow. The date is recorded in the lifecycle, and
 * manual edits of the effective date are rejected by `validateAgainstTemplate`.
 *
 * @throws {InvalidTransitionError} when the event is not allowed from the current state
 * @throws {GuardViolationError} when a guard fails
 */
export function transitionDocument(
  lifecycle: DocumentLifecycle,
  event: DocumentEvent,
  actor: Actor,
  options: { comment?: string; at?: string; sectionsApproved?: boolean; effectiveDate?: string } = {}
): { lifecycle: DocumentLifecycle; audit: TransitionAuditEvent } {
  const rule = DOCUMENT_RULES[event];
  if (!rule || !rule.from.includes(lifecycle.state)) throw new InvalidTransitionError(lifecycle.state, event);
  if (rule.roles) requireRole(actor, rule.roles);
  if (rule.separation && lifecycle.submittedBy === actor.userId) {
    throw new GuardViolationError('separation-of-duties', `Actor "${actor.userId}" submitted this document`);
  }
  if (rule.comment && !options.comment?.trim()) {
    throw new GuardViolationError('comment-required', `Event "${event}" needs a comment`);
  }
  if (event === 'approve' && options.sectionsApproved !== true) {
    throw new GuardViolationError('sections-not-approved', 'Every section must be approved before the document is approved');
  }
  if (event === 'makeEffective' && !options.effectiveDate) {
    throw new GuardViolationError('effective-date-required', 'The approval workflow must supply the effective date');
  }

  const at = options.at ?? new Date().toISOString();
  const next: DocumentLifecycle = { ...lifecycle, state: rule.to };
  if (event === 'submitForReview') next.submittedBy = actor.userId;
  if (event === 'approve') next.approvedBy = actor.userId;
  if (event === 'makeEffective') next.effectiveDate = options.effectiveDate ?? null;

  const audit: TransitionAuditEvent = {
    at,
    actor: { ...actor, roles: actor.roles ? [...actor.roles] : undefined },
    from: lifecycle.state,
    to: rule.to,
    sectionId: lifecycle.documentId,
    event,
    ...(options.comment?.trim() ? { comment: options.comment.trim() } : {}),
  };
  return { lifecycle: next, audit };
}
