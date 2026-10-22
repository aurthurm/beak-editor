/**
 * Client side of the controlled-document vertical slice. The browser never decides on its own:
 * template publication, instantiation and composition run here (they are pure functions), while
 * every write goes to the authoritative Nitro store under server/api/v2/documents.post.ts.
 */
import type { Block } from '@amusendame/beakblock-core';
import {
  addSection,
  buildPolicyContext,
  composeDocument,
  createRelease,
  createTemplate,
  bindSignature,
  attachRendition,
  freezeSectionRevision,
  instantiateDocument,
  publishTemplate,
  flattenBlocks,
  verifyRelease,
  stampControlledCopy,
  createPrintRegisterEntry,
  type Actor,
  type ComposedDocument,
  type ReleaseManifest,
  type SectionAssignments,
  type SectionLifecycle,
  type SectionRevision,
  type TemplateDefinition,
  type TransitionAuditEvent,
} from '@amusendame/beakblock-templates';
import { createDomMeasurer, layoutDocument, renderPrintHTML } from '@amusendame/beakblock-layout';
import { exportDocxBlob } from '@amusendame/beakblock-export-docx';
import { documentToIR } from '@amusendame/beakblock-ir';
import type { PolicyContext } from '@amusendame/beakblock-permissions';
import type { BeakDocument } from '@amusendame/beakblock-schema';

export const CONTROLLED_DOC_ID = 'controlled-sop-0042';
export const CONTROLLED_TEMPLATE_ID = 'tpl-sop-gram-stain';

/** Identities are asserted by the browser in this demo; the QMS service derives them from sessions. */
export interface DemoUser {
  id: string;
  name: string;
  roles: string[];
  /** Human hint shown under the switcher. */
  hint: string;
}

export const DEMO_USERS: DemoUser[] = [
  { id: 'qm', name: 'Quality Manager', roles: ['qualityManager'], hint: 'Publishes the template and instantiates the document.' },
  { id: 'ann', name: 'Author A', roles: ['author'], hint: 'Owns the Purpose section.' },
  { id: 'ben', name: 'Author B', roles: ['author'], hint: 'Owns Scope and Records.' },
  { id: 'cy', name: 'Author C', roles: ['author'], hint: 'Owns the Procedure table and steps.' },
  { id: 'rita', name: 'Reviewer', roles: ['reviewer'], hint: 'Comments, requests changes, reviews submitted sections.' },
  { id: 'ap', name: 'Approver', roles: ['approver'], hint: 'Approves reviewed sections and releases the document.' },
];

export const SECTION_ASSIGNMENTS: SectionAssignments = {
  purpose: { ownerId: 'ann', ownerName: 'Author A' },
  scope: { ownerId: 'ben', ownerName: 'Author B' },
  procedure: { ownerId: 'cy', ownerName: 'Author C' },
  records: { ownerId: 'ben', ownerName: 'Author B' },
};

export const SECTION_TITLES: Record<string, string> = {
  purpose: 'Purpose',
  scope: 'Scope',
  procedure: 'Procedure',
  records: 'Records',
};

export function actorOf(user: DemoUser): Actor {
  return { userId: user.id, displayName: user.name, roles: user.roles };
}

/* -------------------------------------------------------------------------- */
/* Template (Quality Manager)                                                  */
/* -------------------------------------------------------------------------- */

const text = (value: string, placeholder = false) => {
  void placeholder;
  return [{ type: 'text' as const, text: value, styles: {} }];
};
const para = (id: string, value: string, props: Record<string, unknown> = {}): Block => ({
  id,
  type: 'paragraph',
  props,
  content: text(value),
});
const cell = (id: string, value: string): Block => ({ id, type: 'tableCell', props: {}, children: [para(`${id}-p`, value)] });
const row = (id: string, cells: Block[]): Block => ({ id, type: 'tableRow', props: {}, children: cells });

/** Publishes the Gram stain SOP template: four sections with boilerplate, placeholders and rules. */
export async function publishSopTemplate(): Promise<TemplateDefinition> {
  let t = createTemplate({
    id: CONTROLLED_TEMPLATE_ID,
    title: 'Standard operating procedure',
    documentType: 'SOP',
    watermark: 'CONTROLLED',
    properties: {
      docNumber: { generated: true, readOnly: true, required: true, pattern: '^SOP-\\d{4}$' },
      title: { required: true, maxLength: 120 },
      revision: { required: true, readOnly: true },
      effectiveDate: { source: 'workflow', readOnly: true },
    },
  });
  t = addSection(t, {
    templateSectionId: 'purpose',
    title: 'Purpose',
    required: true,
    allowedBlocks: ['paragraph'],
    lockedBoilerplate: [para('bp-1', 'This SOP describes the Gram stain procedure used by the Microbiology bench.')],
    placeholder: [para('ph-1', 'Describe the purpose of this procedure.', { placeholder: true })],
  });
  t = addSection(t, {
    templateSectionId: 'scope',
    title: 'Scope',
    required: true,
    allowedBlocks: null,
    placeholder: [para('ph-2', 'Describe the scope and the specimens covered.', { placeholder: true })],
  });
  t = addSection(t, {
    templateSectionId: 'procedure',
    title: 'Procedure',
    required: true,
    kind: 'procedure',
    allowedBlocks: ['paragraph', 'table', 'orderedList', 'heading'],
    placeholder: [
      {
        id: 'ph-table',
        type: 'table',
        props: { placeholder: true },
        children: [row('r1', [cell('c1', 'Step'), cell('c2', 'Action')]), row('r2', [cell('c3', 'TBD'), cell('c4', 'TBD')])],
      },
    ],
  });
  t = addSection(t, {
    templateSectionId: 'records',
    title: 'Records',
    required: false,
    placeholder: [para('ph-3', 'List the records that this procedure generates.', { placeholder: true })],
  });
  return publishTemplate(t);
}

/* -------------------------------------------------------------------------- */
/* Policy context (mirrors the server, used for the editor's UX guard)         */
/* -------------------------------------------------------------------------- */

export function policyContextFor(blocks: Block[], user: DemoUser): PolicyContext {
  const fake = { sections: [{ id: 'sec-1', blocks }] } as unknown as BeakDocument;
  return buildPolicyContext(fake, SECTION_ASSIGNMENTS, user.id, user.roles);
}

/** Initial document blocks for a new instance (Quality Manager). */
export async function instantiateSop(template: TemplateDefinition): Promise<Block[]> {
  const doc = instantiateDocument(template, {
    documentId: CONTROLLED_DOC_ID,
    docNumber: 'SOP-0042',
    properties: { title: 'Gram stain procedure', revision: '1' },
    assignments: SECTION_ASSIGNMENTS,
  });
  return flattenBlocks(doc);
}

/* -------------------------------------------------------------------------- */
/* Server API                                                                  */
/* -------------------------------------------------------------------------- */

export interface ApiResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T & { error?: string; violations?: Array<{ kind: string; sectionId: string | null; reason: string }>; currentVersion?: number };
}

export async function apiPost(body: Record<string, unknown>): Promise<ApiResult> {
  const res = await fetch('/api/v2/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as ApiResult['data'];
  return { ok: res.ok, status: res.status, data };
}

export interface ServerDocumentState {
  exists: boolean;
  id: string;
  version: number;
  title: string;
  docNumber: string;
  revision: string;
  blocks: Block[];
  assignments: SectionAssignments;
  lifecycles: Record<string, SectionLifecycle>;
  audit: TransitionAuditEvent[];
  comments: Array<{ id: string; sectionId: string; authorName: string; body: string; at: string }>;
  security: Array<{ at: string; actorId: string; action: string; outcome: string; reason: string }>;
  release: null | {
    at: string;
    releasedBy: string;
    documentHash: string;
    sections: Array<{ sectionId: string; templateSectionId: string | null; contentHash: string; revision: string }>;
  };
  documentHash: string;
}

export async function fetchServerDocument(id = CONTROLLED_DOC_ID): Promise<ServerDocumentState> {
  const res = await fetch(`/api/v2/documents?id=${encodeURIComponent(id)}`);
  return (await res.json()) as ServerDocumentState;
}

/* -------------------------------------------------------------------------- */
/* Composition and release (final approver)                                    */
/* -------------------------------------------------------------------------- */

export interface ReleaseBundle {
  composed: ComposedDocument;
  manifest: ReleaseManifest;
  released: ReleaseManifest;
  verification: Awaited<ReturnType<typeof verifyRelease>>;
  printHtml: string;
  sectionRevisions: SectionRevision[];
}

/**
 * Freezes each approved section into an immutable revision, composes the document, builds the
 * release manifest, binds the approver signature to the document hash and attaches the rendition.
 */
export async function composeAndRelease(params: {
  template: TemplateDefinition;
  serverDoc: ServerDocumentState;
  approver: Actor;
  documentRevision: string;
}): Promise<ReleaseBundle> {
  const { template, serverDoc, approver } = params;
  const sectionBlocks = serverDoc.blocks.filter((b) => b.type === 'controlledSection');
  const sectionRevisions: SectionRevision[] = [];
  for (const block of sectionBlocks) {
    const sectionId = String(block.props.sectionId);
    const lifecycle = serverDoc.lifecycles[sectionId];
    if (!lifecycle || lifecycle.state !== 'approved') throw new Error(`Section ${sectionId} is not approved`);
    sectionRevisions.push(
      await freezeSectionRevision({
        sectionId,
        templateSectionId: String(block.props.templateSectionId),
        revision: '1.0',
        blocks: block.children ?? [],
        lifecycle,
      })
    );
  }

  const composed = await composeDocument({
    template,
    sectionRevisions,
    documentId: CONTROLLED_DOC_ID,
    properties: {
      title: serverDoc.title,
      docNumber: serverDoc.docNumber,
      revision: params.documentRevision,
      effectiveDate: '2026-11-01',
      owner: 'Quality Manager',
      lab: 'Microbiology',
    },
    generatedParts: {
      notice: { kind: 'uncontrolledWhenPrinted' },
      revisionHistory: [
        { revision: params.documentRevision, date: '2026-10-22', author: 'Author A, Author B, Author C', description: 'Initial controlled release' },
      ],
      distributionList: ['Microbiology bench', 'Quality assurance'],
      approvalPage: {
        approvers: [
          { role: 'Reviewer', name: 'Reviewer' },
          { role: 'Approver', name: approver.displayName ?? approver.userId },
        ],
      },
    },
  });

  const manifest = await createRelease({
    composed,
    documentRevision: params.documentRevision,
    releasedBy: approver.userId,
    releasedAt: new Date().toISOString(),
  });
  const signed = bindSignature(manifest, {
    signatureId: `sig-${approver.userId}-${Date.now().toString(36)}`,
    signerId: approver.userId,
    meaning: 'approved',
    at: new Date().toISOString(),
    contentHash: manifest.documentHash,
  });

  const layout = layoutDocument(composed.ir, { measurer: createDomMeasurer() });
  const printHtml = renderPrintHTML(composed.ir, layout, {
    title: serverDoc.title,
    watermark: template.watermark ?? null,
    controlledCopy: { copyNumber: 1, issuedTo: 'Microbiology bench' },
  });
  const released = await attachRendition(signed, new TextEncoder().encode(printHtml));
  const verification = await verifyRelease(released, composed, { renditionBytes: new TextEncoder().encode(printHtml) });
  return { composed, manifest, released, verification, printHtml, sectionRevisions };
}

export async function downloadDocx(composed: ComposedDocument, filename: string): Promise<void> {
  const blob = await exportDocxBlob(composed.ir);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function controlledCopyStamp(copyNumber: number, issuedTo: string, watermark: string) {
  return stampControlledCopy({ copyNumber, issuedTo, watermark });
}

export function registerPrint(released: ReleaseManifest, stamp: ReturnType<typeof stampControlledCopy>, printedBy: string) {
  return createPrintRegisterEntry(released, stamp, printedBy, `print-${Date.now().toString(36)}`);
}

export function toIrForPreview(doc: BeakDocument) {
  return documentToIR(doc);
}
