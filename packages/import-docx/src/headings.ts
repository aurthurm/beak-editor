/**
 * Heading detection for the legacy SOP migration wizard.
 *
 * Heuristics, in order of strength: heading styles, SOP section names, dotted
 * or section numbering, and bold short lines (all capitals scores higher).
 * Results are candidates for a human to confirm, not decisions.
 *
 * @module
 */

import type { IRDocument, IRInline, IRParagraph } from '@amusendame/beakblock-ir';

/** Canonical SOP section names and the synonyms that map to them (lowercase). */
export const SOP_SECTION_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  Purpose: ['purpose', 'objective', 'objectives', 'aim'],
  Scope: ['scope', 'applicability', 'application'],
  Responsibilities: ['responsibilities', 'responsibility', 'roles and responsibilities', 'roles'],
  Definitions: ['definitions', 'terms and definitions', 'abbreviations', 'terminology'],
  Procedure: ['procedure', 'procedures', 'method', 'process', 'steps', 'instructions', 'work instructions'],
  Safety: ['safety', 'safety precautions', 'health and safety', 'hazards', 'precautions'],
  References: ['references', 'related documents', 'reference documents', 'related references'],
  'Quality Control': ['quality control', 'qc', 'quality assurance', 'qa criteria', 'acceptance criteria'],
  'Revision History': ['revision history', 'document history', 'change history', 'revisions', 'version history'],
};

/** Minimum confidence for a candidate to be returned. */
const MIN_CONFIDENCE = 0.5;

/** A heading candidate found by {@link detectHeadings}. */
export interface HeadingCandidate {
  /** Index of the top-level block, counted across all sections in order. */
  index: number;
  /** Heading text (the paragraph text, trimmed). */
  text: string;
  /** Suggested outline level, 1 = top level. */
  level: number;
  /** Confidence between 0 and 1. */
  confidence: number;
  /** Human-readable reasons, joined with `; `. */
  reason: string;
}

interface Signal {
  level: number;
  confidence: number;
  reason: string;
}

function paragraphText(p: IRParagraph): string {
  return p.runs
    .map((item: IRInline) => (item.type === 'run' ? item.text : item.type === 'field' ? item.cachedText : ''))
    .join('')
    .trim();
}

function matchSopSection(text: string): string | null {
  if (text.length > 40) return null;
  const normalized = text.replace(/[:.\s]+$/, '').trim().toLowerCase();
  for (const [canonical, synonyms] of Object.entries(SOP_SECTION_SYNONYMS)) {
    if (normalized === canonical.toLowerCase() || synonyms.includes(normalized)) return canonical;
  }
  return null;
}

function headingStyleLevel(p: IRParagraph, ir: IRDocument): number | null {
  const styleId = p.props.styleId;
  if (!styleId) return null;
  const direct = /^heading\s?([1-9])$/i.exec(styleId);
  if (direct) return Number(direct[1]);
  const name = ir.styles.paragraph[styleId]?.name ?? '';
  const named = /^heading\s?([1-9])$/i.exec(name);
  return named ? Number(named[1]) : null;
}

function signalsFor(p: IRParagraph, ir: IRDocument): Signal[] {
  const text = paragraphText(p);
  if (!text || text.length > 160) return [];
  const signals: Signal[] = [];

  const styleLevel = headingStyleLevel(p, ir);
  if (styleLevel !== null) {
    signals.push({ level: styleLevel, confidence: 0.95, reason: `style:${p.props.styleId ?? ''}` });
  }

  let body = text;
  let numbered = false;
  const numbering = /^(\d+(?:\.\d+)*)[.)]?\s+(\S.*)$/.exec(text);
  const section = /^section\s+(\d+(?:\.\d+)*)[.:]?\s*(.*)$/i.exec(text);
  const match = numbering ?? section;
  if (match && text.length <= 100 && !/[.;]$/.test(text)) {
    const depth = match[1].split('.').length;
    numbered = true;
    signals.push({
      level: depth,
      confidence: depth > 1 ? 0.7 : 0.4,
      reason: `numbered:${match[1]}`,
    });
    body = (match[2] ?? '').trim() || text;
  }

  const sop = matchSopSection(body);
  if (sop) signals.push({ level: 1, confidence: 0.85, reason: `sop-section:${sop}` });

  const runs = p.runs.filter((item) => item.type === 'run' && item.text.trim().length > 0);
  const allBold = runs.length > 0 && runs.every((item) => item.type === 'run' && item.props.bold === true);
  if (allBold && text.length <= 80 && !/[.;,]$/.test(text)) {
    const caps = text === text.toUpperCase() && /[A-Z]/.test(text);
    signals.push({ level: 1, confidence: caps ? 0.75 : 0.6, reason: caps ? 'bold-caps' : 'bold-short' });
    if (numbered) {
      const last = signals[signals.length - 1];
      last.confidence = Math.min(0.9, last.confidence + 0.1);
    }
  }
  return signals;
}

/**
 * Finds likely section headings in an IR document.
 *
 * @example
 * ```typescript
 * const { ir } = await importDocx(bytes);
 * const candidates = detectHeadings(ir).filter((c) => c.confidence >= 0.8);
 * ```
 */
export function detectHeadings(ir: IRDocument): HeadingCandidate[] {
  const out: HeadingCandidate[] = [];
  let index = 0;
  for (const section of ir.sections) {
    for (const block of section.body) {
      if (block.type === 'paragraph') {
        const signals = signalsFor(block, ir);
        if (signals.length > 0) {
          const best = signals.reduce((a, b) => (b.confidence > a.confidence ? b : a));
          const confidence = Math.round(best.confidence * 100) / 100;
          if (confidence >= MIN_CONFIDENCE) {
            out.push({
              index,
              text: paragraphText(block),
              level: best.level,
              confidence,
              reason: signals.map((s) => s.reason).join('; '),
            });
          }
        }
      }
      index += 1;
    }
  }
  return out;
}
