import { computed, defineComponent, h, onBeforeUnmount, ref, type PropType, type VNode } from 'vue';
import type { BeakBlockEditor, PageSetup, ParagraphIndent, ParagraphTab } from '@amusendame/beakblock-core';
import {
  PX_PER_PT,
  findIndentedTextblock,
  pageGeometryPt,
  tableColumnBoundariesPt,
  useEditorTick,
  DEFAULT_PAGE_SETUP,
} from './editorState';

/** Round to two decimals, the precision used for indent and margin values. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Convert an absolute first-line position and left indent into the contract's indent shape.
 * A first line to the right of the left indent becomes `firstLinePt`, one to its left becomes
 * `hangingPt`. Returns null when both are zero.
 */
export function indentFromPositions(leftPt: number, firstAbsPt: number): ParagraphIndent | null {
  const left = round2(Math.max(0, leftPt));
  const rel = round2(firstAbsPt - left);
  if (left === 0 && rel === 0) return null;
  if (rel === 0) return { leftPt: left };
  if (rel > 0) return { leftPt: left, firstLinePt: rel };
  return { leftPt: left, hangingPt: -rel };
}

/** Absolute first-line position (points from the text area edge) for an indent. */
export function firstLinePositionPt(indent: ParagraphIndent | null | undefined): number {
  const left = indent?.leftPt ?? 0;
  if (indent?.firstLinePt) return left + indent.firstLinePt;
  if (indent?.hangingPt) return left - indent.hangingPt;
  return left;
}

/**
 * Write a paragraph or heading indent with `setNodeMarkup`. Returns false when the node at
 * `pos` does not carry an `indent` attribute.
 */
export function setParagraphIndent(editor: BeakBlockEditor, pos: number, indent: ParagraphIndent | null): boolean {
  const { doc } = editor.pm.state;
  const node = doc.nodeAt(pos);
  if (!node || !node.isTextblock || !('indent' in node.attrs)) return false;
  const tr = editor.pm.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
  editor.pm.dispatch(tr);
  return true;
}

/** Write vertical margins into a page setup, returning a new object. */
export function withMarginsPt(
  setup: PageSetup,
  margins: Partial<{ topPt: number; bottomPt: number; leftPt: number; rightPt: number }>
): PageSetup {
  return {
    ...setup,
    margins: {
      ...setup.margins,
      ...(margins.topPt !== undefined ? { top: Math.round(margins.topPt * 20) } : {}),
      ...(margins.bottomPt !== undefined ? { bottom: Math.round(margins.bottomPt * 20) } : {}),
      ...(margins.leftPt !== undefined ? { left: Math.round(margins.leftPt * 20) } : {}),
      ...(margins.rightPt !== undefined ? { right: Math.round(margins.rightPt * 20) } : {}),
    },
  };
}

type DragKind = 'left' | 'first-line' | 'top' | 'bottom';

interface DragState {
  kind: DragKind;
  startX: number;
  startY: number;
  startValuePt: number;
  /** Paragraph position, for indent drags. */
  pos: number;
  leftPt: number;
  firstAbsPt: number;
}

/**
 * Office ruler. Horizontal: page margins, paragraph indent markers (left, first line), tab
 * stops and table column boundaries. Vertical: top and bottom margins.
 *
 * Indent markers are dragged with the pointer and committed on release through
 * `setNodeMarkup`, so the change is one undoable step. Vertical margins emit
 * `update:pageSetup`. Values are in points internally; pixels are `pt * zoom * 96 / 72`.
 */
export const Ruler = defineComponent({
  name: 'BeakBlockOfficeRuler',
  props: {
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    orientation: { type: String as PropType<'horizontal' | 'vertical'>, default: 'horizontal' },
    pageSetup: { type: Object as PropType<PageSetup>, default: () => DEFAULT_PAGE_SETUP },
    zoom: { type: Number, default: 1 },
  },
  emits: {
    'update:pageSetup': (setup: PageSetup) => typeof setup === 'object',
    'indent-change': (indent: ParagraphIndent | null) => indent === null || typeof indent === 'object',
  },
  setup(props, { emit }) {
    const tick = useEditorTick(() => props.editor);
    const preview = ref<{ leftPt: number; firstAbsPt: number } | null>(null);
    const verticalPreview = ref<{ topPt: number; bottomPt: number } | null>(null);
    let drag: DragState | null = null;

    const geometry = computed(() => pageGeometryPt(props.pageSetup));
    const pxPerPt = computed(() => Math.max(0.01, props.zoom) * PX_PER_PT);
    const textWidthPt = computed(() => {
      const g = geometry.value;
      return Math.max(0, g.widthPt - g.marginLeftPt - g.marginRightPt);
    });

    /** Current paragraph indent, tab stops and table column boundaries. */
    const context = computed(() => {
      void tick.value;
      const editor = props.editor;
      if (!editor || editor.isDestroyed) return null;
      const state = editor.pm.state;
      const block = findIndentedTextblock(state);
      const indent = (block?.node.attrs.indent as ParagraphIndent | null | undefined) ?? null;
      const tabs = (block?.node.attrs.tabs as ParagraphTab[] | null | undefined) ?? [];
      return {
        pos: block?.pos ?? -1,
        indent,
        tabs,
        columns: tableColumnBoundariesPt(state, textWidthPt.value),
      };
    });

    function startDrag(event: PointerEvent | MouseEvent, kind: DragKind): void {
      if (event.button !== undefined && event.button !== 0) return;
      const ctx = context.value;
      const g = geometry.value;
      const isVertical = props.orientation === 'vertical';
      if (!isVertical && (!ctx || ctx.pos < 0)) return;
      event.preventDefault();

      const indent = ctx?.indent ?? null;
      const leftPt = indent?.leftPt ?? 0;
      const firstAbsPt = firstLinePositionPt(indent);
      const startValuePt =
        kind === 'left' ? leftPt : kind === 'first-line' ? firstAbsPt : kind === 'top' ? g.marginTopPt : g.heightPt - g.marginBottomPt;
      drag = {
        kind,
        startX: event.clientX,
        startY: event.clientY,
        startValuePt,
        pos: ctx?.pos ?? -1,
        leftPt,
        firstAbsPt,
      };
      window.addEventListener('pointermove', onDragMove);
      window.addEventListener('pointerup', onDragEnd);
    }

    function onDragMove(event: PointerEvent | MouseEvent): void {
      if (!drag) return;
      const isVertical = drag.kind === 'top' || drag.kind === 'bottom';
      const deltaPt = ((isVertical ? event.clientY - drag.startY : event.clientX - drag.startX) / pxPerPt.value);
      const target = Math.max(0, Math.min(isVertical ? geometry.value.heightPt : textWidthPt.value, drag.startValuePt + deltaPt));

      if (drag.kind === 'left') {
        // Word-style: the first-line offset stays relative to the left indent while dragging.
        const newLeft = Math.min(target, textWidthPt.value);
        const relativeFirst = drag.firstAbsPt - drag.leftPt;
        preview.value = { leftPt: newLeft, firstAbsPt: newLeft + relativeFirst };
      } else if (drag.kind === 'first-line') {
        preview.value = { leftPt: drag.leftPt, firstAbsPt: target };
      } else if (drag.kind === 'top') {
        verticalPreview.value = { topPt: target, bottomPt: geometry.value.marginBottomPt };
      } else {
        verticalPreview.value = { topPt: geometry.value.marginTopPt, bottomPt: Math.max(0, geometry.value.heightPt - target) };
      }
    }

    function onDragEnd(): void {
      const finished = drag;
      const editor = props.editor;
      window.removeEventListener('pointermove', onDragMove);
      window.removeEventListener('pointerup', onDragEnd);
      drag = null;
      if (!finished) return;

      if (finished.kind === 'left' || finished.kind === 'first-line') {
        const next = preview.value;
        preview.value = null;
        if (!next || !editor || finished.pos < 0) return;
        const indent = indentFromPositions(next.leftPt, next.firstAbsPt);
        if (setParagraphIndent(editor, finished.pos, indent)) emit('indent-change', indent);
        return;
      }

      const margins = verticalPreview.value;
      verticalPreview.value = null;
      if (!margins) return;
      emit(
        'update:pageSetup',
        withMarginsPt(props.pageSetup, finished.kind === 'top' ? { topPt: margins.topPt } : { bottomPt: margins.bottomPt })
      );
    }

    onBeforeUnmount(() => {
      window.removeEventListener('pointermove', onDragMove);
      window.removeEventListener('pointerup', onDragEnd);
    });

    function marker(kind: string, positionPx: number, extra: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}): VNode {
      return h('div', {
        class: `bb-office-ruler-marker bb-office-ruler-marker--${kind}`,
        'data-marker': kind,
        style: props.orientation === 'horizontal' ? { left: `${positionPx}px` } : { top: `${positionPx}px` },
        onPointerdown: (event: PointerEvent) => {
          if (kind === 'left' || kind === 'first-line' || kind === 'top' || kind === 'bottom') startDrag(event, kind);
        },
        ...attrs,
        ...extra,
      });
    }

    function renderHorizontal(): VNode {
      const g = geometry.value;
      const ctx = context.value;
      const totalPx = g.widthPt * pxPerPt.value;
      const leftPx = g.marginLeftPt * pxPerPt.value;
      const textPx = textWidthPt.value * pxPerPt.value;
      const indent = preview.value
        ? { leftPt: preview.value.leftPt, firstAbsPt: preview.value.firstAbsPt }
        : { leftPt: ctx?.indent?.leftPt ?? 0, firstAbsPt: firstLinePositionPt(ctx?.indent) };

      const ticks: VNode[] = [];
      for (let pt = 0; pt <= g.widthPt; pt += 36) {
        const x = pt * pxPerPt.value;
        const fromMargin = pt - g.marginLeftPt;
        const isInch = Math.abs(fromMargin / 72 - Math.round(fromMargin / 72)) < 0.001;
        ticks.push(
          h('div', {
            class: 'bb-office-ruler-tick',
            style: { position: 'absolute', left: `${x}px`, top: isInch ? '0' : '14px', height: isInch ? '22px' : '8px', borderLeft: '1px solid #8a8886' },
          }, isInch && fromMargin !== 0 ? [h('span', { style: { position: 'absolute', left: '2px', top: '0' } }, String(Math.abs(Math.round(fromMargin / 72))))] : [])
        );
      }

      const tabMarkers = (ctx?.tabs ?? []).map((tab) =>
        marker('tab', leftPx + tab.posPt * pxPerPt.value, {}, { 'data-tab-pos': tab.posPt, 'data-tab-kind': tab.kind })
      );
      const columnMarkers = (ctx?.columns ?? [])
        .slice(0, -1)
        .map((boundary, index) =>
          marker('column', leftPx + boundary * pxPerPt.value, {}, { 'data-column-index': index })
        );

      return h(
        'div',
        {
          class: 'bb-office-ruler bb-office-ruler--horizontal',
          role: 'slider',
          'aria-label': 'Horizontal ruler',
          'aria-valuemin': 0,
          'aria-valuemax': Math.round(g.widthPt),
          'data-beakblock-ruler': 'horizontal',
          style: { width: `${totalPx}px` },
        },
        [
          h('div', { class: 'bb-office-ruler-margin', style: { left: '0', width: `${leftPx}px` } }),
          h('div', {
            class: 'bb-office-ruler-margin',
            style: { left: `${leftPx + textPx}px`, right: '0' },
          }),
          h('div', { class: 'bb-office-ruler-text', style: { left: `${leftPx}px`, width: `${textPx}px` } }),
          ...ticks,
          ...(ctx?.pos !== undefined && ctx.pos >= 0
            ? [
                marker('first-line', leftPx + indent.firstAbsPt * pxPerPt.value),
                marker('left', leftPx + indent.leftPt * pxPerPt.value),
              ]
            : []),
          ...tabMarkers,
          ...columnMarkers,
        ]
      );
    }

    function renderVertical(): VNode {
      const g = geometry.value;
      const totalPx = g.heightPt * pxPerPt.value;
      const topMargin = verticalPreview.value?.topPt ?? g.marginTopPt;
      const bottomMargin = verticalPreview.value?.bottomPt ?? g.marginBottomPt;
      const topPx = topMargin * pxPerPt.value;
      const bottomPx = bottomMargin * pxPerPt.value;
      return h(
        'div',
        {
          class: 'bb-office-ruler bb-office-ruler--vertical',
          role: 'slider',
          'aria-label': 'Vertical ruler',
          'aria-valuemin': 0,
          'aria-valuemax': Math.round(g.heightPt),
          'data-beakblock-ruler': 'vertical',
          style: { height: `${totalPx}px` },
        },
        [
          h('div', { class: 'bb-office-ruler-margin', style: { top: '0', height: `${topPx}px` } }),
          h('div', { class: 'bb-office-ruler-margin', style: { top: `${totalPx - bottomPx}px`, bottom: '0' } }),
          h('div', { class: 'bb-office-ruler-text', style: { top: `${topPx}px`, height: `${Math.max(0, totalPx - topPx - bottomPx)}px` } }),
          marker('top', topPx, {}, { 'data-margin': 'top' }),
          marker('bottom', totalPx - bottomPx, {}, { 'data-margin': 'bottom' }),
        ]
      );
    }

    return () => (props.orientation === 'vertical' ? renderVertical() : renderHorizontal());
  },
});
