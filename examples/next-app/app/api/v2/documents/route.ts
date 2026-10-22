/**
 * Authoritative store for the controlled-document vertical slice.
 *
 * The client never decides what is allowed. Every submitted block tree is checked here with
 * `verifyDocumentChange` against the stored copy, using the caller's identity. Updates carry the
 * base hash they were made from, so stale or replayed updates are rejected. Lifecycle transitions,
 * release and signature binding also run here. The in-memory store is for the demo only.
 */

import { restoreServerGlobals } from './serverDomShim';
import { NextResponse } from 'next/server';
import type { Block } from '@amusendame/beakblock-core';
import { verifyDocumentChange } from '@amusendame/beakblock-permissions';
import type { BeakDocument } from '@amusendame/beakblock-schema';
import {
  bindSignature,
  buildPolicyContext,
  composeDocument,
  contentHash,
  createRelease,
  createSectionLifecycle,
  freezeSectionRevision,
  instantiateDocument,
  LifecycleError,
  publishTemplate,
  transitionSection,
  type Actor,
  type SectionEvent,
  type SectionLifecycle,
  type SectionRevision,
  type TemplateDefinition,
  type TransitionAuditEvent,
} from '@amusendame/beakblock-templates';
import {
  buildSopTemplateDraft,
  demoUser,
  SECTION_ASSIGNMENTS,
  USER_HEADER,
  type ControlledDocumentView,
  type ReleaseRecord,
  type ServerError,
} from '../../../v2/controlledShared';

export const runtime = 'nodejs';
// All imports above have loaded. Remove the DOM stub that let them load, so other routes see a server global scope.
restoreServerGlobals();
export const dynamic = 'force-dynamic';

const SYSTEM = { userId: 'qms-service', roles: ['system'] };
const DOCUMENT_ID = 'doc-gram-stain-42';
const EFFECTIVE_DATE = '2026-11-01';

interface StoredDocument {
  documentId: string;
  doc: BeakDocument;
  template: TemplateDefinition | null;
  assignments: typeof SECTION_ASSIGNMENTS;
  hash: string;
  lifecycles: Record<string, SectionLifecycle>;
  audit: TransitionAuditEvent[];
  release: ReleaseRecord | null;
  templateSectionByBlock: Record<string, string>;
}

type StoreShape = { current: StoredDocument | null; templatePublished: TemplateDefinition | null };
const globalStore = globalThis as unknown as { __beakV2Documents?: StoreShape };
function store(): StoreShape {
  if (!globalStore.__beakV2Documents) globalStore.__beakV2Documents = { current: null, templatePublished: null };
  return globalStore.__beakV2Documents;
}

function blocksOf(stored: StoredDocument): Block[] {
  return stored.doc.sections[0]!.blocks;
}

function viewOf(stored: StoredDocument): ControlledDocumentView {
  return {
    documentId: stored.documentId,
    docNumber: String(stored.doc.properties.docNumber ?? ''),
    revision: String(stored.doc.properties.revision ?? ''),
    hash: stored.hash,
    template: stored.template ?? (store().templatePublished as TemplateDefinition),
    assignments: stored.assignments,
    blocks: blocksOf(stored),
    lifecycles: stored.lifecycles,
    audit: stored.audit,
    release: stored.release,
  };
}

function fail(status: number, code: string, message: string, violations?: ServerError['violations']): NextResponse {
  const body: ServerError = { error: message, code, ...(violations ? { violations } : {}) };
  return NextResponse.json(body, { status });
}

function callerFrom(request: Request): { id: string; name: string; roles: string[] } | null {
  const id = request.headers.get(USER_HEADER);
  return id ? demoUser(id) : null;
}

function findSectionBlock(blocks: Block[], sectionId: string): Block | undefined {
  return blocks.find((b) => b.type === 'controlledSection' && b.props.sectionId === sectionId);
}

function editableSectionsFor(stored: StoredDocument, userId: string, roles: string[]): string[] {
  const ctx = buildPolicyContext(stored.doc, stored.assignments, userId, roles);
  return Object.entries(ctx.sectionGrants)
    .filter(([sid, caps]) => caps.includes('section.editText') && !(ctx.lockedSections ?? []).includes(sid))
    .map(([sid]) => sid);
}

async function hashOf(blocks: Block[]): Promise<string> {
  return contentHash(blocks);
}

function ensureDocument(request: Request): StoredDocument | null {
  const id = new URL(request.url).searchParams.get('id');
  const current = store().current;
  if (!current) return null;
  return id === null || id === current.documentId ? current : null;
}

export async function GET(request: Request): Promise<Response> {
  const caller = callerFrom(request);
  if (!caller) return fail(401, 'unauthenticated', 'Sign in with a demo user first');
  const stored = ensureDocument(request);
  if (!stored) return NextResponse.json({ document: null });
  return NextResponse.json({ document: viewOf(stored), editableSections: editableSectionsFor(stored, caller.id, caller.roles) });
}

interface PostBody {
  action: string;
  documentId?: string;
  baseHash?: string;
  blocks?: Block[];
  template?: TemplateDefinition;
  sectionId?: string;
  event?: SectionEvent;
  comment?: string;
  docNumber?: string;
}

export async function POST(request: Request): Promise<Response> {
  const caller = callerFrom(request);
  if (!caller) return fail(401, 'unauthenticated', 'Sign in with a demo user first');
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return fail(400, 'bad-json', 'Request body must be JSON');
  }
  const actor: Actor = { userId: caller.id, displayName: caller.name, roles: caller.roles };

  switch (body.action) {
    case 'reset': {
      store().current = null;
      return NextResponse.json({ document: null });
    }

    case 'publishTemplate': {
      if (!caller.roles.includes('qualityManager')) return fail(403, 'forbidden', 'Only the Quality Manager publishes templates');
      try {
        const draft = body.template ?? buildSopTemplateDraft();
        if (draft.status !== 'draft') return fail(422, 'not-draft', 'Only a draft template can be published');
        store().templatePublished = await publishTemplate(draft);
        return NextResponse.json({ template: store().templatePublished });
      } catch (error) {
        return fail(422, 'template-invalid', error instanceof Error ? error.message : 'Template could not be published');
      }
    }

    case 'instantiate': {
      if (!caller.roles.includes('qualityManager')) return fail(403, 'forbidden', 'Only the Quality Manager creates controlled documents');
      const template = store().templatePublished;
      if (!template) return fail(409, 'no-template', 'Publish the template before creating a document');
      const doc = instantiateDocument(template, {
        documentId: DOCUMENT_ID,
        docNumber: body.docNumber ?? 'SOP-0042',
        properties: { title: 'Gram stain procedure', revision: '1' },
        assignments: SECTION_ASSIGNMENTS,
      });
      const blocks = doc.sections[0]!.blocks;
      const lifecycles: Record<string, SectionLifecycle> = {};
      const templateSectionByBlock: Record<string, string> = {};
      for (const block of blocks) {
        if (block.type !== 'controlledSection') continue;
        const tsid = block.props.templateSectionId as string;
        const sid = block.props.sectionId as string;
        lifecycles[tsid] = createSectionLifecycle(sid, SECTION_ASSIGNMENTS[tsid]?.ownerId ?? null);
        templateSectionByBlock[sid] = tsid;
      }
      const stored: StoredDocument = {
        documentId: DOCUMENT_ID,
        doc,
        template,
        assignments: SECTION_ASSIGNMENTS,
        hash: await hashOf(blocks),
        lifecycles,
        audit: [],
        release: null,
        templateSectionByBlock,
      };
      store().current = stored;
      return NextResponse.json({ document: viewOf(stored), editableSections: editableSectionsFor(stored, caller.id, caller.roles) });
    }

    case 'save': {
      const stored = store().current;
      if (!stored || stored.documentId !== body.documentId) return fail(404, 'not-found', 'Document not found');
      if (!Array.isArray(body.blocks)) return fail(400, 'bad-request', 'blocks must be an array');
      if (body.baseHash !== stored.hash) {
        return fail(409, 'stale-base', 'The document changed since you loaded it. Reload before saving.');
      }
      if (stored.release) return fail(409, 'released', 'The document is released and cannot be edited');
      const current = blocksOf(stored);
      const ctx = buildPolicyContext(stored.doc, stored.assignments, caller.id, caller.roles);
      const verdict = verifyDocumentChange(current, body.blocks, ctx);
      if (!verdict.allowed) {
        return fail(
          403,
          'permission-denied',
          verdict.violations[0]?.reason ?? 'Change rejected by the server',
          verdict.violations.map((v) => ({ reason: v.reason ?? 'Not permitted', sectionId: v.operation.sectionId, kind: v.operation.kind }))
        );
      }
      stored.doc = { ...stored.doc, sections: [{ ...stored.doc.sections[0]!, blocks: body.blocks }] };
      stored.hash = await hashOf(body.blocks);
      return NextResponse.json({ document: viewOf(stored), editableSections: editableSectionsFor(stored, caller.id, caller.roles) });
    }

    case 'transition': {
      const stored = store().current;
      if (!stored || stored.documentId !== body.documentId) return fail(404, 'not-found', 'Document not found');
      if (body.baseHash !== stored.hash) return fail(409, 'stale-base', 'The document changed since you loaded it. Reload before acting.');
      if (stored.release) return fail(409, 'released', 'The document is released');
      const blocks = blocksOf(stored);
      const block = body.sectionId ? findSectionBlock(blocks, body.sectionId) : undefined;
      if (!block) return fail(404, 'no-section', 'Unknown section');
      const tsid = block.props.templateSectionId as string;
      const lifecycle = stored.lifecycles[tsid];
      if (!lifecycle || !body.event) return fail(400, 'bad-request', 'Missing lifecycle state or event');
      try {
        const out = transitionSection(lifecycle, body.event, actor, { comment: body.comment });
        // The server writes the workflow state. Clients cannot.
        const nextBlocks = blocks.map((b) =>
          b === block ? { ...b, props: { ...b.props, workflowState: out.lifecycle.state } } : b
        );
        const systemCtx = buildPolicyContext(stored.doc, stored.assignments, SYSTEM.userId, SYSTEM.roles);
        const verdict = verifyDocumentChange(blocks, nextBlocks, systemCtx);
        if (!verdict.allowed) return fail(500, 'internal', 'System write rejected');
        stored.doc = { ...stored.doc, sections: [{ ...stored.doc.sections[0]!, blocks: nextBlocks }] };
        stored.lifecycles = { ...stored.lifecycles, [tsid]: out.lifecycle };
        stored.audit = [...stored.audit, out.audit];
        stored.hash = await hashOf(nextBlocks);
        return NextResponse.json({ document: viewOf(stored), editableSections: editableSectionsFor(stored, caller.id, caller.roles) });
      } catch (error) {
        if (error instanceof LifecycleError) return fail(422, error.code, error.message);
        throw error;
      }
    }

    case 'release': {
      const stored = store().current;
      if (!stored || stored.documentId !== body.documentId) return fail(404, 'not-found', 'Document not found');
      if (!caller.roles.includes('approver')) return fail(403, 'forbidden', 'Only the final approver releases a document');
      if (stored.release) return fail(409, 'released', 'Already released');
      if (body.baseHash !== stored.hash) return fail(409, 'stale-base', 'Reload before releasing');
      const blocks = blocksOf(stored);
      const sections = Object.entries(stored.lifecycles);
      const notApproved = sections.filter(([, lc]) => lc.state !== 'approved').map(([tsid]) => tsid);
      if (notApproved.length > 0) return fail(409, 'not-approved', `Sections not approved: ${notApproved.join(', ')}`);

      try {
        const sectionRevisions: SectionRevision[] = [];
        for (const [tsid, lifecycle] of sections) {
          const block = blocks.find((b) => b.type === 'controlledSection' && b.props.templateSectionId === tsid)!;
          sectionRevisions.push(
            await freezeSectionRevision({
              sectionId: block.props.sectionId as string,
              templateSectionId: tsid,
              revision: '1.0',
              blocks: block.children ?? [],
              lifecycle,
            })
          );
        }
        const template = stored.template!;
        const composed = await composeDocument({
          template,
          sectionRevisions,
          properties: {
            title: String(stored.doc.properties.title ?? 'Gram stain procedure'),
            docNumber: String(stored.doc.properties.docNumber ?? ''),
            revision: '1',
            effectiveDate: EFFECTIVE_DATE,
          },
          documentId: stored.documentId,
          generatedParts: {
            notice: { kind: 'controlledCopy', copyNumber: null },
            revisionHistory: [
              { revision: '1', date: EFFECTIVE_DATE, author: 'Maya (Quality Manager)', description: 'Initial controlled release' },
            ],
            distributionList: ['Microbiology bench', 'Quality assurance'],
            approvalPage: {
              approvers: [{ role: 'Quality Manager', name: 'Maya' }, { role: 'Final approver', name: caller.name }],
            },
          },
        });
        const releasedAt = new Date().toISOString();
        const manifest0 = await createRelease({ composed, documentRevision: '1', releasedBy: caller.id, releasedAt });
        const manifest = bindSignature(manifest0, {
          signatureId: `sig-${caller.id}-1`,
          signerId: caller.id,
          meaning: 'approved',
          at: releasedAt,
          contentHash: manifest0.documentHash,
        });
        stored.release = { manifest, document: composed.document, sectionRevisions, releasedAt };
        return NextResponse.json({ document: viewOf(stored), editableSections: [] });
      } catch (error) {
        return fail(422, 'compose-failed', error instanceof Error ? error.message : 'Composition failed');
      }
    }

    default:
      return fail(400, 'unknown-action', `Unknown action ${body.action}`);
  }
}
