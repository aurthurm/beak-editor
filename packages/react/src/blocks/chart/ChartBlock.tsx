import React, { useEffect, useRef, useState } from 'react';
import type { Chart } from 'chart.js';
import { type BeakBlockEditor } from '@amusendame/beakblock-core';
import { useUpdateBlock } from '../createReactBlockSpec';
import { ChartEditorModal } from './ChartEditorModal';
import { createCategoryColorPalette, type ChartNodeData, type ChartDataset } from './chartTypes';

type ChartBlockRenderProps = {
  block: {
    id: string;
    type: string;
    props: { data: ChartNodeData };
  };
  editor: BeakBlockEditor;
  isEditable: boolean;
};

function getCSSVariableColor(element: HTMLElement, varName: string, fallback: string): string {
  const computedStyle = getComputedStyle(element);
  const cleanVarName = varName.replace(/^var\(/, '').replace(/\)$/, '');
  const color = computedStyle.getPropertyValue(cleanVarName).trim();
  return color || fallback;
}

function shouldShowAxes(type: ChartNodeData['type']): boolean {
  return type === 'bar' || type === 'line' || type === 'radar';
}

function supportsCategoryPalette(type: ChartNodeData['type']): boolean {
  return type === 'bar' || type === 'pie' || type === 'doughnut' || type === 'polarArea';
}

function cloneDataset<T extends Record<string, unknown>>(dataset: T): T {
  return JSON.parse(JSON.stringify(dataset)) as T;
}

function canvasWrapperStyle(options: ChartNodeData['options']): Record<string, string> | undefined {
  if (!options) return undefined;
  const style: Record<string, string> = {};
  if (typeof options.width === 'number' && Number.isFinite(options.width) && options.width > 0) {
    style.width = `${options.width}px`;
    style.maxWidth = '100%';
  }
  if (typeof options.height === 'number' && Number.isFinite(options.height) && options.height > 0) {
    style.height = `${options.height}px`;
  }
  if (typeof options.minHeight === 'number' && Number.isFinite(options.minHeight) && options.minHeight > 0) {
    style.minHeight = `${options.minHeight}px`;
  }
  return Object.keys(style).length ? style : undefined;
}

export function ChartBlock({ block, editor, isEditable }: ChartBlockRenderProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const updateBlock = useUpdateBlock<{ data: { default: ChartNodeData } }>(editor, block.id);

  const chartData = block.props.data;

  const destroyChart = () => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }
  };

  const renderChart = async () => {
    if (!canvasRef.current || !chartData) return;

    try {
      const module = await import('chart.js/auto');
      destroyChart();

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const container = containerRef.current;
      const textColor = container ? getCSSVariableColor(container, '--ob-foreground', '#37352f') : '#37352f';
      const textMutedColor = container ? getCSSVariableColor(container, '--ob-muted-foreground', '#9b9a97') : '#9b9a97';
      const subtleGridColor = 'rgba(125, 125, 125, 0.08)';
      const colorMode = chartData.options?.colorScheme?.mode ?? 'default';
      const labelsCount = chartData.data.labels.length;
      const datasetCount = chartData.data.datasets.length;
      const paletteCount = supportsCategoryPalette(chartData.type) && datasetCount === 1 ? labelsCount : datasetCount;
      const palette = createCategoryColorPalette(Math.max(paletteCount, 1), colorMode);
      const themedDatasets = chartData.data.datasets.map((dataset: ChartDataset, index: number) => {
        const nextDataset = cloneDataset(dataset);
        const seriesColor = palette.backgroundColor[index % palette.backgroundColor.length];
        const seriesBorderColor = palette.borderColor[index % palette.borderColor.length];
        const categoryPalette =
          supportsCategoryPalette(chartData.type) && datasetCount === 1
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

      const baseScales = (chartData.options?.scales as Record<
        string,
        {
          ticks?: { color?: string };
          grid?: { color?: string };
          title?: { color?: string };
        }
      > | undefined) ?? {};
      const themedScales = shouldShowAxes(chartData.type)
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

      const {
        width: _layoutW,
        height: _layoutH,
        minHeight: _layoutMinH,
        ...optionsForChartJs
      } = chartData.options ?? {};

      const chartOptions = {
        ...optionsForChartJs,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          ...optionsForChartJs.plugins,
          legend: {
            display: optionsForChartJs.plugins?.legend?.display ?? true,
            position: optionsForChartJs.plugins?.legend?.position ?? 'top',
            ...(optionsForChartJs.plugins?.legend?.labels
              ? {
                  labels: {
                    ...optionsForChartJs.plugins.legend.labels,
                    color: textColor,
                  },
                }
              : { labels: { color: textColor } }),
          },
          title: optionsForChartJs.plugins?.title
            ? {
                ...optionsForChartJs.plugins.title,
                color: textColor,
              }
            : undefined,
        },
        scales: themedScales,
      };

      const ChartJS = module.default;
      if (!ChartJS) return;

      chartInstance.current = new ChartJS(ctx, {
        type: chartData.type,
        data: {
          labels: [...chartData.data.labels],
          datasets: themedDatasets,
        },
        options: chartOptions,
      });
    } catch (error) {
      console.error('Failed to load Chart.js:', error);
    }
  };

  useEffect(() => {
    void renderChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData]);

  useEffect(() => () => destroyChart(), []);

  return (
    <figure className="ob-chart-block" ref={containerRef}>
      <div className="ob-chart-block__toolbar">
        <button type="button" className="ob-chart-block__chip" onClick={() => setIsEditing(true)} disabled={!isEditable}>
          Edit chart
        </button>
      </div>
      <div className="ob-chart-block__canvas-wrapper" style={canvasWrapperStyle(chartData.options)}>
        <canvas ref={canvasRef} />
      </div>
      {chartData.options?.plugins?.title?.text ? (
        <figcaption className="ob-chart-block__caption">{chartData.options.plugins.title.text}</figcaption>
      ) : null}
      {isEditing ? (
        <ChartEditorModal
          initialData={chartData}
          onCancel={() => setIsEditing(false)}
          onSave={(next) => {
            updateBlock({ data: next });
            setIsEditing(false);
          }}
        />
      ) : null}
    </figure>
  );
}
