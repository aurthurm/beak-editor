import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type CSSProperties,
  type PropType,
  type Ref,
} from 'vue';
import { BeakBlockEditor } from '@aurthurm/beakblock-core';

export interface LinkPopoverProps {
  editor: BeakBlockEditor;
  currentUrl: string | null;
  onClose: () => void;
  position?: { left: number; top: number };
  className?: string;
  triggerRef?: Ref<HTMLElement | null>;
  anchorToTrigger?: boolean;
}

function isValidUrl(url: string): boolean {
  if (!url.trim()) return false;
  const urlToTest = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
  try {
    new URL(urlToTest);
    return true;
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
}

export const LinkPopover = defineComponent({
  name: 'LinkPopover',
  props: {
    editor: { type: Object as PropType<BeakBlockEditor>, required: true },
    currentUrl: { type: String as PropType<string | null>, default: null },
    onClose: { type: Function as PropType<() => void>, required: true },
    position: { type: Object as PropType<{ left: number; top: number }>, default: undefined },
    className: { type: String, default: '' },
    triggerRef: { type: Object as PropType<Ref<HTMLElement | null>>, default: undefined },
    anchorToTrigger: { type: Boolean, default: true },
  },
  setup(props) {
    const url = ref(props.currentUrl || '');
    const error = ref<string | null>(null);
    const inputRef = ref<HTMLInputElement | null>(null);
    const popoverRef = ref<HTMLElement | null>(null);
    const openUpward = ref(false);

    onMounted(() => {
      inputRef.value?.focus();
      inputRef.value?.select();
    });

    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.value?.contains(target)) return;
      if (props.triggerRef?.value && props.triggerRef.value.contains(target)) return;
      props.onClose();
    };

    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose();
    };

    const addListeners = () => {
      requestAnimationFrame(() => {
        document.addEventListener('mousedown', outside);
      });
      document.addEventListener('keydown', keydown);
    };
    const removeListeners = () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', keydown);
    };

    onMounted(addListeners);
    onBeforeUnmount(removeListeners);

    const updatePlacement = async () => {
      if (!props.anchorToTrigger) return;
      await Promise.resolve();
      const trigger = props.triggerRef?.value;
      const popover = popoverRef.value;
      if (!trigger || !popover) return;
      const triggerRect = trigger.getBoundingClientRect();
      const dropdownHeight = popover.offsetHeight || 220;
      const spaceBelow = window.innerHeight - triggerRect.bottom - 8;
      const spaceAbove = triggerRect.top - 8;
      openUpward.value = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    };

    onMounted(() => {
      void updatePlacement();
    });

    const submit = (event: Event) => {
      event.preventDefault();
      if (!url.value.trim()) {
        error.value = 'Please enter a URL';
        return;
      }
      if (!isValidUrl(url.value)) {
        error.value = 'Please enter a valid URL';
        return;
      }
      props.editor.setLink(normalizeUrl(url.value));
      props.editor.pm.view.focus();
      props.onClose();
    };

    const removeLink = () => {
      props.editor.removeLink();
      props.editor.pm.view.focus();
      props.onClose();
    };

    const openLink = () => {
      if (props.currentUrl) window.open(props.currentUrl, '_blank', 'noopener,noreferrer');
    };

    const style: CSSProperties = {
      ...(props.anchorToTrigger
        ? {
            position: 'absolute',
            left: '50%',
            top: openUpward.value ? undefined : 'calc(100% + 8px)',
            bottom: openUpward.value ? 'calc(100% + 8px)' : undefined,
            transform: 'translateX(-50%)',
            zIndex: 1001,
          }
        : {
            position: 'fixed',
            left: `${props.position?.left ?? 0}px`,
            top: `${props.position?.top ?? 0}px`,
            zIndex: 1001,
          }),
    };

    watch(
      () => props.currentUrl,
      (value) => {
        url.value = value || '';
        error.value = null;
      }
    );

    return () =>
      h(
        'div',
        {
          ref: popoverRef,
          class: ['ob-link-popover', props.className].filter(Boolean).join(' '),
          style,
          role: 'dialog',
          'aria-label': props.currentUrl ? 'Edit link' : 'Add link',
        },
        [
          h('form', { onSubmit: submit, class: 'ob-link-popover-form' }, [
            h('div', { class: 'ob-link-popover-input-row' }, [
              h('div', { class: ['ob-link-popover-input-wrapper', error.value ? 'ob-link-popover-input-wrapper--error' : ''].filter(Boolean).join(' ') }, [
                h('svg', { class: 'ob-link-popover-input-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [
                  h('path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }),
                  h('path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }),
                ]),
                h('input', {
                  ref: inputRef,
                  type: 'text',
                  class: 'ob-link-popover-input',
                  value: url.value,
                  placeholder: 'Enter URL...',
                  'aria-label': 'Link URL',
                  'aria-invalid': !!error.value,
                  onInput: (e: Event) => {
                    url.value = (e.target as HTMLInputElement).value;
                    error.value = null;
                  },
                }),
                props.currentUrl
                  ? [
                      h(
                        'button',
                        {
                          type: 'button',
                          class: 'ob-link-popover-inline-btn',
                          onClick: openLink,
                          title: 'Open link',
                        },
                        [h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [
                          h('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
                          h('polyline', { points: '15 3 21 3 21 9' }),
                          h('line', { x1: '10', y1: '14', x2: '21', y2: '3' }),
                        ])]
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          class: 'ob-link-popover-inline-btn ob-link-popover-inline-btn--danger',
                          onClick: removeLink,
                          title: 'Remove link',
                        },
                        [h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [h('path', { d: 'M18 6 6 18M6 6l12 12' })])]
                      ),
                    ]
                  : null,
                h(
                  'button',
                  {
                    type: 'submit',
                    class: 'ob-link-popover-inline-btn ob-link-popover-inline-btn--primary',
                    title: props.currentUrl ? 'Update link' : 'Add link',
                  },
                  [h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [h('polyline', { points: '20 6 9 17 4 12' })])]
                ),
              ]),
            ]),
            error.value ? h('p', { class: 'ob-link-popover-error' }, error.value) : null,
          ]),
        ]
      );
  },
});
