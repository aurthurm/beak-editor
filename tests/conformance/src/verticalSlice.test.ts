/**
 * Phase 4 exit narrative, end to end across packages (roadmap section 6, Phase 4):
 *
 * A Quality Manager publishes a controlled template. Three authors edit only their own sections,
 * including a formatted table. A reviewer comments and requests changes, and the approved sections
 * are frozen. The document is composed, numbered, released with content hashes, rendered as an A4
 * print document and exported as DOCX. A malicious client that alters a protected section is refused.
 */
import { describe, expect, it } from 'vitest';
import type { Block } from '@amusendame/beakblock-core';
import { layoutDocument, renderPrintHTML } from '@amusendame/beakblock-layout';
import { exportDocxWithReport } from '@amusendame/beakblock-export-docx';
import { importDocx } from '@amusendame/beakblock-import-docx';
import { documentToIR } from '@amusendame/beakblock-ir';
import { verifyDocumentChange } from '@amusendame/beakblock-permissions';
import { InMemoryCommentThreadStore, compareRevisions, createCommentAnchor } from '@amusendame/beakblock-review';
import {
  addSection,
  attachRendition,
  bindSignature,
  buildPolicyContext,
  composeDocument,
  createDocumentLifecycle,
  createDraftFromPublished,
  createRelease,
  createSectionLifecycle,
  createTemplate,
  flattenBlocks,
  freezeSectionRevision,
  instantiateDocument,
  publishTemplate,
  transitionDocument,
  transitionSection,
  validateAgainstTemplate,
  verifyRelease,
  type Actor,
  type SectionAssignments,
  type TemplateDefinition,
} from '@amusendame/beakblock-templates';

import { ServerDocumentStore, hashBlocks } from './support/serverStore';

const text = (value: string) => [{ type: 'text' as const, text: value, styles: {} }];
const para = (id: string, value: string, props: Record<string, unknown> = {}): Block => ({ id, type: 'paragraph', props, content: text(value) });
const cell = (id: string, value: string): Block => ({ id, type: 'tableCell', props: {}, children: [para(`${id}-p`, value)] });
const row = (id: string, cells: Block[]): Block => ({ id, type: 'tableRow', props: {}, children: cells });

const A4_WIDTH_PT = 595.3;

async function publishedTemplate(): Promise<TemplateDefinition> {
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

function sectionOf(blocks: Block[], templateSectionId: string): Block {
  const found = blocks.find((b) => b.type === 'controlledSection' && b.props.templateSectionId === templateSectionId);
  if (!found) throw new Error(`no section ${templateSectionId}`);
  return found;
}

describe('vertical slice: controlled SOP from template to release (Phase 4 exit)', () => {
  it('runs template, authoring, review, approval, composition, release, print and DOCX, and refuses a malicious client', async () => {
    // 1. Quality Manager publishes the template.
    const template = await publishedTemplate();
    expect(template.status).toBe('published');

    // 2. Instantiate for three authors and check the empty document is incomplete.
    const doc = instantiateDocument(template, {
      properties: { title: 'Gram stain', revision: '1' },
      docNumber: 'SOP-0042',
      assignments: ASSIGN,
      documentId: 'doc-42',
    });
    const initial = await validateAgainstTemplate(doc, template, { procedureBlockTypes: ['orderedList'] });
    expect(initial.filter((i) => i.severity === 'error').map((i) => i.code)).toEqual(['procedure-steps-missing']);

    // 3. Each author edits only their own section.
    const before = flattenBlocks(doc);
    const ctx = {
      ann: buildPolicyContext(doc, ASSIGN, 'ann', ['author']),
      ben: buildPolicyContext(doc, ASSIGN, 'ben', ['author']),
      cy: buildPolicyContext(doc, ASSIGN, 'cy', ['author']),
    };
    const edit = (tsid: string, mutate: (section: Block) => void): Block[] => {
      const next = structuredClone(before);
      mutate(sectionOf(next, tsid));
      return next;
    };
    const annEdit = edit('purpose', (s) => {
      s.children = [...(s.children ?? []).filter((c) => !c.props.placeholder), para('ann-1', 'Gram stain differentiates bacteria by cell wall structure.')];
    });
    const benEdit = edit('scope', (s) => {
      s.children = [...(s.children ?? []).filter((c) => !c.props.placeholder), para('ben-1', 'Applies to all microbiology bench staff.')];
    });
    const cyEdit = edit('procedure', (s) => {
      const table = s.children!.find((c) => c.type === 'table')!;
      delete table.props.placeholder;
      s.children!.push({ id: 'steps', type: 'orderedList', props: {}, children: [{ id: 'step-1', type: 'listItem', props: {}, content: text('Fix smear') }] });
    });
    expect(verifyDocumentChange(before, annEdit, ctx.ann).allowed).toBe(true);
    expect(verifyDocumentChange(before, annEdit, ctx.ben).allowed).toBe(false);
    expect(verifyDocumentChange(before, benEdit, ctx.ben).allowed).toBe(true);
    expect(verifyDocumentChange(before, benEdit, ctx.ann).allowed).toBe(false);
    expect(verifyDocumentChange(before, cyEdit, ctx.cy).allowed).toBe(true);
    expect(verifyDocumentChange(before, cyEdit, ctx.ben).allowed).toBe(false);

    // Merge the three authored sections into one submitted state.
    const merged = structuredClone(before);
    for (const [src, tsid] of [[annEdit, 'purpose'], [benEdit, 'scope'], [cyEdit, 'procedure']] as const) {
      const dst = sectionOf(merged, tsid);
      dst.children = structuredClone(sectionOf(src, tsid).children);
    }
    doc.sections[0]!.blocks = merged;
    const afterAuthoring = await validateAgainstTemplate(doc, template, { procedureBlockTypes: ['orderedList'] });
    expect(afterAuthoring.filter((i) => i.severity === 'error')).toEqual([]);

    // 4. Review: a reviewer comments on the procedure, and the draft is compared with the published
    //    state to produce the change summary.
    const comments = new InMemoryCommentThreadStore();
    const procedure = sectionOf(merged, 'procedure');
    const stepBlock = procedure.children!.find((c) => c.type === 'orderedList')!;
    const anchor = createCommentAnchor(merged, stepBlock.children![0]!.id, 0, 3);
    const thread = comments.add({ anchor, authorId: REVIEWER.userId, body: 'Please add the wash step @cy' });
    expect(thread.thread[0]?.mentions).toEqual(['cy']);
    const diff = compareRevisions(before, merged);
    expect(diff.summary.modified + diff.summary.added).toBeGreaterThan(0);
    expect(diff.summary.sectionsChanged).toContain(procedure.props.sectionId);

    // 5. Section lifecycle: submit, review, request changes, resubmit, approve.
    const lifecycles: Record<string, ReturnType<typeof createSectionLifecycle>> = {};
    for (const [tsid, def] of Object.entries(ASSIGN)) {
      lifecycles[tsid] = createSectionLifecycle(sectionOf(merged, tsid).props.sectionId as string, def.ownerId);
    }
    for (const tsid of ['purpose', 'scope', 'procedure', 'records']) {
      lifecycles[tsid] = transitionSection(lifecycles[tsid]!, 'submit', { userId: ASSIGN[tsid]!.ownerId }).lifecycle;
      lifecycles[tsid] = transitionSection(lifecycles[tsid]!, 'review', REVIEWER).lifecycle;
    }
    expect(() => transitionSection(lifecycles.procedure!, 'approve', REVIEWER)).toThrow();
    lifecycles.procedure = transitionSection(lifecycles.procedure!, 'requestChanges', REVIEWER, { comment: 'Add the wash step' }).lifecycle;
    lifecycles.procedure = transitionSection(lifecycles.procedure!, 'submit', { userId: 'cy' }).lifecycle;
    lifecycles.procedure = transitionSection(lifecycles.procedure!, 'review', { userId: 'rita2', roles: ['reviewer'] }).lifecycle;
    for (const tsid of ['purpose', 'scope', 'procedure', 'records']) {
      lifecycles[tsid] = transitionSection(lifecycles[tsid]!, 'approve', APPROVER).lifecycle;
    }

    // 6. The service writes the approved state and the locks, then the approved sections are frozen.
    const approved = structuredClone(flattenBlocks(doc));
    for (const b of approved) if (b.type === 'controlledSection') b.props.workflowState = 'approved';
    expect(verifyDocumentChange(flattenBlocks(doc), approved, buildPolicyContext(doc, ASSIGN, SYSTEM.userId, SYSTEM.roles)).allowed).toBe(true);
    doc.sections[0]!.blocks = approved;
    const sectionRevisions = [];
    for (const tsid of ['purpose', 'scope', 'procedure', 'records']) {
      const block = sectionOf(approved, tsid);
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

    // 7. Document lifecycle and composition.
    let docLifecycle = createDocumentLifecycle('doc-42');
    docLifecycle = transitionDocument(docLifecycle, 'submitForReview', { userId: 'ann' }).lifecycle;
    docLifecycle = transitionDocument(docLifecycle, 'approve', APPROVER, { sectionsApproved: true }).lifecycle;
    docLifecycle = transitionDocument(docLifecycle, 'makeEffective', QM, { effectiveDate: '2026-11-01' }).lifecycle;
    expect(docLifecycle.state).toBe('effective');

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
    expect(composed.ir.sections[0]!.body.filter((b) => b.type === 'sdt')).toHaveLength(4);
    const composedValidation = await validateAgainstTemplate(composed.document, template, { procedureBlockTypes: ['orderedList'], fromWorkflow: true });
    expect(composedValidation.filter((i) => i.severity === 'error')).toEqual([]);

    // 8. Release: manifest with hashes, signature bound to the document hash, rendition hash.
    const manifest = await createRelease({ composed, documentRevision: '1', releasedBy: 'qm', releasedAt: '2026-10-22T09:00:00.000Z' });
    expect(manifest.sections).toHaveLength(4);
    const signed = bindSignature(manifest, {
      signatureId: 'sig-ap-1',
      signerId: 'ap',
      meaning: 'approved',
      at: '2026-10-22T09:05:00.000Z',
      contentHash: manifest.documentHash,
    });
    const rendition = new TextEncoder().encode('%PDF-1.7 rendition bytes');
    const released = await attachRendition(signed, rendition);
    expect(released.renditionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyRelease(released, composed, { renditionBytes: rendition })).toEqual({ ok: true, mismatches: [] });

    // 9. Print: A4 page size from the composed page setup, one page element per layout page.
    const layout = layoutDocument(composed.ir, { now: new Date('2026-10-22T09:00:00.000Z') });
    expect(composed.ir.sections[0]!.pageSetup.size.widthTwips).toBe(11906);
    const html = renderPrintHTML(composed.ir, layout, { title: 'SOP-0042 Gram stain', now: new Date('2026-10-22T09:00:00.000Z') });
    expect((html.match(/<section class="bb-page[ "]/g) ?? []).length).toBe(layout.pageCount);
    expect(html).toMatch(new RegExp(`width:${A4_WIDTH_PT.toFixed(1).replace('.', '\\.')}\\d?pt`));
    expect(layout.pageCount).toBeGreaterThanOrEqual(1);

    // 10. DOCX: the content controls survive export and import, and the export is deterministic.
    const ir = documentToIR(composed.document);
    const exported = await exportDocxWithReport(ir);
    const again = await exportDocxWithReport(ir);
    expect(Buffer.from(exported.bytes).equals(Buffer.from(again.bytes))).toBe(true);
    const { ir: reimported } = await importDocx(exported.bytes);
    const sdtTags = reimported.sections[0]!.body.filter((b) => b.type === 'sdt').map((b) => (b as { tag: string }).tag);
    expect(sdtTags).toEqual(composed.ir.sections[0]!.body.filter((b) => b.type === 'sdt').map((b) => (b as { tag: string }).tag));

    // 11. Malicious client: it edits the approved purpose section and tries to unlock it. The
    //     server store refuses both, and the stored document is unchanged.
    const store = new ServerDocumentStore();
    store.createDocument('tenant-a', 'doc-42', approved);
    store.grant('tenant-a', 'ann', { roles: ['author'], sectionGrants: { purpose: ['section.editText'] } });
    const base = store.read('tenant-a', 'ann', 'doc-42')!;
    const tampered = structuredClone(base.blocks);
    sectionOf(tampered, 'purpose').children!.push(para('forged', 'Everything is fine, sign here.'));
    const forged = store.submit('tenant-a', { documentId: 'doc-42', userId: 'ann', baseHash: base.hash, submissionId: 'mal-1', blocks: tampered });
    expect(forged.ok).toBe(false);
    const unlock = structuredClone(base.blocks);
    sectionOf(unlock, 'purpose').props.workflowState = 'draft';
    const unlocked = store.submit('tenant-a', { documentId: 'doc-42', userId: 'ann', baseHash: base.hash, submissionId: 'mal-2', blocks: unlock });
    expect(unlocked.ok).toBe(false);
    expect(store.read('tenant-a', 'ann', 'doc-42')!.hash).toBe(hashBlocks(approved));

    // 12. Drafts derived from the published template leave the published version intact.
    const next = createDraftFromPublished(template);
    expect(next.status).toBe('draft');
    expect(template.version).toBe(1);
  });
});
