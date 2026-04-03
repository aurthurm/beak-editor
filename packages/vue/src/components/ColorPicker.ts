import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type CSSProperties,
  type PropType,
} from 'vue';
import { BeakBlockEditor } from '@aurthurm/beakblock-core';

export interface ColorOption {
  value: string;
  label: string;
}

export const DEFAULT_TEXT_COLORS: ColorOption[] = [
  { value: '', label: 'Default' },
  { value: '#374151', label: 'Gray' },
  { value: '#dc2626', label: 'Red' },
  { value: '#ea580c', label: 'Orange' },
  { value: '#ca8a04', label: 'Yellow' },
  { value: '#16a34a', label: 'Green' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#7c3aed', label: 'Purple' },
  { value: '#db2777', label: 'Pink' },
];

export const DEFAULT_BACKGROUND_COLORS: ColorOption[] = [
  { value: '', label: 'Default' },
  { value: '#f3f4f6', label: 'Gray' },
  { value: '#fee2e2', label: 'Red' },
  { value: '#ffedd5', label: 'Orange' },
  { value: '#fef9c3', label: 'Yellow' },
  { value: '#dcfce7', label: 'Green' },
  { value: '#dbeafe', label: 'Blue' },
  { value: '#ede9fe', label: 'Purple' },
  { value: '#fce7f3', label: 'Pink' },
];

export interface ColorPickerProps {
  editor: BeakBlockEditor;
  currentTextColor: string | null;
  currentBackgroundColor: string | null;
  textColors?: ColorOption[];
  backgroundColors?: ColorOption[];
  textColorLabel?: string;
  backgroundColorLabel?: string;
  onClose?: () => void;
}

export const ColorPicker = defineComponent({
  name: 'ColorPicker',
  props: {
    editor: { type: Object as PropType<BeakBlockEditor>, required: true },
    currentTextColor: { type: String as PropType<string | null>, default: null },
    currentBackgroundColor: { type: String as PropType<string | null>, default: null },
    textColors: { type: Array as PropType<ColorOption[]>, default: () => DEFAULT_TEXT_COLORS },
    backgroundColors: { type: Array as PropType<ColorOption[]>, default: () => DEFAULT_BACKGROUND_COLORS },
    textColorLabel: { type: String, default: 'Color' },
    backgroundColorLabel: { type: String, default: 'Background' },
    onClose: { type: Function as PropType<() => void>, default: undefined },
  },
  setup(props) {
    const isOpen = ref(false);
    const openUpward = ref(false);
    const containerRef = ref<HTMLElement | null>(null);
    const buttonRef = ref<HTMLButtonElement | null>(null);
    const dropdownRef = ref<HTMLElement | null>(null);

    const hasAnyColor = computed(() => props.currentTextColor || props.currentBackgroundColor);

    const close = () => {
      isOpen.value = false;
      props.onClose?.();
    };

    watch(isOpen, async (open) => {
      if (!open) return;
      await nextTick();
      const button = buttonRef.value;
      const dropdown = dropdownRef.value;
      if (!button || !dropdown) return;
      const buttonRect = button.getBoundingClientRect();
      const dropdownHeight = dropdown.offsetHeight || 250;
      const spaceBelow = window.innerHeight - buttonRect.bottom - 8;
      const spaceAbove = buttonRect.top - 8;
      openUpward.value = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    });

    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.value && !containerRef.value.contains(target)) {
        close();
      }
    };

    watch(isOpen, (open) => {
      if (open) {
        document.addEventListener('mousedown', handleOutside);
      } else {
        document.removeEventListener('mousedown', handleOutside);
      }
    });

    onBeforeUnmount(() => {
      document.removeEventListener('mousedown', handleOutside);
    });

    const selectTextColor = (color: string) => {
      if (color === '') props.editor.removeTextColor();
      else props.editor.setTextColor(color);
      close();
      props.editor.pm.view.focus();
    };

    const selectBackgroundColor = (color: string) => {
      if (color === '') props.editor.removeBackgroundColor();
      else props.editor.setBackgroundColor(color);
      close();
      props.editor.pm.view.focus();
    };

    const buttonStyle = (color: string | null): CSSProperties => ({
      color: color || 'currentColor',
    });

    return () =>
      h('div', { class: 'ob-color-picker', ref: containerRef }, [
        h(
          'button',
          {
            ref: buttonRef,
            type: 'button',
            class: ['ob-bubble-menu-btn', hasAnyColor.value ? 'ob-bubble-menu-btn--active' : '']
              .filter(Boolean)
              .join(' '),
            title: 'Colors',
            'aria-expanded': isOpen.value,
            'aria-haspopup': 'listbox',
            onClick: () => {
              isOpen.value = !isOpen.value;
            },
            onMousedown: (e: MouseEvent) => e.preventDefault(),
          },
          [
            h(
              'svg',
              { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' },
              [
                h('path', {
                  d: 'M5 18h14',
                  strokeWidth: '3',
                  stroke: props.currentTextColor || props.currentBackgroundColor || 'currentColor',
                }),
                h('path', { d: 'M6 15l6-12 6 12' }),
                h('path', { d: 'M8.5 11h7' }),
              ]
            ),
          ]
        ),
        isOpen.value
          ? h(
              'div',
              {
                ref: dropdownRef,
                class: 'ob-color-picker-dropdown',
                role: 'listbox',
                style: {
                  position: 'absolute',
                  left: '50%',
                  top: openUpward.value ? undefined : 'calc(100% + 8px)',
                  bottom: openUpward.value ? 'calc(100% + 8px)' : undefined,
                  transform: 'translateX(-50%)',
                },
              },
              [
                h('div', { class: 'ob-color-picker-section' }, [
                  h('div', { class: 'ob-color-picker-label' }, props.textColorLabel),
                  h(
                    'div',
                    { class: 'ob-color-picker-grid' },
                    props.textColors.map((color) =>
                      h(
                        'button',
                        {
                          key: `text-${color.value || 'default'}`,
                          type: 'button',
                          class: [
                            'ob-color-picker-option',
                            color.value === ''
                              ? !props.currentTextColor
                                ? 'ob-color-picker-option--active'
                                : ''
                              : props.currentTextColor === color.value
                                ? 'ob-color-picker-option--active'
                                : '',
                          ]
                            .filter(Boolean)
                            .join(' '),
                          onClick: () => selectTextColor(color.value),
                          onMousedown: (e: MouseEvent) => e.preventDefault(),
                          role: 'option',
                          'aria-selected': color.value === '' ? !props.currentTextColor : props.currentTextColor === color.value,
                          title: color.label,
                        },
                        color.value === ''
                          ? h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
                              h('circle', { cx: '12', cy: '12', r: '10' }),
                              h('path', { d: 'M4 4l16 16' }),
                            ])
                          : h('span', { class: 'ob-color-picker-swatch ob-color-picker-swatch--text' }, [
                              h('span', { style: buttonStyle(color.value) }, 'A'),
                            ])
                      )
                    )
                  ),
                ]),
                h('div', { class: 'ob-color-picker-divider' }),
                h('div', { class: 'ob-color-picker-section' }, [
                  h('div', { class: 'ob-color-picker-label' }, props.backgroundColorLabel),
                  h(
                    'div',
                    { class: 'ob-color-picker-grid' },
                    props.backgroundColors.map((color) =>
                      h(
                        'button',
                        {
                          key: `bg-${color.value || 'default'}`,
                          type: 'button',
                          class: [
                            'ob-color-picker-option',
                            color.value === ''
                              ? !props.currentBackgroundColor
                                ? 'ob-color-picker-option--active'
                                : ''
                              : props.currentBackgroundColor === color.value
                                ? 'ob-color-picker-option--active'
                                : '',
                          ]
                            .filter(Boolean)
                            .join(' '),
                          onClick: () => selectBackgroundColor(color.value),
                          onMousedown: (e: MouseEvent) => e.preventDefault(),
                          role: 'option',
                          'aria-selected':
                            color.value === '' ? !props.currentBackgroundColor : props.currentBackgroundColor === color.value,
                          title: color.label,
                        },
                        color.value === ''
                          ? h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
                              h('circle', { cx: '12', cy: '12', r: '10' }),
                              h('path', { d: 'M4 4l16 16' }),
                            ])
                          : h('span', {
                              class: 'ob-color-picker-swatch',
                              style: { backgroundColor: color.value },
                            })
                      )
                    )
                  ),
                ]),
              ]
            )
          : null,
      ]);
  },
});
