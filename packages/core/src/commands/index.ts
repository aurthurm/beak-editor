/**
 * Commands for BeakBlock.
 *
 * @module
 */

export {
  addRowAfter,
  addRowBefore,
  deleteRow,
  addColumnAfter,
  addColumnBefore,
  deleteColumn,
  deleteTable,
  goToNextCell,
  goToPreviousCell,
  isInTable,
  getTableInfo,
  findTableContext,
  addRowAtIndex,
  addColumnAtIndex,
  deleteRowAtIndex,
  deleteColumnAtIndex,
} from './tableCommands';
export type { TableContext } from './tableCommands';
export {
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
} from './tableOfficeCommands';
export type { BorderEdge, SortDirection } from './tableOfficeCommands';
