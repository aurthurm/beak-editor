import { defineComponent, h, onBeforeUnmount, ref, Teleport, watch, type PropType } from 'vue';
import { BeakBlockEditor, addColumnAtIndex, addRowAtIndex, deleteColumnAtIndex, deleteRowAtIndex } from '@labbs/beakblock-core';

export interface TableHandlesProps {
  editor: BeakBlockEditor | null;
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

function svg(path: string) {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [h('path', { d: path })]);
}

function getTableState(editor: BeakBlockEditor, tableElement: HTMLElement): TableState | null {
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
  const rowElements = tableElement.querySelectorAll(':scope > tr, :scope > tbody > tr, :scope > thead > tr');
  const rows: { element: HTMLElement; top: number; height: number }[] = [];
  const tableRect = tableElement.getBoundingClientRect();
  rowElements.forEach((row) => {
    const rect = row.getBoundingClientRect();
    rows.push({ element: row as HTMLElement, top: rect.top - tableRect.top, height: rect.height });
  });
  const cols: { element: HTMLElement; left: number; width: number }[] = [];
  if (rowElements.length > 0) {
    const firstRowCells = rowElements[0].querySelectorAll(':scope > td, :scope > th');
    firstRowCells.forEach((cell) => {
      const rect = cell.getBoundingClientRect();
      cols.push({ element: cell as HTMLElement, left: rect.left - tableRect.left, width: rect.width });
    });
  }
  return { tablePos, tableElement, rowCount: table.childCount, colCount: cols.length, rows, cols };
}

export const TableHandles = defineComponent({
  name: 'TableHandles',
  props: {
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    className: { type: String, default: '' },
  },
  setup(props) {
    const tableState = ref<TableState | null>(null);
    const hoverState = ref<HoverState>({ type: null, index: -1 });
    const showRowMenu = ref<number | null>(null);
    const showColMenu = ref<number | null>(null);
    const menuPosition = ref<{ left: number; top: number } | null>(null);
    const containerRef = ref<HTMLElement | null>(null);

    const getMenuHost = () => {
      if (!props.editor || props.editor.isDestroyed) return null;
      return (props.editor.pm.view.dom.closest('.beakblock-vue-view') as HTMLElement | null) || props.editor.pm.view.dom.parentElement || null;
    };

    const toHostPoint = (left: number, top: number) => {
      const host = getMenuHost();
      if (!host) return { left, top };
      const rect = host.getBoundingClientRect();
      return { left: left - rect.left, top: top - rect.top };
    };

    const scheduleHide = () => {
      setTimeout(() => {
        tableState.value = null;
        hoverState.value = { type: null, index: -1 };
      }, 100);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!props.editor || props.editor.isDestroyed) return;
      const target = e.target as HTMLElement;
      if (containerRef.value?.contains(target)) return;
      const tableElement = target.closest('table');
      if (!tableElement) {
        if (tableState.value) {
          const tableRect = tableState.value.tableElement.getBoundingClientRect();
          const isInExtendZone =
            (e.clientX >= tableRect.right && e.clientX <= tableRect.right + 30 && e.clientY >= tableRect.top && e.clientY <= tableRect.bottom) ||
            (e.clientY >= tableRect.bottom && e.clientY <= tableRect.bottom + 30 && e.clientX >= tableRect.left && e.clientX <= tableRect.right);
          if (isInExtendZone) return;
        }
        scheduleHide();
        return;
      }
      const state = getTableState(props.editor, tableElement as HTMLElement);
      if (!state) {
        scheduleHide();
        return;
      }
      tableState.value = state;
      const tableRect = tableElement.getBoundingClientRect();
      const relX = e.clientX - tableRect.left;
      const relY = e.clientY - tableRect.top;
      if (relX < 0 && relX > -40) {
        const rowIndex = state.rows.findIndex((row) => relY >= row.top && relY <= row.top + row.height);
        if (rowIndex !== -1) {
          hoverState.value = { type: 'row', index: rowIndex };
          return;
        }
      }
      if (relY < 0 && relY > -40) {
        const colIndex = state.cols.findIndex((col) => relX >= col.left && relX <= col.left + col.width);
        if (colIndex !== -1) {
          hoverState.value = { type: 'col', index: colIndex };
          return;
        }
      }
      const cell = target.closest('td, th');
      if (cell) {
        const cellRect = cell.getBoundingClientRect();
        const rowElement = cell.closest('tr');
        if (rowElement) {
          const rowIndex = Array.from(tableElement.querySelectorAll(':scope > tr, :scope > tbody > tr, :scope > thead > tr')).indexOf(rowElement);
          const colIndex = Array.from(rowElement.children).indexOf(cell);
          if (e.clientX - cellRect.left < 20) hoverState.value = { type: 'row', index: rowIndex };
          else if (e.clientY - cellRect.top < 20) hoverState.value = { type: 'col', index: colIndex };
          else hoverState.value = { type: null, index: -1 };
        }
      }
    };

    const handleMouseLeave = () => scheduleHide();

    watch(
      () => props.editor,
      (editor, _prev, onCleanup) => {
        if (!editor || editor.isDestroyed) return;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseleave', handleMouseLeave);
        const handleClick = (e: MouseEvent) => {
          if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
            showRowMenu.value = null;
            showColMenu.value = null;
            menuPosition.value = null;
          }
        };
        document.addEventListener('mousedown', handleClick);
        onCleanup(() => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseleave', handleMouseLeave);
          document.removeEventListener('mousedown', handleClick);
        });
      },
      { immediate: true }
    );

    onBeforeUnmount(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    });

    const doRow = (index: number, action: 'addBefore' | 'addAfter' | 'delete') => {
      if (!props.editor || props.editor.isDestroyed || !tableState.value) return;
      if (action === 'addBefore') addRowAtIndex(props.editor.pm.state, props.editor.pm.view.dispatch, tableState.value.tablePos, index);
      if (action === 'addAfter') addRowAtIndex(props.editor.pm.state, props.editor.pm.view.dispatch, tableState.value.tablePos, index);
      if (action === 'delete') deleteRowAtIndex(props.editor.pm.state, props.editor.pm.view.dispatch, tableState.value.tablePos, index);
      props.editor.pm.view.focus();
      showRowMenu.value = null;
    };

    const doCol = (index: number, action: 'addBefore' | 'addAfter' | 'delete') => {
      if (!props.editor || props.editor.isDestroyed || !tableState.value) return;
      if (action === 'addBefore') addColumnAtIndex(props.editor.pm.state, props.editor.pm.view.dispatch, tableState.value.tablePos, index);
      if (action === 'addAfter') addColumnAtIndex(props.editor.pm.state, props.editor.pm.view.dispatch, tableState.value.tablePos, index);
      if (action === 'delete') deleteColumnAtIndex(props.editor.pm.state, props.editor.pm.view.dispatch, tableState.value.tablePos, index);
      props.editor.pm.view.focus();
      showColMenu.value = null;
    };

    return () => {
      const state = tableState.value;
      const host = getMenuHost();
      if (!props.editor || props.editor.isDestroyed || !state || !host) return null;
      const tableRect = state.tableElement.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      return h(
        Teleport,
        { to: host },
        [
          h(
            'div',
            { ref: containerRef, class: ['ob-table-handles', props.className].filter(Boolean).join(' '), style: { position: 'absolute', left: '0px', top: '0px', width: '100%', height: '100%', zIndex: 1000 } },
            [
              ...state.rows.map((row, index) =>
                h(
                  'div',
                  {
                    key: `row-${index}`,
                    class: ['ob-table-handle ob-table-handle--row', hoverState.value.type === 'row' && hoverState.value.index === index ? 'ob-table-handle--visible' : ''].filter(Boolean).join(' '),
                    style: {
                      position: 'absolute',
                      left: `${tableRect.left - hostRect.left - 28}px`,
                      top: `${tableRect.top - hostRect.top + row.top}px`,
                      height: `${row.height}px`,
                    },
                  },
                  [
                    h(
                      'button',
                      {
                        type: 'button',
                        class: 'ob-table-handle-btn',
                        title: 'Row options',
                        onClick: (e: MouseEvent) => {
                          const btn = e.currentTarget as HTMLElement;
                          if (showRowMenu.value === index) {
                            showRowMenu.value = null;
                            menuPosition.value = null;
                          } else {
                            const btnRect = btn.getBoundingClientRect();
                            showRowMenu.value = index;
                            showColMenu.value = null;
                            menuPosition.value = toHostPoint(btnRect.right + 4, btnRect.top);
                          }
                        },
                        onMousedown: (e: MouseEvent) => e.preventDefault(),
                      },
                      [h('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, [h('circle', { cx: '12', cy: '6', r: '2' }), h('circle', { cx: '12', cy: '12', r: '2' }), h('circle', { cx: '12', cy: '18', r: '2' })])]
                    ),
                    showRowMenu.value === index && menuPosition.value
                      ? h('div', { class: 'ob-table-handle-menu', style: { left: `${menuPosition.value.left}px`, top: `${menuPosition.value.top}px` } }, [
                          h('button', { onClick: () => doRow(index, 'addBefore') }, [svg('M12 5v14M5 12h14'), ' Insert above']),
                          h('button', { onClick: () => doRow(index + 1, 'addAfter') }, [svg('M12 5v14M5 12h14'), ' Insert below']),
                          state.rowCount > 1 ? h('button', { class: 'ob-table-handle-menu-danger', onClick: () => doRow(index, 'delete') }, [svg('M18 6L6 18M6 6l12 12'), ' Delete row']) : null,
                        ])
                      : null,
                  ]
                )
              ),
              ...state.cols.map((col, index) =>
                h(
                  'div',
                  {
                    key: `col-${index}`,
                    class: ['ob-table-handle ob-table-handle--col', hoverState.value.type === 'col' && hoverState.value.index === index ? 'ob-table-handle--visible' : ''].filter(Boolean).join(' '),
                    style: {
                      position: 'absolute',
                      left: `${tableRect.left - hostRect.left + col.left}px`,
                      top: `${tableRect.top - hostRect.top - 28}px`,
                      width: `${col.width}px`,
                    },
                  },
                  [
                    h(
                      'button',
                      {
                        type: 'button',
                        class: 'ob-table-handle-btn',
                        title: 'Column options',
                        onClick: (e: MouseEvent) => {
                          const btn = e.currentTarget as HTMLElement;
                          if (showColMenu.value === index) {
                            showColMenu.value = null;
                            menuPosition.value = null;
                          } else {
                            const btnRect = btn.getBoundingClientRect();
                            showColMenu.value = index;
                            showRowMenu.value = null;
                            menuPosition.value = toHostPoint(btnRect.left + btnRect.width / 2 - 75, btnRect.bottom + 4);
                          }
                        },
                        onMousedown: (e: MouseEvent) => e.preventDefault(),
                      },
                      [h('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, [h('circle', { cx: '6', cy: '12', r: '2' }), h('circle', { cx: '12', cy: '12', r: '2' }), h('circle', { cx: '18', cy: '12', r: '2' })])]
                    ),
                    showColMenu.value === index && menuPosition.value
                      ? h('div', { class: 'ob-table-handle-menu', style: { left: `${menuPosition.value.left}px`, top: `${menuPosition.value.top}px` } }, [
                          h('button', { onClick: () => doCol(index, 'addBefore') }, [svg('M12 5v14M5 12h14'), ' Insert left']),
                          h('button', { onClick: () => doCol(index + 1, 'addAfter') }, [svg('M12 5v14M5 12h14'), ' Insert right']),
                          state.colCount > 1 ? h('button', { class: 'ob-table-handle-menu-danger', onClick: () => doCol(index, 'delete') }, [svg('M18 6L6 18M6 6l12 12'), ' Delete column']) : null,
                        ])
                      : null,
                  ]
                )
              ),
              h('button', { type: 'button', class: 'ob-table-extend-btn ob-table-extend-btn--row ob-table-extend-btn--visible', style: { position: 'absolute', left: `${tableRect.left - hostRect.left}px`, top: `${tableRect.bottom - hostRect.top + 4}px`, width: `${tableRect.width}px` }, onClick: () => { const editor = props.editor; const currentState = tableState.value; if (!editor || !currentState) return; addRowAtIndex(editor.pm.state, editor.pm.view.dispatch, currentState.tablePos, currentState.rowCount); }, onMousedown: (e: MouseEvent) => e.preventDefault(), title: 'Add row' }, [svg('M12 5v14M5 12h14')]),
              h('button', { type: 'button', class: 'ob-table-extend-btn ob-table-extend-btn--col ob-table-extend-btn--visible', style: { position: 'absolute', left: `${tableRect.right - hostRect.left + 4}px`, top: `${tableRect.top - hostRect.top}px`, height: `${tableRect.height}px` }, onClick: () => { const editor = props.editor; const currentState = tableState.value; if (!editor || !currentState) return; addColumnAtIndex(editor.pm.state, editor.pm.view.dispatch, currentState.tablePos, currentState.colCount); }, onMousedown: (e: MouseEvent) => e.preventDefault(), title: 'Add column' }, [svg('M12 5v14M5 12h14')]),
            ]
          ),
        ]
      );
    };
  },
});
