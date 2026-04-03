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
import type { ChartEditorModalProps, ChartBlockType, ChartDataset, ChartNodeData } from './chartTypes';

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
      props.onSave({
        type: chartType.value,
        data: {
          labels: labels.value,
          datasets: datasets.value,
        },
        options: {
          ...props.initialData.options,
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
                h('label', { class: 'ob-chart-modal__field' }, [
                  h('span', { class: 'ob-chart-modal__label' }, 'Chart type'),
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
                    placeholder: 'Chart title...',
                    onInput: (event: Event) => {
                      chartTitle.value = (event.target as HTMLInputElement).value;
                    },
                  }),
                ]),
                h('div', { class: 'ob-chart-modal__row' }, [
                  h('label', { class: 'ob-chart-modal__checkbox-label' }, [
                    h('input', {
                      type: 'checkbox',
                      checked: showLegend.value,
                      onChange: (event: Event) => {
                        showLegend.value = (event.target as HTMLInputElement).checked;
                      },
                    }),
                    h('span', null, 'Show legend'),
                  ]),
                  showLegend.value
                    ? h('label', { class: 'ob-chart-modal__field' }, [
                        h('span', { class: 'ob-chart-modal__label' }, 'Legend position'),
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
                h('label', { class: 'ob-chart-modal__field' }, [
                  h('span', { class: 'ob-chart-modal__label' }, 'Color style'),
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
                  h('p', { class: 'ob-chart-modal__hint' }, 'Best for charts with many categories such as bar, pie, doughnut, and polar area charts.'),
                ]),
                h('label', { class: 'ob-chart-modal__field' }, [
                  h('span', { class: 'ob-chart-modal__label' }, 'Labels'),
                  h('input', {
                    class: 'ob-chart-modal__input',
                    type: 'text',
                    value: labels.value.join(', '),
                    placeholder: 'Jan, Feb, Mar, Apr...',
                    onInput: (event: Event) => {
                      updateLabels((event.target as HTMLInputElement).value);
                    },
                  }),
                ]),
                h('div', { class: 'ob-chart-modal__datasets' }, [
                  h('div', { class: 'ob-chart-modal__datasets-header' }, [
                    h('span', { class: 'ob-chart-modal__label' }, 'Datasets'),
                    h(
                      'button',
                      {
                        type: 'button',
                        class: 'ob-chart-modal__button ob-chart-modal__button--secondary',
                        onClick: addDataset,
                      },
                      '+ Add dataset'
                    ),
                  ]),
                  datasets.value.map((dataset, index) =>
                    h('div', { key: index, class: 'ob-chart-modal__dataset' }, [
                      h('div', { class: 'ob-chart-modal__dataset-grid' }, [
                        h('input', {
                          class: 'ob-chart-modal__input',
                          type: 'text',
                          value: dataset.label ?? '',
                          placeholder: 'Dataset label...',
                          onInput: (event: Event) => updateDatasetLabel(index, (event.target as HTMLInputElement).value),
                        }),
                        h('input', {
                          class: 'ob-chart-modal__input',
                          type: 'text',
                          value: dataset.data.join(', '),
                          placeholder: '10, 20, 30, 40...',
                          onInput: (event: Event) => updateDatasetData(index, (event.target as HTMLInputElement).value),
                        }),
                      ]),
                      h(
                        'button',
                        {
                          type: 'button',
                          class: 'ob-chart-modal__button ob-chart-modal__button--danger',
                          onClick: () => removeDataset(index),
                        },
                        'Remove'
                      ),
                    ])
                  ),
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
