/**
 * Property tests: random sequences of table structure operations on random
 * grids must never leave a corrupted table map. Uses a small seeded PRNG so
 * failures are reproducible.
 */
import { describe, expect, it } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { TableMap, fixTables } from 'prosemirror-tables';
import {
  addRowAfter,
  addRowBefore,
  addColumnAfter,
  addColumnBefore,
  deleteRow,
  deleteColumn,
  addRowAtIndex,
  addColumnAtIndex,
  deleteRowAtIndex,
  deleteColumnAtIndex,
  mergeCells,
  splitCell,
} from '../index';
import {
  table,
  stateOf,
  cellPositions,
  cursorIn,
  cellSelection,
  run,
  firstTable,
  assertValidTable,
} from './tableTestUtils';

/** Mulberry32 seeded PRNG. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomGrid(rand: () => number): string[][] {
  const rows = 1 + Math.floor(rand() * 5);
  const cols = 1 + Math.floor(rand() * 5);
  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) row.push(`${r}${c}`);
    grid.push(row);
  }
  return grid;
}

/** Checks the map and the no-op property of fixTables. */
function assertConsistent(state: EditorState, label: string): void {
  try {
    assertValidTable(state);
    const tbl = firstTable(state);
    const map = TableMap.get(tbl);
    expect(map.width).toBeGreaterThan(0);
    expect(map.height).toBe(tbl.childCount);
    expect(fixTables(state)).toBeUndefined();
  } catch (err) {
    throw new Error(`${label}: ${(err as Error).message}`);
  }
}

type Op = { name: string; run: (s: EditorState) => EditorState };

/** Picks one random operation applicable to the current state. */
function pickOp(state: EditorState, rand: () => number): Op | null {
  const positions = cellPositions(state.doc);
  if (!positions.length) return null;
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const kind = Math.floor(rand() * 9);
  const cellPos = pick(positions);
  const tablePos = 0;
  const tbl = firstTable(state);
  const map = TableMap.get(tbl);

  switch (kind) {
    case 0:
      return { name: 'addRowAfter', run: (s) => run(cursorIn(s, cellPos), addRowAfter).state };
    case 1:
      return { name: 'addRowBefore', run: (s) => run(cursorIn(s, cellPos), addRowBefore).state };
    case 2:
      return { name: 'addColumnAfter', run: (s) => run(cursorIn(s, cellPos), addColumnAfter).state };
    case 3:
      return { name: 'addColumnBefore', run: (s) => run(cursorIn(s, cellPos), addColumnBefore).state };
    case 4:
      return { name: 'deleteRow', run: (s) => run(cursorIn(s, cellPos), deleteRow).state };
    case 5:
      return { name: 'deleteColumn', run: (s) => run(cursorIn(s, cellPos), deleteColumn).state };
    case 6: {
      const a = pick(positions);
      const b = pick(positions);
      return {
        name: 'mergeCells',
        run: (s) => {
          const sel = cellSelection(s, a, b);
          return run(sel, mergeCells).state;
        },
      };
    }
    case 7:
      return { name: 'splitCell', run: (s) => run(cursorIn(s, cellPos), splitCell).state };
    default: {
      const row = Math.floor(rand() * (map.height + 1));
      const col = Math.floor(rand() * (map.width + 1));
      const choice = Math.floor(rand() * 4);
      const apply = (s: EditorState, fn: (st: EditorState, d: (tr: import('prosemirror-state').Transaction) => void) => boolean) => {
        let next = s;
        fn(s, (tr) => {
          next = next.apply(tr);
        });
        return next;
      };
      const ops = [
        () => apply(state, (st, d) => addRowAtIndex(st, d, tablePos, Math.min(row, tbl.childCount))),
        () => apply(state, (st, d) => addColumnAtIndex(st, d, tablePos, Math.min(col, map.width))),
        () => apply(state, (st, d) => deleteRowAtIndex(st, d, tablePos, Math.min(row, tbl.childCount - 1))),
        () => apply(state, (st, d) => deleteColumnAtIndex(st, d, tablePos, Math.min(col, map.width - 1))),
      ];
      return { name: `index${choice}`, run: () => ops[choice]!() };
    }
  }
}

describe('random table operations never corrupt the grid', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => 1000 + i * 7919);

  for (const seed of seeds) {
    it(`seed ${seed}`, () => {
      const rand = prng(seed);
      let state = stateOf(table(randomGrid(rand)));
      assertConsistent(state, 'initial');
      const history: string[] = [];
      for (let step = 0; step < 40; step++) {
        const op = pickOp(state, rand);
        if (!op) break;
        history.push(op.name);
        try {
          state = op.run(state);
        } catch (err) {
          throw new Error(`seed ${seed} step ${step} ${op.name} threw: ${(err as Error).message}`);
        }
        assertConsistent(state, `seed ${seed} step ${step} after ${history.join(',')}`);
      }
    });
  }
});
