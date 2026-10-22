/**
 * Advisory validation against configured terminology and approved references. Findings are
 * warnings for a reviewer to consider. They never block or change content.
 *
 * @module
 */

import type { AIFinding, AIValidationOptions } from './types';

/** Maximum findings returned by one validation pass. */
const MAX_VALIDATION_FINDINGS = 200;

/** Reference-like tokens such as `SOP-004`, `WI 12.3` or `ISO 15189`. */
const REFERENCE_PATTERN = /\b(?:SOP|WI|FORM|REF|ISO|IEC|QC)[- ]?[A-Z0-9][A-Za-z0-9./-]*/g;

/** Words of at least four letters. */
const WORD_PATTERN = /[A-Za-z][A-Za-z-]{3,}/g;

function levenshtein(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = current[0]!;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length]!;
}

/**
 * Checks text items against the configured lists. Each item may carry the block id it came from.
 *
 * - Terminology: a word that is not a listed term but is one or two edits away from one is flagged
 *   with the listed term as the suggestion.
 * - References: a reference-like token that is not in `approvedReferences` is flagged.
 */
export function validateAgainstLists(
  items: ReadonlyArray<{ blockId?: string; text: string }>,
  options: AIValidationOptions
): AIFinding[] {
  const findings: AIFinding[] = [];
  const seen = new Set<string>();
  const terms = (options.terminology ?? []).map((t) => t.trim()).filter(Boolean);
  const termLower = terms.map((t) => t.toLowerCase());
  const approved = new Set((options.approvedReferences ?? []).map(normalizeReference).filter(Boolean));

  for (const item of items) {
    if (findings.length >= MAX_VALIDATION_FINDINGS) break;

    if (terms.length > 0) {
      for (const word of item.text.match(WORD_PATTERN) ?? []) {
        if (findings.length >= MAX_VALIDATION_FINDINGS) break;
        const lower = word.toLowerCase();
        if (termLower.includes(lower)) continue;
        const limit = lower.length <= 6 ? 1 : 2;
        let best: { term: string; distance: number } | null = null;
        terms.forEach((term, index) => {
          const distance = levenshtein(lower, termLower[index]!, limit);
          if (distance <= limit && (!best || distance < best.distance)) best = { term, distance };
        });
        const match = best as { term: string; distance: number } | null;
        const key = `t|${item.blockId ?? ''}|${lower}`;
        if (match && !seen.has(key)) {
          seen.add(key);
          findings.push({
            severity: 'warning',
            message: `"${word}" is not in the approved terminology; did you mean "${match.term}"?`,
            blockId: item.blockId,
            suggestion: match.term,
            origin: 'terminology',
          });
        }
      }
    }

    if (approved.size > 0) {
      for (const match of item.text.match(REFERENCE_PATTERN) ?? []) {
        if (findings.length >= MAX_VALIDATION_FINDINGS) break;
        const cleaned = match.replace(/[./-]+$/, '');
        const normalized = normalizeReference(cleaned);
        const key = `r|${item.blockId ?? ''}|${normalized}`;
        if (!approved.has(normalized) && !seen.has(key)) {
          seen.add(key);
          findings.push({
            severity: 'warning',
            message: `Reference "${cleaned}" is not in the approved references list`,
            blockId: item.blockId,
            origin: 'reference',
          });
        }
      }
    }
  }
  return findings;
}

function normalizeReference(value: string): string {
  return value.toUpperCase().replace(/[\s_]+/g, '-');
}
