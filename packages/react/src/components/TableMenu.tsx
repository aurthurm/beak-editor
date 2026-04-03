/**
 * TableMenu - React component for table editing toolbar.
 *
 * Renders a floating menu when the cursor is inside a table,
 * providing buttons to add/remove rows and columns.
 *
 * @example
 * ```tsx
 * import { useBeakBlock, BeakBlockView, TableMenu } from '@beakblock/react';
 *
 * function MyEditor() {
 *   const editor = useBeakBlock();
 *
 *   return (
 *     <BeakBlockView editor={editor}>
 *       <TableMenu editor={editor} />
 *     </BeakBlockView>
 *   );
 * }
 * ```
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  BeakBlockEditor,
  isInTable,
  getTableInfo,
  addRowBefore,
  addRowAfter,
  deleteRow,
  addColumnBefore,
  addColumnAfter,
  deleteColumn,
  deleteTable,
} from '@labbs/beakblock-core';

/**
 * Props for TableMenu component.
 */
export interface TableMenuProps {
  /**
   * The BeakBlockEditor instance (can be null during initialization).
   */
  editor: BeakBlockEditor | null;

  /**
   * Additional class name for the menu container.
   */
  className?: string;
}

/**
 * Table menu button component.
 */
interface TableMenuButtonProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}

function TableMenuButton({ onClick, title, children, danger }: TableMenuButtonProps) {
  return (
    <button
      type="button"
      className={`ob-table-menu-btn ${danger ? 'ob-table-menu-btn--danger' : ''}`}
      onClick={onClick}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

/**
 * Dropdown menu for table actions.
 */
interface TableMenuDropdownProps {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function TableMenuDropdown({ label, icon, children }: TableMenuDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="ob-table-menu-dropdown" ref={containerRef}>
      <button
        type="button"
        className="ob-table-menu-dropdown-btn"
        onClick={() => setIsOpen(!isOpen)}
        onMouseDown={(e) => e.preventDefault()}
        aria-expanded={isOpen}
      >
        <span className="ob-table-menu-dropdown-icon">{icon}</span>
        <span className="ob-table-menu-dropdown-label">{label}</span>
        <svg
          className={`ob-table-menu-dropdown-chevron ${isOpen ? 'ob-table-menu-dropdown-chevron--open' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="ob-table-menu-dropdown-content" onClick={() => setIsOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Icons for table menu.
 */
const Icons = {
  addRowAbove: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 14h18v7H3zM12 3v6M9 6h6" />
      <rect x="3" y="14" width="18" height="7" rx="1" />
    </svg>
  ),
  addRowBelow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="7" rx="1" />
      <path d="M12 14v6M9 17h6" />
    </svg>
  ),
  deleteRow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="8" width="18" height="8" rx="1" />
      <path d="M8 12h8" />
    </svg>
  ),
  addColumnLeft: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="14" y="3" width="7" height="18" rx="1" />
      <path d="M3 12h6M6 9v6" />
    </svg>
  ),
  addColumnRight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <path d="M15 12h6M18 9v6" />
    </svg>
  ),
  deleteColumn: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="3" width="8" height="18" rx="1" />
      <path d="M10 12h4" />
    </svg>
  ),
  deleteTable: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
      <path d="M6 6l12 12M18 6L6 18" strokeWidth="2.5" />
    </svg>
  ),
  rows: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18" />
    </svg>
  ),
  columns: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M15 3v18" />
    </svg>
  ),
};

/**
 * TableMenu component.
 *
 * Renders a floating toolbar when the cursor is inside a table.
 */
export function TableMenu({
  editor,
  className,
}: TableMenuProps): React.ReactElement | null {
  const [inTable, setInTable] = useState(false);
  const [tableInfo, setTableInfo] = useState<{ rowIndex: number; cellIndex: number; rowCount: number; colCount: number } | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const updateState = () => {
      const state = editor.pm.state;
      const isInsideTable = isInTable(state);
      setInTable(isInsideTable);

      if (isInsideTable) {
        const info = getTableInfo(state);
        setTableInfo(info);

        // Get coordinates of the table
        const { $from } = state.selection;
        // Find the table node position
        for (let depth = $from.depth; depth > 0; depth--) {
          const node = $from.node(depth);
          if (node.type.name === 'table') {
            const pos = $from.before(depth);
            const domNode = editor.pm.view.nodeDOM(pos) as HTMLElement | null;
            if (domNode) {
              const rect = domNode.getBoundingClientRect();
              setCoords({
                left: rect.left,
                top: rect.top - 44, // Menu height + gap
              });
            }
            break;
          }
        }
      } else {
        setTableInfo(null);
        setCoords(null);
      }
    };

    updateState();

    const unsubscribe = editor.on('transaction', updateState);
    return unsubscribe;
  }, [editor]);

  const handleAddRowBefore = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    addRowBefore(editor.pm.state, editor.pm.view.dispatch);
    editor.pm.view.focus();
  }, [editor]);

  const handleAddRowAfter = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    addRowAfter(editor.pm.state, editor.pm.view.dispatch);
    editor.pm.view.focus();
  }, [editor]);

  const handleDeleteRow = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    deleteRow(editor.pm.state, editor.pm.view.dispatch);
    editor.pm.view.focus();
  }, [editor]);

  const handleAddColumnBefore = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    addColumnBefore(editor.pm.state, editor.pm.view.dispatch);
    editor.pm.view.focus();
  }, [editor]);

  const handleAddColumnAfter = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    addColumnAfter(editor.pm.state, editor.pm.view.dispatch);
    editor.pm.view.focus();
  }, [editor]);

  const handleDeleteColumn = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    deleteColumn(editor.pm.state, editor.pm.view.dispatch);
    editor.pm.view.focus();
  }, [editor]);

  const handleDeleteTable = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    deleteTable(editor.pm.state, editor.pm.view.dispatch);
    editor.pm.view.focus();
  }, [editor]);

  if (!editor || editor.isDestroyed || !inTable || !coords) {
    return null;
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    left: coords.left,
    top: coords.top,
    zIndex: 1000,
  };

  return (
    <div
      className={`ob-table-menu ${className || ''}`}
      style={style}
      role="toolbar"
      aria-label="Table editing"
    >
      <TableMenuDropdown label="Row" icon={Icons.rows}>
        <button
          type="button"
          className="ob-table-menu-dropdown-item"
          onClick={handleAddRowBefore}
          onMouseDown={(e) => e.preventDefault()}
        >
          {Icons.addRowAbove}
          <span>Insert row above</span>
        </button>
        <button
          type="button"
          className="ob-table-menu-dropdown-item"
          onClick={handleAddRowAfter}
          onMouseDown={(e) => e.preventDefault()}
        >
          {Icons.addRowBelow}
          <span>Insert row below</span>
        </button>
        <button
          type="button"
          className="ob-table-menu-dropdown-item ob-table-menu-dropdown-item--danger"
          onClick={handleDeleteRow}
          onMouseDown={(e) => e.preventDefault()}
          disabled={tableInfo?.rowCount === 1}
        >
          {Icons.deleteRow}
          <span>Delete row</span>
        </button>
      </TableMenuDropdown>

      <TableMenuDropdown label="Column" icon={Icons.columns}>
        <button
          type="button"
          className="ob-table-menu-dropdown-item"
          onClick={handleAddColumnBefore}
          onMouseDown={(e) => e.preventDefault()}
        >
          {Icons.addColumnLeft}
          <span>Insert column left</span>
        </button>
        <button
          type="button"
          className="ob-table-menu-dropdown-item"
          onClick={handleAddColumnAfter}
          onMouseDown={(e) => e.preventDefault()}
        >
          {Icons.addColumnRight}
          <span>Insert column right</span>
        </button>
        <button
          type="button"
          className="ob-table-menu-dropdown-item ob-table-menu-dropdown-item--danger"
          onClick={handleDeleteColumn}
          onMouseDown={(e) => e.preventDefault()}
          disabled={tableInfo?.colCount === 1}
        >
          {Icons.deleteColumn}
          <span>Delete column</span>
        </button>
      </TableMenuDropdown>

      <span className="ob-table-menu-divider" />

      <TableMenuButton
        onClick={handleDeleteTable}
        title="Delete table"
        danger
      >
        {Icons.deleteTable}
      </TableMenuButton>

      {tableInfo && (
        <span className="ob-table-menu-info">
          Row {tableInfo.rowIndex + 1}/{tableInfo.rowCount}, Col {tableInfo.cellIndex + 1}/{tableInfo.colCount}
        </span>
      )}
    </div>
  );
}
