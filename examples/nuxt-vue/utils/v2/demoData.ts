/**
 * Demo content for the BeakBlock 2.0 scenarios. Shared by the Vue (examples/nuxt-vue) and
 * React (examples/next-app) showcases where the scenario names match.
 */
import type { Block } from '@amusendame/beakblock-core';
import {
  createDefaultNumbering,
  createDefaultStyleSheet,
  documentToBlocks,
  type BeakDocument,
  type DocumentSection,
  type PageSetup,
} from '@amusendame/beakblock-schema';

/* -------------------------------------------------------------------------- */
/* Scenario catalogue                                                          */
/* -------------------------------------------------------------------------- */

export interface V2Scenario {
  id: string;
  label: string;
  sub: string;
  capability: string;
}

export const V2_SCENARIOS: readonly V2Scenario[] = [
  {
    id: 'v2-office',
    label: 'Office mode SOP',
    sub: 'Ribbon, pages, fields',
    capability: 'Office shell, styles, multilevel numbering, Office-class tables, sections, print preview (roadmap C, D, E).',
  },
  {
    id: 'v2-block',
    label: 'Block mode',
    sub: 'One model, three projections',
    capability: 'The same document projected in Block, Office and Controlled modes on one editor (roadmap 0, C).',
  },
  {
    id: 'v2-controlled',
    label: 'Controlled document',
    sub: 'Template to release',
    capability: 'Vertical slice: template, four owned sections, reviews, approvals, release manifest, malicious-client test (roadmap F, G, Phase 4).',
  },
  {
    id: 'v2-review',
    label: 'Track changes & compare',
    sub: 'Revisions, comments, redline',
    capability: 'Durable revisions, Original/Final/Markup views, anchored comments with mentions, compare with released revision (roadmap I).',
  },
  {
    id: 'v2-docx',
    label: 'DOCX import & export',
    sub: 'Loss report, template mapping',
    capability: 'DOCX import with loss report and passthrough, SOP migration mapping, export and round-trip (roadmap H).',
  },
  {
    id: 'v2-clinical',
    label: 'Clinical blocks & forms',
    sub: 'Validation, LIMS, calculations',
    capability: 'Clinical semantic blocks, mock LIMS equipment checks, calculated forms, notes, captions, conditional content (roadmap 6).',
  },
  {
    id: 'v2-ai',
    label: 'AI proposals',
    sub: 'Tracked, policy-checked',
    capability: 'AI commands return tracked-change proposals, respect section policy, and are labelled as AI-generated (roadmap J).',
  },
];

/* -------------------------------------------------------------------------- */
/* Block helpers                                                               */
/* -------------------------------------------------------------------------- */

let seq = 0;
export function demoId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq.toString(36)}`;
}

type Styles = Record<string, unknown>;
const txt = (text: string, styles: Styles = {}) => ({ type: 'text' as const, text, styles });

/** Empty strings produce no text node (ProseMirror rejects empty text nodes). */
export function para(text: string, props: Record<string, unknown> = {}, styles: Styles = {}): Block {
  return { id: demoId('p'), type: 'paragraph', props: { styleId: 'Normal', ...props }, content: text ? [txt(text, styles)] : [] };
}

export function rich(parts: Array<[string, Styles?]>, props: Record<string, unknown> = {}): Block {
  return {
    id: demoId('p'),
    type: 'paragraph',
    props: { styleId: 'Normal', ...props },
    content: parts.filter(([text]) => text.length > 0).map(([text, styles]) => txt(text, styles ?? {})),
  };
}

export function heading(level: 1 | 2 | 3, text: string, numId: string | null = '3'): Block {
  return {
    id: demoId('h'),
    type: 'heading',
    props: {
      level,
      styleId: `Heading${level}`,
      numbering: numId ? { numId, level: level - 1 } : null,
    },
    content: [txt(text)],
  };
}

export function numbered(text: string, level = 0): Block {
  return para(text, { styleId: 'ListParagraph', numbering: { numId: '2', level } });
}

function cell(children: Block[], props: Record<string, unknown> = {}): Block {
  return { id: demoId('tc'), type: 'tableCell', props: { colspan: 1, rowspan: 1, vAlign: 'top', ...props }, children };
}

function row(cells: Block[], props: Record<string, unknown> = {}): Block {
  return { id: demoId('tr'), type: 'tableRow', props, children: cells };
}

const headerCell = (text: string, props: Record<string, unknown> = {}) =>
  cell([para(text, { styleId: 'Normal' }, { bold: true })], { shading: 'D9E2F3', ...props });

const BORDER = { style: 'single', sizePt: 0.5, color: '808080' };
const borders = { top: BORDER, right: BORDER, bottom: BORDER, left: BORDER };

/* -------------------------------------------------------------------------- */
/* Scenario 1 and 2: Office SOP                                                */
/* -------------------------------------------------------------------------- */

export const SOP_PROPERTIES = {
  title: 'Gram stain procedure',
  docNumber: 'SOP-0042',
  revision: '3',
  effectiveDate: '2026-11-01',
  owner: 'Quality Manager',
  lab: 'Microbiology',
  language: 'en-GB',
};

function docField(name: 'docNumber' | 'revision' | 'effectiveDate' | 'owner', fallback: string) {
  return { type: 'field', fieldType: 'DOCPROPERTY', name, format: null, fallback };
}

function pageField(fieldType: 'PAGE' | 'NUMPAGES', fallback: string) {
  return { type: 'field', fieldType, name: null, format: null, fallback };
}

/** Builds the SOP as a BeakDocument: two sections (portrait body, landscape appendix). */
export function buildOfficeSopDocument(): BeakDocument {
  const styles = createDefaultStyleSheet();
  const numbering = createDefaultNumbering();
  const portrait: PageSetup = {
    size: { widthTwips: 11906, heightTwips: 16838 },
    orientation: 'portrait',
    margins: { top: 1440, right: 1247, bottom: 1440, left: 1247, header: 709, footer: 709, gutter: 0 },
  };
  const landscape: PageSetup = {
    size: { widthTwips: 16838, heightTwips: 11906 },
    orientation: 'landscape',
    margins: { top: 1134, right: 1134, bottom: 1134, left: 1134, header: 567, footer: 567, gutter: 0 },
  };

  const headerBlocks: Block[] = [
    rich([['BeakLab Quality Manual', { bold: true }], ['  ·  Document ', {}]], { styleId: 'Header' }),
  ];
  headerBlocks[0]!.content!.push(docField('docNumber', 'SOP-0042') as never, txt(' · Rev ') as never, docField('revision', '3') as never);
  const footerBlocks: Block[] = [
    rich([['Effective ', {}]], { styleId: 'Footer', align: 'center' }),
  ];
  footerBlocks[0]!.content!.push(docField('effectiveDate', '2026-11-01') as never, txt('   ·   Page ') as never, pageField('PAGE', '1') as never, txt(' of ') as never, pageField('NUMPAGES', '2') as never);

  const bodyA: Block[] = [
    { id: demoId('title'), type: 'paragraph', props: { styleId: 'Title' }, content: [txt('Gram stain procedure')] },
    rich([['Document number ', {}], ['SOP-0042', { bold: true }], ['  ·  Revision 3  ·  Effective 1 November 2026', {}]], { styleId: 'Caption' }),
    heading(1, 'Purpose'),
    para('This procedure describes how Microbiology prepares, stains and reads Gram-stained smears from clinical specimens. It applies to all bench staff who perform smear microscopy.'),
    heading(1, 'Scope'),
    rich([
      ['Applies to specimens received for Gram staining in the ', {}],
      ['Microbiology bench', { italic: true }],
      [' area. Results are reported according to ', {}],
      ['clause 7.3', { bold: true }],
      [' of the laboratory quality manual.', {}],
    ]),
    heading(1, 'Procedure'),
    heading(2, 'Preparation'),
    numbered('Label the slide with the specimen identifier and the date, in pencil on the frosted end.'),
    numbered('Prepare a thin, even smear and allow it to air dry completely before heat fixing.'),
    numbered('Heat fix by passing the slide three times through the flame.'),
    heading(2, 'Staining'),
    {
      id: demoId('tbl'),
      type: 'table',
      props: { widthMode: 'pct', widthValue: 5000, styleId: 'TableGrid', look: { headerRow: true, bandedRows: false, firstColumn: false, lastRow: false } },
      children: [
        row(
          [
            cell([para('Reagent and step', {}, { bold: true })], { shading: 'D9E2F3', borders }),
            cell([para('Time', {}, { bold: true })], { shading: 'D9E2F3', borders }),
            cell([para('Notes', {}, { bold: true })], { shading: 'D9E2F3', borders }),
          ],
          { isHeader: true }
        ),
        row([
          cell([para('Crystal violet (primary stain)')], { borders }),
          cell([para('30 s')], { borders }),
          cell([para('Flood the smear, then rinse with water.')], { borders }),
        ]),
        row([
          cell([para('Gram iodine (mordant)')], { borders }),
          cell([para('60 s')], { borders }),
          cell([para('Rinse with water, drain.')], { borders }),
        ]),
        row([
          cell([para('Decolouriser, then safranin counterstain')], { borders, colspan: 2 }),
          cell([para('Decolourise until the smear runs clear; counterstain 30 s.')], { borders }),
        ]),
      ],
    },
    heading(2, 'Interpretation'),
    numbered('Gram-positive organisms retain the crystal violet and appear purple.'),
    numbered('Gram-negative organisms lose the stain and appear pink or red.'),
    { id: demoId('pb'), type: 'pageBreak', props: {} },
    heading(1, 'Responsibilities'),
    para('The Microbiology supervisor approves changes to this procedure. Bench staff record the reagent lot and the time of each step in the bench log.'),
    heading(1, 'Records'),
    para('Smear results are recorded in the LIMS. Retain bench logs for five years.'),
  ];

  const appendix: Block[] = [
    heading(1, 'Appendix A: Reagent and QC log', '3'),
    para('Record each reagent lot and each daily control result. Landscape layout keeps the log readable.'),
    {
      id: demoId('tbl'),
      type: 'table',
      props: { widthMode: 'pct', widthValue: 5000, styleId: 'TableGrid', look: { headerRow: true, bandedRows: true } },
      children: [
        row(
          ['Date', 'Reagent', 'Lot', 'Expiry', 'Control result', 'Initials'].map((t) => headerCell(t, { borders })),
          { isHeader: true, cantSplit: true }
        ),
        row(['2026-10-20', 'Crystal violet', 'CV-2291', '2027-03-31', 'Pass', 'AM'].map((t) => cell([para(t)], { borders }))),
        row(['2026-10-20', 'Gram iodine', 'GI-1184', '2027-01-15', 'Pass', 'AM'].map((t) => cell([para(t)], { borders }))),
        row(['2026-10-21', 'Safranin', 'SF-0937', '2026-12-30', 'Fail, repeated', 'BN'].map((t) => cell([para(t)], { borders }))),
      ],
    },
  ];

  const sections: DocumentSection[] = [
    {
      id: 'sec-body',
      pageSetup: portrait,
      headers: { default: headerBlocks },
      footers: { default: footerBlocks },
      blocks: bodyA,
    },
    {
      id: 'sec-appendix',
      pageSetup: landscape,
      headers: { default: headerBlocks },
      footers: { default: footerBlocks },
      blocks: appendix,
    },
  ];

  return {
    schemaVersion: 2,
    id: 'sop-0042',
    properties: SOP_PROPERTIES,
    styles,
    numbering,
    sections,
  };
}

/** The SOP as editor blocks (section breaks are inserted between sections). */
export function officeSopBlocks(): Block[] {
  return documentToBlocks(buildOfficeSopDocument());
}

/* -------------------------------------------------------------------------- */
/* Scenario 4: track changes baseline                                          */
/* -------------------------------------------------------------------------- */

export function reviewBaselineBlocks(): Block[] {
  return [
    { id: 'rv-title', type: 'heading', props: { level: 1 }, content: [txt('Calibration of the incubator')] },
    { id: 'rv-p1', type: 'paragraph', props: {}, content: [txt('Verify the incubator at 37 °C every working day using the calibrated probe.')] },
    { id: 'rv-p2', type: 'paragraph', props: {}, content: [txt('Record the reading in the calibration log. Escalate deviations above 0.5 °C to the supervisor.')] },
    { id: 'rv-p3', type: 'paragraph', props: {}, content: [txt('Calibration certificates are kept for the life of the equipment.')] },
  ];
}

/* -------------------------------------------------------------------------- */
/* Scenario 6: clinical blocks and forms                                       */
/* -------------------------------------------------------------------------- */

export const CLINICAL_VARIABLES = { biohazard: true, laboratory: 'Microbiology', siteCode: 'MB-02' };

/** Mock LIMS: one active and one inactive instrument so the equipment check has something to report. */
export const MOCK_LIMS_RECORDS = [
  { id: 'LIMS-MIC-001', code: 'MIC-001', name: 'Light microscope (oil immersion)', status: 'active' },
  { id: 'LIMS-CEN-004', code: 'CEN-004', name: 'Benchtop centrifuge', status: 'inactive' },
  { id: 'LIMS-INC-002', code: 'INC-002', name: 'Incubator 37 °C', status: 'active' },
];

export function createMockLimsProvider(delayMs = 180) {
  const wait = () => new Promise((resolve) => setTimeout(resolve, delayMs));
  return {
    async search(query: string) {
      await wait();
      const q = query.trim().toLowerCase();
      return MOCK_LIMS_RECORDS.filter((r) => !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
    },
    async get(id: string) {
      await wait();
      return MOCK_LIMS_RECORDS.find((r) => r.id === id) ?? null;
    },
  };
}

function reagentTable(columns: readonly string[]): Block {
  const header = row(columns.map((c) => headerCell(c, { borders })), { isHeader: true });
  const sample = [
    ['Crystal violet', '2 %', 'mg/mL', 'LOT-CV-22', '2027-03-31'],
    ['Gram iodine', '1 %', 'mg/mL', 'LOT-GI-18', '2027-06-30'],
  ];
  const body = sample.map((values) =>
    row(columns.map((_, i) => cell([para(values[i] ?? '—')], { borders })))
  );
  return {
    id: demoId('reagent'),
    type: 'reagentTable',
    props: { requiredColumns: [...columns] },
    children: [{ id: demoId('tbl'), type: 'table', props: {}, children: [header, ...body] }],
  };
}

export function clinicalDemoBlocks(reagentColumns: readonly string[]): Block[] {
  const eqActive = { type: 'equipmentReference', props: { equipmentId: 'LIMS-MIC-001', code: 'MIC-001', name: 'Light microscope', status: 'active' } };
  const eqInactive = { type: 'equipmentReference', props: { equipmentId: 'LIMS-CEN-004', code: 'CEN-004', name: 'Benchtop centrifuge', status: 'active' } };
  return [
    { id: 'cl-title', type: 'heading', props: { level: 1 }, content: [txt('Clinical SOP: Gram stain')] },
    {
      id: 'cl-method',
      type: 'testMethodSpec',
      props: { methodCode: 'MTH-GS-01', version: '3', analyte: 'Bacterial morphology', principle: 'Differential staining by cell-wall structure' },
      children: [para('Method summary: differential stain on heat-fixed smears, read under oil immersion.')],
    },
    {
      id: 'cl-warning',
      type: 'safetyWarning',
      props: { level: 'danger', hazardCodes: ['H314', 'H318'], ppe: ['gloves', 'eye protection', 'lab coat'] },
      children: [para('Crystal violet and iodine are corrosive. Wear gloves and eye protection at the staining bench.')],
    },
    {
      id: 'cl-specimen',
      type: 'specimenRequirements',
      props: {
        specimenType: 'Sputum or pus swab',
        container: 'Sterile screw-cap tube',
        volumeMl: 2,
        minVolumeMl: 0.5,
        stability: '4 h at room temperature, 24 h at 2–8 °C',
        rejectionCriteria: 'Saliva-contaminated sputum, unlabelled container',
      },
    },
    { id: 'cap-reagent', type: 'caption', props: { label: 'Table' }, content: [txt('Reagents used at the staining bench')] },
    reagentTable(reagentColumns),
    {
      id: 'cl-steps-h',
      type: 'heading',
      props: { level: 2 },
      content: [txt('Steps')],
    },
    {
      id: 'cl-step-1',
      type: 'sopStep',
      props: { stepNumber: null, critical: false, timeMinutes: 1 },
      children: [
        {
          id: 'cl-step-1-p',
          type: 'paragraph',
          props: {},
          content: [
            txt('Confirm the instrument before use. '),
            eqActive,
            txt(' is the reference microscope for this method. See '),
            { type: 'crossReference', props: { targetId: 'cap-reagent', display: 'label' } },
            txt('.'),
          ],
        },
      ],
    },
    {
      id: 'cl-step-2',
      type: 'sopStep',
      props: { stepNumber: null, critical: true, timeMinutes: 2 },
      children: [{ id: 'cl-step-2-p', type: 'paragraph', props: {}, content: [txt('Flood with crystal violet for 30 seconds, then rinse.')] }],
    },
    {
      id: 'cl-step-3',
      type: 'sopStep',
      props: { stepNumber: null, critical: false, timeMinutes: 1 },
      children: [
        {
          id: 'cl-step-3-p',
          type: 'paragraph',
          props: {},
          content: [txt('Spin the specimen in '), eqInactive, txt(' before smearing. Stop if the centrifuge is out of service.')],
        },
      ],
    },
    {
      id: 'cl-cond',
      type: 'conditional',
      props: { expression: 'biohazard' },
      children: [para('Biohazard: all smears from this specimen are handled in a Class II cabinet.')],
    },
    {
      id: 'cl-qc',
      type: 'qcCriteria',
      props: { analyte: 'Gram control (E. coli)', level: 'L2', target: 1.5, sd: 0.2, westgardRules: ['1_2s', '1_3s', 'R_4s'] },
    },
    {
      id: 'form-section',
      type: 'validatedFormSection',
      props: { name: 'run-record', title: 'Run record' },
      children: [
        { id: 'f-operator', type: 'formText', props: { name: 'operator', label: 'Operator', required: true, value: '' } },
        { id: 'f-temp', type: 'formNumber', props: { name: 'temp', label: 'Incubator temperature', unit: '°C', min: 20, max: 40, decimals: 1, value: '37.0', allowedUnits: ['°C'] } },
        { id: 'f-sample', type: 'formNumber', props: { name: 'sample', label: 'Sample volume', unit: 'mL', min: 0, max: 10, decimals: 1, value: '2' } },
        { id: 'f-dilution', type: 'formCalculated', props: { name: 'dilution', label: 'Dilution factor', expression: 'sample * 5', decimals: 2, value: '' } },
        { id: 'f-date', type: 'formDate', props: { name: 'prepDate', label: 'Preparation date', value: '2026-10-22' } },
        { id: 'f-stain', type: 'formDropdown', props: { name: 'stainLot', label: 'Stain lot', options: ['LOT-CV-22', 'LOT-CV-23'], value: '' } },
      ],
    },
    {
      id: 'cl-footnote-p',
      type: 'paragraph',
      props: {},
      content: [
        txt('Results are reported using the laboratory reporting scale'),
        { type: 'footnote', props: { text: 'Reporting scale as defined in ISO 15189:2022, clause 7.3.' } },
        txt(' for the laboratory '),
        { type: 'variable', props: { name: 'laboratory' } },
        txt(' (site '),
        { type: 'variable', props: { name: 'siteCode' } },
        txt(').'),
      ],
    },
    { id: 'cl-eq', type: 'equation', props: { latex: 'D = V_{total} / V_{sample}' } },
  ];
}

/** Forms-only sample (used when the clinical extension is not needed). */
export function formsDemoBlocks(): Block[] {
  return clinicalDemoBlocks([]).filter((b) => b.type === 'validatedFormSection');
}
