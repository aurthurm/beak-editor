/**
 * Synthetic controlled documents: validation protocol, quality manual excerpt, a mixed-permission
 * SOP and a QMS release page. All content is invented for conformance testing.
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';
import { createPageSetup } from '@amusendame/beakblock-schema';

import { docBuilder } from './builders';

/** VAL-2026-07: IQ/OQ/PQ protocol. Captions, SEQ fields, equations and dense result tables. */
export function validationProtocol(): Block[] {
  const b = docBuilder('val');
  const objective = b.h(1, '1. Objective', { styleId: 'Heading1' });
  const resultRows = Array.from({ length: 12 }, (_, i) => [
    { text: `TC-${String(i + 1).padStart(3, '0')}` },
    { text: `Dilution ${i + 1}` },
    { text: (98 + (i % 3) * 0.7).toFixed(1) },
    { text: 'Pass' },
  ]);
  return [
    b.p([b.text('Validation Protocol: Automated Haematology Analyser', { bold: true })], { styleId: 'Title', textAlign: 'center' }),
    objective,
    b.p('Demonstrate that the analyser meets the acceptance criteria for precision, linearity and carryover before release to routine use.'),
    b.h(1, '2. Acceptance criteria', { styleId: 'Heading1' }),
    b.p([b.text('Within-run CV must not exceed 3 %. The recovery at each dilution must fall between 95 % and 105 %.')]),
    b.block('equation', { latex: '\\mathrm{CV} = \\frac{\\sigma}{\\bar{x}} \\times 100\\%' }),
    b.block('caption', { label: 'Equation' }, [b.text('Coefficient of variation used for the precision criterion.')]),
    b.h(1, '3. Test cases', { styleId: 'Heading1' }),
    b.table([
      [{ text: 'Test', header: true }, { text: 'Sample', header: true }, { text: 'Recovery %', header: true }, { text: 'Result', header: true }],
      ...resultRows,
    ], { widthMode: 'auto', look: { headerRow: true, bandedRows: true, firstColumn: false, lastRow: false } }),
    b.block('caption', { label: 'Table' }, [b.text('Linearity results for the haemoglobin channel.')]),
    b.h(1, '4. Deviations', { styleId: 'Heading1' }),
    b.p([
      b.text('Deviation '),
      b.field('SEQ', 'Deviation', { format: 'ARABIC' }),
      b.text(': one reagent lot was received late; see the change record for '),
      b.field('REF', objective.id, { fallback: 'Objective' }),
      b.text('.'),
    ]),
    b.h(1, '5. Approval', { styleId: 'Heading1' }),
    b.block('signatureBlock', { id: 'sig-val-1', role: 'Validation lead', signerName: null, signedAt: null, meaning: 'authored', contentHash: null, signatureId: null }),
    b.block('approvalBlock', {
      id: 'appr-val-1',
      approvers: [
        { role: 'Quality manager', name: null },
        { role: 'Laboratory director', name: null },
      ],
    }),
  ];
}

/** QM-001 excerpt: TOC, numbered headings, a landscape appendix section and a controlled notice. */
export function qualityManualExcerpt(): Block[] {
  const b = docBuilder('qm');
  return [
    b.p([b.text('Quality Manual (excerpt)', { bold: true })], { styleId: 'Title' }),
    b.block('controlledNotice', { id: 'notice-qm', kind: 'uncontrolledWhenPrinted', copyNumber: null }),
    b.block('tableOfContents', { items: [{ id: 'qm-h-4', level: 1, text: '4. Document control' }] }),
    b.h(1, '1. Introduction', { styleId: 'Heading1', numbering: { numId: '3', level: 0 } }),
    b.p('This excerpt describes how the laboratory maintains documents and records under the quality management system.'),
    b.h(1, '2. Normative references', { styleId: 'Heading1', numbering: { numId: '3', level: 0 } }),
    b.ul(['ISO 15189:2022, Medical laboratories: requirements for quality and competence', 'Internal policy QP-000, Document control']),
    b.h(1, '3. Terms and definitions', { styleId: 'Heading1', numbering: { numId: '3', level: 0 } }),
    b.p([b.text('Controlled document: ', { bold: true }), b.text('a document whose current version is held by Document Control and whose copies are tracked.')]),
    b.h(1, '4. Document control', { styleId: 'Heading1', numbering: { numId: '3', level: 0 } }),
    b.controlledSection('qm-doc-control', '4. Document control', [
      b.h(2, '4.1 Approval', { styleId: 'Heading2', numbering: { numId: '3', level: 1 } }),
      b.p('Documents are approved by the quality manager before release. Approval is recorded electronically.'),
      b.h(2, '4.2 Review cycle', { styleId: 'Heading2', numbering: { numId: '3', level: 1 } }),
      b.p([b.text('Each document is reviewed at least every '), b.text('two years', { bold: true }), b.text('.')]),
      b.block('revisionHistory', {
        id: 'rh-qm-1',
        entries: [
          { revision: '1', date: '2022-01-10', author: 'J. Moyo', description: 'Initial issue' },
          { revision: '2', date: '2024-06-03', author: 'A. Dube', description: 'Added electronic approval' },
        ],
      }),
    ], { workflowState: 'approved', required: true }),
    b.h(1, '5. Records', { styleId: 'Heading1', numbering: { numId: '3', level: 0 } }),
    b.p('Records are retained according to the retention schedule in the appendix.'),
    b.block('sectionBreak', { pageSetup: createPageSetup({ size: 'A4', orientation: 'landscape' }) }),
    b.h(1, 'Appendix A: Retention schedule', { styleId: 'Heading1' }),
    b.table([
      [{ text: 'Record', header: true }, { text: 'Retention', header: true }, { text: 'Owner', header: true }],
      [{ text: 'Controlled documents' }, { text: 'Life of document + 5 years' }, { text: 'Document Control' }],
      [{ text: 'Training records' }, { text: '10 years' }, { text: 'HR' }],
      [{ text: 'Calibration certificates' }, { text: 'Life of equipment + 5 years' }, { text: 'Equipment' }],
    ]),
    b.p([b.text('Appendix prepared by '), b.field('DOCPROPERTY', 'owner', { fallback: 'Quality' }), b.text('.')]),
    b.block('sectionBreak', { pageSetup: createPageSetup({ size: 'A4' }) }),
  ];
}

/** Mixed permissions: approved (locked), draft, optional and reopened sections, plus uncontrolled text. */
export function mixedPermissionSop(): Block[] {
  const b = docBuilder('mix');
  return [
    b.h(1, 'Sample Receipt and Labelling', { styleId: 'Heading1' }),
    b.p('Uncontrolled introduction: anyone with document edit rights may change this paragraph.'),
    b.controlledSection('mix-purpose', 'Purpose', [
      b.p('Locked approved boilerplate describing why samples are labelled at receipt.'),
    ], { workflowState: 'approved', locked: true, allowedBlocks: ['paragraph'], required: true }),
    b.controlledSection('mix-scope', 'Scope', [
      b.p('Scope text, editable by the bench author.'),
      b.ul(['Blood, urine and swab specimens', 'Specimens received by courier']),
    ], { workflowState: 'draft', required: true, allowedBlocks: null, ownerName: 'Bench author' }),
    b.controlledSection('mix-steps', 'Procedure', [
      b.block('sopStep', { stepNumber: 1, timeMinutes: 1, critical: true }, undefined, [b.p([b.text('Check the requisition matches the sample label.')])]),
      b.table([
        [{ text: 'Label field', header: true }, { text: 'Required', header: true }],
        [{ text: 'Patient identifier' }, { text: 'Yes' }],
        [{ text: 'Collection time' }, { text: 'Yes' }],
      ], { widthMode: 'fixed', widthValue: 4000 }),
    ], { workflowState: 'reopened', required: true, allowedBlocks: ['paragraph', 'table', 'sopStep'] }),
    b.controlledSection('mix-records', 'Records', [b.p('Optional records section; may be removed for short-form work instructions.')], {
      workflowState: 'submitted',
      required: false,
    }),
    b.p('Uncontrolled closing remarks sit outside every section.'),
  ];
}

/** QMS release page: document identifier, notice, approval, signatures (hash-bound) and acknowledgement. */
export function qmsReleaseSop(): Block[] {
  const b = docBuilder('rel');
  return [
    b.p([
      b.text('SOP-QA-0101 '),
      { type: 'documentIdentifier', props: { id: 'docid-1', property: 'docNumberRevision', fallback: 'SOP-QA-0101 r3' } },
    ]),
    b.block('controlledNotice', { id: 'notice-rel', kind: 'controlledCopy', copyNumber: 2 }),
    b.h(1, 'Non-conformance handling', { styleId: 'Heading1' }),
    b.controlledSection('rel-body', 'Non-conformance handling', [
      b.p('Log every non-conformance within 24 hours and assign an owner.'),
      b.block('sopStep', { stepNumber: 1, timeMinutes: 5, critical: false }, undefined, [b.p([b.text('Open a non-conformance record in the QMS.')])]),
    ], { workflowState: 'approved', required: true, ownerName: 'QA' }),
    b.block('approvalBlock', {
      id: 'appr-rel-1',
      approvers: [
        { role: 'Author', name: 'M. Ncube', signedAt: '2026-05-04T08:00:00.000Z', signatureId: 'sig-1001' },
        { role: 'Reviewer', name: 'R. Chanda', signedAt: '2026-05-05T11:30:00.000Z', signatureId: 'sig-1002' },
        { role: 'Approver', name: null },
      ],
    }),
    b.block('signatureBlock', {
      id: 'sig-rel-2',
      role: 'Approver',
      signerName: 'K. Phiri',
      signedAt: '2026-05-06T14:12:00.000Z',
      meaning: 'approved',
      contentHash: 'sha256:4f2a9c1e7b3d8a60f5e2c9b1a7d3f4e8c6b2a9d5f1e7c3b8a4d6f2e9c1b7a3d5',
      signatureId: 'sig-1003',
    }),
    b.block('revisionHistory', {
      id: 'rh-rel-1',
      entries: [{ revision: '3', date: '2026-05-06', author: 'M. Ncube', description: 'Clarified the escalation timeline' }],
    }),
    b.block('acknowledgement', { id: 'ack-rel-1', statement: 'I have read and understood this procedure.', required: true }),
  ];
}
