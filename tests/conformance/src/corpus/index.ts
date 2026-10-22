/**
 * Synthetic conformance corpus: 20 realistic but invented documents in Block JSON (v1 format).
 *
 * Roadmap section 5K calls for 50 to 100 anonymised real SOPs. Real documents are not available to
 * this repository, so this corpus stands in for them. Every entry is `synthetic: true`. Replace or
 * extend it with anonymised real documents when they can be obtained.
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';

import { formWorksheet, officeExtensionsDoc } from './formsAndOffice';
import { bloodCultureSop, centrifugeMaintenanceSop, gramStainSop, pcrSetupSop, specimenRejectionSop } from './labSops';
import { deepNesting, emptyBlocks, longParagraph, unicodeEdgeCases, unknownBlockTypes } from './pathological';
import { mixedPermissionSop, qmsReleaseSop, qualityManualExcerpt, validationProtocol } from './controlledDocs';
import { complexTables, longSop, multilingualDoc, reviewedDraft } from './structural';

export { longSop } from './structural';

export type CorpusCategory =
  | 'lab-sop'
  | 'validation'
  | 'manual'
  | 'controlled'
  | 'form'
  | 'office'
  | 'large'
  | 'multilingual'
  | 'tables'
  | 'review'
  | 'pathological';

export interface CorpusMeta {
  category: CorpusCategory;
  description: string;
  /** Approximate printed page count, for reasoning about the performance budgets. */
  approxPages: number;
  /** Extension families the document uses. Editor tests load these extensions. */
  extensions: ('office' | 'clinical' | 'forms' | 'qms' | 'review')[];
  synthetic: true;
}

export interface CorpusEntry {
  id: string;
  title: string;
  blocks: Block[];
  meta: CorpusMeta;
}

const meta = (category: CorpusCategory, description: string, approxPages: number, extensions: CorpusMeta['extensions'] = []): CorpusMeta => ({
  category,
  description,
  approxPages,
  extensions,
  synthetic: true,
});

/** The 20 corpus documents. Built once at import time; each call to `corpus` shares the same objects. */
export const corpus: CorpusEntry[] = [
  { id: 'lab-gram-stain', title: 'SOP-LAB-0012 Gram stain', blocks: gramStainSop(), meta: meta('lab-sop', 'Gram stain with clinical blocks, numbering and fields', 3, ['clinical', 'office']) },
  { id: 'lab-blood-culture', title: 'SOP-LAB-0031 Blood culture', blocks: bloodCultureSop(), meta: meta('lab-sop', 'Blood culture collection with reagent table and checklist', 3, ['clinical']) },
  { id: 'lab-pcr-setup', title: 'SOP-LAB-0044 PCR master mix', blocks: pcrSetupSop(), meta: meta('lab-sop', 'PCR master-mix setup with QC criteria and a cycling profile', 2, ['clinical']) },
  { id: 'lab-centrifuge', title: 'SOP-LAB-0058 Centrifuge maintenance', blocks: centrifugeMaintenanceSop(), meta: meta('lab-sop', 'Preventive maintenance with checklist and log format', 2, ['clinical']) },
  { id: 'lab-specimen-rejection', title: 'SOP-LAB-0066 Specimen rejection', blocks: specimenRejectionSop(), meta: meta('lab-sop', 'Rejection criteria as a table with row spans and nested lists', 2) },
  { id: 'validation-protocol', title: 'VAL-2026-07 Analyser validation', blocks: validationProtocol(), meta: meta('validation', 'IQ/OQ/PQ protocol with captions, equations, SEQ/REF fields and approvals', 4, ['office', 'qms', 'clinical']) },
  { id: 'quality-manual-excerpt', title: 'QM-001 Quality manual excerpt', blocks: qualityManualExcerpt(), meta: meta('manual', 'Manual excerpt with TOC, numbering, landscape appendix and revision history', 5, ['qms', 'office']) },
  { id: 'mixed-permission-sop', title: 'SOP-MIX-001 Mixed permissions', blocks: mixedPermissionSop(), meta: meta('controlled', 'Approved, draft, reopened and optional controlled sections with uncontrolled text', 3, ['qms']) },
  { id: 'qms-release', title: 'SOP-QA-0101 Released copy', blocks: qmsReleaseSop(), meta: meta('controlled', 'Released page with identifier, notice, approvals, signatures and acknowledgement', 2, ['qms']) },
  { id: 'form-equipment-worksheet', title: 'Equipment qualification worksheet', blocks: formWorksheet(), meta: meta('form', 'Fillable worksheet with checklists, repeating rows, conditionals and reusable content', 3, ['forms', 'office']) },
  { id: 'office-extensions', title: 'Office extensions showcase', blocks: officeExtensionsDoc(), meta: meta('office', 'Equations, captions, text box, shape, footnote, cross reference and variables', 3, ['office']) },
  { id: 'long-sop-50', title: 'Long-form SOP (50 pages)', blocks: longSop(50, 'long50'), meta: meta('large', 'Generated 50-page SOP with headings, lists, fields, tables and section breaks', 50) },
  { id: 'multilingual', title: 'Multilingual procedure (FR, AR, ZH)', blocks: multilingualDoc(), meta: meta('multilingual', 'French with accents, Arabic right-to-left runs, Chinese and mixed scripts', 2) },
  { id: 'complex-tables', title: 'Complex tables', blocks: complexTables(), meta: meta('tables', 'Row and column spans, two header rows, nested lists and tables in cells, empty cells', 3, ['office']) },
  { id: 'reviewed-draft', title: 'Reviewed draft with tracked changes', blocks: reviewedDraft(), meta: meta('review', 'Insertions and deletions from three authors, one AI proposal', 1, ['review']) },
  { id: 'pathological-empty-blocks', title: 'Pathological: empty blocks', blocks: emptyBlocks(), meta: meta('pathological', 'Empty content arrays, empty headings, list items and table cells', 1, ['clinical', 'qms']) },
  { id: 'pathological-deep-nesting', title: 'Pathological: deep nesting', blocks: deepNesting(12), meta: meta('pathological', 'Bullet lists nested twelve levels deep', 1) },
  { id: 'pathological-long-paragraph', title: 'Pathological: 10k paragraph', blocks: longParagraph(10000), meta: meta('pathological', 'A single 10,000-character paragraph with two runs', 1) },
  { id: 'pathological-unicode', title: 'Pathological: unicode and control characters', blocks: unicodeEdgeCases(), meta: meta('pathological', 'Emoji sequences, zero-width characters, combining marks, bidi and control characters', 1) },
  { id: 'pathological-unknown-types', title: 'Pathological: unknown block types', blocks: unknownBlockTypes(), meta: meta('pathological', 'Unregistered block and inline types, plus an unknown prop on a known type', 1) },
];

/** Returns a corpus entry by id, throwing when it is missing. */
export function corpusEntry(id: string): CorpusEntry {
  const entry = corpus.find((item) => item.id === id);
  if (!entry) throw new Error(`no corpus entry "${id}"`);
  return entry;
}

/** Deep copy of a corpus document's blocks, so tests can mutate freely. */
export function cloneBlocks(blocks: Block[]): Block[] {
  return structuredClone(blocks);
}
