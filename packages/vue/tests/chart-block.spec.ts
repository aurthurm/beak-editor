import { describe, expect, it } from 'vitest';
import {
  createChartBlockSpec,
  createCategoryColorPalette,
  createDefaultChartData,
  DEFAULT_CHART_CANVAS_MIN_HEIGHT_PX,
  DEFAULT_CHART_OPTIONS,
  DEFAULT_BORDER_COLORS,
  DEFAULT_CHART_COLORS,
} from '@aurthurm/beakblock-vue';

describe('@aurthurm/beakblock-vue chart block', () => {
  it('exposes the default canvas min-height constant aligned with editor styles', () => {
    expect(DEFAULT_CHART_CANVAS_MIN_HEIGHT_PX).toBe(240);
  });

  it('allows optional canvas width and height on chart options for uniform layouts', () => {
    const chart = createDefaultChartData('bar');
    chart.options = {
      ...chart.options,
      width: 400,
      height: 280,
      minHeight: 200,
    };
    expect(chart.options?.width).toBe(400);
    expect(chart.options?.height).toBe(280);
    expect(chart.options?.minHeight).toBe(200);
  });

  it('creates default chart data with the expected shape', () => {
    const chart = createDefaultChartData('bar');

    expect(chart.type).toBe('bar');
    expect(chart.data.labels).toHaveLength(4);
    expect(chart.data.datasets).toHaveLength(1);
    expect(chart.options?.plugins?.title?.text).toBe('Chart Title');
    expect(chart.options?.colorScheme?.mode).toBe('default');
    expect(chart.options).toMatchObject(DEFAULT_CHART_OPTIONS);
    expect(DEFAULT_CHART_COLORS).toHaveLength(8);
    expect(DEFAULT_BORDER_COLORS).toHaveLength(8);
  });

  it('generates category color palettes for random and gradient modes', () => {
    const randomPalette = createCategoryColorPalette(4, 'random');
    const gradientPalette = createCategoryColorPalette(4, 'gradient');

    expect(randomPalette.backgroundColor).toHaveLength(4);
    expect(randomPalette.borderColor).toHaveLength(4);
    expect(gradientPalette.backgroundColor).toHaveLength(4);
    expect(gradientPalette.borderColor).toHaveLength(4);
    expect(new Set(randomPalette.backgroundColor).size).toBeGreaterThan(1);
    expect(new Set(gradientPalette.backgroundColor).size).toBeGreaterThan(1);
  });

  it('creates a reusable chart block spec with slash menu metadata', () => {
    const chartBlock = createChartBlockSpec();

    expect(chartBlock.type).toBe('chart');
    expect(chartBlock.content).toBe('none');
    expect(chartBlock.slashMenu).toMatchObject({
      title: 'Chart',
      description: 'Insert an interactive chart',
      aliases: ['chart', 'graph', 'plot'],
      group: 'Insert',
    });
  });
});
