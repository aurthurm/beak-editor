import { describe, expect, it } from 'vitest';
import type { Block } from '@amusendame/beakblock-core';
import { BlockRegistry } from '@amusendame/beakblock-core';
import type { BeakDocument } from '@amusendame/beakblock-schema';

import {
  addSection,
  bindSignature,
  composeDocument,
  ComposeError,
  contentHash,
  createDocumentLifecycle,
  createRelease,
  createSectionLifecycle,
  createTemplate,
  createPrintRegisterEntry,
  freezeSectionRevision,
  GuardViolationError,
  headingSimilarity,
  instantiateDocument,
  InvalidTransitionError,
  mapImportToTemplate,
  moveSection,
  publishTemplate,
  removeSection,
  sectionContentHash,
  stampControlledCopy,
  PrintError,
  templateFromDocument,
  transitionDocument,
  transitionSection,
  updateSection,
  validateAgainstTemplate,
  validateProperties,
  OWNER_GRANTS,
  buildPolicyContext,
  TemplateError,
  SignatureBindingError,
  verifyRelease,
} from './index';
import type { TemplateDefinition, SectionAssignments, SectionRevision } from './index';

const text = (value: string) => [{ type: 'text' as const, text: value, styles: {} }];
const para = (id: string, value = '', props: Record<string, unknown> = {}): Block => ({ id, type: 'paragraph', props, content: text(value) });

function base(): TemplateDefinition {
  return createTemplate({ id: 'tpl', title: 'SOP', documentType: 'SOP', properties: { docNumber: { generated: true, pattern: '^SOP-\\d+$' }, title: { required: true, maxLength: 10 }, effectiveDate: { source: 'workflow' } } });
}

async function published(): Promise<TemplateDefinition> {
  let t = base();
  t = addSection(t, { templateSectionId: 'a', title: 'Purpose', required: true, allowedBlocks: ['paragraph'], lockedBoilerplate: [para('x', 'Fixed')], placeholder: [para('p', 'TBD', { placeholder: true })] });
  t = addSection(t, { templateSectionId: 'b', title: 'Procedure', required: true, kind: 'procedure', requiredBlocks: ['orderedList'], minBlocks: 2, placeholder: [] });
  return publishTemplate(t);
}

const ASSIGN: SectionAssignments = { a: { ownerId: 'u1', ownerName: 'U1' }, b: { ownerId: 'u2', ownerName: 'U2' } };

function docFrom(t: TemplateDefinition, blocks?: Block[]): BeakDocument {
  const doc = instantiateDocument(t, { properties: { title: 'T', revision: '1' }, docNumber: 'SOP-1', assignments: ASSIGN });
  if (blocks) doc.sections[0]!.blocks = blocks;
  return doc;
}

/** A document with only the given blocks (for templates that have no sections). */
function rawDoc(blocks: Block[]): BeakDocument {
  return {
    schemaVersion: 2,
    id: 'raw',
    properties: { title: 'T' },
    styles: { paragraph: {}, character: {}, table: {} },
    numbering: { abstract: {}, instances: {} },
    sections: [{ id: 'sec', pageSetup: { size: { widthTwips: 11906, heightTwips: 16838 }, orientation: 'portrait', margins: { top: 1, right: 1, bottom: 1, left: 1, header: 1, footer: 1, gutter: 0 } }, blocks }],
  };
}

describe('authoring', () => {
  it('creates drafts and edits them immutably', () => {
    const t0 = base();
    const t1 = addSection(t0, { templateSectionId: 'a', title: 'A', required: true });
    expect(t0.sections).toHaveLength(0);
    expect(t1.sections[0]!.defaultRoles).toEqual({});
    expect(() => addSection(t1, { templateSectionId: 'a', title: 'dup', required: false })).toThrow(TemplateError);
    const t2 = addSection(t1, { templateSectionId: 'b', title: 'B', required: false });
    const moved = moveSection(t2, 'b', 0);
    expect(moved.sections.map((s) => s.templateSectionId)).toEqual(['b', 'a']);
    expect(updateSection(moved, 'a', { title: 'Renamed' }).sections[1]!.title).toBe('Renamed');
    expect(removeSection(moved, 'a').sections).toHaveLength(1);
    expect(() => moveSection(t2, 'a', 5)).toThrow(TemplateError);
  });

  it('publishes a frozen, versioned copy with a content hash', async () => {
    const t = base();
    const published = await publishTemplate(addSection(t, { templateSectionId: 'a', title: 'A', required: true }));
    expect(published.status).toBe('published');
    expect(published.version).toBe(1);
    expect(published.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(published)).toBe(true);
    expect(Object.isFrozen(published.sections[0])).toBe(true);
    expect(() => updateSection(published, 'a', { title: 'x' })).toThrow(TemplateError);
    await expect(publishTemplate(published)).rejects.toThrow(TemplateError);
    await expect(publishTemplate(base())).rejects.toThrow(/at least one section/);
  });

  it('derives a template from an existing document', () => {
    const doc = rawDoc(
      [
        {
          id: 'cs',
          type: 'controlledSection',
          props: { sectionId: 'S', templateSectionId: 'a', title: 'Purpose', required: true, allowedBlocks: ['paragraph'], ownerName: 'U1' },
          children: [para('bp', 'Boiler', { lockedBy: 'template' }), para('free', 'Mine')],
        },
      ]
    );
    const t = templateFromDocument(doc, { id: 'from-doc', title: 'From doc', documentType: 'SOP' });
    expect(t.sections[0]).toMatchObject({ templateSectionId: 'a', required: true, allowedBlocks: ['paragraph'], defaultRoles: { author: 'U1' } });
    expect(t.sections[0]!.lockedBoilerplate!.map((b) => b.id)).toEqual(['bp']);
  });
});

describe('instantiation and policy context', () => {
  it('requires a published template, owners for required sections, and a generated number', async () => {
    const t = base();
    expect(() => instantiateDocument(t, { properties: { title: 'x' }, docNumber: 'SOP-1', assignments: {} })).toThrow(/published/);
    const p = await published();
    expect(() => instantiateDocument(p, { properties: { title: 'x' }, docNumber: 'SOP-1', assignments: { a: ASSIGN.a! } })).toThrow(/no owner/);
    expect(() => instantiateDocument(p, { properties: { title: 'x' }, assignments: ASSIGN })).toThrow(/generated/);
    expect(() => instantiateDocument(p, { properties: { title: 'x', docNumber: 'SOP-9' }, docNumber: 'SOP-1', assignments: ASSIGN })).toThrow(/read-only/);
  });

  it('creates one controlled section per template section with boilerplate and placeholders', async () => {
    const doc = docFrom(await published());
    const [a, b] = doc.sections[0]!.blocks;
    expect(a!.props).toMatchObject({ templateSectionId: 'a', workflowState: 'draft', allowedBlocks: ['paragraph'], ownerName: 'U1', required: true });
    expect(a!.children!.map((c) => c.props)).toEqual([{ lockedBy: 'template', templateSectionId: 'a' }, { placeholder: true }]);
    expect(b!.children).toHaveLength(1); // empty paragraph fallback
    expect(doc.properties).toMatchObject({ docNumber: 'SOP-1', revision: '1' });
  });

  it('builds grants for owners, locks approved sections, and gives system everything', async () => {
    const doc = docFrom(await published());
    const ctx = buildPolicyContext(doc, ASSIGN, 'u1', ['author']);
    const sid = doc.sections[0]!.blocks[0]!.props.sectionId as string;
    expect(ctx.sectionGrants[sid]).toEqual(OWNER_GRANTS);
    expect(OWNER_GRANTS).not.toContain('section.delete');
    expect(OWNER_GRANTS).not.toContain('table.editMandatoryColumns');
    expect(OWNER_GRANTS).not.toContain('table.editApprovedValues');
    expect(buildPolicyContext(doc, ASSIGN, 'u2', ['author']).sectionGrants[sid]).toBeUndefined();
    expect(buildPolicyContext(doc, ASSIGN, 'svc', ['system']).defaultGrants!.length).toBeGreaterThan(10);
    doc.sections[0]!.blocks[0]!.props.workflowState = 'approved';
    expect(buildPolicyContext(doc, ASSIGN, 'u1', ['author']).lockedSections).toEqual([sid]);
  });
});

describe('validation', () => {
  it('reports the template rules', async () => {
    const t = await published();
    const sid = 'S';
    const bad: Block[] = [
      { id: 's1', type: 'controlledSection', props: { sectionId: sid, templateSectionId: 'a', allowedBlocks: ['paragraph'] }, children: [{ id: 'hh', type: 'heading', props: { level: 1 }, content: text('x') }, para('z', 'Changed', { lockedBy: 'template' })] },
    ];
    const doc = docFrom(t, bad);
    doc.properties.effectiveDate = '2026-01-01';
    const codes = (await validateAgainstTemplate(doc, t)).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['missing-section', 'boilerplate-tampered', 'disallowed-block', 'property-workflow-only']));
    expect(codes).not.toContain('placeholder-remaining');
  });

  it('flags missing sections, min blocks, required blocks and procedure steps', async () => {
    const t = await published();
    const doc = docFrom(t, [
      { id: 's1', type: 'controlledSection', props: { sectionId: 'S1', templateSectionId: 'b', allowedBlocks: null }, children: [para('p1', 'one')] },
    ]);
    const codes = (await validateAgainstTemplate(doc, t)).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['missing-section', 'below-min-blocks', 'required-block-missing', 'procedure-steps-missing']));
  });

  it('checks property rules and passes the registry issues through', () => {
    const issues = validateProperties({ title: 'way too long title', docNumber: 'X' }, { docNumber: { generated: true, pattern: '^SOP-' }, title: { required: true, maxLength: 5 }, revision: { required: true } });
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(['property-too-long', 'property-pattern', 'property-required']));
    expect(validateProperties({}, { docNumber: { generated: true } }).map((i) => i.code)).toEqual(['property-generated-missing']);
  });

  it('uses the block registry when one is supplied', async () => {
    const t = await published();
    const registry = new BlockRegistry();
    registry.register({ type: 'paragraph', version: 1, family: 'text', capabilities: { editable: true, nested: false, printable: true, splittable: true, collaborative: true }, validate: () => [{ severity: 'warning', code: 'custom', message: 'm' }] }, { replace: true });
    const doc = docFrom(t);
    const issues = await validateAgainstTemplate(doc, t, { registry });
    expect(issues.some((i) => i.code === 'custom')).toBe(true);
  });
});

describe('lifecycles', () => {
  it('walks the section machine and emits audit events', () => {
    let lc = createSectionLifecycle('S', 'u1');
    const events = [];
    let out = transitionSection(lc, 'submit', { userId: 'u1' }, { at: '2026-01-01T00:00:00Z' });
    events.push(out.audit);
    lc = out.lifecycle;
    out = transitionSection(lc, 'review', { userId: 'r', roles: ['reviewer'] });
    lc = out.lifecycle;
    out = transitionSection(lc, 'approve', { userId: 'a', roles: ['approver'] });
    lc = out.lifecycle;
    expect(lc.state).toBe('approved');
    expect(events[0]).toMatchObject({ from: 'draft', to: 'submitted', sectionId: 'S', event: 'submit', at: '2026-01-01T00:00:00Z' });
    expect(out.audit).toMatchObject({ from: 'reviewed', to: 'approved', actor: { userId: 'a' } });
  });

  it('rejects invalid transitions, missing roles, non-owners, self-review and missing comments', () => {
    const lc = createSectionLifecycle('S', 'u1');
    expect(() => transitionSection(lc, 'approve', { userId: 'a', roles: ['approver'] })).toThrow(InvalidTransitionError);
    expect(() => transitionSection(lc, 'submit', { userId: 'u2' })).toThrow(GuardViolationError);
    const submitted = transitionSection(lc, 'submit', { userId: 'u1' }).lifecycle;
    expect(() => transitionSection(submitted, 'review', { userId: 'a' })).toThrow(/needs one of roles/);
    expect(() => transitionSection(submitted, 'review', { userId: 'u1', roles: ['reviewer'] })).toThrow(/already acted/);
    const reviewed = transitionSection(submitted, 'review', { userId: 'r', roles: ['reviewer'] }).lifecycle;
    expect(() => transitionSection(reviewed, 'approve', { userId: 'r', roles: ['approver'] })).toThrow(/already acted/);
    expect(() => transitionSection(reviewed, 'requestChanges', { userId: 'r', roles: ['reviewer'] })).toThrow(/needs a comment/);
    const reopened = transitionSection(reviewed, 'requestChanges', { userId: 'r', roles: ['reviewer'] }, { comment: 'fix' });
    expect(reopened.lifecycle.state).toBe('reopened');
    expect(reopened.audit.comment).toBe('fix');
  });

  it('freezes only approved sections into immutable revisions with stable hashes', async () => {
    const approved = transitionSection(
      transitionSection(transitionSection(createSectionLifecycle('S', 'u1'), 'submit', { userId: 'u1' }).lifecycle, 'review', { userId: 'r', roles: ['reviewer'] }).lifecycle,
      'approve',
      { userId: 'a', roles: ['approver'] }
    ).lifecycle;
    const blocks = [para('p', 'Hello')];
    const rev = await freezeSectionRevision({ sectionId: 'S', templateSectionId: 'a', revision: '1', blocks, lifecycle: approved });
    expect(Object.isFrozen(rev.blocks[0])).toBe(true);
    expect(rev.contentHash).toBe(await sectionContentHash(blocks));
    await expect(freezeSectionRevision({ sectionId: 'S', revision: '1', blocks, lifecycle: createSectionLifecycle('S') })).rejects.toThrow(InvalidTransitionError);
  });

  it('walks the document machine with its guards', () => {
    let lc = createDocumentLifecycle('D');
    lc = transitionDocument(lc, 'submitForReview', { userId: 'author' }).lifecycle;
    expect(() => transitionDocument(lc, 'approve', { userId: 'a', roles: ['approver'] }, { sectionsApproved: false })).toThrow(/Every section/);
    expect(() => transitionDocument(lc, 'approve', { userId: 'author', roles: ['approver'] }, { sectionsApproved: true })).toThrow(/already acted|submitted/);
    lc = transitionDocument(lc, 'approve', { userId: 'a', roles: ['approver'] }, { sectionsApproved: true }).lifecycle;
    expect(() => transitionDocument(lc, 'makeEffective', { userId: 'q', roles: ['qualityManager'] })).toThrow(/effective date/);
    lc = transitionDocument(lc, 'makeEffective', { userId: 'q', roles: ['qualityManager'] }, { effectiveDate: '2026-12-01' }).lifecycle;
    expect(lc).toMatchObject({ state: 'effective', effectiveDate: '2026-12-01' });
    lc = transitionDocument(lc, 'startPeriodicReview', { userId: 'q', roles: ['qualityManager'] }).lifecycle;
    lc = transitionDocument(lc, 'supersede', { userId: 'q', roles: ['qualityManager'] }).lifecycle;
    expect(lc.state).toBe('superseded');
    expect(() => transitionDocument(lc, 'submitForReview', { userId: 'x' })).toThrow(InvalidTransitionError);
  });
});

describe('hashing', () => {
  it('is independent of key order and sensitive to content', async () => {
    expect(await contentHash({ b: 1, a: [2] })).toBe(await contentHash({ a: [2], b: 1 }));
    expect(await contentHash({ a: 1 })).not.toBe(await contentHash({ a: 2 }));
  });

  it('ignores derived heading numbering but not heading text', async () => {
    const h = (level: number, extra: Record<string, unknown> = {}): Block => ({ id: 'h', type: 'heading', props: { level, ...extra }, content: text('Scope') });
    const plain = await sectionContentHash([h(1)]);
    const numbered = await sectionContentHash([h(1, { numbering: { numId: '3', level: 0 }, styleId: 'Heading1' })]);
    expect(numbered).toBe(plain);
    expect(await sectionContentHash([{ ...h(1), content: text('Other') }])).not.toBe(plain);
  });
});

describe('composition', () => {
  async function revisionsFor(_t: TemplateDefinition, approvedBy = "a"): Promise<SectionRevision[]> {
    const out: SectionRevision[] = [];
    out.push(await freezeSectionRevision({
      sectionId: 'S-a',
      templateSectionId: 'a',
      revision: '1',
      blocks: [para('x', 'Fixed'), para('y', 'Body')],
      lifecycle: { sectionId: 'S-a', state: 'approved', ownerId: 'u1', submittedBy: 'u1', reviewedBy: 'r', approvedBy, approvedAt: '2026-01-01T00:00:00Z' },
    }));
    out.push(await freezeSectionRevision({
      sectionId: 'S-b',
      templateSectionId: 'b',
      revision: '1',
      blocks: [{ id: 'h', type: 'heading', props: { level: 2 }, content: text('Steps') }, { id: 'ol', type: 'orderedList', props: {}, children: [] }],
      lifecycle: { sectionId: 'S-b', state: 'approved', ownerId: 'u2', submittedBy: 'u2', reviewedBy: 'r', approvedBy, approvedAt: '2026-01-01T00:00:00Z' },
    }));
    return out;
  }

  it('rejects missing, unknown, duplicate and tampered revisions', async () => {
    const t = await published();
    const revs = await revisionsFor(t);
    const props = { title: 'T', docNumber: 'SOP-1', revision: '1' };
    await expect(composeDocument({ template: t, sectionRevisions: [revs[0]!], properties: props })).rejects.toThrow(/no approved revision/);
    await expect(composeDocument({ template: t, sectionRevisions: [...revs, { ...revs[0]! }], properties: props })).rejects.toBeInstanceOf(ComposeError);
    await expect(composeDocument({ template: t, sectionRevisions: [{ ...revs[0]!, templateSectionId: 'zz' }, revs[1]!], properties: props })).rejects.toThrow(/matches no template section/);
    const tampered = { ...revs[0]!, blocks: [para('x', 'Changed')] };
    await expect(composeDocument({ template: t, sectionRevisions: [tampered, revs[1]!], properties: props })).rejects.toMatchObject({ code: 'revision-hash-mismatch' });
    await expect(composeDocument({ template: t, sectionRevisions: revs, properties: { title: 'T', revision: '1' } })).rejects.toMatchObject({ code: 'properties-invalid' });
  });

  it('composes sections in order with continuous heading numbering, page masters and generated parts', async () => {
    const t0 = await published();
    const t = { ...t0, pageMasters: { ...t0.pageMasters, landscape: { ...t0.pageMasters.default, orientation: 'landscape' as const } } };
    const landscapeT = await publishTemplate(createDraftFromTemplate(t));
    const revs = await revisionsFor(landscapeT);
    const composed = await composeDocument({
      template: landscapeT,
      sectionRevisions: revs,
      properties: { title: 'T', docNumber: 'SOP-1', revision: '1' },
      generatedParts: {
        notice: { kind: 'controlledCopy', copyNumber: 2 },
        revisionHistory: [{ revision: '1', date: 'd', author: 'a', description: 'x' }],
        distributionList: ['QA'],
        approvalPage: { approvers: [{ role: 'Approver', name: null }] },
      },
    });
    expect(composed.document.schemaVersion).toBe(2);
    expect(composed.manifestDraft.sections.map((s) => s.sectionId)).toEqual(['S-a', 'S-b']);
    expect(composed.document.sections).toHaveLength(1);
    const types = composed.document.sections[0]!.blocks.map((b) => b.type);
    expect(types[0]).toBe('controlledNotice');
    expect(types).toContain('revisionHistory');
    expect(types).toContain('approvalBlock');
    expect(types.filter((x) => x === 'signatureBlock')).toHaveLength(1);
    expect(composed.ir.sections[0]!.body.length).toBeGreaterThan(0);
  });

  it('splits sections into document sections by page master', async () => {
    const t0 = await published();
    const t = await publishTemplate({
      ...createDraftFromTemplate(t0),
      pageMasters: { default: t0.pageMasters.default, landscape: { ...t0.pageMasters.default, orientation: 'landscape' } },
      sections: t0.sections.map((s) => ({ ...s, pageMaster: s.templateSectionId === 'b' ? 'landscape' : 'default' })),
    });
    const composed = await composeDocument({ template: t, sectionRevisions: await revisionsFor(t), properties: { title: 'T', docNumber: 'SOP-1', revision: '1' } });
    expect(composed.document.sections).toHaveLength(2);
    expect(composed.document.sections[1]!.pageSetup.orientation).toBe('landscape');
  });

  it('verifies a release and reports a mismatched revision as a revision mismatch', async () => {
    const t = await published();
    const composed = await composeDocument({ template: t, sectionRevisions: await revisionsFor(t), properties: { title: 'T', docNumber: 'SOP-1', revision: '1' } });
    const release = await createRelease({ composed, documentRevision: '1', releasedBy: 'qm' });
    expect((await verifyRelease(release, composed)).ok).toBe(true);
    await expect(createRelease({ composed, documentRevision: '2', releasedBy: 'qm' })).rejects.toThrow(/does not match/);
    const wrongRev = { ...release, revision: '9' };
    expect((await verifyRelease(wrongRev, composed)).mismatches.map((m) => m.kind)).toContain('revision');
  });
});

function createDraftFromTemplate(t: TemplateDefinition): TemplateDefinition {
  const { contentHash: _c, publishedAt: _p, ...rest } = t;
  return { ...rest, status: 'draft' };
}

describe('release signatures and print', () => {
  it('binds signatures only to the matching document hash', async () => {
    const t = await published();
    const revs = await (async () => {
      const r1 = await freezeSectionRevision({ sectionId: 'S-a', templateSectionId: 'a', revision: '1', blocks: [para('x', 'A')], lifecycle: { sectionId: 'S-a', state: 'approved', ownerId: null, submittedBy: null, reviewedBy: null, approvedBy: 'a', approvedAt: 't' } });
      const r2 = await freezeSectionRevision({ sectionId: 'S-b', templateSectionId: 'b', revision: '1', blocks: [{ id: 'l', type: 'orderedList', props: {}, children: [] }], lifecycle: { sectionId: 'S-b', state: 'approved', ownerId: null, submittedBy: null, reviewedBy: null, approvedBy: 'a', approvedAt: 't' } });
      return [r1, r2];
    })();
    const composed = await composeDocument({ template: t, sectionRevisions: revs, properties: { title: 'T', docNumber: 'SOP-1', revision: '1' } });
    const m = await createRelease({ composed, documentRevision: '1', releasedBy: 'qm' });
    const sig = { signatureId: 's1', signerId: 'ap', meaning: 'approved' as const, at: 't' };
    expect(bindSignature(m, { ...sig, contentHash: m.documentHash }).signatures).toHaveLength(1);
    expect(() => bindSignature(m, { ...sig, contentHash: 'deadbeef' })).toThrow(SignatureBindingError);
    expect(() => bindSignature(bindSignature(m, { ...sig, contentHash: m.documentHash }), { ...sig, contentHash: m.documentHash })).toThrow(/already bound/);
    expect((await createRelease({ composed, documentRevision: '1', releasedBy: 'qm', signatures: [sig] })).signatures[0]!.contentHash).toBe(m.documentHash);
    expect(createPrintRegisterEntry(m, stampControlledCopy({ copyNumber: 1, issuedTo: 'QA' }), 'printer', 'pr-1')).toMatchObject({ copyNumber: 1, issuedTo: 'QA', documentHash: m.documentHash });
  });

  it('stamps controlled copies with layout-ready options', () => {
    const stamp = stampControlledCopy({ copyNumber: 3, issuedTo: 'Lab 2', printedAt: '2026-10-22T00:00:00Z' });
    expect(stamp.watermark).toBe('CONTROLLED COPY No. 3');
    expect(stamp.controlledCopy).toEqual({ copyNumber: 3, issuedTo: 'Lab 2' });
    expect(() => stampControlledCopy({ copyNumber: 0, issuedTo: 'x' })).toThrow(PrintError);
    expect(() => stampControlledCopy({ copyNumber: 1, issuedTo: ' ' })).toThrow(PrintError);
  });
});

describe('import mapping', () => {
  it('maps legacy headings to template sections in order using synonyms', async () => {
    const t = await publishTemplate(
      addSection(addSection(addSection(base(), { templateSectionId: 'purpose', title: 'Purpose', required: true }), { templateSectionId: 'proc', title: 'Procedure', required: true }), { templateSectionId: 'refs', title: 'References', required: false })
    );
    const mapping = mapImportToTemplate(
      [
        { index: 0, text: '1. Objective', level: 1 },
        { index: 1, text: '2. Scope', level: 1 },
        { index: 2, text: '3. Method', level: 1 },
        { index: 3, text: 'Bibliography of unrelated things', level: 1 },
        { index: 4, text: 'Related documents', level: 1 },
      ],
      t
    );
    expect(mapping.map((m) => [m.templateSectionId, m.startIndex, m.endIndex])).toEqual([
      ['purpose', 0, 1],
      ['proc', 2, 3],
      ['refs', 4, 4],
    ]);
    expect(mapping[0]!.confidence).toBeGreaterThanOrEqual(0.6);
    expect(headingSimilarity('Purpose', 'Purpose')).toBe(1);
    expect(headingSimilarity('Purpose', 'Zebra')).toBeLessThan(0.6);
  });

  it('reports unmatched sections with index -1', async () => {
    const t = await publishTemplate(addSection(base(), { templateSectionId: 'qc', title: 'Quality control', required: true }));
    const [m] = mapImportToTemplate([{ index: 0, text: 'Introduction to the lab', level: 1 }], t);
    expect(m).toMatchObject({ startIndex: -1, endIndex: -1, confidence: 0 });
  });
});
