import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import type {
  BeakBlockEditor,
  EditorState,
  Mark,
  Node as PMNode,
} from '@amusendame/beakblock-core';
import { OFFICE_PARAGRAPH_ATTR_NAMES } from '@amusendame/beakblock-core';

/** Formatting captured from a source selection. */
export interface FormatSnapshot {
  /** Character marks at the source. */
  marks: readonly Mark[];
  /** Paragraph type and formatting attributes, or null when the source is not a paragraph or heading. */
  block: { typeName: string; attrs: Record<string, unknown> } | null;
}

/** Attribute names copied from a paragraph or heading. */
const PARAGRAPH_ATTRS: readonly string[] = ['textAlign', 'level', ...OFFICE_PARAGRAPH_ATTR_NAMES];

/** Capture character marks and paragraph formatting at the current selection. */
export function captureFormat(state: EditorState): FormatSnapshot {
  const { selection, doc } = state;
  const marks = selection.empty
    ? selection.$from.marks()
    : (doc.nodeAt(selection.from)?.marks ?? selection.$from.marks());

  let block: FormatSnapshot['block'] = null;
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.isTextblock) {
      block = { typeName: node.type.name, attrs: pickAttrs(node) };
      break;
    }
  }
  return { marks: [...marks], block };
}

function pickAttrs(node: PMNode): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  for (const name of PARAGRAPH_ATTRS) {
    if (name in node.attrs) attrs[name] = node.attrs[name];
  }
  return attrs;
}

/**
 * Apply a captured format. With a range selection, character marks are replaced across the
 * range and every paragraph in it takes the source paragraph formatting. With a caret, only the
 * paragraph at the caret is formatted. Returns true when the document changed.
 */
export function applyFormat(editor: BeakBlockEditor, snapshot: FormatSnapshot): boolean {
  const state = editor.pm.state;
  const { schema, selection } = state;
  const { from, to, empty } = selection;
  let tr = state.tr;

  if (!empty) {
    tr = tr.removeMark(from, to);
    for (const mark of snapshot.marks) {
      if (schema.marks[mark.type.name]) tr = tr.addMark(from, to, mark);
    }
  }

  if (snapshot.block) {
    const targetType = schema.nodes[snapshot.block.typeName];
    if (targetType) {
      const allowed = new Set(Object.keys(targetType.spec.attrs ?? {}));
      const attrsFor = (node: PMNode): Record<string, unknown> => {
        const next: Record<string, unknown> = { ...node.attrs };
        for (const [key, value] of Object.entries(snapshot.block!.attrs)) {
          if (allowed.has(key) && key !== 'id') next[key] = value;
        }
        return next;
      };
      const targets: Array<{ pos: number; node: PMNode }> = [];
      if (empty) {
        const block = findTextblockAt(state, from);
        if (block) targets.push(block);
      } else {
        tr.doc.nodesBetween(from, to, (node, pos) => {
          if (node.isTextblock) targets.push({ pos, node });
          return !node.isTextblock;
        });
      }
      for (const { pos, node } of targets) {
        tr = tr.setNodeMarkup(pos, targetType, attrsFor(node));
      }
    }
  }

  if (tr.steps.length === 0) return false;
  editor.pm.dispatch(tr);
  return true;
}

function findTextblockAt(state: EditorState, pos: number): { pos: number; node: PMNode } | null {
  const $pos = state.doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.isTextblock) return { pos: $pos.before(depth), node };
  }
  return null;
}

/**
 * Format painter. Click once to copy the formatting at the selection, then select text or click
 * a paragraph to apply it. A single apply ends painting unless the painter is sticky
 * (double-click the button, or `sticky` prop).
 */
export const FormatPainter = defineComponent({
  name: 'BeakBlockOfficeFormatPainter',
  props: {
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    /** Keep painting after each application. */
    sticky: { type: Boolean, default: false },
    label: { type: String, default: 'Format Painter' },
  },
  emits: {
    'update:active': (active: boolean) => typeof active === 'boolean',
    apply: () => true,
  },
  setup(props, { emit }) {
    const active = ref(false);
    const sticky = ref(props.sticky);
    let snapshot: FormatSnapshot | null = null;
    let applying = false;
    let unsubscribe: (() => void) | null = null;

    watch(
      () => props.sticky,
      (value) => {
        sticky.value = value;
      }
    );

    function setActive(value: boolean): void {
      active.value = value;
      emit('update:active', value);
    }

    function onSelectionChange(): void {
      if (!active.value || !snapshot || applying || !props.editor || props.editor.isDestroyed) return;
      applying = true;
      try {
        const changed = applyFormat(props.editor, snapshot);
        if (changed) emit('apply');
      } finally {
        applying = false;
      }
      if (!sticky.value) {
        snapshot = null;
        setActive(false);
      }
    }

    function subscribe(editor: BeakBlockEditor | null): void {
      unsubscribe?.();
      unsubscribe = null;
      if (editor && !editor.isDestroyed) {
        unsubscribe = editor.on('selectionChange', onSelectionChange);
      }
    }

    watch(() => props.editor, (editor) => subscribe(editor), { immediate: true });
    onMounted(() => subscribe(props.editor));
    onBeforeUnmount(() => {
      unsubscribe?.();
      unsubscribe = null;
    });

    function toggle(): void {
      if (active.value) {
        snapshot = null;
        sticky.value = props.sticky;
        setActive(false);
        return;
      }
      if (!props.editor || props.editor.isDestroyed) return;
      snapshot = captureFormat(props.editor.pm.state);
      setActive(true);
    }

    return () =>
      h(
        'button',
        {
          type: 'button',
          class: 'bb-office-button bb-office-format-painter',
          title: active.value ? 'Format Painter (select text to apply, Esc to cancel)' : 'Copy formatting',
          'aria-label': props.label,
          'aria-pressed': String(active.value),
          onMousedown: (event: MouseEvent) => event.preventDefault(),
          onClick: toggle,
          onDblclick: () => {
            if (!props.editor || props.editor.isDestroyed) return;
            snapshot = captureFormat(props.editor.pm.state);
            sticky.value = true;
            setActive(true);
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.key === 'Escape' && active.value) {
              snapshot = null;
              sticky.value = props.sticky;
              setActive(false);
            }
          },
        },
        [h('span', { class: 'bb-office-button-label' }, props.label)]
      );
  },
});
