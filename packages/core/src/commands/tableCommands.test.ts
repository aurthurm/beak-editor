import { describe, expect, it } from 'vitest';
import { CellSelection, TableMap, fixTables } from 'prosemirror-tables';
import { EditorState } from 'prosemirror-state';
import {
  addRowAfter,
  addRowAtIndex,
  addColumnAfter,
  deleteColumnAtIndex,
  deleteRowAtIndex,
  deleteRow,
  goToNextCell,
  isInTable,
  mergeCells,
  splitCell,
  setCellBorders,
  setCellShading,
  setCellPadding,
  setCellVerticalAlign,
  setCellHorizontalAlign,
  setTableWidth,
  setColumnWidthTwips,
  distributeColumns,
  toggleHeaderRow,
  toggleRowCantSplit,
  sortTableByColumn,
  setTableStyle,
  getColumnWidthsPx,
} from '../index';
import {
  table,
  stateOf,
  cellPositions,
  cursorIn,
  cellSelection,
  run,
  firstTable,
  textGrid,
  assertValidTable,
  schema,
} from './tableTestUtils';

/** Position of the cell at (row, col) in the first table, using the map. */
function cellAt(state: EditorState, row: number, col: number): number {
  const tbl = firstTable(state);
  const map = TableMap.get(tbl);
  const rel = map.map[row * map.width + col]!;
  // table content start is the first table's position + 1
  let start = -1;
  state.doc.descendants((node, pos) => {
    if (start < 0 && node.type.name === 'table') start = pos + 1;
    return start < 0;
  });
  return start + rel;
}

describe('table commands on a plain grid', () => {
  it('adds a row after the cursor row', () => {
    const state = cursorIn(stateOf(table([['a', 'b'], ['c', 'd']])), cellAt(stateOf(table([['a', 'b'], ['c', 'd']])), 0, 0));
    const { ok, state: next } = run(state, addRowAfter);
    expect(ok).toBe(true);
    expect(firstTable(next).childCount).toBe(3);
    assertValidTable(next);
  });

  it('adds a column after the cursor column', () => {
    const base = stateOf(table([['a', 'b'], ['c', 'd']]));
    const state = cursorIn(base, cellAt(base, 0, 0));
    const { state: next } = run(state, addColumnAfter);
    expect(TableMap.get(firstTable(next)).width).toBe(3);
    assertValidTable(next);
  });

  it('refuses to delete the only row', () => {
    const base = stateOf(table([['a', 'b']]));
    expect(run(cursorIn(base, cellAt(base, 0, 0)), deleteRow).ok).toBe(false);
  });

  it('insert and delete at index keep the grid valid', () => {
    const base = stateOf(table([['a', 'b'], ['c', 'd']]));
    const tablePos = 0;
    let s = base;
    expect(addRowAtIndex(s, (tr) => { s = s.apply(tr); }, tablePos, 2)).toBe(true);
    expect(firstTable(s).childCount).toBe(3);
    expect(deleteRowAtIndex(s, (tr) => { s = s.apply(tr); }, tablePos, 0)).toBe(true);
    expect(firstTable(s).childCount).toBe(2);
    expect(deleteColumnAtIndex(s, (tr) => { s = s.apply(tr); }, tablePos, 1)).toBe(true);
    expect(TableMap.get(firstTable(s)).width).toBe(1);
    assertValidTable(s);
  });

  it('Tab in the last cell appends a row and moves into it', () => {
    const base = stateOf(table([['a', 'b']]));
    const state = cursorIn(base, cellAt(base, 0, 1));
    const { ok, state: next } = run(state, goToNextCell);
    expect(ok).toBe(true);
    expect(firstTable(next).childCount).toBe(2);
    // cursor is inside the first cell of the new row
    const $pos = next.selection.$from;
    expect($pos.node($pos.depth - 2).type.name).toBe('tableRow');
    expect(isInTable(next)).toBe(true);
    expect($pos.index($pos.depth - 3)).toBe(1);
  });

  it('Tab moves to the next cell inside the table', () => {
    const base = stateOf(table([['a', 'b'], ['c', 'd']]));
    const state = cursorIn(base, cellAt(base, 0, 0));
    const { state: next } = run(state, goToNextCell);
    expect(next.doc.textBetween(next.selection.from, next.selection.from + 1)).toBe('b');
  });
});

describe('merge and split', () => {
  it('merges a 2x2 selection and splits it back', () => {
    const base = stateOf(table([['a', 'b', 'x'], ['c', 'd', 'y'], ['e', 'f', 'z']]));
    const sel = cellSelection(base, cellAt(base, 0, 0), cellAt(base, 1, 1));
    const { ok, state: merged } = run(sel, mergeCells);
    expect(ok).toBe(true);
    const map = TableMap.get(firstTable(merged));
    expect(map.width).toBe(3);
    assertValidTable(merged);

    const inside = cursorIn(merged, cellAt(merged, 0, 0));
    const { state: split } = run(inside, splitCell);
    expect(TableMap.get(firstTable(split)).width).toBe(3);
    expect(textGrid(split)[0]![2]).toBe('x');
    expect(textGrid(split)[2]![2]).toBe('z');
    assertValidTable(split);
  });

  it('vertical merge via rowspan keeps every row covered', () => {
    const base = stateOf(table([['a', 'b'], ['c', 'd'], ['e', 'f']]));
    const sel = cellSelection(base, cellAt(base, 0, 1), cellAt(base, 1, 1));
    const { state: merged } = run(sel, mergeCells);
    const tbl = firstTable(merged);
    expect(tbl.child(0).lastChild!.attrs.rowspan).toBe(2);
    assertValidTable(merged);
  });
});

describe('Office formatting commands', () => {
  it('sets shading and padding on the selected cells', () => {
    const base = stateOf(table([['a', 'b'], ['c', 'd']]));
    const sel = cellSelection(base, cellAt(base, 0, 0), cellAt(base, 0, 1));
    let s = run(sel, setCellShading('#ffcc00')).state;
    s = run(s, setCellPadding({ topPt: 2, rightPt: 3, bottomPt: 2, leftPt: 3 })).state;
    const row0 = firstTable(s).child(0);
    expect(row0.child(0).attrs.shading).toBe('#ffcc00');
    expect(row0.child(1).attrs.backgroundColor).toBe('#ffcc00');
    expect(row0.child(1).attrs.padding).toEqual({ topPt: 2, rightPt: 3, bottomPt: 2, leftPt: 3 });
    expect(firstTable(s).child(1).child(0).attrs.shading).toBeNull();
  });

  it('sets vertical and horizontal alignment', () => {
    const base = stateOf(table([['a']]));
    let s = run(cursorIn(base, cellAt(base, 0, 0)), setCellVerticalAlign('center')).state;
    s = run(s, setCellHorizontalAlign('right')).state;
    expect(firstTable(s).child(0).child(0).attrs.vAlign).toBe('center');
    expect(firstTable(s).child(0).child(0).attrs.hAlign).toBe('right');
  });

  it('sets per-edge borders and mirrors shared edges onto the neighbour', () => {
    const base = stateOf(table([['a', 'b'], ['c', 'd']]));
    const sel = cellSelection(base, cellAt(base, 0, 0), cellAt(base, 0, 0));
    const border = { style: 'single' as const, sizePt: 1, color: '#000000' };
    const { state: s } = run(sel, setCellBorders(['bottom'], border));
    const tbl = firstTable(s);
    expect(tbl.child(0).child(0).attrs.borders.bottom).toEqual(border);
    expect(tbl.child(1).child(0).attrs.borders.top).toEqual(border);
    expect(tbl.child(0).child(0).attrs.borders.top).toBeNull();
  });

  it('sets table width and style', () => {
    const base = stateOf(table([['a']]));
    const cur = cursorIn(base, cellAt(base, 0, 0));
    let s = run(cur, setTableWidth('fixed', 9360)).state;
    expect(firstTable(s).attrs.widthMode).toBe('fixed');
    expect(firstTable(s).attrs.widthValue).toBe(9360);
    s = run(s, setTableStyle('GridTable4', { headerRow: true, bandedRows: false, firstColumn: false, lastRow: false })).state;
    expect(firstTable(s).attrs.styleId).toBe('GridTable4');
    expect(firstTable(s).attrs.look).toEqual({ headerRow: true, bandedRows: false, firstColumn: false, lastRow: false });
    s = run(s, setTableWidth('auto')).state;
    expect(firstTable(s).attrs.widthValue).toBeNull();
  });

  it('sets a column width in twips and distributes columns equally', () => {
    const base = stateOf(table([['a', 'b', 'c'], ['d', 'e', 'f']]));
    const cur = cursorIn(base, cellAt(base, 0, 0));
    expect(setColumnWidthTwips(0, 2880)(cur)).toBe(true);
    const { state: s } = run(cur, setColumnWidthTwips(0, 2880));
    expect(firstTable(s).child(0).child(0).attrs.colwidth).toEqual([192]);
    expect(firstTable(s).child(0).child(0).attrs.widthTwips).toBe(2880);
    const { state: even } = run(s, distributeColumns);
    const widths = getColumnWidthsPx(even)!;
    expect(widths.length).toBe(3);
    expect(widths[0]).toBeCloseTo(widths[1]!, 5);
    expect(widths[1]).toBeCloseTo(widths[2]!, 5);
  });

  it('toggles repeat header row and cantSplit on the cursor row', () => {
    const base = stateOf(table([['a'], ['b']]));
    const cur = cursorIn(base, cellAt(base, 0, 0));
    const { state: s1 } = run(cur, toggleHeaderRow);
    expect(firstTable(s1).child(0).attrs.isHeader).toBe(true);
    const { state: s2 } = run(s1, toggleHeaderRow);
    expect(firstTable(s2).child(0).attrs.isHeader).toBeNull();
    const { state: s3 } = run(cur, toggleRowCantSplit);
    expect(firstTable(s3).child(0).attrs.cantSplit).toBe(true);
  });

  it('sorts body rows numerically and keeps header rows in place', () => {
    const base = stateOf(
      table([['Name', 'Qty'], ['b', '10'], ['a', '2'], ['c', '1,000']])
    );
    // mark first row as header
    const tbl = firstTable(base);
    const headerTable = tbl.copy(tbl.content.replaceChild(0, tbl.child(0).type.create({ ...tbl.child(0).attrs, isHeader: true }, tbl.child(0).content)));
    const withHeader = base.apply(base.tr.replaceWith(0, tbl.nodeSize, headerTable));
    const cur = cursorIn(withHeader, cellAt(withHeader, 1, 0));
    const { state: sorted } = run(cur, sortTableByColumn(1, 'desc'));
    expect(textGrid(sorted)).toEqual([['Name', 'Qty'], ['c', '1,000'], ['b', '10'], ['a', '2']]);
    const { state: asc } = run(cur, sortTableByColumn(0, 'asc'));
    expect(textGrid(asc).slice(1).map((r) => r[0])).toEqual(['a', 'b', 'c']);
  });

  it('refuses to sort when body rows contain merged cells', () => {
    const base = stateOf(table([['a', 'b'], ['c', 'd'], ['e', 'f']]));
    const sel = cellSelection(base, cellAt(base, 0, 1), cellAt(base, 1, 1));
    const merged = run(sel, mergeCells).state;
    const cur = cursorIn(merged, cellAt(merged, 0, 0));
    expect(run(cur, sortTableByColumn(0, 'asc')).ok).toBe(false);
  });
});

describe('table structure helpers keep map validity', () => {
  it('deleteRow on a spanned table stays valid', () => {
    const base = stateOf(table([['a', 'b'], ['c', 'd'], ['e', 'f']]));
    const sel = cellSelection(base, cellAt(base, 0, 1), cellAt(base, 1, 1));
    const merged = run(sel, mergeCells).state;
    const cur = cursorIn(merged, cellAt(merged, 2, 0));
    const { ok, state } = run(cur, deleteRow);
    expect(ok).toBe(true);
    assertValidTable(state);
  });

  it('a clean doc has no fixTables changes', () => {
    expect(fixTables(stateOf(table([['a', 'b'], ['c', 'd']])))).toBeUndefined();
  });

  it('cellSelection helper returns a CellSelection', () => {
    const base = stateOf(table([['a', 'b']]));
    const s = cellSelection(base, cellPositions(base.doc)[0]!, cellPositions(base.doc)[1]!);
    expect(s.selection).toBeInstanceOf(CellSelection);
    expect(schema.nodes.table).toBeDefined();
  });
});
