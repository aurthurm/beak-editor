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
