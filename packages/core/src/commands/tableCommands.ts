/**
 * Table commands for BeakBlock.
 *
 * Provides commands for manipulating tables: adding/removing rows and columns,
 * navigating between cells, etc.
 *
 * @module
 */

import { EditorState, Transaction, TextSelection } from 'prosemirror-state';
import { Node as PMNode } from 'prosemirror-model';

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
    colCount: row.childCount,
    rowCount: table.childCount,
  };
}

/**
 * Create a new row with the given number of cells.
 */
function createRow(state: EditorState, colCount: number, isHeader = false): PMNode {
  const { schema } = state;
  const cellType = isHeader && schema.nodes.tableHeader
    ? schema.nodes.tableHeader
    : schema.nodes.tableCell;

  const cells: PMNode[] = [];
  for (let i = 0; i < colCount; i++) {
    cells.push(cellType.create(null, schema.nodes.paragraph.create()));
  }
  return schema.nodes.tableRow.create(null, cells);
}

/**
 * Add a row after the current row.
 */
export const addRowAfter: Command = (state, dispatch) => {
  const ctx = findTableContext(state);
  if (!ctx) return false;

  if (dispatch) {
    const { tablePos, rowIndex, colCount, table } = ctx;

    const newRow = createRow(state, colCount);

    // Calculate position after the current row
    let insertPos = tablePos + 1;
    for (let i = 0; i <= rowIndex; i++) {
      insertPos += table.child(i).nodeSize;
    }

    dispatch(state.tr.insert(insertPos, newRow));
  }

  return true;
};

/**
 * Add a row before the current row.
 */
export const addRowBefore: Command = (state, dispatch) => {
  const ctx = findTableContext(state);
  if (!ctx) return false;

  if (dispatch) {
    const { tablePos, rowIndex, colCount, table } = ctx;

    const newRow = createRow(state, colCount);

    // Calculate position before the current row
    let insertPos = tablePos + 1;
    for (let i = 0; i < rowIndex; i++) {
      insertPos += table.child(i).nodeSize;
    }

    dispatch(state.tr.insert(insertPos, newRow));
  }

  return true;
};

/**
 * Delete the current row.
 */
export const deleteRow: Command = (state, dispatch) => {
  const ctx = findTableContext(state);
  if (!ctx) return false;

  // Don't delete if it's the only row
  if (ctx.rowCount <= 1) return false;

  if (dispatch) {
    const { tablePos, rowIndex, table } = ctx;

    // Calculate row position and size
    let rowStart = tablePos + 1;
    for (let i = 0; i < rowIndex; i++) {
      rowStart += table.child(i).nodeSize;
    }
    const rowEnd = rowStart + table.child(rowIndex).nodeSize;

    dispatch(state.tr.delete(rowStart, rowEnd));
  }

  return true;
};

/**
 * Add a column after the current column.
 * Uses replaceWith to rebuild each row with the new cell.
 */
export const addColumnAfter: Command = (state, dispatch) => {
  const ctx = findTableContext(state);
  if (!ctx) return false;

  if (dispatch) {
    const { schema } = state;
    const { tablePos, cellIndex, table } = ctx;

    // Build new rows with an extra cell after cellIndex
    const newRows: PMNode[] = [];
    table.forEach((row) => {
      const cells: PMNode[] = [];
      const isHeaderRow = row.child(0).type.name === 'tableHeader';
      const cellType = isHeaderRow && schema.nodes.tableHeader
        ? schema.nodes.tableHeader
        : schema.nodes.tableCell;

      row.forEach((cell, _offset, index) => {
        cells.push(cell);
        if (index === cellIndex) {
          // Insert new cell after this one
          cells.push(cellType.create(null, schema.nodes.paragraph.create()));
        }
      });

      newRows.push(schema.nodes.tableRow.create(row.attrs, cells));
    });

    // Replace the entire table content
    const newTable = schema.nodes.table.create(table.attrs, newRows);
    const tr = state.tr.replaceWith(tablePos, tablePos + table.nodeSize, newTable);
    dispatch(tr);
  }

  return true;
};

/**
 * Add a column before the current column.
 * Uses replaceWith to rebuild each row with the new cell.
 */
export const addColumnBefore: Command = (state, dispatch) => {
  const ctx = findTableContext(state);
  if (!ctx) return false;

  if (dispatch) {
    const { schema } = state;
    const { tablePos, cellIndex, table } = ctx;

    // Build new rows with an extra cell before cellIndex
    const newRows: PMNode[] = [];
    table.forEach((row) => {
      const cells: PMNode[] = [];
      const isHeaderRow = row.child(0).type.name === 'tableHeader';
      const cellType = isHeaderRow && schema.nodes.tableHeader
        ? schema.nodes.tableHeader
        : schema.nodes.tableCell;

      row.forEach((cell, _offset, index) => {
        if (index === cellIndex) {
          // Insert new cell before this one
          cells.push(cellType.create(null, schema.nodes.paragraph.create()));
        }
        cells.push(cell);
      });

      newRows.push(schema.nodes.tableRow.create(row.attrs, cells));
    });

    // Replace the entire table content
    const newTable = schema.nodes.table.create(table.attrs, newRows);
    const tr = state.tr.replaceWith(tablePos, tablePos + table.nodeSize, newTable);
    dispatch(tr);
  }

  return true;
};

/**
 * Delete the current column.
 * Uses replaceWith to rebuild each row without the cell.
 */
export const deleteColumn: Command = (state, dispatch) => {
  const ctx = findTableContext(state);
  if (!ctx) return false;

  // Don't delete if it's the only column
  if (ctx.colCount <= 1) return false;

  if (dispatch) {
    const { schema } = state;
    const { tablePos, cellIndex, table } = ctx;

    // Build new rows without the cell at cellIndex
    const newRows: PMNode[] = [];
    table.forEach((row) => {
      const cells: PMNode[] = [];

      row.forEach((cell, _offset, index) => {
        if (index !== cellIndex) {
          cells.push(cell);
        }
      });

      newRows.push(schema.nodes.tableRow.create(row.attrs, cells));
    });

    // Replace the entire table content
    const newTable = schema.nodes.table.create(table.attrs, newRows);
    const tr = state.tr.replaceWith(tablePos, tablePos + table.nodeSize, newTable);
    dispatch(tr);
  }

  return true;
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
 * Move to the next cell (or create a new row if at the end).
 * Typically bound to Tab.
 */
export const goToNextCell: Command = (state, dispatch) => {
  const ctx = findTableContext(state);
  if (!ctx) return false;

  const { tablePos, rowIndex, cellIndex, colCount, rowCount, table } = ctx;

  // If at the last cell of the last row, add a new row
  const isLastCell = cellIndex === colCount - 1;
  const isLastRow = rowIndex === rowCount - 1;

  if (dispatch) {
    let tr = state.tr;

    if (isLastCell && isLastRow) {
      // Create a new row
      const newRow = createRow(state, colCount);

      // Insert at the end of the table (before closing tag)
      const insertPos = tablePos + table.nodeSize - 1;
      tr = tr.insert(insertPos, newRow);

      // Move selection to first cell of new row
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 3)));
    } else {
      // Move to next cell
      let nextRow = rowIndex;
      let nextCell = cellIndex + 1;

      if (isLastCell) {
        nextRow++;
        nextCell = 0;
      }

      // Calculate position of next cell
      let targetPos = tablePos + 1;
      for (let r = 0; r < nextRow; r++) {
        targetPos += table.child(r).nodeSize;
      }
      targetPos += 1; // Row start

      const targetRow = table.child(nextRow);
      for (let c = 0; c < nextCell; c++) {
        targetPos += targetRow.child(c).nodeSize;
      }
      targetPos += 2; // Cell start + paragraph start

      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(targetPos)));
    }

    dispatch(tr);
  }

  return true;
};

/**
 * Move to the previous cell.
 * Typically bound to Shift+Tab.
 */
export const goToPreviousCell: Command = (state, dispatch) => {
  const ctx = findTableContext(state);
  if (!ctx) return false;

  const { tablePos, rowIndex, cellIndex, colCount, table } = ctx;

  // If at the first cell, do nothing
  if (rowIndex === 0 && cellIndex === 0) return false;

  if (dispatch) {
    let prevRow = rowIndex;
    let prevCell = cellIndex - 1;

    if (cellIndex === 0) {
      prevRow--;
      prevCell = colCount - 1;
    }

    // Calculate position of previous cell
    let targetPos = tablePos + 1;
    for (let r = 0; r < prevRow; r++) {
      targetPos += table.child(r).nodeSize;
    }
    targetPos += 1; // Row start

    const targetRow = table.child(prevRow);
    for (let c = 0; c < prevCell; c++) {
      targetPos += targetRow.child(c).nodeSize;
    }
    targetPos += 2; // Cell start + paragraph start

    const tr = state.tr.setSelection(TextSelection.near(state.doc.resolve(targetPos)));
    dispatch(tr);
  }

  return true;
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
 * Add a row at a specific index.
 */
export function addRowAtIndex(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  tablePos: number,
  rowIndex: number
): boolean {
  const table = state.doc.nodeAt(tablePos);
  if (!table || table.type.name !== 'table') return false;

  if (dispatch) {
    const colCount = table.child(0).childCount;
    const { schema } = state;

    const cells: PMNode[] = [];
    for (let i = 0; i < colCount; i++) {
      cells.push(schema.nodes.tableCell.create(null, schema.nodes.paragraph.create()));
    }
    const newRow = schema.nodes.tableRow.create(null, cells);

    // Calculate insert position
    let insertPos = tablePos + 1;
    for (let i = 0; i < rowIndex; i++) {
      insertPos += table.child(i).nodeSize;
    }

    dispatch(state.tr.insert(insertPos, newRow));
  }

  return true;
}

/**
 * Add a column at a specific index.
 */
export function addColumnAtIndex(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  tablePos: number,
  colIndex: number
): boolean {
  const table = state.doc.nodeAt(tablePos);
  if (!table || table.type.name !== 'table') return false;

  if (dispatch) {
    const { schema } = state;

    const newRows: PMNode[] = [];
    table.forEach((row) => {
      const cells: PMNode[] = [];

      // Determine cell type based on first cell in this row
      const firstCell = row.childCount > 0 ? row.child(0) : null;
      const isHeaderRow = firstCell?.type.name === 'tableHeader';
      const cellType = isHeaderRow && schema.nodes.tableHeader
        ? schema.nodes.tableHeader
        : schema.nodes.tableCell;

      // Create a new empty cell
      const createNewCell = () => {
        const newCell = cellType.createAndFill();
        if (newCell) return newCell;
        // Fallback
        return cellType.create(null, schema.nodes.paragraph.create());
      };

      row.forEach((cell, _offset, index) => {
        if (index === colIndex) {
          cells.push(createNewCell());
        }
        cells.push(cell);
      });

      // If colIndex is at or past the end
      if (colIndex >= row.childCount) {
        cells.push(createNewCell());
      }

      newRows.push(schema.nodes.tableRow.create(row.attrs, cells));
    });

    const newTable = schema.nodes.table.create(table.attrs, newRows);
    dispatch(state.tr.replaceWith(tablePos, tablePos + table.nodeSize, newTable));
  }

  return true;
}

/**
 * Delete a row at a specific index.
 */
export function deleteRowAtIndex(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  tablePos: number,
  rowIndex: number
): boolean {
  const table = state.doc.nodeAt(tablePos);
  if (!table || table.type.name !== 'table') return false;
  if (table.childCount <= 1) return false;

  if (dispatch) {
    let rowStart = tablePos + 1;
    for (let i = 0; i < rowIndex; i++) {
      rowStart += table.child(i).nodeSize;
    }
    const rowEnd = rowStart + table.child(rowIndex).nodeSize;

    dispatch(state.tr.delete(rowStart, rowEnd));
  }

  return true;
}

/**
 * Delete a column at a specific index.
 */
export function deleteColumnAtIndex(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  tablePos: number,
  colIndex: number
): boolean {
  const table = state.doc.nodeAt(tablePos);
  if (!table || table.type.name !== 'table') return false;
  if (table.child(0).childCount <= 1) return false;

  if (dispatch) {
    const { schema } = state;

    const newRows: PMNode[] = [];
    table.forEach((row) => {
      const cells: PMNode[] = [];

      row.forEach((cell, _offset, index) => {
        if (index !== colIndex) {
          cells.push(cell);
        }
      });

      newRows.push(schema.nodes.tableRow.create(row.attrs, cells));
    });

    const newTable = schema.nodes.table.create(table.attrs, newRows);
    dispatch(state.tr.replaceWith(tablePos, tablePos + table.nodeSize, newTable));
  }

  return true;
}
