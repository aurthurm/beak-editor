import { describe, expect, it } from 'vitest';

import { createDomMeasurer, createHeuristicMeasurer } from './measure';

describe('measurers', () => {
  const heuristic = createHeuristicMeasurer();

  it('is deterministic and scales with size', () => {
    const a = heuristic.measureText('The quick brown fox', { font: 'Carlito' }, 11);
    expect(heuristic.measureText('The quick brown fox', { font: 'Carlito' }, 11)).toBe(a);
    expect(heuristic.measureText('The quick brown fox', { font: 'Carlito' }, 22)).toBeCloseTo(a * 2);
  });

  it('makes bold wider and Carlito narrower than Liberation Sans', () => {
    const regular = heuristic.measureText('Procedure', { font: 'Carlito' }, 11);
    expect(heuristic.measureText('Procedure', { font: 'Carlito', bold: true }, 11)).toBeGreaterThan(regular);
    expect(regular).toBeLessThan(heuristic.measureText('Procedure', { font: 'Liberation Sans' }, 11));
  });

  it('keeps Caladea close to Liberation Serif', () => {
    const serif = heuristic.measureText('Standard operating', { font: 'Liberation Serif' }, 11);
    const caladea = heuristic.measureText('Standard operating', { font: 'Caladea' }, 11);
    expect(Math.abs(caladea - serif) / serif).toBeLessThan(0.1);
  });

  it('applies line rules: auto multiplier, 240ths, exact and atLeast', () => {
    expect(heuristic.lineHeightPt(10, { line: 1.15, lineRule: 'auto' }, 'Carlito')).toBeCloseTo(10 * 1.22 * 1.15);
    expect(heuristic.lineHeightPt(10, { line: 276, lineRule: 'auto' }, 'Carlito')).toBeCloseTo(10 * 1.22 * 1.15);
    expect(heuristic.lineHeightPt(10, { line: 276, lineRule: 'auto' }, 'Carlito')).toBeCloseTo(
      heuristic.lineHeightPt(10, null, 'Carlito') * 1.15
    );
    expect(heuristic.lineHeightPt(10, { line: 240, lineRule: 'auto' }, 'Carlito')).toBeCloseTo(
      heuristic.lineHeightPt(10, null, 'Carlito')
    );
    expect(heuristic.lineHeightPt(10, { line: 280, lineRule: 'exact' }, 'Carlito')).toBe(14);
    expect(heuristic.lineHeightPt(10, { line: 600, lineRule: 'atLeast' }, 'Carlito')).toBe(30);
    expect(heuristic.lineHeightPt(20, { line: 280, lineRule: 'atLeast' }, 'Carlito')).toBeGreaterThan(14);
  });

  it('falls back to the heuristic when the DOM has no canvas', () => {
    const dom = createDomMeasurer();
    expect(dom.measureText('fallback', { font: 'Carlito' }, 11)).toBeCloseTo(heuristic.measureText('fallback', { font: 'Carlito' }, 11));
  });
});
