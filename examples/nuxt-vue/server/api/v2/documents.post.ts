import type { Block } from '@amusendame/beakblock-core';
import type { SectionAssignments, SectionEvent } from '@amusendame/beakblock-templates';
import {
  addServerComment,
  createServerDocument,
  deleteServerDocument,
  documentHashOfServer,
  getServerDocument,
  readActor,
  releaseServerDocument,
  saveServerDocument,
  transitionServerSection,
} from '../../utils/v2Store';

const SECTION_EVENTS: readonly SectionEvent[] = ['submit', 'review', 'requestChanges', 'approve', 'reopen'];

function fail(event: Parameters<typeof setResponseStatus>[0], status: number, error: string, extra: Record<string, unknown> = {}) {
  setResponseStatus(event, status);
  return { ok: false, status, error, ...extra };
}

/**
 * Typed operations against the authoritative document. Every mutation is checked here:
 * - create: quality manager only
 * - save: full-block submit, verified by verifyDocumentChange against the stored document
 * - transition: section lifecycle (server state machine, separation of duties)
 * - comment: reviewers and approvers
 * - release: approver only, all sections approved
 */
export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, unknown> | null;
  const actor = readActor(body);
  if (!body || !actor) return fail(event, 400, 'An actor with a userId is required.');
  const action = body.action;
  const roles = actor.roles ?? [];

  if (action === 'reset') {
    deleteServerDocument(String(body.documentId ?? ''));
    return { ok: true };
  }

  if (action === 'create') {
    if (!roles.includes('qualityManager')) return fail(event, 403, 'Only a quality manager can instantiate a controlled document.');
    const blocks = body.blocks as Block[] | undefined;
    if (!Array.isArray(blocks) || blocks.length === 0) return fail(event, 400, 'blocks are required');
    const doc = createServerDocument({
      id: String(body.documentId ?? 'controlled-sop'),
      title: String(body.title ?? 'Controlled document').slice(0, 200),
      docNumber: String(body.docNumber ?? 'SOP-0042').slice(0, 40),
      revision: String(body.revision ?? '1').slice(0, 20),
      blocks,
      assignments: (body.assignments ?? {}) as SectionAssignments,
    });
    return { ok: true, version: doc.version, documentHash: await documentHashOfServer(doc) };
  }

  const doc = getServerDocument(String(body.documentId ?? ''));
  if (!doc) return fail(event, 404, 'Unknown document. Create it first.');

  if (action === 'save') {
    if (!Array.isArray(body.blocks)) return fail(event, 400, 'blocks must be an array');
    const outcome = saveServerDocument(doc, actor, Number(body.baseVersion), body.blocks as Block[]);
    if (!outcome.ok) {
      const violations = outcome.verification?.violations.map((d) => ({
        kind: d.operation.kind,
        sectionId: d.operation.sectionId,
        reason: d.reason ?? 'not permitted',
        requiredCapability: d.requiredCapability ?? null,
      }));
      return fail(event, outcome.status, outcome.error, { violations, currentVersion: outcome.currentVersion });
    }
    return { ok: true, version: doc.version, documentHash: await documentHashOfServer(doc) };
  }

  if (action === 'transition') {
    const event_ = String(body.event) as SectionEvent;
    if (!SECTION_EVENTS.includes(event_)) return fail(event, 400, `Unknown section event ${String(body.event)}`);
    const out = transitionServerSection(doc, actor, String(body.sectionId), event_, typeof body.comment === 'string' ? body.comment.slice(0, 500) : undefined);
    if (!out.ok) return fail(event, out.status, out.error);
    return { ok: true, lifecycle: out.lifecycle, audit: out.audit, version: out.version };
  }

  if (action === 'comment') {
    if (!roles.includes('reviewer') && !roles.includes('approver')) {
      return fail(event, 403, 'Only reviewers and approvers can comment on a section.');
    }
    const text = typeof body.body === 'string' ? body.body.trim().slice(0, 500) : '';
    if (!text) return fail(event, 400, 'Comment text is required.');
    const comment = addServerComment(doc, actor, String(body.sectionId), text);
    return { ok: true, comment };
  }

  if (action === 'release') {
    if (!roles.includes('approver')) return fail(event, 403, 'Only the final approver can release a document.');
    const out = await releaseServerDocument(doc, actor);
    if (!out.ok) return fail(event, out.status, out.error);
    return { ok: true, release: out.release, version: doc.version };
  }

  return fail(event, 400, `Unknown action ${String(action)}`);
});
