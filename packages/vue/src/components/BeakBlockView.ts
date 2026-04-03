import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
  type CSSProperties,
} from 'vue';
import { BeakBlockEditor } from '@aurthurm/beakblock-core';

export interface BeakBlockViewProps {
  editor: BeakBlockEditor | null;
  className?: string;
  style?: CSSProperties;
  tag?: string;
}

export const BeakBlockView = defineComponent({
  name: 'BeakBlockView',
  props: {
    editor: {
      type: Object as PropType<BeakBlockEditor | null>,
      default: null,
    },
    className: {
      type: String,
      default: '',
    },
    style: {
      type: Object as PropType<CSSProperties>,
      default: undefined,
    },
    tag: {
      type: String,
      default: 'div',
    },
  },
  setup(props, { slots, expose }) {
    const containerRef = ref<HTMLElement | null>(null);

    const mountEditor = () => {
      const editor = props.editor;
      const container = containerRef.value;
      if (!editor || editor.isDestroyed || !container) return;
      editor.mount(container);
    };

    onMounted(mountEditor);
    watch(
      () => props.editor,
      () => mountEditor()
    );

    onBeforeUnmount(() => {
      containerRef.value = null;
    });

    expose({
      get container() {
        return containerRef.value;
      },
      get editor() {
        return props.editor;
      },
    });

    return () =>
      h(
        props.tag,
        {
          ref: containerRef,
          class: ['beakblock-container', 'beakblock-vue-view', props.className].filter(Boolean).join(' '),
          style: {
            position: 'relative',
            ...(props.style || {}),
          },
        },
        slots.default?.()
      );
  },
});
