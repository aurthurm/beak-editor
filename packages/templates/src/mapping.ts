/**
 * Suggests how legacy document headings map onto template sections (SOP migration wizard).
 *
 * Input headings come from import-docx's `detectHeadings`. Matching uses normalised titles,
 * a synonym table and a token and edit-distance score. The mapping keeps document order. It is
 * a suggestion for a person to confirm.
 *
 * @module
 */

import type { TemplateDefinition } from './types';

/** A heading found in the imported document. */
export interface HeadingInput {
  index: number;
  text: string;
  level: number;
}

/** A suggested mapping for one template section. `startIndex` is -1 when no heading matched. */
export interface SectionMappingSuggestion {
  templateSectionId: string;
  startIndex: number;
  endIndex: number;
  /** 0..1. Below 0.6 means no suggestion. */
  confidence: number;
  matchedText?: string;
}

/** Synonym groups. Titles in the same group match with high confidence. */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['purpose', 'objective', 'objectives', 'aim', 'aims'],
  ['scope', 'applicability', 'application', 'coverage'],
  ['responsibilities', 'responsibility', 'roles', 'roles and responsibilities', 'duties'],
  ['procedure', 'procedures', 'method', 'methods', 'process', 'steps', 'instructions', 'procedure steps', 'work instruction'],
  ['materials', 'materials and equipment', 'equipment', 'reagents', 'apparatus', 'equipment and materials'],
  ['safety', 'safety precautions', 'hazards', 'health and safety', 'warnings'],
  ['definitions', 'definition', 'terms', 'abbreviations', 'terminology'],
  ['references', 'reference', 'related documents', 'related documentation', 'normative references'],
  ['records', 'record', 'documentation', 'record keeping', 'records retention'],
  ['revision history', 'change history', 'revisions', 'document history'],
  ['quality control', 'qc', 'qc criteria', 'quality controls'],
  ['appendix', 'appendices', 'attachments'],
];

const MIN_CONFIDENCE = 0.6;

/** Lowercases, strips leading numbering (`1.`, `2.3`, `A)`, `iv.`) and punctuation. */
export function normaliseHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/^\s*(\d+(\.\d+)*|[ivxlc]+|[a-z])[).:-]?\s+/, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function synonymGroupOf(normalised: string): number {
  return SYNONYM_GROUPS.findIndex((group) => group.includes(normalised));
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_v, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = saved;
    }
  }
  return prev[b.length]!;
}

/** Similarity of two headings, 0..1. */
export function headingSimilarity(templateTitle: string, heading: string): number {
  const a = normaliseHeading(templateTitle);
  const b = normaliseHeading(heading);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ga = synonymGroupOf(a);
  if (ga >= 0 && ga === synonymGroupOf(b)) return 0.9;
  const ta = new Set(a.split(' '));
  const tb = new Set(b.split(' '));
  const shared = [...ta].filter((t) => tb.has(t)).length;
  const jaccard = shared / new Set([...ta, ...tb]).size;
  const edit = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  return Math.round((jaccard * 0.6 + edit * 0.4) * 100) / 100;
}

/**
 * Suggests a mapping of imported headings to template sections.
 *
 * Sections are matched in template order, each to the best heading after the previous match.
 * `endIndex` runs up to the heading before the next matched heading (or the last heading).
 */
export function mapImportToTemplate(headings: readonly HeadingInput[], template: TemplateDefinition): SectionMappingSuggestion[] {
  const ordered = [...headings].sort((a, b) => a.index - b.index);
  const results: SectionMappingSuggestion[] = [];
  let cursor = 0;
  for (const def of template.sections) {
    let best: { heading: HeadingInput; score: number } | null = null;
    for (let i = cursor; i < ordered.length; i++) {
      const heading = ordered[i]!;
      const score = headingSimilarity(def.title, heading.text);
      if (score >= MIN_CONFIDENCE && (!best || score > best.score)) best = { heading, score };
    }
    if (best) {
      results.push({
        templateSectionId: def.templateSectionId,
        startIndex: best.heading.index,
        endIndex: best.heading.index,
        confidence: best.score,
        matchedText: best.heading.text,
      });
      cursor = ordered.indexOf(best.heading) + 1;
    } else {
      results.push({ templateSectionId: def.templateSectionId, startIndex: -1, endIndex: -1, confidence: 0 });
    }
  }
  // Each matched section runs until the next matched heading.
  const matched = results.filter((r) => r.startIndex >= 0);
  const lastIndex = ordered.length ? ordered[ordered.length - 1]!.index : -1;
  matched.forEach((r, i) => {
    const next = matched[i + 1];
    r.endIndex = next ? next.startIndex - 1 : lastIndex;
  });
  return results;
}
