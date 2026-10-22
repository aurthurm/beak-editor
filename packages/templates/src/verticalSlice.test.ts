import { describe, expect, it } from 'vitest';
import type { Block } from '@amusendame/beakblock-core';
import { verifyDocumentChange } from '@amusendame/beakblock-permissions';
import type { BeakDocument } from '@amusendame/beakblock-schema';

import {
  addSection,
  attachRendition,
  bindSignature,
  buildPolicyContext,
  composeDocument,
  createDraftFromPublished,
  createRelease,
  createSectionLifecycle,
  createTemplate,
  createDocumentLifecycle,
  freezeSectionRevision,
  flattenBlocks,
  instantiateDocument,
  publishTemplate,
  transitionDocument,
  transitionSection,
  validateAgainstTemplate,
  verifyRelease,
} from './index';
import type { Actor, SectionAssignments, SectionLifecycle, TemplateDefinition, TransitionAuditEvent } from './index';
import { cloneJson } from '@amusendame/beakblock-core';

const text = (value: string) => [{ type: 'text' as const, text: value, styles: {} }];
const para = (id: string, value: string, props: Record<string, unknown> = {}): Block => ({ id, type: 'paragraph', props, content: text(value) });
const cell = (id: string, value: string): Block => ({ id, type: 'tableCell', props: {}, children: [para(`${id}-p`, value)] });
const row = (id: string, cells: Block[]): Block => ({ id, type: 'tableRow', props: {}, children: cells });

/** Four sections: Purpose (boilerplate), Scope, Procedure (a formatted table), Records (optional). */
async function publishedSopTemplate(): Promise<TemplateDefinition> {
  let t = createTemplate({
    id: 'tpl-sop',
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
    lockedBoilerplate: [para('bp-1', 'This SOP describes the Gram stain procedure.')],
    placeholder: [para('ph-1', 'Describe the purpose.', { placeholder: true })],
  });
  t = addSection(t, {
    templateSectionId: 'scope',
    title: 'Scope',
    required: true,
    allowedBlocks: null,
    placeholder: [para('ph-2', 'Describe the scope.', { placeholder: true })],
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
    placeholder: [para('ph-3', 'List the records.', { placeholder: true })],
  });
  return publishTemplate(t);
}

const ASSIGN: SectionAssignments = {
  purpose: { ownerId: 'ann', ownerName: 'Ann Author' },
  scope: { ownerId: 'ben', ownerName: 'Ben Author' },
  procedure: { ownerId: 'cy', ownerName: 'Cy Author' },
  records: { ownerId: 'ben', ownerName: 'Ben Author' },
};

const SYSTEM = { userId: 'qms-service', roles: ['system'] };
const REVIEWER: Actor = { userId: 'rita', roles: ['reviewer'] };
const APPROVER: Actor = { userId: 'ap', roles: ['approver'] };
const QM: Actor = { userId: 'qm', roles: ['qualityManager'] };

/** Replaces the blocks of one section in a flat block list, returning a new list. */
function editSection(blocks: Block[], tsid: string, edit: (section: Block) => void): Block[] {
  const next = cloneJson(blocks);
  const section = next.find((b) => b.type === 'controlledSection' && b.props.templateSectionId === tsid);
  if (!section) throw new Error(`no section ${tsid}`);
  edit(section);
  return next;
}

function sectionBlock(doc: BeakDocument, tsid: string): Block {
  const found = flattenBlocks(doc).find((b) => b.type === 'controlledSection' && b.props.templateSectionId === tsid);
  if (!found) throw new Error(`no section ${tsid}`);
  return found;
}

describe('vertical slice: controlled SOP from template to release', () => {
  it('runs the full flow with enforcement, lifecycle, composition, release and tamper detection', async () => {
    // 1. Quality Manager publishes the template.
    const template = await publishedSopTemplate();
    expect(template.status).toBe('published');
    expect(template.version).toBe(1);
    expect(Object.isFrozen(template.sections[0])).toBe(true);

    // 2. Instantiate for three authors.
    const doc = instantiateDocument(template, {
      properties: { title: 'Gram stain', revision: '1' },
      docNumber: 'SOP-0042',
      assignments: ASSIGN,
      documentId: 'doc-42',
    });
    expect(doc.sections).toHaveLength(1);
    expect(sectionBlock(doc, 'purpose').children!.map((c) => c.type)).toEqual(['paragraph', 'paragraph']);
    const initial = await validateAgainstTemplate(doc, template, { procedureBlockTypes: ['orderedList'] });
    // Only the procedure steps are missing before authoring.
    expect(initial.filter((i) => i.severity === 'error').map((i) => i.code)).toEqual(['procedure-steps-missing']);
    expect(initial.some((i) => i.code === 'placeholder-remaining')).toBe(true);

    const before = flattenBlocks(doc);
    const ctxAnn = buildPolicyContext(doc, ASSIGN, 'ann', ['author']);
    const ctxBen = buildPolicyContext(doc, ASSIGN, 'ben', ['author']);
    const ctxCy = buildPolicyContext(doc, ASSIGN, 'cy', ['author']);

    // 3. Each author edits only their own section. Cross-section edits are rejected.
    const annEdit = editSection(before, 'purpose', (s) => {
      s.children = s.children!.filter((c) => !c.props.placeholder);
      s.children.push(para('ann-1', 'Gram stain differentiates bacteria by cell wall structure.'));
    });
    expect(verifyDocumentChange(before, annEdit, ctxAnn).allowed).toBe(true);
    expect(verifyDocumentChange(before, annEdit, ctxBen).allowed).toBe(false);

    const benEdit = editSection(before, 'scope', (s) => {
      s.children = s.children!.filter((c) => !c.props.placeholder);
      s.children.push({ id: 'ben-h', type: 'heading', props: { level: 1 }, content: text('Scope') });
      s.children.push(para('ben-1', 'Applies to all microbiology bench staff.'));
    });
    expect(verifyDocumentChange(before, benEdit, ctxBen).allowed).toBe(true);
    expect(verifyDocumentChange(before, benEdit, ctxAnn).allowed).toBe(false);

    // Cy fills the formatted table and adds an ordered step list.
    const cyEdit = editSection(before, 'procedure', (s) => {
      const table = s.children!.find((c) => c.type === 'table')!;
      delete table.props.placeholder;
      (table.children![1]!.children![0]!.children![0]!.content as Array<{ text: string }>)[0]!.text = 'Apply crystal violet';
      s.children!.push({ id: 'steps', type: 'orderedList', props: {}, children: [{ id: 'step-1', type: 'listItem', props: {}, content: text('Fix smear') }] });
    });
    expect(verifyDocumentChange(before, cyEdit, ctxCy).allowed).toBe(true);
    expect(verifyDocumentChange(before, cyEdit, ctxBen).allowed).toBe(false);

    // Owners can insert table rows in their own section (table.editStructure), not in another's.
    const cyRow = editSection(before, 'procedure', (s) => {
      s.children!.find((c) => c.type === 'table')!.children!.push(row('r-new', [cell('c-new1', 'Wash'), cell('c-new2', 'Rinse')]));
    });
    expect(verifyDocumentChange(before, cyRow, ctxCy).allowed).toBe(true);
    expect(verifyDocumentChange(before, cyRow, ctxBen).allowed).toBe(false);
    expect(verifyDocumentChange(before, cyRow, ctxAnn).allowed).toBe(false);

    // A client trying to write a workflow state for its own section is rejected.
    const selfApprove = editSection(before, 'scope', (s) => {
      s.props.workflowState = 'approved';
    });
    expect(verifyDocumentChange(before, selfApprove, ctxBen).allowed).toBe(false);

    // The service stores the authored content after verifying it (system context).
    const records = editSection(before, 'records', (s) => {
      s.children = [para('rec-1', 'Lab notebook entries, 5 years.')];
    });
    expect(verifyDocumentChange(before, records, ctxBen).allowed).toBe(true);
    expect(verifyDocumentChange(before, records, ctxCy).allowed).toBe(false);
    const pick = (src: Block[], tsid: string) => src.find((b) => b.props.templateSectionId === tsid)!;
    const merged = cloneJson(before);
    for (const [src, tsid] of [[annEdit, 'purpose'], [benEdit, 'scope'], [cyEdit, 'procedure'], [records, 'records']] as const) {
      const dst = pick(merged, tsid);
      dst.children = cloneJson(pick(src, tsid).children);
      dst.props = cloneJson(pick(src, tsid).props);
    }
    expect(verifyDocumentChange(before, merged, buildPolicyContext(doc, ASSIGN, SYSTEM.userId, SYSTEM.roles)).allowed).toBe(true);
    doc.sections[0]!.blocks = merged;

    const afterAuthoring = await validateAgainstTemplate(doc, template, { procedureBlockTypes: ['orderedList'] });
    expect(afterAuthoring.filter((i) => i.severity === 'error')).toEqual([]);
    expect(afterAuthoring.filter((i) => i.code === 'placeholder-remaining')).toEqual([]);

    // 4. Section lifecycle: submit, review (with a change request on procedure), approve.
    const audit: TransitionAuditEvent[] = [];
    const lifecycles: Record<string, SectionLifecycle> = {};
    for (const [tsid, def] of Object.entries(ASSIGN)) {
      lifecycles[tsid] = createSectionLifecycle(sectionBlock(doc, tsid).props.sectionId as string, def.ownerId);
    }
    const step = (tsid: string, event: Parameters<typeof transitionSection>[1], actor: Actor, comment?: string) => {
      const out = transitionSection(lifecycles[tsid]!, event, actor, { comment });
      lifecycles[tsid] = out.lifecycle;
      audit.push(out.audit);
    };
    for (const tsid of ['purpose', 'scope', 'procedure', 'records']) {
      step(tsid, 'submit', { userId: ASSIGN[tsid]!.ownerId });
      step(tsid, 'review', REVIEWER);
    }
    // Reviewer requests changes on procedure, the owner resubmits, then reviewer reviews again.
    // The reviewer cannot approve their own review (role and separation of duties).
    expect(() => step('procedure', 'approve', REVIEWER)).toThrow();
    const reopened = transitionSection(lifecycles.procedure!, 'requestChanges', REVIEWER, { comment: 'Add the wash step' });
    lifecycles.procedure = reopened.lifecycle;
    audit.push(reopened.audit);
    step('procedure', 'submit', { userId: 'cy' });
    step('procedure', 'review', { userId: 'rita2', roles: ['reviewer'] });
    for (const tsid of ['purpose', 'scope', 'procedure', 'records']) step(tsid, 'approve', APPROVER);
    expect(audit.every((a) => a.at && a.actor.userId && a.sectionId)).toBe(true);
    expect(audit.filter((a) => a.event === 'approve')).toHaveLength(4);

    // The service writes the approved workflow state (system role) and the section locks.
    let approvedDoc = doc;
    const current = flattenBlocks(approvedDoc);
    const approvedBlocks = cloneJson(current);
    for (const b of approvedBlocks) if (b.type === 'controlledSection') b.props.workflowState = 'approved';
    const serviceCtx = buildPolicyContext(approvedDoc, ASSIGN, SYSTEM.userId, SYSTEM.roles);
    expect(verifyDocumentChange(current, approvedBlocks, serviceCtx).allowed).toBe(true);
    approvedDoc = { ...approvedDoc, sections: [{ ...approvedDoc.sections[0]!, blocks: approvedBlocks }] };

    // A malicious client edits an approved section: rejected, with and without its own grants.
    const lockedCtxAnn = buildPolicyContext(approvedDoc, ASSIGN, 'ann', ['author']);
    expect(lockedCtxAnn.lockedSections).toHaveLength(4);
    const tamperedPurpose = editSection(flattenBlocks(approvedDoc), 'purpose', (s) => {
      s.children![s.children!.length - 1]!.content = text('Everything is fine, sign here.');
    });
    expect(verifyDocumentChange(flattenBlocks(approvedDoc), tamperedPurpose, lockedCtxAnn).allowed).toBe(false);
    const unlockAttempt = editSection(flattenBlocks(approvedDoc), 'purpose', (s) => {
      s.props.workflowState = 'draft';
    });
    expect(verifyDocumentChange(flattenBlocks(approvedDoc), unlockAttempt, lockedCtxAnn).allowed).toBe(false);

    // 5. Freeze approved sections into immutable revisions.
    const sectionRevisions = [];
    for (const tsid of ['purpose', 'scope', 'procedure', 'records']) {
      const block = sectionBlock(approvedDoc, tsid);
      const rev = await freezeSectionRevision({
        sectionId: block.props.sectionId as string,
        templateSectionId: tsid,
        revision: '1.0',
        blocks: block.children!,
        lifecycle: lifecycles[tsid]!,
      });
      expect(Object.isFrozen(rev.blocks)).toBe(true);
      sectionRevisions.push(rev);
    }

    // 6. Document lifecycle, then composition.
    let docLc = createDocumentLifecycle('doc-42');
    docLc = transitionDocument(docLc, 'submitForReview', { userId: 'ann' }).lifecycle;
    docLc = transitionDocument(docLc, 'approve', APPROVER, { sectionsApproved: true }).lifecycle;
    docLc = transitionDocument(docLc, 'makeEffective', QM, { effectiveDate: '2026-11-01' }).lifecycle;
    expect(docLc.state).toBe('effective');

    const composed = await composeDocument({
      template,
      sectionRevisions,
      properties: { title: 'Gram stain', docNumber: 'SOP-0042', revision: '1', effectiveDate: '2026-11-01' },
      documentId: 'doc-42',
      generatedParts: {
        notice: { kind: 'uncontrolledWhenPrinted' },
        revisionHistory: [{ revision: '1', date: '2026-10-22', author: 'Ann Author', description: 'Initial release' }],
        distributionList: ['Microbiology bench', 'QA'],
        approvalPage: { approvers: [{ role: 'Approver', name: 'Ap' }] },
      },
    });
    expect(composed.document.properties.custom?.watermark).toBe('CONTROLLED');
    const headingNumbering = (composed.document.sections[0]!.blocks.flatMap((b) => b.children ?? [])
      .find((c) => c.type === 'heading')?.props as { numbering?: { numId: string; level: number } }).numbering;
    expect(headingNumbering).toEqual({ numId: '3', level: 0 });
    const ir = composed.ir;
    expect(ir.sections).toHaveLength(1);
    expect(ir.sections[0]!.body.filter((b) => b.type === 'sdt')).toHaveLength(4);
    expect(composed.manifestDraft.sections.map((s) => s.templateSectionId)).toEqual(['purpose', 'scope', 'procedure', 'records']);

    const composedValidation = await validateAgainstTemplate(composed.document, template, {
      procedureBlockTypes: ['orderedList'],
      fromWorkflow: true,
    });
    expect(composedValidation.filter((i) => i.severity === 'error')).toEqual([]);

    // 7. Release: manifest, signature bound to the document hash, rendition hash.
    const manifest = await createRelease({
      composed,
      documentRevision: '1',
      releasedBy: 'qm',
      releasedAt: '2026-10-22T09:00:00.000Z',
    });
    expect(manifest.sections).toHaveLength(4);
    const signed = bindSignature(manifest, {
      signatureId: 'sig-ap-1',
      signerId: 'ap',
      meaning: 'approved',
      at: '2026-10-22T09:05:00.000Z',
      contentHash: manifest.documentHash,
    });
    expect(() =>
      bindSignature(signed, { signatureId: 'sig-x', signerId: 'ap', meaning: 'approved', at: 'now', contentHash: 'f'.repeat(64) })
    ).toThrow();
    const pdf = new TextEncoder().encode('%PDF-1.7 rendition bytes');
    const released = await attachRendition(signed, pdf);
    expect(released.renditionHash).toMatch(/^[0-9a-f]{64}$/);

    const ok = await verifyRelease(released, composed, { renditionBytes: pdf });
    expect(ok).toEqual({ ok: true, mismatches: [] });

    // 8. Tamper detection: text in a released section, and the rendition.
    const tampered = cloneJson(composed);
    const scope = tampered.document.sections[0]!.blocks.find((b) => b.props.templateSectionId === 'scope')!;
    const body = scope.children!.find((c) => c.type === 'paragraph' && c.content?.[0] && (c.content[0] as { text: string }).text.startsWith('Applies'))!;
    (body.content![0] as { text: string }).text = 'Applies to nobody.';
    const bad = await verifyRelease(released, tampered, { renditionBytes: pdf });
    expect(bad.ok).toBe(false);
    expect(bad.mismatches.some((m) => m.kind === 'section' && m.sectionId === scope.props.sectionId)).toBe(true);
    expect(bad.mismatches.some((m) => m.kind === 'document')).toBe(true);

    const badRendition = await verifyRelease(released, composed, { renditionBytes: new TextEncoder().encode('changed') });
    expect(badRendition.mismatches.map((m) => m.kind)).toEqual(['rendition']);

    // 9. Drafts derived from the published template keep the old version intact.
    const next = createDraftFromPublished(template);
    expect(next.status).toBe('draft');
    expect(template.version).toBe(1);
  });
});
