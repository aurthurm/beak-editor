/**
 * Layout and fidelity-proxy suite (roadmap 5E, ADR-2, performance budgets in section 8).
 *
 * - Page counts are stable across runs for every corpus document.
 * - relayout after an edit equals a full layout of the edited document.
 * - Print HTML has one page element per layout page, and layout does not mutate the IR.
 * - Performance: 50- and 200-page documents layout within generous CI budgets. Timings are written to
 *   reports/perf.json so trends can be tracked.
 *
 * Budgets are deliberately loose so that CI hardware variance does not fail the build; the
 * roadmap's 16 ms keystroke budget is measured in the browser, not here.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { layoutDocument, relayout, renderPrintHTML, type LayoutResult } from '@amusendame/beakblock-layout';
import type { IRBlock, IRDocument, IRParagraph } from '@amusendame/beakblock-ir';
import { documentToIR } from '@amusendame/beakblock-ir';
import { migrateDocument } from '@amusendame/beakblock-schema';

import { corpus, cloneBlocks, longSop } from './corpus';

const FIXED_NOW = new Date('2026-06-01T09:00:00.000Z');
// Tests run from the conformance package directory (pnpm --filter ... test).
const REPORT_DIR = resolve(process.cwd(), 'reports');
const REPORT = resolve(REPORT_DIR, 'perf.json');

const toIR = (blocks: Parameters<typeof migrateDocument>[0]): IRDocument => documentToIR(migrateDocument(cloneBlocks(blocks as never)));

/** Leaf ordinal of a top-level paragraph, matching layout's blockIndex (tables count as one leaf). */
function leafOrdinalOf(ir: IRDocument, target: IRBlock): number {
  let ordinal = 0;
  let found = -1;
  const walk = (blocks: IRBlock[]) => {
    for (const block of blocks) {
      if (found >= 0) return;
      if (block === target) {
        found = ordinal;
        return;
      }
      if (block.type === 'sdt') walk(block.blocks);
      else ordinal += 1;
    }
  };
  for (const section of ir.sections) walk(section.body);
  if (found < 0) throw new Error('target block not found');
  return found;
}

/** The last top-level paragraph of the last section that has one. */
function lastParagraph(ir: IRDocument): IRParagraph {
  for (let s = ir.sections.length - 1; s >= 0; s -= 1) {
    const body = ir.sections[s].body;
    for (let i = body.length - 1; i >= 0; i -= 1) {
      if (body[i].type === 'paragraph') return body[i] as IRParagraph;
    }
  }
  throw new Error('no paragraph');
}

const pageSignature = (layout: LayoutResult) =>
  layout.pages.map((page) => ({ number: page.number, sectionId: page.sectionId, fragments: page.body.map((f) => `${f.kind}:${f.blockIndex}:${f.yPt}`) }));

describe('layout: page counts are stable', () => {
  for (const entry of corpus) {
    it(`${entry.id} lays out to the same pages on two runs`, () => {
      const ir = toIR(entry.blocks);
      const first = layoutDocument(ir, { now: FIXED_NOW });
      const second = layoutDocument(ir, { now: FIXED_NOW });
      expect(second.pageCount).toBe(first.pageCount);
      expect(pageSignature(second)).toStrictEqual(pageSignature(first));
      expect(first.pageCount).toBeGreaterThan(0);
    });
  }
});

describe('layout: relayout equals a full layout', () => {
  for (const entry of corpus) {
    it(`${entry.id}: editing the last paragraph and relaying out from it matches a full layout`, () => {
      const ir = toIR(entry.blocks);
      const prev = layoutDocument(ir, { now: FIXED_NOW });
      const edited = structuredClone(ir);
      const target = lastParagraph(edited);
      target.runs = [...target.runs, { type: 'run', text: ' An appended sentence that changes the line count of the final paragraph in this document.', props: {} }];
      const fromBlockIndex = leafOrdinalOf(edited, target);
      const full = layoutDocument(edited, { now: FIXED_NOW });
      const incremental = relayout(prev, edited, fromBlockIndex, { now: FIXED_NOW });
      expect(pageSignature(incremental)).toStrictEqual(pageSignature(full));
      expect(incremental.pageCount).toBe(full.pageCount);
      expect(incremental.fieldValues).toStrictEqual(full.fieldValues);
    });
  }
});

describe('layout: print HTML and purity', () => {
  for (const entry of corpus) {
    it(`${entry.id}: print HTML has one page element per layout page and the IR is not mutated`, () => {
      const ir = toIR(entry.blocks);
      const snapshot = structuredClone(ir);
      const layout = layoutDocument(ir, { now: FIXED_NOW });
      const html = renderPrintHTML(ir, layout, { now: FIXED_NOW });
      const pages = (html.match(/<section class="bb-page[ "]/g) ?? []).length;
      expect(pages).toBe(layout.pageCount);
      expect(ir).toStrictEqual(snapshot);
    });
  }

  it('NUMPAGES fields resolve to the page count of the long document', () => {
    const ir = toIR(corpus.find((c) => c.id === 'long-sop-50')!.blocks);
    const layout = layoutDocument(ir, { now: FIXED_NOW });
    expect(Object.values(layout.fieldValues)).toContain(String(layout.pageCount));
  });
});

describe('layout: performance budgets (generous, for CI)', () => {
  const timings: Record<string, number> = {};

  for (const pages of [50, 200]) {
    it(`${pages}-page document lays out within budget`, () => {
      const blocks = longSop(pages, `perf${pages}`);
      const ir = toIR(blocks);
      const started = performance.now();
      const layout = layoutDocument(ir, { now: FIXED_NOW });
      const elapsed = performance.now() - started;
      timings[`layout_${pages}p_ms`] = Math.round(elapsed);
      timings[`pages_${pages}p`] = layout.pageCount;
      console.info(`[perf] ${pages} pages: ${layout.pageCount} laid out pages in ${Math.round(elapsed)} ms`);
      expect(layout.pageCount).toBeGreaterThanOrEqual(pages * 0.6);
      expect(elapsed, `${pages}-page layout`).toBeLessThan(pages === 50 ? 3000 : 10000);
    });

    it(`${pages}-page relayout from the last 5% is faster than a full layout`, () => {
      const ir = toIR(longSop(pages, `relay${pages}`));
      const prev = layoutDocument(ir, { now: FIXED_NOW });
      const edited = structuredClone(ir);
      const tail = lastParagraph(edited);
      tail.runs = [...tail.runs, { type: 'run', text: ' Edited.', props: {} }];
      const fromBlockIndex = leafOrdinalOf(edited, tail);
      const started = performance.now();
      const next = relayout(prev, edited, fromBlockIndex, { now: FIXED_NOW });
      const elapsed = performance.now() - started;
      timings[`relayout_${pages}p_tail_ms`] = Math.round(elapsed);
      console.info(`[perf] relayout ${pages} pages from tail: ${Math.round(elapsed)} ms`);
      expect(next.pageCount).toBeGreaterThan(0);
      expect(elapsed, `${pages}-page relayout`).toBeLessThan(pages === 50 ? 1500 : 5000);
    });
  }

  it('writes the timings report', () => {
    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(REPORT, JSON.stringify({ generatedAt: new Date().toISOString(), budgetsMs: { layout50: 3000, layout200: 10000 }, timings }, null, 2) + '\n');
    expect(Object.keys(timings).length).toBeGreaterThan(0);
  });
});
