import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChartBlockType, ChartDataset, ChartEditorModalProps } from './chartTypes';

const CHART_TYPES: Array<{ value: ChartBlockType; label: string }> = [
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'pie', label: 'Pie' },
  { value: 'doughnut', label: 'Doughnut' },
  { value: 'radar', label: 'Radar' },
  { value: 'polarArea', label: 'Polar Area' },
];

function parseOptionalPositivePx(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function getDefaultColor(index: number): { backgroundColor: string; borderColor: string } {
  return {
    backgroundColor: `rgba(59, 130, 246, ${0.5 + (index % 3) * 0.2})`,
    borderColor: 'rgba(59, 130, 246, 1)',
  };
}

export function ChartEditorModal({ initialData, onSave, onCancel }: ChartEditorModalProps): React.ReactElement | null {
  const [chartType, setChartType] = useState<ChartBlockType>(initialData.type);
  const [chartTitle, setChartTitle] = useState(initialData.options?.plugins?.title?.text ?? '');
  const [showLegend, setShowLegend] = useState(initialData.options?.plugins?.legend?.display ?? true);
  const [legendPosition, setLegendPosition] = useState<'top' | 'bottom' | 'left' | 'right'>(
    (initialData.options?.plugins?.legend?.position as 'top' | 'bottom' | 'left' | 'right') ?? 'top'
  );
  const [colorMode, setColorMode] = useState(initialData.options?.colorScheme?.mode ?? 'default');
  const [labels, setLabels] = useState<string[]>([...initialData.data.labels]);
  const [datasets, setDatasets] = useState<ChartDataset[]>(initialData.data.datasets.map((dataset) => ({ ...dataset })));
  const [canvasWidth, setCanvasWidth] = useState(initialData.options?.width != null ? String(initialData.options.width) : '');
  const [canvasHeight, setCanvasHeight] = useState(initialData.options?.height != null ? String(initialData.options.height) : '');
  const [canvasMinHeight, setCanvasMinHeight] = useState(
    initialData.options?.minHeight != null ? String(initialData.options.minHeight) : ''
  );

  const chartTypeLabel = useMemo(
    () => CHART_TYPES.find((type) => type.value === chartType)?.label ?? 'Chart',
    [chartType]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const updateDatasetLabel = (index: number, label: string) => {
    setDatasets((current) => current.map((dataset, i) => (i === index ? { ...dataset, label } : dataset)));
  };

  const updateDatasetData = (index: number, data: string) => {
    const parsed = data.split(',').map((value) => Number.parseFloat(value.trim()) || 0);
    setDatasets((current) => current.map((dataset, i) => (i === index ? { ...dataset, data: parsed } : dataset)));
  };

  const updateDatasetColor = (index: number, key: 'backgroundColor' | 'borderColor', value: string) => {
    setDatasets((current) => current.map((dataset, i) => (i === index ? { ...dataset, [key]: value } : dataset)));
  };

  const addDataset = () => {
    const colors = getDefaultColor(datasets.length);
    setDatasets((current) => [
      ...current,
      {
        label: `Dataset ${current.length + 1}`,
        data: labels.map(() => Math.floor(Math.random() * 100)),
        backgroundColor: colors.backgroundColor,
        borderColor: colors.borderColor,
        borderWidth: 2,
      },
    ]);
  };

  const removeDataset = (index: number) => {
    setDatasets((current) => current.filter((_, i) => i !== index));
  };

  const updateLabels = (value: string) => {
    setLabels(value.split(',').map((label) => label.trim()).filter(Boolean));
  };

  const save = () => {
    const { width: _prevW, height: _prevH, minHeight: _prevMinH, ...optionsWithoutLayout } = initialData.options ?? {};
    const widthPx = parseOptionalPositivePx(canvasWidth);
    const heightPx = parseOptionalPositivePx(canvasHeight);
    const minHeightPx = parseOptionalPositivePx(canvasMinHeight);

    onSave({
      type: chartType,
      data: {
        labels,
        datasets,
      },
      options: {
        ...optionsWithoutLayout,
        responsive: true,
        maintainAspectRatio: false,
        colorScheme: {
          mode: colorMode,
        },
        plugins: {
          title: {
            display: !!chartTitle,
            text: chartTitle,
            color: 'var(--ob-foreground, #37352f)',
            font: {
              size: 16,
              weight: 'bold',
            },
          },
          legend: {
            display: showLegend,
            position: legendPosition,
          },
        },
        ...(widthPx != null ? { width: widthPx } : {}),
        ...(heightPx != null ? { height: heightPx } : {}),
        ...(minHeightPx != null ? { minHeight: minHeightPx } : {}),
      },
    });
  };

  return createPortal(
    <div className="ob-chart-modal__overlay" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="ob-chart-modal__panel" role="dialog" aria-modal="true" aria-labelledby="ob-chart-modal-title">
        <div className="ob-chart-modal__header">
          <div>
            <h2 id="ob-chart-modal-title" className="ob-chart-modal__title">Edit chart</h2>
            <p className="ob-chart-modal__subtitle">Configure a {chartTypeLabel.toLowerCase()} chart.</p>
          </div>
          <button type="button" className="ob-chart-modal__close" onClick={onCancel}>×</button>
        </div>

        <div className="ob-chart-modal__body">
          <section className="ob-chart-modal__section">
            <h3 className="ob-chart-modal__section-title">Chart</h3>
            <div className="ob-chart-modal__section-body ob-chart-modal__chart-row">
              <label className="ob-chart-modal__field">
                <span className="ob-chart-modal__label">Type</span>
                <select className="ob-chart-modal__select" value={chartType} onChange={(event) => setChartType(event.target.value as ChartBlockType)}>
                  {CHART_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="ob-chart-modal__field">
                <span className="ob-chart-modal__label">Title</span>
                <input className="ob-chart-modal__input" type="text" value={chartTitle} placeholder="Visible above the chart" onChange={(event) => setChartTitle(event.target.value)} />
              </label>
            </div>
          </section>

          <section className="ob-chart-modal__section">
            <h3 className="ob-chart-modal__section-title">Data</h3>
            <div className="ob-chart-modal__section-body">
              <label className="ob-chart-modal__field">
                <span className="ob-chart-modal__label">Labels</span>
                <input className="ob-chart-modal__input" type="text" value={labels.join(', ')} onChange={(event) => updateLabels(event.target.value)} placeholder="Comma-separated labels" />
              </label>
              <div className="ob-chart-modal__dataset-list">
                {datasets.map((dataset, index) => (
                  <div key={index} className="ob-chart-modal__dataset">
                    <div className="ob-chart-modal__dataset-header">
                      <strong>Dataset {index + 1}</strong>
                      <button type="button" className="ob-chart-modal__chip" onClick={() => removeDataset(index)} disabled={datasets.length === 1}>Remove</button>
                    </div>
                    <label className="ob-chart-modal__field">
                      <span className="ob-chart-modal__label">Label</span>
                      <input className="ob-chart-modal__input" type="text" value={dataset.label ?? ''} onChange={(event) => updateDatasetLabel(index, event.target.value)} />
                    </label>
                    <label className="ob-chart-modal__field">
                      <span className="ob-chart-modal__label">Values</span>
                      <input className="ob-chart-modal__input" type="text" value={dataset.data.join(', ')} onChange={(event) => updateDatasetData(index, event.target.value)} />
                    </label>
                    <div className="ob-chart-modal__chart-row">
                      <label className="ob-chart-modal__field">
                        <span className="ob-chart-modal__label">Background</span>
                        <input className="ob-chart-modal__input" type="text" value={String(dataset.backgroundColor ?? '')} onChange={(event) => updateDatasetColor(index, 'backgroundColor', event.target.value)} />
                      </label>
                      <label className="ob-chart-modal__field">
                        <span className="ob-chart-modal__label">Border</span>
                        <input className="ob-chart-modal__input" type="text" value={String(dataset.borderColor ?? '')} onChange={(event) => updateDatasetColor(index, 'borderColor', event.target.value)} />
                      </label>
                    </div>
                  </div>
                ))}
                <button type="button" className="ob-chart-modal__chip" onClick={addDataset}>Add dataset</button>
              </div>
            </div>
          </section>

          <section className="ob-chart-modal__section">
            <h3 className="ob-chart-modal__section-title">Layout</h3>
            <div className="ob-chart-modal__section-body ob-chart-modal__chart-row">
              <label className="ob-chart-modal__field">
                <span className="ob-chart-modal__label">Width</span>
                <input className="ob-chart-modal__input" type="text" value={canvasWidth} onChange={(event) => setCanvasWidth(event.target.value)} placeholder="Optional px" />
              </label>
              <label className="ob-chart-modal__field">
                <span className="ob-chart-modal__label">Height</span>
                <input className="ob-chart-modal__input" type="text" value={canvasHeight} onChange={(event) => setCanvasHeight(event.target.value)} placeholder="Optional px" />
              </label>
              <label className="ob-chart-modal__field">
                <span className="ob-chart-modal__label">Min height</span>
                <input className="ob-chart-modal__input" type="text" value={canvasMinHeight} onChange={(event) => setCanvasMinHeight(event.target.value)} placeholder="Optional px" />
              </label>
            </div>
            <div className="ob-chart-modal__chart-row">
              <label className="ob-chart-modal__field">
                <span className="ob-chart-modal__label">Legend</span>
                <select className="ob-chart-modal__select" value={showLegend ? 'show' : 'hide'} onChange={(event) => setShowLegend(event.target.value === 'show')}>
                  <option value="show">Show</option>
                  <option value="hide">Hide</option>
                </select>
              </label>
              <label className="ob-chart-modal__field">
                <span className="ob-chart-modal__label">Legend position</span>
                <select className="ob-chart-modal__select" value={legendPosition} onChange={(event) => setLegendPosition(event.target.value as typeof legendPosition)}>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <label className="ob-chart-modal__field">
                <span className="ob-chart-modal__label">Color mode</span>
                <select className="ob-chart-modal__select" value={colorMode} onChange={(event) => setColorMode(event.target.value as typeof colorMode)}>
                  <option value="default">Default</option>
                  <option value="random">Random</option>
                  <option value="gradient">Gradient</option>
                </select>
              </label>
            </div>
          </section>
        </div>

        <div className="ob-chart-modal__footer">
          <button type="button" className="ob-chart-modal__chip" onClick={onCancel}>Cancel</button>
          <button type="button" className="ob-chart-modal__chip ob-chart-modal__chip--primary" onClick={save}>Save chart</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
