import { computed, defineComponent, h, type PropType } from 'vue';

/** Document view modes. */
export type OfficeViewMode = 'print' | 'draft' | 'outline' | 'preview';

/** View modes in display order, with their labels. */
export const OFFICE_VIEW_MODES: ReadonlyArray<{ id: OfficeViewMode; label: string }> = [
  { id: 'print', label: 'Print Layout' },
  { id: 'draft', label: 'Draft' },
  { id: 'outline', label: 'Outline' },
  { id: 'preview', label: 'Print Preview' },
];

/** Zoom limits and step, as multipliers (1 = 100%). */
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2;
export const ZOOM_STEP = 0.1;

/** Clamp a zoom value to the supported range and round to 0.01. */
export function clampZoom(value: number): number {
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)) * 100) / 100;
}

/**
 * Zoom control and view switch. Emits `update:zoom`, `update:viewMode`, `update:multiPage`,
 * `update:focusMode` and `fit-width` (the app or shell computes the page-width zoom).
 */
export const ZoomControl = defineComponent({
  name: 'BeakBlockOfficeZoomControl',
  props: {
    zoom: { type: Number, default: 1 },
    viewMode: { type: String as PropType<OfficeViewMode>, default: 'print' },
    multiPage: { type: Boolean, default: true },
    focusMode: { type: Boolean, default: false },
    /** Show the view switch. */
    showViewModes: { type: Boolean, default: true },
  },
  emits: {
    'update:zoom': (zoom: number) => typeof zoom === 'number',
    'update:viewMode': (mode: OfficeViewMode) => typeof mode === 'string',
    'update:multiPage': (value: boolean) => typeof value === 'boolean',
    'update:focusMode': (value: boolean) => typeof value === 'boolean',
    'fit-width': () => true,
  },
  setup(props, { emit }) {
    const percent = computed(() => `${Math.round(props.zoom * 100)}%`);

    return () =>
      h('div', { class: 'bb-office-zoom-group', 'data-beakblock-zoom': '' }, [
        h('div', { class: 'bb-office-zoom', role: 'group', 'aria-label': 'Zoom' }, [
          h('button', {
            type: 'button',
            class: 'bb-office-button',
            'aria-label': 'Zoom out',
            disabled: props.zoom <= ZOOM_MIN,
            onClick: () => emit('update:zoom', clampZoom(props.zoom - ZOOM_STEP)),
          }, '−'),
          h('button', {
            type: 'button',
            class: 'bb-office-button bb-office-zoom-value',
            'aria-label': `Zoom ${percent.value}, reset to 100%`,
            title: 'Reset to 100%',
            onClick: () => emit('update:zoom', 1),
          }, percent.value),
          h('button', {
            type: 'button',
            class: 'bb-office-button',
            'aria-label': 'Zoom in',
            disabled: props.zoom >= ZOOM_MAX,
            onClick: () => emit('update:zoom', clampZoom(props.zoom + ZOOM_STEP)),
          }, '+'),
          h('button', {
            type: 'button',
            class: 'bb-office-button',
            title: 'Fit to page width',
            onClick: () => emit('fit-width'),
          }, 'Page width'),
        ]),
        h('div', { class: 'bb-office-view-switch', role: 'radiogroup', 'aria-label': 'View mode' },
          props.showViewModes
            ? OFFICE_VIEW_MODES.map((mode) =>
                h('button', {
                  type: 'button',
                  role: 'radio',
                  class: 'bb-office-button',
                  'aria-checked': String(props.viewMode === mode.id),
                  'data-view-mode': mode.id,
                  title: mode.label,
                  onClick: () => emit('update:viewMode', mode.id),
                }, mode.label)
              )
            : []
        ),
        h('button', {
          type: 'button',
          class: 'bb-office-button',
          role: 'switch',
          'aria-checked': String(props.multiPage),
          title: props.multiPage ? 'Show one page at a time' : 'Show multiple pages',
          onClick: () => emit('update:multiPage', !props.multiPage),
        }, props.multiPage ? 'Multi-page' : 'Single page'),
        h('button', {
          type: 'button',
          class: 'bb-office-button',
          role: 'switch',
          'aria-checked': String(props.focusMode),
          title: 'Focus mode hides the ribbon, navigation and status bar',
          onClick: () => emit('update:focusMode', !props.focusMode),
        }, 'Focus'),
      ]);
  },
});
