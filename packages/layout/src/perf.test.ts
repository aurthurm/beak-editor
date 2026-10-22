import { describe, expect, it } from 'vitest';

import { documentOf, para, row, section, table } from './__fixtures__/builders';
import { layoutDocument, relayout } from './layout';
import type { IRBlock } from '@amusendame/beakblock-ir';

const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor '.split(' ');

function body(count: number, editedIndex?: number): IRBlock[] {
  const blocks: IRBlock[] = [];
  for (let index = 0; index < count; index += 1) {
    if (index % 25 === 24) {
      const rows = Array.from({ length: 5 }, (_v, r) => row([`t${index}-${r} ${WORDS.slice(0, 6).join(' ')}`, 'value'], r === 0 ? { isHeader: true } : {}));
      blocks.push(table([4513, 4513], rows));
      continue;
    }
    const words = Array.from({ length: 150 + (index % 40) }, (_v, w) => WORDS[(w + index) % WORDS.length]);
    const text = index === editedIndex ? `EDITED ${words.join(' ')}` : words.join(' ');
    blocks.push(para(text, index % 60 === 0 ? { styleId: 'Heading1', keepNext: true } : {}, `p-${index}`));
  }
  return blocks;
}

describe('performance budgets (heuristic measurer)', () => {
  it('lays out ~1500 blocks under 1500 ms and relayouts the last 5% under 100 ms', () => {
    const count = 1500;
    const ir = documentOf([section('sec-1', body(count))]);

    const t0 = performance.now();
    const layout = layoutDocument(ir);
    const fullMs = performance.now() - t0;

    const editIndex = Math.floor(count * 0.95) + 2;
    const edited = documentOf([section('sec-1', body(count, editIndex))]);
    const t1 = performance.now();
    const next = relayout(layout, edited, editIndex);
    const relayoutMs = performance.now() - t1;

    console.log(
      `[perf] pages=${layout.pageCount} full=${fullMs.toFixed(1)}ms relayout(last 5%)=${relayoutMs.toFixed(1)}ms`
    );
    expect(layout.pageCount).toBeGreaterThanOrEqual(90);
    expect(fullMs).toBeLessThan(1500);
    expect(relayoutMs).toBeLessThan(100);
    expect(next.pageCount).toBe(layoutDocument(edited).pageCount);
  });
});
