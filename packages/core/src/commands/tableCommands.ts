/**
 * Table commands for BeakBlock.
 *
 * Structural editing (rows, columns, merge, split, cell navigation) is backed
 * by prosemirror-tables so rowspan and colspan stay consistent. The exported
 * names and signatures predate the Office-class tables and are kept stable for
 * the React and Vue table components.
 *
 * @module
 */

import { EditorState, TextSelection, Transaction } from 'prosemirror-state';
import { Node as PMNode } from 'prosemirror-model';
import {
  TableMap,
  fixTables,
  addRowAfter as pmAddRowAfter,
  addRowBefore as pmAddRowBefore,
  addColumnAfter as pmAddColumnAfter,
  addColumnBefore as pmAddColumnBefore,
  deleteRow as pmDeleteRow,
  deleteColumn as pmDeleteColumn,
  goToNextCell as pmGoToNextCell,
  addRow,
  addColumn,
  removeRow,
  removeColumn,
} from 'prosemirror-tables';

/**
 * Command function type
 */
type Command = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void
) => boolean;

/**
 * Find the table, row, and cell at the current selection.
 * Returns null if not inside a table.
 */
export interface TableContext {
  table: PMNode;
  tablePos: number;
  row: PMNode;
  rowPos: number;
  rowIndex: number;
  cell: PMNode;
  cellPos: number;
  cellIndex: number;
  colCount: number;
  rowCount: number;
}

export function findTableContext(state: EditorState): TableContext | null {
  const { $from } = state.selection;

  // Walk up the tree to find table, row, and cell
  let cell: PMNode | null = null;
  let cellPos = -1;
  let row: PMNode | null = null;
  let rowPos = -1;
  let table: PMNode | null = null;
  let tablePos = -1;

  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    const pos = $from.before(depth);

    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      cell = node;
      cellPos = pos;
    } else if (node.type.name === 'tableRow') {
      row = node;
      rowPos = pos;
    } else if (node.type.name === 'table') {
      table = node;
      tablePos = pos;
      break;
    }
  }

  if (!table || !row || !cell) return null;

  // Calculate indices
  let rowIndex = 0;
  let cellIndex = 0;

  table.forEach((_r, offset) => {
    if (tablePos + 1 + offset < rowPos) {
      rowIndex++;
    }
  });

  row.forEach((_c, offset) => {
    if (rowPos + 1 + offset < cellPos) {
      cellIndex++;
    }
  });

  return {
    table,
    tablePos,
    row,
    rowPos,
    rowIndex,
    cell,
    cellPos,
    cellIndex,
    colCount: TableMap.get(table).width,
    rowCount: table.childCount,
  };
}

/**
 * Appends prosemirror-tables' table repairs to `tr`. Column widths are brought back in step with
 * colspan (and missing cells are filled), so no command leaves a table with a `colwidth` array
 * shorter than `colspan`.
 */
export function repairTableTransaction(state: EditorState, tr: Transaction): Transaction {
  // A plugin-free state over the transaction's doc, so the steps line up with `tr`.
  const fix = fixTables(EditorState.create({ doc: tr.doc, schema: state.schema }));
  if (fix) for (const step of fix.steps) tr.step(step);
  return tr;
}

/** Wraps a dispatch so that every transaction is passed through {@link repairTableTransaction}. */
export function repairingDispatch(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined
): ((tr: Transaction) => void) | undefined {
  return dispatch && ((tr) => dispatch(repairTableTransaction(state, tr)));
}

/**
 * Add a row after the current row.
 */
export const addRowAfter: Command = (state, dispatch) => {
  if (!findTableContext(state)) return false;
  return pmAddRowAfter(state, repairingDispatch(state, dispatch));
};

/**
 * Add a row before the current row.
 */
export const addRowBefore: Command = (state, dispatch) => {
  if (!findTableContext(state)) return false;
  return pmAddRowBefore(state, repairingDispatch(state, dispatch));
};

/**
 * Delete the current row(s). Refuses to delete the only row.
 */
export const deleteRow: Command = (state, dispatch) => {
  const ctx = findTableContext(state);
  if (!ctx || ctx.rowCount <= 1) return false;
  return pmDeleteRow(state, repairingDispatch(state, dispatch));
};

/**
 * Add a column after the current column.
 */
export const addColumnAfter: Command = (state, dispatch) => {
  if (!findTableContext(state)) return false;
  return pmAddColumnAfter(state, repairingDispatch(state, dispatch));
};

/**
 * Add a column before the current column.
 */
export const addColumnBefore: Command = (state, dispatch) => {
  if (!findTableContext(state)) return false;
  return pmAddColumnBefore(state, repairingDispatch(state, dispatch));
};

/**
 * Delete the current column(s). Refuses to delete the only column.
 */
export const deleteColumn: Command = (state, dispatch) => {
  const ctx = findTableContext(state);
  if (!ctx || ctx.colCount <= 1) return false;
  return pmDeleteColumn(state, repairingDispatch(state, dispatch));
};

/**
 * Delete the entire table.
 */
export const deleteTable: Command = (state, dispatch) => {
  const ctx = findTableContext(state);
  if (!ctx) return false;

  if (dispatch) {
    const { tablePos, table } = ctx;
    dispatch(state.tr.delete(tablePos, tablePos + table.nodeSize));
  }

  return true;
};

/**
 * Move to the next cell. In the last cell of the table a new row is appended
 * and the cursor moves into its first cell. Typically bound to Tab.
 */
export const goToNextCell: Command = (state, dispatch) => {
  const ctx = findTableContext(state);
  if (!ctx) return false;
  if (pmGoToNextCell(1)(state)) return pmGoToNextCell(1)(state, dispatch);

  // Last cell of the table: append a row, then move into its first cell.
  if (!dispatch) return true;
  const holder: { tr?: Transaction } = {};
  pmAddRowAfter(state, (tr) => {
    holder.tr = tr;
  });
  if (!holder.tr) return false;
  const tr = holder.tr;
  // The new row is last in the table: its first cell's paragraph starts at
  // table end - 1 (row open) + 2 (cell open, paragraph open). Computed from
  // positions because appendTransaction plugins may replace the state's doc.
  const insertPos = ctx.tablePos + ctx.table.nodeSize - 1;
  tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 3)));
  dispatch(tr);
  return true;
};

/**
 * Move to the previous cell. Typically bound to Shift+Tab.
 */
export const goToPreviousCell: Command = (state, dispatch) => {
  if (!findTableContext(state)) return false;
  return pmGoToNextCell(-1)(state, dispatch);
};

/**
 * Check if the selection is inside a table.
 */
export function isInTable(state: EditorState): boolean {
  return findTableContext(state) !== null;
}

/**
 * Get information about the current table context.
 */
export function getTableInfo(state: EditorState): {
  rowIndex: number;
  cellIndex: number;
  rowCount: number;
  colCount: number;
} | null {
  const ctx = findTableContext(state);
  if (!ctx) return null;

  return {
    rowIndex: ctx.rowIndex,
    cellIndex: ctx.cellIndex,
    rowCount: ctx.rowCount,
    colCount: ctx.colCount,
  };
}

/**
 * Returns the table node at `tablePos`, or null when it is not a table.
 */
function tableAt(state: EditorState, tablePos: number): PMNode | null {
  const table = state.doc.nodeAt(tablePos);
  return table && table.type.name === 'table' ? table : null;
}

/**
 * Builds the rect argument prosemirror-tables' row/column helpers expect.
 * The helpers only read `map`, `table` and `tableStart`; the bounds are
 * filled in for the full table.
 */
function fullTableRect(table: PMNode, tablePos: number) {
  const map = TableMap.get(table);
  return { map, table, tableStart: tablePos + 1, left: 0, top: 0, right: map.width, bottom: map.height };
}

/**
 * Add a row before row `rowIndex` (`rowIndex === rowCount` appends).
 * Span-aware: uses prosemirror-tables' row insertion.
 */
export function addRowAtIndex(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  tablePos: number,
  rowIndex: number
): boolean {
  const table = tableAt(state, tablePos);
  if (!table || rowIndex < 0 || rowIndex > table.childCount) return false;

  if (dispatch) {
    const tr = state.tr;
    addRow(tr, fullTableRect(table, tablePos), rowIndex);
    dispatch(repairTableTransaction(state, tr));
  }

  return true;
}

/**
 * Add a column before column `colIndex` (`colIndex === colCount` appends).
 */
export function addColumnAtIndex(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  tablePos: number,
  colIndex: number
): boolean {
  const table = tableAt(state, tablePos);
  if (!table) return false;
  const map = TableMap.get(table);
  if (colIndex < 0 || colIndex > map.width) return false;

  if (dispatch) {
    const tr = state.tr;
    addColumn(tr, fullTableRect(table, tablePos), colIndex);
    dispatch(repairTableTransaction(state, tr));
  }

  return true;
}

/**
 * Delete row `rowIndex`. Refuses to delete the only row.
 */
export function deleteRowAtIndex(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  tablePos: number,
  rowIndex: number
): boolean {
  const table = tableAt(state, tablePos);
  if (!table || table.childCount <= 1) return false;
  if (rowIndex < 0 || rowIndex >= table.childCount) return false;

  if (dispatch) {
    const tr = state.tr;
    removeRow(tr, fullTableRect(table, tablePos), rowIndex);
    dispatch(repairTableTransaction(state, tr));
  }

  return true;
}

/**
 * Delete column `colIndex`. Refuses to delete the only column.
 */
export function deleteColumnAtIndex(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  tablePos: number,
  colIndex: number
): boolean {
  const table = tableAt(state, tablePos);
  if (!table) return false;
  const map = TableMap.get(table);
  if (map.width <= 1 || colIndex < 0 || colIndex >= map.width) return false;

  if (dispatch) {
    const tr = state.tr;
    removeColumn(tr, fullTableRect(table, tablePos), colIndex);
    dispatch(repairTableTransaction(state, tr));
  }

  return true;
}
