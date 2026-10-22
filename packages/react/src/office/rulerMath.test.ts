import { describe, it, expect } from 'vitest';
import {
  addTabStop,
  applyIndentDrag,
  columnBoundaries,
  firstLinePosition,
  moveTabStop,
  pxToPt,
  ptToPx,
  pxWidthsToPt,
  resizeColumn,
} from './rulerMath';

describe('unit conversion', () => {
  it('converts points and pixels at zoom', () => {
    expect(ptToPx(72)).toBeCloseTo(96);
    expect(ptToPx(72, 2)).toBeCloseTo(192);
    expect(pxToPt(96)).toBeCloseTo(72);
  });
});

describe('indents', () => {
  it('computes first-line position from hanging and first-line indents', () => {
    expect(firstLinePosition({ leftPt: 36, hangingPt: 18 })).toBe(18);
    expect(firstLinePosition({ leftPt: 36, firstLinePt: 12 })).toBe(48);
    expect(firstLinePosition(null)).toBe(0);
  });

  it('keeps the hanging offset when the left marker moves', () => {
    expect(applyIndentDrag({ leftPt: 36, hangingPt: 18 }, 'left', 72, 400)).toEqual({ leftPt: 72, hangingPt: 18 });
  });

  it('turns a first-line marker dragged left of the left marker into a hanging indent', () => {
    expect(applyIndentDrag({ leftPt: 36 }, 'firstLine', 20, 400)).toEqual({ leftPt: 36, hangingPt: 16 });
  });

  it('clamps indents to the text width', () => {
    expect(applyIndentDrag(null, 'left', -10, 400)).toEqual({ leftPt: 0 });
    expect(applyIndentDrag(null, 'left', 999, 400).leftPt).toBe(400);
  });
});

describe('tab stops', () => {
  it('adds a stop in sorted order and moves or removes one', () => {
    const tabs = addTabStop([{ posPt: 72, kind: 'left' }], 36, 'center');
    expect(tabs.map((t) => t.posPt)).toEqual([36, 72]);
    expect(moveTabStop(tabs, 0, null)).toEqual([{ posPt: 72, kind: 'left' }]);
    expect(moveTabStop(tabs, 1, 10)[0]!.posPt).toBe(10);
  });
});

describe('table columns', () => {
  it('resizes a boundary while keeping the total and minimum widths', () => {
    const widths = resizeColumn([100, 100, 100], 0, 150);
    expect(widths).toEqual([150, 50, 100]);
    expect(columnBoundaries(widths)).toEqual([150, 200, 300]);
    const clamped = resizeColumn([100, 100], 0, 0);
    expect(clamped[0]).toBeGreaterThanOrEqual(18);
    expect(clamped[0]! + clamped[1]!).toBe(200);
  });

  it('converts pixel column widths to points, sharing the remainder with unknown columns', () => {
    expect(pxWidthsToPt([100, null], 300)).toEqual([75, 225]);
  });
});
