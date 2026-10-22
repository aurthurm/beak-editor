/**
 * Shared helpers for table command tests (not exported from the package).
 *
 * @module
 */

import { EditorState, TextSelection, Transaction } from 'prosemirror-state';
import { Node as PMNode } from 'prosemirror-model';
import { CellSelection, TableMap, tableEditing } from 'prosemirror-tables';
import { createSchema } from '../schema';

export const schema = createSchema();

/** Builds a paragraph-filled cell. */
export function cell(text = '', attrs: Record<string, unknown> = {}): PMNode {
  const para = schema.nodes.paragraph.create(null, text ? schema.text(text) : null);
  return schema.nodes.tableCell.create({ ...attrs }, para);
}

/** Builds a table from a grid of text (`''` for an empty cell). */
export function table(grid: string[][], attrs: Record<string, unknown> = {}): PMNode {
  const rows = grid.map((r) => schema.nodes.tableRow.create(null, r.map((t) => cell(t))));
  return schema.nodes.table.create(attrs, rows);
}

/** Creates an editor state whose doc is the given table. */
export function stateOf(tbl: PMNode): EditorState {
  const doc = schema.nodes.doc.create(null, [tbl]);
  // tableEditing repairs rows covered by rowspans after structural commands.
  return EditorState.create({ doc, schema, plugins: [tableEditing()] });
}

/** Absolute positions (before each cell) in document order. */
export function cellPositions(doc: PMNode): number[] {
  const out: number[] = [];
  doc.descendants((node, pos) => {
    if (node.type.spec.tableRole === 'cell' || node.type.spec.tableRole === 'header_cell') out.push(pos);
    return true;
  });
  return out;
}

/** Cursor placed inside the cell at `cellPos`. */
export function cursorIn(state: EditorState, cellPos: number): EditorState {
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, cellPos + 2)));
}

/** Cell selection between two cell positions. */
export function cellSelection(state: EditorState, a: number, b: number): EditorState {
  return state.apply(state.tr.setSelection(CellSelection.create(state.doc, a, b)));
}

/** Runs a command, returning whether it applied and the resulting state. */
export function run(
  state: EditorState,
  cmd: (s: EditorState, d?: (tr: Transaction) => void) => boolean
): { ok: boolean; state: EditorState } {
  let next = state;
  const ok = cmd(state, (tr) => {
    next = next.apply(tr);
  });
  return { ok, state: next };
}

/** The first table node in the doc. */
export function firstTable(state: EditorState): PMNode {
  let found: PMNode | null = null;
  state.doc.descendants((node) => {
    if (!found && node.type.name === 'table') found = node;
    return !found;
  });
  if (!found) throw new Error('no table');
  return found;
}

/** Text grid of the first table, using the grid map (spans repeat their text). */
export function textGrid(state: EditorState): string[][] {
  const tbl = firstTable(state);
  const map = TableMap.get(tbl);
  const start = findTableStart(state);
  const out: string[][] = [];
  for (let r = 0; r < map.height; r++) {
    const row: string[] = [];
    for (let c = 0; c < map.width; c++) {
      const rel = map.map[r * map.width + c]!;
      row.push(tbl.nodeAt(rel)!.textContent);
      void start;
    }
    out.push(row);
  }
  return out;
}

/** Absolute position of the first table's start (inside the table node). */
export function findTableStart(state: EditorState): number {
  let start = -1;
  state.doc.descendants((node, pos) => {
    if (start < 0 && node.type.name === 'table') start = pos + 1;
    return start < 0;
  });
  return start;
}

/** Throws unless the table map of `state`'s first table is consistent. */
export function assertValidTable(state: EditorState): void {
  const tbl = firstTable(state);
  const map = TableMap.get(tbl);
  if (map.problems && map.problems.length) {
    throw new Error(`table map problems: ${JSON.stringify(map.problems)}`);
  }
}
