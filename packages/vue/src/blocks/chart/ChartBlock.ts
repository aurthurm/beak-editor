import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import type { Chart } from 'chart.js';
import { useUpdateBlock } from '../createVueBlockSpec';
import { ChartEditorModal } from './ChartEditorModal';
import { createCategoryColorPalette } from './chartTypes';
import type { ChartBlockType, ChartNodeData } from './chartTypes';

export interface ChartBlockRenderProps {
  block: {
    id: string;
    type: string;
    props: {
      data: ChartNodeData;
    };
  };
  editor: import('@aurthurm/beakblock-core').BeakBlockEditor;
  isEditable: boolean;
}

function getCSSVariableColor(element: HTMLElement, varName: string, fallback: string): string {
  const computedStyle = getComputedStyle(element);
  const cleanVarName = varName.replace(/^var\(/, '').replace(/\)$/, '');
  const color = computedStyle.getPropertyValue(cleanVarName).trim();
  return color || fallback;
}

function shouldShowAxes(type: ChartNodeData['type']): boolean {
  return type === 'bar' || type === 'line' || type === 'radar';
}

function supportsCategoryPalette(type: ChartBlockType): boolean {
  return type === 'bar' || type === 'pie' || type === 'doughnut' || type === 'polarArea';
}

function cloneDataset<T extends Record<string, unknown>>(dataset: T): T {
  return JSON.parse(JSON.stringify(dataset)) as T;
}

export const ChartBlock = defineComponent<ChartBlockRenderProps>({
  name: 'ChartBlock',
  props: {
    block: { type: Object as () => ChartBlockRenderProps['block'], required: true },
    editor: { type: Object as () => ChartBlockRenderProps['editor'], required: true },
    isEditable: { type: Boolean, default: true },
  },
  setup(props) {
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const containerRef = ref<HTMLElement | null>(null);
    const chartInstance = ref<Chart | null>(null);
    const chartJs = ref<typeof import('chart.js/auto').default | null>(null);
    const isEditing = ref(false);
    const updateBlock = useUpdateBlock(props.editor, props.block.id);

    const chartData = computed(() => props.block.props.data);
    const editable = computed(() => props.isEditable);

    const destroyChart = () => {
      if (chartInstance.value) {
        chartInstance.value.destroy();
        chartInstance.value = null;
      }
    };

    const renderChart = async () => {
      if (!canvasRef.value || !chartData.value) return;

      try {
        const module = await import('chart.js/auto');
        chartJs.value = module.default;
        destroyChart();

        const ctx = canvasRef.value.getContext('2d');
        if (!ctx) return;

        const container = containerRef.value;
        const textColor = container ? getCSSVariableColor(container, '--ob-foreground', '#37352f') : '#37352f';
        const textMutedColor = container ? getCSSVariableColor(container, '--ob-muted-foreground', '#9b9a97') : '#9b9a97';
        const subtleGridColor = 'rgba(125, 125, 125, 0.08)';
        const colorMode = chartData.value.options?.colorScheme?.mode ?? 'default';
        const labelsCount = chartData.value.data.labels.length;
        const datasetCount = chartData.value.data.datasets.length;
        const paletteCount = supportsCategoryPalette(chartData.value.type) && datasetCount === 1 ? labelsCount : datasetCount;
        const palette = createCategoryColorPalette(Math.max(paletteCount, 1), colorMode);
        const themedDatasets = chartData.value.data.datasets.map((dataset, index) => {
          const nextDataset = cloneDataset(dataset);
          const seriesColor = palette.backgroundColor[index % palette.backgroundColor.length];
          const seriesBorderColor = palette.borderColor[index % palette.borderColor.length];
          const categoryPalette = supportsCategoryPalette(chartData.value.type) && datasetCount === 1
            ? createCategoryColorPalette(Math.max(labelsCount, 1), colorMode)
            : null;

          if (colorMode === 'default') {
            return nextDataset;
          }

          if (categoryPalette && labelsCount > 0) {
            nextDataset.backgroundColor = categoryPalette.backgroundColor;
            nextDataset.borderColor = categoryPalette.borderColor;
            return nextDataset;
          }

          nextDataset.backgroundColor = seriesColor;
          nextDataset.borderColor = seriesBorderColor;
          return nextDataset;
        });

        const baseScales = (chartData.value.options?.scales as Record<
          string,
          {
            ticks?: { color?: string };
            grid?: { color?: string };
            title?: { color?: string };
          }
        > | undefined) ?? {};
        const themedScales = shouldShowAxes(chartData.value.type)
          ? {
              x: {
                ...(baseScales.x ?? {}),
                ticks: { ...(baseScales.x?.ticks ?? {}), color: textMutedColor },
                grid: { ...(baseScales.x?.grid ?? {}), color: subtleGridColor },
                title: { ...(baseScales.x?.title ?? {}), color: textColor },
              },
              y: {
                ...(baseScales.y ?? {}),
                ticks: { ...(baseScales.y?.ticks ?? {}), color: textMutedColor },
                grid: { ...(baseScales.y?.grid ?? {}), color: subtleGridColor },
                title: { ...(baseScales.y?.title ?? {}), color: textColor },
              },
            }
          : undefined;

        const chartOptions = {
          ...chartData.value.options,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            ...chartData.value.options?.plugins,
            legend: {
              display: chartData.value.options?.plugins?.legend?.display ?? true,
              position: chartData.value.options?.plugins?.legend?.position ?? 'top',
              ...(chartData.value.options?.plugins?.legend?.labels
                ? {
                    labels: {
                      ...chartData.value.options.plugins.legend.labels,
                      color: textColor,
                    },
                  }
                : { labels: { color: textColor } }),
            },
            title: chartData.value.options?.plugins?.title
              ? {
                  ...chartData.value.options.plugins.title,
                  color: textColor,
                }
              : undefined,
          },
          scales: themedScales,
        };

        const ChartJS = chartJs.value;
        if (!ChartJS) return;

        chartInstance.value = new ChartJS(ctx, {
          type: chartData.value.type,
          data: {
            labels: [...chartData.value.data.labels],
            datasets: themedDatasets,
          },
          options: chartOptions,
        });
      } catch (error) {
        console.error('Failed to load Chart.js:', error);
      }
    };

    watch(
      () => props.block.props.data,
      () => {
        void renderChart();
      },
      { deep: true, immediate: true }
    );

    onMounted(() => {
      void renderChart();
    });

    onBeforeUnmount(() => {
      destroyChart();
    });

    return () => {
      if (!chartData.value) {
        return h('div', { class: 'ob-chart-block ob-chart-block--invalid' }, 'Invalid chart data');
      }

      const height = (chartData.value.options as Record<string, unknown> | undefined)?.height as number | undefined;
      const minHeight = (chartData.value.options as Record<string, unknown> | undefined)?.minHeight as number | undefined;

      return h('div', { class: 'ob-chart-block', 'data-selected': 'false' }, [
        h('div', { ref: containerRef, class: 'ob-chart-block__container' }, [
          h('div', { class: 'ob-chart-block__canvas-wrapper', style: { height: height ? `${height}px` : undefined, minHeight: minHeight ? `${minHeight}px` : undefined } }, [
            h('canvas', { ref: canvasRef, class: 'ob-chart-block__canvas' }),
          ]),
          editable.value
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'ob-chart-block__edit',
                  onClick: () => {
                    isEditing.value = true;
                  },
                },
                'Edit'
              )
            : null,
        ]),
        isEditing.value
          ? h(ChartEditorModal, {
              initialData: chartData.value,
              onSave: (data: ChartNodeData) => {
                updateBlock({ data });
                isEditing.value = false;
              },
              onCancel: () => {
                isEditing.value = false;
              },
            })
          : null,
      ]);
    };
  },
});
