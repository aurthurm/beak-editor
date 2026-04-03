import { computed, defineComponent, h, onBeforeUnmount, ref, Teleport, watch, type PropType } from 'vue';
import {
  MEDIA_MENU_PLUGIN_KEY,
  deleteMediaNode,
  type EmbedAttrs,
  type ImageAttrs,
  type MediaMenuState,
  updateMediaAttrs,
  type BeakBlockEditor,
} from '@aurthurm/beakblock-core';

export interface MediaMenuProps {
  editor: BeakBlockEditor | null;
  className?: string;
}

const AlignmentButton = defineComponent({
  name: 'AlignmentButton',
  props: {
    active: { type: Boolean, required: true },
    onClick: { type: Function as PropType<() => void>, required: true },
    title: { type: String, required: true },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'button',
        {
          type: 'button',
          class: ['ob-media-menu-btn', props.active ? 'ob-media-menu-btn--active' : ''].filter(Boolean).join(' '),
          title: props.title,
          onClick: props.onClick,
          onMousedown: (e: MouseEvent) => e.preventDefault(),
        },
        slots.default?.()
      );
  },
});

const UrlEditPopover = defineComponent({
  name: 'UrlEditPopover',
  props: {
    currentUrl: { type: String, required: true },
    onSave: { type: Function as PropType<(url: string) => void>, required: true },
    onClose: { type: Function as PropType<() => void>, required: true },
    label: { type: String, required: true },
  },
  setup(props) {
    const url = ref(props.currentUrl);
    const inputRef = ref<HTMLInputElement | null>(null);
    watch(
      () => props.currentUrl,
      (value) => {
        url.value = value;
      }
    );
    watch(
      () => null,
      () => inputRef.value?.focus(),
      { immediate: true }
    );
    const submit = (e: Event) => {
      e.preventDefault();
      props.onSave(url.value);
      props.onClose();
    };
    return () =>
      h('div', { class: 'ob-media-url-popover', onKeydown: (e: KeyboardEvent) => e.key === 'Escape' && props.onClose(), onMousedown: (e: MouseEvent) => e.stopPropagation() }, [
        h('form', { onSubmit: submit }, [
          h('label', { class: 'ob-media-url-label' }, props.label),
          h('input', { ref: inputRef, type: 'url', class: 'ob-media-url-input', value: url.value, placeholder: 'https://...', onInput: (e: Event) => (url.value = (e.target as HTMLInputElement).value) }),
          h('div', { class: 'ob-media-url-actions' }, [
            h('button', { type: 'button', class: 'ob-media-url-btn ob-media-url-btn--cancel', onClick: props.onClose }, 'Cancel'),
            h('button', { type: 'submit', class: 'ob-media-url-btn ob-media-url-btn--save' }, 'Save'),
          ]),
        ]),
      ]);
  },
});

const CaptionEditPopover = defineComponent({
  name: 'CaptionEditPopover',
  props: {
    currentCaption: { type: String, required: true },
    onSave: { type: Function as PropType<(caption: string) => void>, required: true },
    onClose: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    const caption = ref(props.currentCaption);
    const inputRef = ref<HTMLInputElement | null>(null);
    watch(
      () => props.currentCaption,
      (value) => {
        caption.value = value;
      }
    );
    watch(
      () => null,
      () => inputRef.value?.focus(),
      { immediate: true }
    );
    const submit = (e: Event) => {
      e.preventDefault();
      props.onSave(caption.value);
      props.onClose();
    };
    return () =>
      h('div', { class: 'ob-media-url-popover', onKeydown: (e: KeyboardEvent) => e.key === 'Escape' && props.onClose(), onMousedown: (e: MouseEvent) => e.stopPropagation() }, [
        h('form', { onSubmit: submit }, [
          h('label', { class: 'ob-media-url-label' }, 'Caption'),
          h('input', { ref: inputRef, type: 'text', class: 'ob-media-url-input', value: caption.value, placeholder: 'Enter caption...', onInput: (e: Event) => (caption.value = (e.target as HTMLInputElement).value) }),
          h('div', { class: 'ob-media-url-actions' }, [
            h('button', { type: 'button', class: 'ob-media-url-btn ob-media-url-btn--cancel', onClick: props.onClose }, 'Cancel'),
            h('button', { type: 'submit', class: 'ob-media-url-btn ob-media-url-btn--save' }, 'Save'),
          ]),
        ]),
      ]);
  },
});

export const MediaMenu = defineComponent({
  name: 'MediaMenu',
  props: {
    editor: { type: Object as PropType<BeakBlockEditor | null>, default: null },
    className: { type: String, default: '' },
  },
  setup(props) {
    const menuState = ref<MediaMenuState | null>(null);
    const showUrlEdit = ref(false);
    const showCaptionEdit = ref(false);
    const fileInputRef = ref<HTMLInputElement | null>(null);
    const menuRef = ref<HTMLElement | null>(null);
    const lastValidState = ref<MediaMenuState | null>(null);

    const getMenuHost = () => {
      if (!props.editor || props.editor.isDestroyed) return null;
      return (props.editor.pm.view.dom.closest('.beakblock-vue-view') as HTMLElement | null) || props.editor.pm.view.dom.parentElement || null;
    };

    const updateState = () => {
      if (!props.editor || props.editor.isDestroyed) return;
      const state = MEDIA_MENU_PLUGIN_KEY.getState(props.editor.pm.state);
      if (state?.visible) {
        lastValidState.value = state;
        menuState.value = state;
      } else if (!showUrlEdit.value && !showCaptionEdit.value) {
        lastValidState.value = null;
        menuState.value = state ?? null;
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

    watch(
      () => [menuState.value?.visible, showUrlEdit.value, showCaptionEdit.value],
      () => {
        if (!menuState.value?.visible && !showUrlEdit.value && !showCaptionEdit.value) {
          lastValidState.value = null;
        }
      }
    );

    const handleScroll = () => {
      if (!props.editor || props.editor.isDestroyed) return;
      props.editor.pm.view.dispatch(props.editor.pm.view.state.tr.setMeta(MEDIA_MENU_PLUGIN_KEY, { hide: true }));
    };

    watch(
      () => [props.editor, menuState.value?.visible] as const,
      ([editor, visible], _prev, onCleanup) => {
        if (!editor || editor.isDestroyed || !visible) return;
        const editorElement = editor.pm.view.dom;
        const scrollContainer = editorElement.closest('.beakblock-container') || editorElement.parentElement;
        window.addEventListener('scroll', handleScroll, true);
        scrollContainer?.addEventListener('scroll', handleScroll);
        onCleanup(() => {
          window.removeEventListener('scroll', handleScroll, true);
          scrollContainer?.removeEventListener('scroll', handleScroll);
        });
      },
      { immediate: true }
    );

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.ob-media-menu') || target.closest('.ob-media-url-popover') || target.closest('.beakblock-image') || target.closest('.beakblock-embed')) return;
      showUrlEdit.value = false;
      showCaptionEdit.value = false;
      lastValidState.value = null;
    };

    watch(
      () => [props.editor, menuState.value?.visible, showUrlEdit.value, showCaptionEdit.value] as const,
      ([editor, visible, urlOpen, captionOpen], _prev, onCleanup) => {
        if (!editor || (!visible && !urlOpen && !captionOpen)) return;
        document.addEventListener('mousedown', handleClickOutside);
        onCleanup(() => document.removeEventListener('mousedown', handleClickOutside));
      },
      { immediate: true }
    );

    onBeforeUnmount(() => document.removeEventListener('mousedown', handleClickOutside));

    const activeState = computed(() => menuState.value?.visible ? menuState.value : (showUrlEdit.value || showCaptionEdit.value ? lastValidState.value : null));

    const alignmentChange = (alignment: 'left' | 'center' | 'right') => {
      const state = activeState.value;
      if (!props.editor || !state?.nodePos) return;
      updateMediaAttrs(props.editor.pm.view, state.nodePos, { alignment });
      props.editor.pm.view.focus();
    };

    const urlSave = (url: string) => {
      const state = activeState.value;
      if (!props.editor || !state?.nodePos) return;
      if (state.mediaType === 'image') updateMediaAttrs(props.editor.pm.view, state.nodePos, { src: url });
      else updateMediaAttrs(props.editor.pm.view, state.nodePos, { url });
      showUrlEdit.value = false;
      props.editor.pm.view.focus();
    };

    const readFileAsDataUrl = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

    const openFilePicker = () => {
      fileInputRef.value?.click();
    };

    const uploadImage = async (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      const state = activeState.value;

      target.value = '';
      if (!props.editor || !state?.nodePos || !file || state.mediaType !== 'image') return;

      try {
        const dataUrl = await readFileAsDataUrl(file);
        updateMediaAttrs(props.editor.pm.view, state.nodePos, {
          src: dataUrl,
          alt: state.attrs && 'alt' in state.attrs && state.attrs.alt ? state.attrs.alt : file.name,
        });
        props.editor.pm.view.focus();
      } catch {
        // Ignore file read errors; the user can try again.
      }
    };

    const captionSave = (caption: string) => {
      const state = activeState.value;
      if (!props.editor || !state?.nodePos) return;
      updateMediaAttrs(props.editor.pm.view, state.nodePos, { caption });
      showCaptionEdit.value = false;
      props.editor.pm.view.focus();
    };

    const deleteNode = () => {
      const state = activeState.value;
      if (!props.editor || !state?.nodePos) return;
      deleteMediaNode(props.editor.pm.view, state.nodePos);
      props.editor.pm.view.focus();
    };

    const style = computed(() => {
      const state = activeState.value;
      const host = getMenuHost();
      if (!state?.coords || !host) return undefined;
      const hostRect = host.getBoundingClientRect();
      return {
        position: 'absolute',
        left: `${Math.max(state.coords.left + (state.coords.right - state.coords.left) / 2 - hostRect.left, 4)}px`,
        top: `${Math.max(state.coords.top - hostRect.top - 52, 4)}px`,
        transform: 'translateX(-50%)',
        zIndex: 1000,
      };
    });

    return () => {
      const host = getMenuHost();
      if (!props.editor || props.editor.isDestroyed || !activeState.value || !activeState.value.coords || !host || !style.value) return null;
      const state = activeState.value;
      const isImage = state.mediaType === 'image';
      const imageAttrs = isImage ? (state.attrs as ImageAttrs) : null;
      const embedAttrs = !isImage ? (state.attrs as EmbedAttrs) : null;
      const alignment = imageAttrs?.alignment || 'center';
      const currentUrl = isImage ? imageAttrs?.src || '' : embedAttrs?.url || '';
      const currentCaption = state.attrs?.caption || '';

      return h(Teleport, { to: host }, [
        h(
          'div',
          { ref: menuRef, class: ['ob-media-menu', props.className].filter(Boolean).join(' '), style: style.value, role: 'toolbar', 'aria-label': `${isImage ? 'Image' : 'Embed'} options` },
          [
            isImage
              ? [
                  h(AlignmentButton, { active: alignment === 'left', onClick: () => alignmentChange('left'), title: 'Align left' }, { default: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [h('rect', { x: '3', y: '5', width: '10', height: '14', rx: '1' }), h('path', { d: 'M17 8h4M17 12h4M17 16h4' })]) }),
                  h(AlignmentButton, { active: alignment === 'center', onClick: () => alignmentChange('center'), title: 'Align center' }, { default: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [h('rect', { x: '7', y: '5', width: '10', height: '14', rx: '1' })]) }),
                  h(AlignmentButton, { active: alignment === 'right', onClick: () => alignmentChange('right'), title: 'Align right' }, { default: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [h('rect', { x: '11', y: '5', width: '10', height: '14', rx: '1' }), h('path', { d: 'M3 8h4M3 12h4M3 16h4' })]) }),
                  h('span', { class: 'ob-media-menu-divider' }),
                ]
              : null,
            h('button', { type: 'button', class: ['ob-media-menu-btn', showUrlEdit.value ? 'ob-media-menu-btn--active' : ''].filter(Boolean).join(' '), title: isImage ? 'Edit image URL' : 'Edit embed URL', onClick: () => { showUrlEdit.value = !showUrlEdit.value; showCaptionEdit.value = false; }, onMousedown: (e: MouseEvent) => e.preventDefault() }, [h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [h('path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }), h('path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' })])]),
            isImage
              ? h('button', {
                  type: 'button',
                  class: 'ob-media-menu-btn',
                  title: 'Upload image from computer',
                  onClick: openFilePicker,
                  onMousedown: (e: MouseEvent) => e.preventDefault(),
                }, [h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [h('path', { d: 'M12 3v12' }), h('path', { d: 'M7 8l5-5 5 5' }), h('path', { d: 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2' })])])
              : null,
            h('button', { type: 'button', class: ['ob-media-menu-btn', showCaptionEdit.value ? 'ob-media-menu-btn--active' : ''].filter(Boolean).join(' '), title: 'Edit caption', onClick: () => { showCaptionEdit.value = !showCaptionEdit.value; showUrlEdit.value = false; }, onMousedown: (e: MouseEvent) => e.preventDefault() }, [h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [h('rect', { x: '3', y: '5', width: '18', height: '14', rx: '2' }), h('path', { d: 'M7 15h10M7 11h4' })])]),
            h('span', { class: 'ob-media-menu-divider' }),
            h('button', { type: 'button', class: 'ob-media-menu-btn ob-media-menu-btn--danger', title: 'Delete', onClick: deleteNode, onMousedown: (e: MouseEvent) => e.preventDefault() }, [h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }, [h('path', { d: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }), h('line', { x1: '10', y1: '11', x2: '10', y2: '17' }), h('line', { x1: '14', y1: '11', x2: '14', y2: '17' })])]),
            isImage
              ? h('input', {
                  ref: fileInputRef,
                  type: 'file',
                  accept: 'image/*',
                  style: { display: 'none' },
                  onChange: uploadImage,
                })
              : null,
            showUrlEdit.value ? h(UrlEditPopover, { currentUrl, onSave: urlSave, onClose: () => (showUrlEdit.value = false), label: isImage ? 'Image URL' : 'Embed URL' }) : null,
            showCaptionEdit.value ? h(CaptionEditPopover, { currentCaption, onSave: captionSave, onClose: () => (showCaptionEdit.value = false) }) : null,
          ].flat()
        ),
      ]);
    };
  },
});
