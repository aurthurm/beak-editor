/**
 * Shared demo content for the BeakBlock 2.0 scenarios.
 *
 * Blocks are written as plain JSON in the core `Block` shape and cast at the boundary. The factories
 * keep the sample documents readable. Ids are explicit so that samples are stable across reloads.
 */

import type { Block } from '@amusendame/beakblock-core';
import { createDefaultNumbering, createDefaultStyleSheet, createPageSetup, blocksToDocument } from '@amusendame/beakblock-schema';
import type { BeakDocument, DocumentSection } from '@amusendame/beakblock-schema';
import { defaultFooterBlocks, defaultHeaderBlocks } from '@amusendame/beakblock-templates';
import type { RevisionRecord } from '@amusendame/beakblock-review';
import type { EquipmentProvider, EquipmentRecord } from '@amusendame/beakblock-blocks-clinical';

type Props = Record<string, unknown>;

const b = (value: Record<string, unknown>): Block => value as unknown as Block;
export const plain = (text: string) => ({ type: 'text', text, styles: {} });
export const styled = (text: string, styles: Record<string, unknown>) => ({ type: 'text', text, styles });
export const field = (fieldType: string, name: string | null, fallback?: string, format?: string) => ({
  type: 'field',
  fieldType,
  name,
  ...(fallback !== undefined ? { fallback } : {}),
  ...(format !== undefined ? { format } : {}),
});

export const P = (id: string, content: unknown[] | string, props: Props = {}): Block =>
  b({ id, type: 'paragraph', props: { textAlign: 'left', ...props }, content: typeof content === 'string' ? [plain(content)] : content });

export const H = (id: string, level: 1 | 2 | 3, text: string, numbering: { numId: string; level: number } | null = null): Block =>
  b({
    id,
    type: 'heading',
    props: { level, textAlign: 'left', styleId: `Heading${level}`, numbering, locked: false, lockReason: null, lockId: null },
    content: [plain(text)],
  });

const borderEdge = { style: 'single', sizePt: 0.75, color: '#8EA9DB' };
const cellBorders = { top: borderEdge, right: borderEdge, bottom: borderEdge, left: borderEdge };

export const TC = (id: string, text: string, props: Props = {}, header = false): Block =>
  b({
    id,
    type: header ? 'tableHeader' : 'tableCell',
    props: { colspan: 1, rowspan: 1, colwidth: [120], backgroundColor: header ? '#D9E2F3' : null, borders: cellBorders, vAlign: 'top', ...props },
    children: [P(`${id}-p`, text, { styleId: 'TableText' })],
  });

export const TCFields = (id: string, content: unknown[], props: Props = {}): Block =>
  b({
    id,
    type: 'tableCell',
    props: { colspan: 1, rowspan: 1, colwidth: [120], backgroundColor: null, borders: cellBorders, vAlign: 'top', ...props },
    children: [P(`${id}-p`, content, { styleId: 'TableText' })],
  });

export const TR = (id: string, cells: Block[], props: Props = {}): Block => b({ id, type: 'tableRow', props: { cantSplit: true, ...props }, children: cells });

export const TABLE = (id: string, rows: Block[], props: Props = {}): Block =>
  b({
    id,
    type: 'table',
    props: { widthMode: 'pct', widthValue: 5000, styleId: 'TableGrid', look: { headerRow: true, bandedRows: false, firstColumn: false, lastRow: false }, ...props },
    children: rows,
  });

/** Office SOP: styles, multilevel heading numbering, fields, merged table, page break and landscape appendix. */
export function officeSopBlocks(): Block[] {
  return [
    P('sop-title', 'Gram Stain Procedure', { styleId: 'Title' }),
    P('sop-sub', 'Standard operating procedure · Microbiology bench', { styleId: 'Subtitle' }),
    P('sop-props', [plain('Document number:'), { type: 'hardBreak' }, field('DOCPROPERTY', 'docNumber', 'SOP-0042')], {
      styleId: 'Normal',
      tabs: [{ posPt: 144, kind: 'left' }],
      spacing: { beforePt: 0, afterPt: 6, line: 276, lineRule: 'auto' },
    }),
    P('sop-caption-1', 'Table 1 – Document control', { styleId: 'Caption' }),
    TABLE('sop-control', [
      TR('sop-control-h', [TC('sc-h1', 'Field', {}, true), TC('sc-h2', 'Value', {}, true)], { isHeader: true }),
      TR('sop-control-1', [TC('sc-1a', 'Revision'), TCFields('sc-1b', [field('DOCPROPERTY', 'revision', '3')])]),
      TR('sop-control-2', [TC('sc-2a', 'Effective date'), TCFields('sc-2b', [field('DOCPROPERTY', 'effectiveDate', '1 November 2026')])]),
      TR('sop-control-3', [TC('sc-3a', 'Owner'), TC('sc-3b', 'Quality Assurance')]),
    ]),
    H('sop-h-purpose', 1, 'Purpose', { numId: '3', level: 0 }),
    P('sop-purpose', 'This procedure describes the Gram stain used to classify bacteria by cell wall structure from fixed smears.'),
    H('sop-h-scope', 1, 'Scope', { numId: '3', level: 0 }),
    P('sop-scope', 'Applies to all microbiology bench staff who prepare and read smears for culture review.'),
    H('sop-h-resp', 1, 'Responsibilities', { numId: '3', level: 0 }),
    b({
      id: 'sop-resp-list',
      type: 'bulletList',
      props: {},
      children: [
        b({ id: 'sop-resp-1', type: 'listItem', props: {}, content: [plain('Bench analyst: prepares, stains and reads the smear.')] }),
        b({ id: 'sop-resp-2', type: 'listItem', props: {}, content: [plain('Section supervisor: reviews the stain log each shift.')] }),
      ],
    }),
    H('sop-h-proc', 1, 'Procedure', { numId: '3', level: 0 }),
    H('sop-h-prep', 2, 'Preparation', { numId: '3', level: 1 }),
    b({
      id: 'sop-steps',
      type: 'orderedList',
      props: { start: 1 },
      children: [
        b({ id: 'sop-step-1', type: 'listItem', props: {}, content: [plain('Label the slide with the sample ID and date.')] }),
        b({ id: 'sop-step-2', type: 'listItem', props: {}, content: [plain('Heat-fix the smear, or fix it in methanol for 3 minutes.')] }),
        b({ id: 'sop-step-3', type: 'listItem', props: {}, content: [plain('Confirm the smear is dry before staining.')] }),
      ],
    }),
    H('sop-h-stain', 2, 'Staining sequence', { numId: '3', level: 1 }),
    P('sop-caption-2', 'Table 2 – Staining reagents and timing', { styleId: 'Caption' }),
    TABLE('sop-stain-table', [
      TR('sop-st-h', [TC('st-h1', 'Step', {}, true), TC('st-h2', 'Reagent', {}, true), TC('st-h3', 'Time', {}, true), TC('st-h4', 'Notes', {}, true)], { isHeader: true }),
      TR('sop-st-1', [TC('st-1a', 'Primary stain', { rowspan: 2, backgroundColor: '#F2F2F2' }), TC('st-1b', 'Crystal violet'), TC('st-1c', '1 minute'), TC('st-1d', 'Flood the smear, then rinse gently')]),
      TR('sop-st-2', [TC('st-2b', 'Iodine (mordant)'), TC('st-2c', '1 minute'), TC('st-2d', 'Do not blot')]),
      TR('sop-st-3', [TC('st-3a', 'Decolourise'), TC('st-3b', 'Acetone-alcohol'), TC('st-3c', '5 seconds'), TC('st-3d', 'Stop as soon as the run-off is clear')]),
      TR('sop-st-4', [TC('st-4a', 'Counterstain'), TC('st-4b', 'Safranin'), TC('st-4c', '30 seconds'), TC('st-4d', 'Rinse and air dry')]),
    ]),
    P('sop-after-table', 'Record any deviation from these times in the stain log.'),
    b({
      id: 'sop-callout',
      type: 'callout',
      props: { calloutType: 'warning' },
      content: [plain('Safety: wear gloves and eye protection. Dispose of stained slides in the sharps container.')],
    }),
    H('sop-h-read', 2, 'Reading', { numId: '3', level: 1 }),
    P('sop-read', 'Read under oil immersion. Gram-positive cells appear purple; Gram-negative cells appear pink.'),
    b({ id: 'sop-pb', type: 'pageBreak', props: {} }),
    H('sop-h-records', 1, 'Records', { numId: '3', level: 0 }),
    P('sop-records', [plain('Stain logs are kept for 5 years. Page '), field('PAGE', null), plain(' of '), field('NUMPAGES', null, '1'), plain('.')]),
    b({ id: 'sop-sb', type: 'sectionBreak', props: { pageSetup: createPageSetup({ size: 'A4', orientation: 'landscape' }) } }),
    H('sop-h-appendix', 1, 'Appendix A: Reagent matrix'),
    P('sop-appendix-lede', 'Reagent matrix for the bench, with suppliers and storage. Landscape layout.'),
    TABLE('sop-matrix', [
      TR('sop-mx-h', ['Reagent', 'Supplier', 'Storage', 'Hazard class', 'Shelf life', 'Lot tracked'].map((t, i) => TC(`mx-h${i}`, t, {}, true)), { isHeader: true }),
      TR('sop-mx-1', ['Crystal violet', 'Lab supplier A', '15-25 °C', 'Harmful', '24 months', 'Yes'].map((t, i) => TC(`mx-1${i}`, t))),
      TR('sop-mx-2', ['Iodine solution', 'Lab supplier A', '15-25 °C', 'Harmful', '12 months', 'Yes'].map((t, i) => TC(`mx-2${i}`, t))),
      TR('sop-mx-3', ['Acetone-alcohol', 'Lab supplier B', 'Flammable cabinet', 'Flammable', '12 months', 'Yes'].map((t, i) => TC(`mx-3${i}`, t))),
      TR('sop-mx-4', ['Safranin', 'Lab supplier B', '15-25 °C', 'Irritant', '24 months', 'No'].map((t, i) => TC(`mx-4${i}`, t))),
    ]),
    P('sop-appendix-end', 'Appendix ends. Return to the main procedure for release.'),
  ];
}

/** The Office SOP as a schema v2 document, with the standard header and footer on every section. */
export function buildOfficeSopDocument(blocks: Block[] = officeSopBlocks()): BeakDocument {
  const doc = blocksToDocument(blocks, {
    properties: { title: 'Gram stain procedure', docNumber: 'SOP-0042', revision: '3', effectiveDate: '2026-11-01', owner: 'Quality Assurance' },
    styles: createDefaultStyleSheet(),
    numbering: createDefaultNumbering(),
  });
  const header = defaultHeaderBlocks({ docNumber: 'SOP-0042', revision: '3', title: 'Gram stain procedure' });
  const footer = defaultFooterBlocks();
  const sections = doc.sections.map((section): DocumentSection => ({
    ...section,
    headers: { default: header },
    footers: { default: footer },
  }));
  return { ...doc, sections };
}

/** Flat blocks of the Office SOP, ready for the editor. */
export function officeSopEditorBlocks(): Block[] {
  return officeSopBlocks();
}

/* ------------------------------------------------------------------------------------------------ */
/* Track changes and comparison                                                                    */
/* ------------------------------------------------------------------------------------------------ */

export const TRACK_AUTHORS = [
  { id: 'ann', name: 'Ann Author' },
  { id: 'ben', name: 'Ben Author' },
  { id: 'rita', name: 'Rita Reviewer' },
] as const;

/** The released revision (v1) that the working copy is compared against. */
export function releasedRevisionBlocks(): Block[] {
  return [
    H('rv-h1', 1, 'Purpose'),
    P('rv-p1', 'This procedure describes the Gram stain for smears.'),
    H('rv-h2', 1, 'Scope'),
    P('rv-p2', 'Applies to bench analysts who read smears.'),
    b({
      id: 'rv-steps',
      type: 'orderedList',
      props: { start: 1 },
      children: [
        b({ id: 'rv-s1', type: 'listItem', props: {}, content: [plain('Fix the smear in methanol for 3 minutes.')] }),
        b({ id: 'rv-s2', type: 'listItem', props: {}, content: [plain('Stain with crystal violet for 1 minute.')] }),
        b({ id: 'rv-s3', type: 'listItem', props: {}, content: [plain('Rinse and air dry.')] }),
      ],
    }),
  ];
}

/**
 * The working copy with pending tracked changes: an insertion by Ben, a deletion by Ann, and an AI
 * insertion. Each revision mark has a matching record in the revision store (`trackRevisionRecords`).
 */
export function workingCopyBlocks(): Block[] {
  const at = '2026-10-20T09:00:00.000Z';
  const ins = (revisionId: string, authorId: string, authorName: string, aiGenerated = false) => ({
    kind: 'insert',
    revisionId,
    authorId,
    authorName,
    at,
    aiGenerated,
  });
  const del = (revisionId: string, authorId: string, authorName: string) => ({ kind: 'delete', revisionId, authorId, authorName, at });
  return [
    H('wc-h1', 1, 'Purpose'),
    P('wc-p1', [
      plain('This procedure describes the Gram stain for smears '),
      { type: 'text', text: 'from fixed specimens ', styles: { revision: ins('rev-ins-1', 'ben', 'Ben Author') } },
      plain('.'),
    ]),
    H('wc-h2', 1, 'Scope'),
    P('wc-p2', [
      plain('Applies to bench analysts '),
      { type: 'text', text: 'and section supervisors ', styles: { revision: ins('rev-ins-2', 'ann', 'Ann Author', true) } },
      { type: 'text', text: 'who read smears.', styles: { revision: del('rev-del-1', 'ann', 'Ann Author') } },
      { type: 'text', text: 'who read smears for culture review.', styles: {} },
    ]),
    b({
      id: 'wc-steps',
      type: 'orderedList',
      props: { start: 1 },
      children: [
        b({ id: 'wc-s1', type: 'listItem', props: {}, content: [plain('Fix the smear in methanol for 3 minutes.')] }),
        b({ id: 'wc-s2', type: 'listItem', props: {}, content: [plain('Stain with crystal violet for 1 minute.')] }),
        b({ id: 'wc-s3', type: 'listItem', props: {}, content: [plain('Wear nitrile gloves throughout.')] }),
        b({ id: 'wc-s4', type: 'listItem', props: {}, content: [plain('Rinse and air dry.')] }),
      ],
    }),
  ];
}

export function trackRevisionRecords(): RevisionRecord[] {
  const at = '2026-10-20T09:00:00.000Z';
  return [
    { id: 'rev-ins-1', kind: 'insert', authorId: 'ben', authorName: 'Ben Author', at, status: 'pending', blockId: 'wc-p1', text: 'from fixed specimens ' },
    { id: 'rev-ins-2', kind: 'insert', authorId: 'ann', authorName: 'Ann Author', at, status: 'pending', aiGenerated: true, blockId: 'wc-p2', text: 'and section supervisors ' },
    { id: 'rev-del-1', kind: 'delete', authorId: 'ann', authorName: 'Ann Author', at, status: 'pending', blockId: 'wc-p2', text: 'who read smears.' },
  ];
}

/* ------------------------------------------------------------------------------------------------ */
/* Clinical blocks and forms                                                                       */
/* ------------------------------------------------------------------------------------------------ */

export const CLINICAL_VARIABLES = { procedureType: 'hazardous' as string };

export function clinicalBlocks(): Block[] {
  return [
    H('cl-h1', 1, 'Gram stain procedure (clinical)'),
    b({
      id: 'cl-warning',
      type: 'conditional',
      props: { id: 'cl-cond', expression: 'procedureType == "hazardous"' },
      children: [
        b({
          id: 'cl-safety',
          type: 'safetyWarning',
          props: { level: 'danger', hazardCodes: ['H314', 'H225'], ppe: 'Nitrile gloves, face shield, lab coat' },
          children: [P('cl-safety-p', 'Acetone-alcohol is highly flammable and corrosive. Keep away from ignition sources.')],
        }),
      ],
    }),
    P('cl-intro', [plain('Equipment for this step: '), { type: 'equipmentReference', props: { equipmentId: 'EQ-101' } }, plain(' and '), { type: 'equipmentReference', props: { equipmentId: 'EQ-088' } }, plain('.')]),
    b({
      id: 'cl-step-1',
      type: 'sopStep',
      props: { critical: true, timeMinutes: 3 },
      children: [P('cl-step-1-p', 'Fix the smear in methanol for three minutes.')],
    }),
    b({
      id: 'cl-step-2',
      type: 'sopStep',
      props: { critical: false, timeMinutes: 1 },
      children: [P('cl-step-2-p', 'Flood the smear with crystal violet and wait one minute.')],
    }),
    b({
      id: 'cl-step-3',
      type: 'sopStep',
      props: { critical: false, timeMinutes: 0.5 },
      children: [P('cl-step-3-p', 'Rinse with water and blot dry gently.')],
    }),
    b({
      id: 'cl-reagents',
      type: 'reagentTable',
      props: { requiredColumns: ['Reagent', 'Concentration', 'Unit', 'Expiry'] },
      children: [
        TABLE('cl-reagent-table', [
          TR('cl-rt-h', ['Reagent', 'Concentration', 'Unit', 'Expiry'].map((t, i) => TC(`cl-rt-h${i}`, t, {}, true)), { isHeader: true }),
          TR('cl-rt-1', [TC('cl-rt-1a', 'Crystal violet'), TC('cl-rt-1b', '2'), TC('cl-rt-1c', 'mg/mL'), TC('cl-rt-1d', '2027-03-31')]),
          TR('cl-rt-2', [TC('cl-rt-2a', 'Iodine'), TC('cl-rt-2b', '1'), TC('cl-rt-2c', 'mmol/L'), TC('cl-rt-2d', '2026-12-31')]),
        ]),
      ],
    }),
    b({
      id: 'cl-method',
      type: 'testMethodSpec',
      props: { methodCode: 'MM-GS-01', version: '3', analyte: 'Bacterial morphology', principle: 'Differential staining' },
    }),
    b({
      id: 'cl-specimen',
      type: 'specimenRequirements',
      props: { specimenType: 'Sputum', container: 'Sterile tube', volumeMl: 2, minVolumeMl: 0.5, stability: '24 h at 4 °C', rejectionCriteria: 'Saliva-dominant sample' },
    }),
    b({
      id: 'cl-qc',
      type: 'qcCriteria',
      props: { analyte: 'Crystal violet optical density', level: 'Level 1', target: 1.2, sd: 0.05, westgardRules: ['1_2s', '1_3s'] },
    }),
    H('cl-h-forms', 2, 'Batch record'),
    b({ id: 'cl-f-operator', type: 'formText', props: { name: 'operator', label: 'Operator', required: true, value: '', placeholder: 'Full name' } }),
    b({
      id: 'cl-f-dose',
      type: 'formNumber',
      props: { name: 'dose', label: 'Crystal violet volume', value: 5, unit: 'mL', allowedUnits: ['mL', 'µL'], min: 0, max: 20, decimals: 1 },
    }),
    b({ id: 'cl-f-date', type: 'formDate', props: { name: 'prepDate', label: 'Preparation date', value: '2026-10-21', min: '2026-01-01', max: '2027-12-31' } }),
    b({
      id: 'cl-f-stain',
      type: 'formDropdown',
      props: { name: 'stain', label: 'Stain set', options: ['Gram', 'Ziehl-Neelsen', 'Giemsa'], value: 'Gram' },
    }),
    b({ id: 'cl-f-calc', type: 'formCalculated', props: { name: 'totalMl', label: 'Total volume (mL)', expression: 'dose * 2', decimals: 2 } }),
    H('cl-h-refs', 2, 'Notes and references'),
    P('cl-note', [
      plain('Gram-positive cells retain crystal violet.'),
      { type: 'footnote', props: { id: 'fn-1', text: 'Adapted from the reference method, edition 3.' } },
      plain(' See '),
      { type: 'crossReference', props: { targetId: 'cl-cap-1', display: 'text' } },
      plain(' for the reagent set.'),
    ]),
    b({ id: 'cl-cap-1', type: 'caption', props: { label: 'Table' }, content: [plain('Reagents and expiry dates')] }),
    b({ id: 'cl-eq', type: 'equation', props: { latex: 'C_{\\text{working}} = \\frac{C_{\\text{stock}} \\cdot V_{\\text{stock}}}{V_{\\text{total}}}' } }),
  ];
}

/** A small LIMS-like provider. One item is retired, so it shows a warning on validation. */
export const LIMS_EQUIPMENT: EquipmentRecord[] = [
  { id: 'EQ-101', code: 'MIC-01', name: 'Light microscope', status: 'active' },
  { id: 'EQ-102', code: 'CEN-02', name: 'Centrifuge 5810', status: 'active' },
  { id: 'EQ-088', code: 'INC-07', name: 'Incubator (retired)', status: 'inactive' },
];

export function mockLimsProvider(delayMs = 120): EquipmentProvider {
  const wait = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), delayMs));
  return {
    search: (query: string) =>
      wait(LIMS_EQUIPMENT.filter((e) => `${e.code} ${e.name}`.toLowerCase().includes(query.toLowerCase()))),
    get: (id: string) => wait(LIMS_EQUIPMENT.find((e) => e.id === id) ?? null),
  };
}

/* ------------------------------------------------------------------------------------------------ */
/* AI canned replies (used when no provider key is configured)                                     */
/* ------------------------------------------------------------------------------------------------ */

export const MOCK_AI_REPLIES = {
  'ai.rewriteSelection': { text: 'Applies to all microbiology bench staff who prepare and read smears.' },
  // The command's response format is JSON: `{ steps: string[] }` (see packages/ai parseSteps).
  'ai.proposeProcedureSteps': {
    json: { steps: ['Dry the smear fully before fixing.', 'Record the stain lot number in the log.'] },
  },
  'ai.reviewDocumentConsistency': {
    json: {
      findings: [
        { severity: 'warning', message: 'Scope and Procedure use different names for the stain set.', origin: 'model' },
        { severity: 'info', message: 'Procedure step 3 has no time limit.', origin: 'model' },
      ],
    },
  },
} as const;
