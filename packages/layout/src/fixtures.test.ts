import { describe, expect, it } from 'vitest';
import { documentToIR } from '@amusendame/beakblock-ir';

import { blocksToDocument, richSopBlocks, richSopBlocksWithSections } from '@amusendame/beakblock-schema';

import { layoutDocument, relayout } from './layout';
import { renderPrintHTML } from './print';
import { fixedMeasurer } from './__fixtures__/builders';

const OPTIONS = { measurer: fixedMeasurer, now: new Date(2026, 9, 21) };

describe('rich SOP fixture', () => {
  it('lays out a single-section SOP with fields, tables, and a controlled section', () => {
    const ir = documentToIR(blocksToDocument(richSopBlocks, { id: 'sop', properties: { docNumber: 'SOP-1' } }));
    const layout = layoutDocument(ir, OPTIONS);
    expect(layout.pageCount).toBeGreaterThan(0);
    expect(layout.fieldValues['s0/1:14']).toBe('SOP-1');
    expect(layout.toc.map((entry) => entry.blockId)).toContain('h-purpose');
    expect(layout.fieldValues['s0/28:3']).toBe('Purpose');
  });

  it('lays out the two-section SOP with a landscape appendix and matches print page count', () => {
    const ir = documentToIR(blocksToDocument(richSopBlocksWithSections, { id: 'sop', properties: { docNumber: 'SOP-1' } }));
    const layout = layoutDocument(ir, OPTIONS);
    expect(layout.sections).toHaveLength(2);
    expect(layout.pages[layout.pages.length - 1].sizePt.w).toBeGreaterThan(layout.pages[0].sizePt.w);
    const html = renderPrintHTML(ir, layout, OPTIONS);
    expect(html.match(/<section class="bb-page /g)?.length).toBe(layout.pageCount);
  });

  it('relayout from the appendix matches a full layout', () => {
    const ir = documentToIR(blocksToDocument(richSopBlocksWithSections, { id: 'sop' }));
    const prev = layoutDocument(ir, OPTIONS);
    const full = layoutDocument(ir, OPTIONS);
    expect(relayout(prev, ir, 0, OPTIONS)).toEqual(full);
  });
});
