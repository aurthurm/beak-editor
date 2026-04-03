/**
 * TableHandles - React component for table row/column manipulation.
 *
 * Renders handles on hover to add/remove rows and columns, similar to BlockNote.
 * - Row handle appears on the left of rows
 * - Column handle appears on top of columns
 * - "+" buttons at the end to add new rows/columns
 *
 * @example
 * ```tsx
 * import { useBeakBlock, BeakBlockView, TableHandles } from '@beakblock/react';
 *
 * function MyEditor() {
 *   const editor = useBeakBlock();
 *
 *   return (
 *     <BeakBlockView editor={editor}>
 *       <TableHandles editor={editor} />
 *     </BeakBlockView>
 *   );
 * }
 * ```
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  BeakBlockEditor,
  addRowAtIndex,
  addColumnAtIndex,
  deleteRowAtIndex,
  deleteColumnAtIndex,
} from '@labbs/beakblock-core';

/**
 * Props for TableHandles component.
 */
export interface TableHandlesProps {
  /**
   * The BeakBlockEditor instance (can be null during initialization).
   */
  editor: BeakBlockEditor | null;

  /**
   * Additional class name for the handles container.
   */
  className?: string;
}

interface TableState {
  tablePos: number;
  tableElement: HTMLElement;
  rowCount: number;
  colCount: number;
  rows: { element: HTMLElement; top: number; height: number }[];
  cols: { element: HTMLElement; left: number; width: number }[];
}

interface HoverState {
  type: 'row' | 'col' | null;
  index: number;
}

/**
 * Find table info from DOM and editor state.
 */
function getTableState(
  editor: BeakBlockEditor,
  tableElement: HTMLElement
): TableState | null {
  // Find table position in document
  const view = editor.pm.view;
  let tablePos = -1;

  view.state.doc.descendants((node, pos) => {
    if (node.type.name === 'table' && tablePos === -1) {
      const domNode = view.nodeDOM(pos);
      if (domNode === tableElement || tableElement.contains(domNode as Node)) {
        tablePos = pos;
        return false;
      }
    }
    return true;
  });

  if (tablePos === -1) return null;

  const table = view.state.doc.nodeAt(tablePos);
  if (!table || table.type.name !== 'table') return null;

  // Get row elements and their positions
  const rowElements = tableElement.querySelectorAll(':scope > tr, :scope > tbody > tr, :scope > thead > tr');
  const rows: { element: HTMLElement; top: number; height: number }[] = [];
  const tableRect = tableElement.getBoundingClientRect();

  rowElements.forEach((row) => {
    const rect = row.getBoundingClientRect();
    rows.push({
      element: row as HTMLElement,
      top: rect.top - tableRect.top,
      height: rect.height,
    });
  });

  // Get column positions from first row cells
  const cols: { element: HTMLElement; left: number; width: number }[] = [];
  if (rowElements.length > 0) {
    const firstRowCells = rowElements[0].querySelectorAll(':scope > td, :scope > th');
    firstRowCells.forEach((cell) => {
      const rect = cell.getBoundingClientRect();
      cols.push({
        element: cell as HTMLElement,
        left: rect.left - tableRect.left,
        width: rect.width,
      });
    });
  }

  return {
    tablePos,
    tableElement,
    rowCount: table.childCount,
    colCount: cols.length,
    rows,
    cols,
  };
}

/**
 * TableHandles component.
 *
 * Renders row/column handles when hovering over a table.
 */
export function TableHandles({
  editor,
  className,
}: TableHandlesProps): React.ReactElement | null {
  const [tableState, setTableState] = useState<TableState | null>(null);
  const [hoverState, setHoverState] = useState<HoverState>({ type: null, index: -1 });
  const [showRowMenu, setShowRowMenu] = useState<number | null>(null);
  const [showColMenu, setShowColMenu] = useState<number | null>(null);
  // Store fixed menu position when menu opens to prevent jumping on re-render
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track mouse position to detect which row/col is hovered
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    let hideTimeout: ReturnType<typeof setTimeout> | null = null;

    const clearHideTimeout = () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
    };

    const scheduleHide = () => {
      clearHideTimeout();
      hideTimeout = setTimeout(() => {
        setTableState(null);
        setHoverState({ type: null, index: -1 });
      }, 100);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if we're over the handles container - keep visible
      if (containerRef.current?.contains(target)) {
        clearHideTimeout();
        return;
      }

      // Find if we're over a table
      const tableElement = target.closest('table');
      if (!tableElement) {
        // Not over a table, but check if we have a current table state
        // and mouse is near the table (in the handle zone)
        if (tableState) {
          const tableRect = tableState.tableElement.getBoundingClientRect();
          // Keep visible only if mouse is within the extend button zones (right and bottom)
          const isInExtendZone =
            (e.clientX >= tableRect.right && e.clientX <= tableRect.right + 30 &&
             e.clientY >= tableRect.top && e.clientY <= tableRect.bottom) ||
            (e.clientY >= tableRect.bottom && e.clientY <= tableRect.bottom + 30 &&
             e.clientX >= tableRect.left && e.clientX <= tableRect.right);

          if (isInExtendZone) {
            clearHideTimeout();
            return;
          }
        }
        scheduleHide();
        return;
      }

      clearHideTimeout();

      // Get table state
      const state = getTableState(editor, tableElement as HTMLElement);
      if (!state) {
        scheduleHide();
        return;
      }

      setTableState(state);

      // Determine which row/col is hovered based on mouse position
      const tableRect = tableElement.getBoundingClientRect();
      const relX = e.clientX - tableRect.left;
      const relY = e.clientY - tableRect.top;

      // Check if in left margin (row handle area)
      if (relX < 0 && relX > -40) {
        const rowIndex = state.rows.findIndex(
          (row) => relY >= row.top && relY <= row.top + row.height
        );
        if (rowIndex !== -1) {
          setHoverState({ type: 'row', index: rowIndex });
          return;
        }
      }

      // Check if in top margin (column handle area)
      if (relY < 0 && relY > -40) {
        const colIndex = state.cols.findIndex(
          (col) => relX >= col.left && relX <= col.left + col.width
        );
        if (colIndex !== -1) {
          setHoverState({ type: 'col', index: colIndex });
          return;
        }
      }

      // Check which cell is hovered
      const cell = target.closest('td, th');
      if (cell) {
        const cellRect = cell.getBoundingClientRect();
        const rowElement = cell.closest('tr');
        if (rowElement) {
          const rowIndex = Array.from(
            tableElement.querySelectorAll(':scope > tr, :scope > tbody > tr, :scope > thead > tr')
          ).indexOf(rowElement);
          const colIndex = Array.from(rowElement.children).indexOf(cell);

          // Show row handle if near left edge
          if (e.clientX - cellRect.left < 20) {
            setHoverState({ type: 'row', index: rowIndex });
          }
          // Show col handle if near top edge
          else if (e.clientY - cellRect.top < 20) {
            setHoverState({ type: 'col', index: colIndex });
          } else {
            setHoverState({ type: null, index: -1 });
          }
        }
      }
    };

    const handleMouseLeave = () => {
      scheduleHide();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      clearHideTimeout();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [editor, tableState]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowRowMenu(null);
        setShowColMenu(null);
        setMenuPosition(null);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleAddRow = useCallback(
    (index: number) => {
      if (!editor || editor.isDestroyed || !tableState) return;
      addRowAtIndex(editor.pm.state, editor.pm.view.dispatch, tableState.tablePos, index);
      editor.pm.view.focus();
      setShowRowMenu(null);
    },
    [editor, tableState]
  );

  const handleDeleteRow = useCallback(
    (index: number) => {
      if (!editor || editor.isDestroyed || !tableState) return;
      deleteRowAtIndex(editor.pm.state, editor.pm.view.dispatch, tableState.tablePos, index);
      editor.pm.view.focus();
      setShowRowMenu(null);
    },
    [editor, tableState]
  );

  const handleAddCol = useCallback(
    (index: number) => {
      if (!editor || editor.isDestroyed || !tableState) return;
      addColumnAtIndex(editor.pm.state, editor.pm.view.dispatch, tableState.tablePos, index);
      editor.pm.view.focus();
      setShowColMenu(null);
    },
    [editor, tableState]
  );

  const handleDeleteCol = useCallback(
    (index: number) => {
      if (!editor || editor.isDestroyed || !tableState) return;
      deleteColumnAtIndex(editor.pm.state, editor.pm.view.dispatch, tableState.tablePos, index);
      editor.pm.view.focus();
      setShowColMenu(null);
    },
    [editor, tableState]
  );

  if (!editor || editor.isDestroyed || !tableState) return null;

  const tableRect = tableState.tableElement.getBoundingClientRect();

  return (
    <div ref={containerRef} className={`ob-table-handles ${className || ''}`}>
      {/* Row handles */}
      {tableState.rows.map((row, index) => (
        <div
          key={`row-${index}`}
          className={`ob-table-handle ob-table-handle--row ${
            hoverState.type === 'row' && hoverState.index === index
              ? 'ob-table-handle--visible'
              : ''
          }`}
          style={{
            position: 'fixed',
            left: tableRect.left - 28,
            top: tableRect.top + row.top,
            height: row.height,
          }}
        >
          <button
            type="button"
            className="ob-table-handle-btn"
            onClick={(e) => {
              if (showRowMenu === index) {
                setShowRowMenu(null);
                setMenuPosition(null);
              } else {
                const btnRect = e.currentTarget.getBoundingClientRect();
                setShowRowMenu(index);
                setShowColMenu(null);
                setMenuPosition({ left: btnRect.right + 4, top: btnRect.top });
              }
            }}
            onMouseDown={(e) => e.preventDefault()}
            title="Row options"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="6" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="18" r="2" />
            </svg>
          </button>

          {showRowMenu === index && menuPosition && (
            <div
              className="ob-table-handle-menu"
              style={{ left: menuPosition.left, top: menuPosition.top }}
            >
              <button onClick={() => handleAddRow(index)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Insert above
              </button>
              <button onClick={() => handleAddRow(index + 1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Insert below
              </button>
              {tableState.rowCount > 1 && (
                <button className="ob-table-handle-menu-danger" onClick={() => handleDeleteRow(index)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  Delete row
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Column handles */}
      {tableState.cols.map((col, index) => (
        <div
          key={`col-${index}`}
          className={`ob-table-handle ob-table-handle--col ${
            hoverState.type === 'col' && hoverState.index === index
              ? 'ob-table-handle--visible'
              : ''
          }`}
          style={{
            position: 'fixed',
            left: tableRect.left + col.left,
            top: tableRect.top - 28,
            width: col.width,
          }}
        >
          <button
            type="button"
            className="ob-table-handle-btn"
            onClick={(e) => {
              if (showColMenu === index) {
                setShowColMenu(null);
                setMenuPosition(null);
              } else {
                const btnRect = e.currentTarget.getBoundingClientRect();
                setShowColMenu(index);
                setShowRowMenu(null);
                setMenuPosition({ left: btnRect.left + btnRect.width / 2 - 75, top: btnRect.bottom + 4 });
              }
            }}
            onMouseDown={(e) => e.preventDefault()}
            title="Column options"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="6" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="18" cy="12" r="2" />
            </svg>
          </button>

          {showColMenu === index && menuPosition && (
            <div
              className="ob-table-handle-menu"
              style={{ left: menuPosition.left, top: menuPosition.top }}
            >
              <button onClick={() => handleAddCol(index)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Insert left
              </button>
              <button onClick={() => handleAddCol(index + 1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Insert right
              </button>
              {tableState.colCount > 1 && (
                <button className="ob-table-handle-menu-danger" onClick={() => handleDeleteCol(index)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  Delete column
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add row button at bottom - full width bar */}
      <button
        type="button"
        className="ob-table-extend-btn ob-table-extend-btn--row ob-table-extend-btn--visible"
        style={{
          position: 'fixed',
          left: tableRect.left,
          top: tableRect.bottom + 4,
          width: tableRect.width,
        }}
        onClick={() => handleAddRow(tableState.rowCount)}
        onMouseDown={(e) => e.preventDefault()}
        title="Add row"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {/* Add column button at right - full height bar */}
      <button
        type="button"
        className="ob-table-extend-btn ob-table-extend-btn--col ob-table-extend-btn--visible"
        style={{
          position: 'fixed',
          left: tableRect.right + 4,
          top: tableRect.top,
          height: tableRect.height,
        }}
        onClick={() => handleAddCol(tableState.colCount)}
        onMouseDown={(e) => e.preventDefault()}
        title="Add column"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
