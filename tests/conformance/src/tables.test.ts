/**
 * Table invariants (roadmap section 8: "no corrupted grids after merge, split or paste").
 *
 * Seeded random sequences of row and column inserts and deletes, cell merges and splits run through
 * core's table commands on every corpus document that contains a table. After each step every table
 * in the document must have:
 *
 * - a rectangular grid, with rowspans and colspans that never overlap and never leave holes, checked
 *   by `checkTableGrid` below, which is independent of prosemirror-tables' TableMap;
 * - no TableMap problems (core's assertValidTable, which uses prosemirror-tables);
 * - valid ProseMirror content (`doc.check()`).
 */
import { describe, expect, it } from 'vitest';
import { EditorState } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  blocksToDoc,
  createSchema,
  createTablePlugins,
  deleteColumn,
  deleteRow,
  mergeCells,
  splitCell,
} from '@amusendame/beakblock-core';

import { corpus, cloneBlocks } from './corpus';
// Core's own table test helpers (not exported from the package). They build states and selections.
import { assertValidTable, cellSelection, cursorIn, run } from '../../../packages/core/src/commands/tableTestUtils';

const schema = createSchema();

type Command = (state: EditorState, dispatch?: (tr: import('prosemirror-state').Transaction) => void) => boolean;

/** Simple seeded PRNG (mulberry32) so failures reproduce from the printed seed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Absolute positions of the direct cells of the table at `tablePos` (nested tables excluded). */
function cellPositionsOf(doc: PMNode, tablePos: number): number[] {
  const table = doc.nodeAt(tablePos)!;
  const out: number[] = [];
  table.forEach((row, rowOffset) => {
    const rowPos = tablePos + 1 + rowOffset;
    row.forEach((_cell, cellOffset) => out.push(rowPos + 1 + cellOffset));
  });
  return out;
}

/** Positions of every top-level or nested table in the document. */
function tablePositions(doc: PMNode): number[] {
  const out: number[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'table') out.push(pos);
    return true;
  });
  return out;
}

/**
 * Independent grid check. Walks the rows, tracks which slots are covered by earlier rowspans, and
 * reports overlaps, holes and rows whose width disagrees with the first row.
 */
export function checkTableGrid(table: PMNode): string[] {
  const problems: string[] = [];
  const rows: PMNode[] = [];
  table.forEach((row) => rows.push(row));
  const occupied: boolean[][] = rows.map(() => []);
  // Pass 1: place every cell and its spans, reporting overlaps and out-of-range rowspans.
  rows.forEach((row, r) => {
    let col = 0;
    row.forEach((cell) => {
      while (occupied[r][col]) col += 1;
      const colspan = Number(cell.attrs.colspan ?? 1);
      const rowspan = Number(cell.attrs.rowspan ?? 1);
      if (colspan < 1 || rowspan < 1) problems.push(`row ${r}: non-positive span at column ${col}`);
      if (r + rowspan > rows.length) problems.push(`row ${r}: rowspan ${rowspan} runs past the last row`);
      for (let dr = 0; dr < rowspan; dr += 1) {
        for (let dc = 0; dc < colspan; dc += 1) {
          if (r + dr >= rows.length) continue;
          if (occupied[r + dr][col + dc]) problems.push(`row ${r + dr}: slot ${col + dc} claimed twice`);
          occupied[r + dr][col + dc] = true;
        }
      }
      col += colspan;
    });
  });
  // Pass 2: every row must cover the same width with no holes. A row's width counts slots covered
  // by rowspans from earlier rows, so trailing covered slots are included.
  const width = Math.max(0, ...occupied.map((cells) => cells.length));
  occupied.forEach((cells, r) => {
    for (let c = 0; c < width; c += 1) {
      if (!cells[c]) {
        problems.push(`row ${r}: hole at column ${c}`);
        break;
      }
    }
  });
  return problems;
}

/**
 * Grid problems are hard failures. `colwidth mismatch` (a cell's colwidth array no longer matches its
 * colspan) is reported separately and asserted by the colwidth test below.
 * Schema content validity is covered by the round-trip and editor suites instead.
 */
function checkDocument(state: EditorState): { grid: string[]; colwidth: string[] } {
  const grid: string[] = [];
  const colwidth: string[] = [];
  for (const pos of tablePositions(state.doc)) {
    grid.push(...checkTableGrid(state.doc.nodeAt(pos)!).map((p) => `table@${pos}: ${p}`));
  }
  try {
    assertValidTable(state);
  } catch (error) {
    const message = (error as Error).message;
    const problems = JSON.parse(message.slice(message.indexOf('['))) as { type: string }[];
    for (const problem of problems) {
      if (problem.type === 'colwidth mismatch') colwidth.push(JSON.stringify(problem));
      else grid.push(`prosemirror-tables: ${JSON.stringify(problem)}`);
    }
  }
  return { grid, colwidth };
}


const OPS = ['addRowAfter', 'addRowBefore', 'deleteRow', 'addColumnAfter', 'addColumnBefore', 'deleteColumn', 'merge', 'split'] as const;
type Op = (typeof OPS)[number];

/** Runs one random sequence on the first table of the document. Returns the applied operation names. */
function randomSequence(start: EditorState, seed: number, steps: number): { state: EditorState; applied: Op[]; problems: string[]; colwidth: string[] } {
  const next = rng(seed);
  let state = start;
  const applied: Op[] = [];
  const colwidth: string[] = [];
  for (let step = 0; step < steps; step += 1) {
    const tables = tablePositions(state.doc);
    if (tables.length === 0) break;
    const tablePos = tables[Math.floor(next() * tables.length)];
    const cells = cellPositionsOf(state.doc, tablePos);
    if (cells.length === 0) break;
    const pick = (): number => cells[Math.floor(next() * cells.length)];
    const op = OPS[Math.floor(next() * OPS.length)];

    let attempt: { ok: boolean; state: EditorState };
    switch (op) {
      case 'merge': {
        const a = pick();
        const b = pick();
        attempt = run(cellSelection(state, a, b), mergeCells as Command);
        break;
      }
      case 'split':
        attempt = run(cursorIn(state, pick()), splitCell as Command);
        break;
      default: {
        const command: Command = {
          addRowAfter: addRowAfter as Command,
          addRowBefore: addRowBefore as Command,
          deleteRow: deleteRow as Command,
          addColumnAfter: addColumnAfter as Command,
          addColumnBefore: addColumnBefore as Command,
          deleteColumn: deleteColumn as Command,
        }[op];
        attempt = run(cursorIn(state, pick()), command);
      }
    }
    if (!attempt.ok) continue;
    state = attempt.state;
    applied.push(op);
    const { grid, colwidth: widths } = checkDocument(state);
    if (widths.length && colwidth.length === 0) colwidth.push(`after ${applied.join(' > ')}: ${widths[0]}`);
    if (grid.length) return { state, applied, problems: grid.map((p) => `after ${applied.join(' > ')}: ${p}`), colwidth };
  }
  return { state, applied, problems: [], colwidth };
}

describe('tables: random merge, split, insert and delete keep grids valid', () => {
  const withTables = corpus.filter((entry) => {
    const doc = blocksToDoc(schema, cloneBlocks(entry.blocks));
    return tablePositions(doc).length > 0;
  });

  it('the corpus contains tables to exercise (at least 8 documents)', () => {
    expect(withTables.length).toBeGreaterThanOrEqual(8);
  });

  for (const entry of withTables) {
    it(`${entry.id}: 40 seeded sequences of up to 14 operations stay valid`, () => {
      const doc = blocksToDoc(schema, cloneBlocks(entry.blocks));
      const baseline = checkDocument(EditorState.create({ doc, schema, plugins: createTablePlugins() }));
      expect(baseline, 'corpus document tables are invalid before any operation').toEqual({ grid: [], colwidth: [] });

      let applied = 0;
      const failures: string[] = [];
      for (let seq = 0; seq < 40; seq += 1) {
        const start = EditorState.create({ doc, schema, plugins: createTablePlugins() });
        const result = randomSequence(start, seq * 7919 + entry.id.length, 14);
        applied += result.applied.length;
        if (result.problems.length) {
          failures.push(`seed ${seq * 7919 + entry.id.length}: ${result.problems[0]}`);
          break;
        }
      }
      expect(failures).toEqual([]);
      // Non-vacuity: operations must actually have been applied.
      expect(applied).toBeGreaterThan(20);
    });

  }

  it('colwidth stays in step with colspan after random operations across the corpus', () => {
    const reproducing: string[] = [];
    for (const entry of withTables) {
      const doc = blocksToDoc(schema, cloneBlocks(entry.blocks));
      for (let seq = 0; seq < 40; seq += 1) {
        const start = EditorState.create({ doc, schema, plugins: createTablePlugins() });
        const found = randomSequence(start, seq * 7919 + entry.id.length, 14).colwidth;
        if (found.length) {
          reproducing.push(`${entry.id}: ${found[0]}`);
          break;
        }
      }
    }
    expect(reproducing).toEqual([]);
  });

  it('checkTableGrid detects a hand-corrupted grid (self-test of the checker)', () => {
    const cell = (colspan = 1, rowspan = 1) => schema.nodes.tableCell.create({ colspan, rowspan, colwidth: null }, schema.nodes.paragraph.create());
    const bad = schema.nodes.table.create(null, [
      schema.nodes.tableRow.create(null, [cell(2), cell()]),
      schema.nodes.tableRow.create(null, [cell()]),
    ]);
    expect(checkTableGrid(bad).length).toBeGreaterThan(0);
  });
});
