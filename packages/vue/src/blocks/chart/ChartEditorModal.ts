import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  Teleport,
  type PropType,
} from 'vue';
import {
  DEFAULT_CHART_CANVAS_MIN_HEIGHT_PX,
  type ChartEditorModalProps,
  type ChartBlockType,
  type ChartDataset,
  type ChartNodeData,
} from './chartTypes';

function parseOptionalPositivePx(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

const CHART_TYPES: Array<{ value: ChartBlockType; label: string }> = [
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'pie', label: 'Pie' },
  { value: 'doughnut', label: 'Doughnut' },
  { value: 'radar', label: 'Radar' },
  { value: 'polarArea', label: 'Polar Area' },
];

function getDefaultColor(index: number): { backgroundColor: string; borderColor: string } {
  return {
    backgroundColor: `rgba(59, 130, 246, ${0.5 + (index % 3) * 0.2})`,
    borderColor: 'rgba(59, 130, 246, 1)',
  };
}

export const ChartEditorModal = defineComponent<ChartEditorModalProps>({
  name: 'ChartEditorModal',
  props: {
    initialData: { type: Object as PropType<ChartNodeData>, required: true },
    onSave: { type: Function as PropType<(data: ChartNodeData) => void>, required: true },
    onCancel: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    const chartType = ref<ChartBlockType>(props.initialData.type);
    const chartTitle = ref(props.initialData.options?.plugins?.title?.text ?? '');
    const showLegend = ref(props.initialData.options?.plugins?.legend?.display ?? true);
    const legendPosition = ref<'top' | 'bottom' | 'left' | 'right'>(
      (props.initialData.options?.plugins?.legend?.position as 'top' | 'bottom' | 'left' | 'right') ?? 'top'
    );
    const colorMode = ref(props.initialData.options?.colorScheme?.mode ?? 'default');
    const labels = ref([...props.initialData.data.labels]);
    const datasets = ref<ChartDataset[]>(props.initialData.data.datasets.map((dataset) => ({ ...dataset })));
    const canvasWidth = ref(
      props.initialData.options?.width != null ? String(props.initialData.options.width) : ''
    );
    const canvasHeight = ref(
      props.initialData.options?.height != null ? String(props.initialData.options.height) : ''
    );
    const canvasMinHeight = ref(
      props.initialData.options?.minHeight != null ? String(props.initialData.options.minHeight) : ''
    );
    let handleKeyDown: ((event: KeyboardEvent) => void) | null = null;

    const chartTypeLabel = computed(() => CHART_TYPES.find((type) => type.value === chartType.value)?.label ?? 'Chart');

    const updateDatasetLabel = (index: number, label: string) => {
      datasets.value = datasets.value.map((dataset, i) => (i === index ? { ...dataset, label } : dataset));
    };

    const updateDatasetData = (index: number, data: string) => {
      const parsed = data.split(',').map((value) => Number.parseFloat(value.trim()) || 0);
      datasets.value = datasets.value.map((dataset, i) => (i === index ? { ...dataset, data: parsed } : dataset));
    };

    const addDataset = () => {
      const colors = getDefaultColor(datasets.value.length);
      datasets.value = [
        ...datasets.value,
        {
          label: `Dataset ${datasets.value.length + 1}`,
          data: labels.value.map(() => Math.floor(Math.random() * 100)),
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          borderWidth: 2,
        },
      ];
    };

    const removeDataset = (index: number) => {
      datasets.value = datasets.value.filter((_, i) => i !== index);
    };

    const updateLabels = (value: string) => {
      labels.value = value.split(',').map((label) => label.trim()).filter(Boolean);
    };

    const save = () => {
      const {
        width: _prevW,
        height: _prevH,
        minHeight: _prevMinH,
        ...optionsWithoutLayout
      } = props.initialData.options ?? {};

      const widthPx = parseOptionalPositivePx(canvasWidth.value);
      const heightPx = parseOptionalPositivePx(canvasHeight.value);
      const minHeightPx = parseOptionalPositivePx(canvasMinHeight.value);

      props.onSave({
        type: chartType.value,
        data: {
          labels: labels.value,
          datasets: datasets.value,
        },
        options: {
          ...optionsWithoutLayout,
          responsive: true,
          maintainAspectRatio: false,
          colorScheme: {
            mode: colorMode.value,
          },
          plugins: {
            title: {
              display: !!chartTitle.value,
              text: chartTitle.value,
              color: 'var(--ob-foreground, #37352f)',
              font: {
                size: 16,
                weight: 'bold',
              },
            },
            legend: {
              display: showLegend.value,
              position: legendPosition.value,
            },
          },
          ...(widthPx != null ? { width: widthPx } : {}),
          ...(heightPx != null ? { height: heightPx } : {}),
          ...(minHeightPx != null ? { minHeight: minHeightPx } : {}),
        },
      });
    };

    const overlayClick = (event: MouseEvent) => {
      if (event.target === event.currentTarget) {
        props.onCancel();
      }
    };

    onMounted(() => {
      handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') props.onCancel();
      };
      document.addEventListener('keydown', handleKeyDown);
    });

    onBeforeUnmount(() => {
      if (handleKeyDown) {
        document.removeEventListener('keydown', handleKeyDown);
      }
    });

    return () =>
      h(Teleport, { to: 'body' }, [
        h('div', { class: 'ob-chart-modal__overlay', onClick: overlayClick }, [
            h('div', { class: 'ob-chart-modal__panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ob-chart-modal-title' }, [
              h('div', { class: 'ob-chart-modal__header' }, [
                h('div', [
                  h('h2', { id: 'ob-chart-modal-title', class: 'ob-chart-modal__title' }, 'Edit chart'),
                  h('p', { class: 'ob-chart-modal__subtitle' }, `Configure a ${chartTypeLabel.value.toLowerCase()} chart.`),
                ]),
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'ob-chart-modal__close',
                    onClick: props.onCancel,
                  },
                  '×'
                ),
              ]),
              h('div', { class: 'ob-chart-modal__body' }, [
                h('section', { class: 'ob-chart-modal__section', 'aria-labelledby': 'ob-chart-sec-chart' }, [
                  h('h3', { id: 'ob-chart-sec-chart', class: 'ob-chart-modal__section-title' }, 'Chart'),
                  h('div', { class: 'ob-chart-modal__section-body ob-chart-modal__chart-row' }, [
                    h('label', { class: 'ob-chart-modal__field' }, [
                      h('span', { class: 'ob-chart-modal__label' }, 'Type'),
                      h(
                        'select',
                        {
                          class: 'ob-chart-modal__select',
                          value: chartType.value,
                          onChange: (event: Event) => {
                            chartType.value = (event.target as HTMLSelectElement).value as ChartBlockType;
                          },
                        },
                        CHART_TYPES.map((item) => h('option', { value: item.value }, item.label))
                      ),
                    ]),
                    h('label', { class: 'ob-chart-modal__field' }, [
                      h('span', { class: 'ob-chart-modal__label' }, 'Title'),
                      h('input', {
                        class: 'ob-chart-modal__input',
                        type: 'text',
                        value: chartTitle.value,
                        placeholder: 'Visible above the chart',
                        onInput: (event: Event) => {
                          chartTitle.value = (event.target as HTMLInputElement).value;
                        },
                      }),
                    ]),
                  ]),
                ]),
                h('section', { class: 'ob-chart-modal__section', 'aria-labelledby': 'ob-chart-sec-size' }, [
                  h('h3', { id: 'ob-chart-sec-size', class: 'ob-chart-modal__section-title' }, 'Canvas size'),
                  h('div', { class: 'ob-chart-modal__section-body' }, [
                    h('div', { class: 'ob-chart-modal__size-row' }, [
                      h('label', { class: 'ob-chart-modal__field' }, [
                        h('span', { class: 'ob-chart-modal__label' }, 'Width (px)'),
                        h('input', {
                          class: 'ob-chart-modal__input',
                          type: 'number',
                          min: 1,
                          step: 1,
                          inputmode: 'numeric',
                          placeholder: 'Auto',
                          value: canvasWidth.value,
                          onInput: (event: Event) => {
                            canvasWidth.value = (event.target as HTMLInputElement).value;
                          },
                        }),
                      ]),
                      h('label', { class: 'ob-chart-modal__field' }, [
                        h('span', { class: 'ob-chart-modal__label' }, 'Height (px)'),
                        h('input', {
                          class: 'ob-chart-modal__input',
                          type: 'number',
                          min: 1,
                          step: 1,
                          inputmode: 'numeric',
                          placeholder: 'Auto',
                          value: canvasHeight.value,
                          onInput: (event: Event) => {
                            canvasHeight.value = (event.target as HTMLInputElement).value;
                          },
                        }),
                      ]),
                      h('label', { class: 'ob-chart-modal__field' }, [
                        h('span', { class: 'ob-chart-modal__label' }, 'Min height (px)'),
                        h('input', {
                          class: 'ob-chart-modal__input',
                          type: 'number',
                          min: 1,
                          step: 1,
                          inputmode: 'numeric',
                          placeholder: String(DEFAULT_CHART_CANVAS_MIN_HEIGHT_PX),
                          value: canvasMinHeight.value,
                          onInput: (event: Event) => {
                            canvasMinHeight.value = (event.target as HTMLInputElement).value;
                          },
                        }),
                      ]),
                    ]),
                    h(
                      'p',
                      { class: 'ob-chart-modal__hint' },
                      `Leave fields empty to use defaults: full width and a ${DEFAULT_CHART_CANVAS_MIN_HEIGHT_PX}px minimum height (unless you set a fixed height).`
                    ),
                  ]),
                ]),
                h('section', { class: 'ob-chart-modal__section', 'aria-labelledby': 'ob-chart-sec-legend' }, [
                  h('h3', { id: 'ob-chart-sec-legend', class: 'ob-chart-modal__section-title' }, 'Legend'),
                  h('div', { class: 'ob-chart-modal__section-body' }, [
                    h('div', { class: 'ob-chart-modal__legend-row' }, [
                      h('label', { class: 'ob-chart-modal__checkbox-label' }, [
                        h('input', {
                          type: 'checkbox',
                          class: 'ob-chart-modal__checkbox',
                          checked: showLegend.value,
                          onChange: (event: Event) => {
                            showLegend.value = (event.target as HTMLInputElement).checked;
                          },
                        }),
                        h('span', null, 'Show legend'),
                      ]),
                      showLegend.value
                        ? h('label', { class: 'ob-chart-modal__field ob-chart-modal__field--legend-position' }, [
                            h('span', { class: 'ob-chart-modal__label ob-chart-modal__label--inline' }, 'Position'),
                            h(
                              'select',
                              {
                                class: 'ob-chart-modal__select',
                                value: legendPosition.value,
                                onChange: (event: Event) => {
                                  legendPosition.value = (event.target as HTMLSelectElement).value as 'top' | 'bottom' | 'left' | 'right';
                                },
                              },
                              ['top', 'bottom', 'left', 'right'].map((value) =>
                                h('option', { value }, value[0].toUpperCase() + value.slice(1))
                              )
                            ),
                          ])
                        : null,
                    ]),
                  ]),
                ]),
                h('section', { class: 'ob-chart-modal__section', 'aria-labelledby': 'ob-chart-sec-colors' }, [
                  h('h3', { id: 'ob-chart-sec-colors', class: 'ob-chart-modal__section-title' }, 'Colors'),
                  h('div', { class: 'ob-chart-modal__section-body' }, [
                    h('label', { class: 'ob-chart-modal__field' }, [
                      h('span', { class: 'ob-chart-modal__label' }, 'Palette style'),
                      h(
                        'select',
                        {
                          class: 'ob-chart-modal__select',
                          value: colorMode.value,
                          onChange: (event: Event) => {
                            colorMode.value = (event.target as HTMLSelectElement).value as 'default' | 'random' | 'gradient';
                          },
                        },
                        [
                          h('option', { value: 'default' }, 'Default'),
                          h('option', { value: 'random' }, 'Random'),
                          h('option', { value: 'gradient' }, 'Gradient'),
                        ]
                      ),
                      h('p', { class: 'ob-chart-modal__hint' }, 'Gradient works well for bar, pie, doughnut, and polar area charts with many categories.'),
                    ]),
                  ]),
                ]),
                h('section', { class: 'ob-chart-modal__section', 'aria-labelledby': 'ob-chart-sec-data' }, [
                  h('h3', { id: 'ob-chart-sec-data', class: 'ob-chart-modal__section-title' }, 'Data'),
                  h('div', { class: 'ob-chart-modal__section-body' }, [
                    h('label', { class: 'ob-chart-modal__field' }, [
                      h('span', { class: 'ob-chart-modal__label' }, 'Category labels'),
                      h('input', {
                        class: 'ob-chart-modal__input',
                        type: 'text',
                        value: labels.value.join(', '),
                        placeholder: 'Neural Networks, NLP, Vision…',
                        onInput: (event: Event) => {
                          updateLabels((event.target as HTMLInputElement).value);
                        },
                      }),
                      h('p', { class: 'ob-chart-modal__hint' }, 'Comma-separated. Order should match values in each series.'),
                    ]),
                    h('div', { class: 'ob-chart-modal__datasets' }, [
                      h('div', { class: 'ob-chart-modal__datasets-header' }, [
                        h('span', { class: 'ob-chart-modal__datasets-heading' }, 'Series'),
                        h(
                          'button',
                          {
                            type: 'button',
                            class: 'ob-chart-modal__button ob-chart-modal__button--ghost',
                            onClick: addDataset,
                          },
                          '+ Add series'
                        ),
                      ]),
                      datasets.value.map((dataset, index) =>
                        h('div', { key: index, class: 'ob-chart-modal__dataset' }, [
                          h('div', { class: 'ob-chart-modal__dataset-head' }, [
                            h('span', { class: 'ob-chart-modal__dataset-index' }, `Series ${index + 1}`),
                            h(
                              'button',
                              {
                                type: 'button',
                                class: 'ob-chart-modal__button ob-chart-modal__button--text-danger',
                                onClick: () => removeDataset(index),
                              },
                              'Remove'
                            ),
                          ]),
                          h('div', { class: 'ob-chart-modal__dataset-grid' }, [
                            h('label', { class: 'ob-chart-modal__subfield' }, [
                              h('span', { class: 'ob-chart-modal__sublabel' }, 'Name'),
                              h('input', {
                                class: 'ob-chart-modal__input',
                                type: 'text',
                                value: dataset.label ?? '',
                                placeholder: 'e.g. Revenue',
                                onInput: (event: Event) => updateDatasetLabel(index, (event.target as HTMLInputElement).value),
                              }),
                            ]),
                            h('label', { class: 'ob-chart-modal__subfield' }, [
                              h('span', { class: 'ob-chart-modal__sublabel' }, 'Values'),
                              h('input', {
                                class: 'ob-chart-modal__input',
                                type: 'text',
                                value: dataset.data.join(', '),
                                placeholder: '10, 20, 30…',
                                onInput: (event: Event) => updateDatasetData(index, (event.target as HTMLInputElement).value),
                              }),
                            ]),
                          ]),
                        ])
                      ),
                    ]),
                  ]),
                ]),
              ]),
              h('div', { class: 'ob-chart-modal__footer' }, [
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'ob-chart-modal__button ob-chart-modal__button--secondary',
                    onClick: props.onCancel,
                  },
                  'Cancel'
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'ob-chart-modal__button',
                    onClick: save,
                  },
                  'Save'
                ),
              ]),
            ]),
          ]),
      ]);
  },
});
