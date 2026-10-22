/**
 * Property test: after random merge, split, insert and delete commands, every cell's `colwidth`
 * is either unset or has exactly one entry per column it spans (`colspan`).
 *
 * @module
 */

import { describe, expect, it } from 'vitest';
import { EditorState } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { TableMap, fixTables } from 'prosemirror-tables';
import { addColumnAfter, addRowAfter, addRowBefore, addColumnBefore, deleteColumn, deleteRow, mergeCells, splitCell } from '../index';
import { cellPositions, cellSelection, cursorIn, firstTable, run, schema, stateOf } from './tableTestUtils';

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

/** Cells whose colwidth length does not match colspan, plus TableMap's own colwidth reports. */
function colwidthMismatches(state: EditorState): string[] {
  const problems: string[] = [];
  for (const problem of TableMap.get(firstTable(state)).problems ?? []) {
    if (problem.type === 'colwidth mismatch') problems.push(`TableMap: ${JSON.stringify(problem)}`);
  }
  firstTable(state).forEach((row, _offset, rowIndex) => {
    row.forEach((cellNode) => {
      const colwidth = cellNode.attrs.colwidth as number[] | null;
      const colspan = Number(cellNode.attrs.colspan ?? 1);
      if (colwidth && colwidth.length !== colspan) {
        problems.push(`row ${rowIndex}: colspan ${colspan} with colwidth [${colwidth.join(', ')}]`);
      }
    });
  });
  return problems;
}

/** One line per row: colspan x rowspan [colwidth]. Used in failure messages. */
function describeTable(state: EditorState): string {
  const rows: string[] = [];
  firstTable(state).forEach((row) => {
    rows.push(row.content.content.map((c) => `${c.attrs.colspan}x${c.attrs.rowspan}[${(c.attrs.colwidth ?? 'null').toString()}]`).join(' '));
  });
  return rows.join('\n');
}

type Step = { name: string; apply: (state: EditorState, rand: () => number) => EditorState };

const STEPS: Step[] = [
  { name: 'addRowAfter', apply: (s, r) => run(cursorIn(s, pick(s, r)), addRowAfter).state },
  { name: 'addRowBefore', apply: (s, r) => run(cursorIn(s, pick(s, r)), addRowBefore).state },
  { name: 'addColumnAfter', apply: (s, r) => run(cursorIn(s, pick(s, r)), addColumnAfter).state },
  { name: 'addColumnBefore', apply: (s, r) => run(cursorIn(s, pick(s, r)), addColumnBefore).state },
  { name: 'deleteRow', apply: (s, r) => run(cursorIn(s, pick(s, r)), deleteRow).state },
  { name: 'deleteColumn', apply: (s, r) => run(cursorIn(s, pick(s, r)), deleteColumn).state },
  { name: 'mergeCells', apply: (s, r) => run(cellSelection(s, pick(s, r), pick(s, r)), mergeCells).state },
  { name: 'splitCell', apply: (s, r) => run(cursorIn(s, pick(s, r)), splitCell).state },
];

function pick(state: EditorState, rand: () => number): number {
  const positions = cellPositions(state.doc);
  return positions[Math.floor(rand() * positions.length)]!;
}

/** Table whose cells carry column widths, as office tables do, so resizing paths are exercised. */
function gridWithWidths(rand: () => number): PMNode {
  const rows = 2 + Math.floor(rand() * 3);
  const cols = 2 + Math.floor(rand() * 3);
  // One width per column, as in a real table grid.
  const widths = Array.from({ length: cols }, () => 50 + Math.floor(rand() * 200));
  const tableRows = Array.from({ length: rows }, (_, r) =>
    schema.nodes.tableRow.create(
      null,
      Array.from({ length: cols }, (_, c) =>
        schema.nodes.tableCell.create(
          { colwidth: [widths[c]!] },
          schema.nodes.paragraph.create(null, schema.text(`${r}${c}`))
        )
      )
    )
  );
  return schema.nodes.table.create(null, tableRows);
}

describe('table colwidth stays in step with colspan', () => {
  for (let seed = 1; seed <= 60; seed++) {
    it(`seed ${seed}: random merge, split, insert and delete keep colwidth length equal to colspan`, () => {
      const rand = prng(seed * 7919);
      let state = stateOf(gridWithWidths(rand));
      expect(colwidthMismatches(state)).toEqual([]);
      const history: string[] = [];
      for (let step = 0; step < 14; step++) {
        const choice = STEPS[Math.floor(rand() * STEPS.length)]!;
        history.push(choice.name);
        state = choice.apply(state, rand);
        const problems = colwidthMismatches(state);
        expect(problems, `after ${history.join(' > ')}\n${describeTable(state)}\nfixable: ${Boolean(fixTables(state))}`).toEqual([]);
      }
    });
  }
});
