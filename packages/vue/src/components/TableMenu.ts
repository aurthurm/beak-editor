import { computed, defineComponent, h, onBeforeUnmount, ref, Teleport, watch, type PropType, type VNodeChild } from 'vue';
import {
  BeakBlockEditor,
  type EditorState,
  type Transaction,
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  getTableInfo,
  isInTable,
} from '@labbs/beakblock-core';

export interface TableMenuProps {
  editor: BeakBlockEditor | null;
  className?: string;
}

const Icons = {
  addRowAbove: h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [h('path', { d: 'M3 14h18v7H3zM12 3v6M9 6h6' }), h('rect', { x: '3', y: '14', width: '18', height: '7', rx: '1' })]),
  addRowBelow: h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [h('rect', { x: '3', y: '3', width: '18', height: '7', rx: '1' }), h('path', { d: 'M12 14v6M9 17h6' })]),
  deleteRow: h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [h('rect', { x: '3', y: '8', width: '18', height: '8', rx: '1' }), h('path', { d: 'M8 12h8' })]),
  addColumnLeft: h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [h('rect', { x: '14', y: '3', width: '7', height: '18', rx: '1' }), h('path', { d: 'M3 12h6M6 9v6' })]),
  addColumnRight: h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [h('rect', { x: '3', y: '3', width: '7', height: '18', rx: '1' }), h('path', { d: 'M15 12h6M18 9v6' })]),
  deleteColumn: h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [h('rect', { x: '8', y: '3', width: '8', height: '18', rx: '1' }), h('path', { d: 'M10 12h4' })]),
  deleteTable: h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' }), h('path', { d: 'M3 9h18M3 15h18M9 3v18M15 3v18' }), h('path', { d: 'M6 6l12 12M18 6L6 18', strokeWidth: '2.5' })]),
  rows: h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' }), h('path', { d: 'M3 9h18M3 15h18' })]),
  columns: h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' }), h('path', { d: 'M9 3v18M15 3v18' })]),
};

const TableMenuDropdown = defineComponent({
  name: 'TableMenuDropdown',
  props: {
    label: { type: String, required: true },
    icon: { type: Object as PropType<VNodeChild>, required: true },
  },
  setup(props, { slots }) {
    const isOpen = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    const outside = (event: MouseEvent) => {
      if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
        isOpen.value = false;
      }
    };

    watch(isOpen, (open) => {
      if (open) document.addEventListener('mousedown', outside);
      else document.removeEventListener('mousedown', outside);
    });

    onBeforeUnmount(() => document.removeEventListener('mousedown', outside));

    return () =>
      h('div', { class: 'ob-table-menu-dropdown', ref: containerRef }, [
        h(
          'button',
          {
            type: 'button',
            class: 'ob-table-menu-dropdown-btn',
            onClick: () => (isOpen.value = !isOpen.value),
            onMousedown: (e: MouseEvent) => e.preventDefault(),
            'aria-expanded': isOpen.value,
          },
          [
            h('span', { class: 'ob-table-menu-dropdown-icon' }, [props.icon]),
            h('span', { class: 'ob-table-menu-dropdown-label' }, props.label),
            h('svg', { class: ['ob-table-menu-dropdown-chevron', isOpen.value ? 'ob-table-menu-dropdown-chevron--open' : ''].filter(Boolean).join(' '), viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [h('path', { d: 'm6 9 6 6 6-6' })]),
          ]
        ),
        isOpen.value ? h('div', { class: 'ob-table-menu-dropdown-content', onClick: () => (isOpen.value = false) }, slots.default?.()) : null,
      ]);
  },
});

export const TableMenu = defineComponent({
  name: 'TableMenu',
  props: {
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    className: { type: String, default: '' },
  },
  setup(props) {
    const inTable = ref(false);
    const tableInfo = ref<{ rowIndex: number; cellIndex: number; rowCount: number; colCount: number } | null>(null);
    const coords = ref<{ left: number; top: number } | null>(null);

    const getMenuHost = () => {
      if (!props.editor || props.editor.isDestroyed) return null;
      return (props.editor.pm.view.dom.closest('.beakblock-vue-view') as HTMLElement | null) || props.editor.pm.view.dom.parentElement || null;
    };

    const updateState = () => {
      if (!props.editor || props.editor.isDestroyed) return;
      const state = props.editor.pm.state;
      const inside = isInTable(state);
      inTable.value = inside;
      if (inside) {
        tableInfo.value = getTableInfo(state);
        const { $from } = state.selection;
        for (let depth = $from.depth; depth > 0; depth--) {
          const node = $from.node(depth);
          if (node.type.name === 'table') {
            const pos = $from.before(depth);
            const domNode = props.editor.pm.view.nodeDOM(pos) as HTMLElement | null;
            if (domNode) {
              const rect = domNode.getBoundingClientRect();
              coords.value = { left: rect.left, top: rect.top - 44 };
            }
            break;
          }
        }
      } else {
        tableInfo.value = null;
        coords.value = null;
      }
    };

    watch(
      () => props.editor,
      (editor, _prev, onCleanup) => {
        updateState();
        if (!editor || editor.isDestroyed) return;
        const unsubscribe = editor.on('transaction', updateState);
        onCleanup(() => unsubscribe());
      },
      { immediate: true }
    );

    const run = (fn: (state: EditorState, dispatch: (tr: Transaction) => void) => void) => {
      if (!props.editor || props.editor.isDestroyed) return;
      fn(props.editor.pm.state, props.editor.pm.view.dispatch);
      props.editor.pm.view.focus();
    };

    const style = computed(() => {
      const host = getMenuHost();
      if (!inTable.value || !coords.value || !host) return undefined;
      const hostRect = host.getBoundingClientRect();
      return {
        position: 'absolute',
        left: `${Math.max(coords.value.left - hostRect.left, 4)}px`,
        top: `${Math.max(coords.value.top - hostRect.top, 4)}px`,
        zIndex: 1000,
      };
    });

    return () => {
      const host = getMenuHost();
      if (!props.editor || props.editor.isDestroyed || !inTable.value || !coords.value || !host || !style.value) return null;
      return h(Teleport, { to: host }, [
        h(
          'div',
          { class: ['ob-table-menu', props.className].filter(Boolean).join(' '), style: style.value, role: 'toolbar', 'aria-label': 'Table editing' },
          [
            h(TableMenuDropdown, { label: 'Row', icon: Icons.rows }, {
              default: () => [
                h('button', { type: 'button', class: 'ob-table-menu-dropdown-item', onClick: () => run((state, dispatch) => addRowBefore(state, dispatch)), onMousedown: (e: MouseEvent) => e.preventDefault() }, [Icons.addRowAbove, h('span', 'Insert row above')]),
                h('button', { type: 'button', class: 'ob-table-menu-dropdown-item', onClick: () => run((state, dispatch) => addRowAfter(state, dispatch)), onMousedown: (e: MouseEvent) => e.preventDefault() }, [Icons.addRowBelow, h('span', 'Insert row below')]),
                h('button', { type: 'button', class: 'ob-table-menu-dropdown-item ob-table-menu-dropdown-item--danger', disabled: tableInfo.value?.rowCount === 1, onClick: () => run((state, dispatch) => deleteRow(state, dispatch)), onMousedown: (e: MouseEvent) => e.preventDefault() }, [Icons.deleteRow, h('span', 'Delete row')]),
              ],
            }),
            h(TableMenuDropdown, { label: 'Column', icon: Icons.columns }, {
              default: () => [
                h('button', { type: 'button', class: 'ob-table-menu-dropdown-item', onClick: () => run((state, dispatch) => addColumnBefore(state, dispatch)), onMousedown: (e: MouseEvent) => e.preventDefault() }, [Icons.addColumnLeft, h('span', 'Insert column left')]),
                h('button', { type: 'button', class: 'ob-table-menu-dropdown-item', onClick: () => run((state, dispatch) => addColumnAfter(state, dispatch)), onMousedown: (e: MouseEvent) => e.preventDefault() }, [Icons.addColumnRight, h('span', 'Insert column right')]),
                h('button', { type: 'button', class: 'ob-table-menu-dropdown-item ob-table-menu-dropdown-item--danger', disabled: tableInfo.value?.colCount === 1, onClick: () => run((state, dispatch) => deleteColumn(state, dispatch)), onMousedown: (e: MouseEvent) => e.preventDefault() }, [Icons.deleteColumn, h('span', 'Delete column')]),
              ],
            }),
            h('span', { class: 'ob-table-menu-divider' }),
            h('button', { type: 'button', class: 'ob-table-menu-btn ob-table-menu-btn--danger', title: 'Delete table', onClick: () => run((state, dispatch) => deleteTable(state, dispatch)), onMousedown: (e: MouseEvent) => e.preventDefault() }, [Icons.deleteTable]),
            tableInfo.value ? h('span', { class: 'ob-table-menu-info' }, `Row ${tableInfo.value.rowIndex + 1}/${tableInfo.value.rowCount}, Col ${tableInfo.value.cellIndex + 1}/${tableInfo.value.colCount}`) : null,
          ]
        ),
      ]);
    };
  },
});
