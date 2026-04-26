export type ChartBlockType = 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea';
export type ChartColorMode = 'default' | 'random' | 'gradient';

export interface ChartDataset {
  label?: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  [key: string]: unknown;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export const DEFAULT_CHART_CANVAS_MIN_HEIGHT_PX = 240;

export interface ChartOptions {
  width?: number;
  height?: number;
  minHeight?: number;
  colorScheme?: {
    mode: ChartColorMode;
  };
  plugins?: {
    title?: {
      display?: boolean;
      text?: string;
      color?: string;
      font?: {
        size?: number;
        weight?: number | 'bold' | 'normal' | 'lighter' | 'bolder';
      };
    };
    legend?: {
      display?: boolean;
      position?: 'top' | 'bottom' | 'left' | 'right';
      labels?: {
        color?: string;
        font?: {
          size?: number;
        };
        [key: string]: unknown;
      };
    };
  };
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  [key: string]: unknown;
}

export interface ChartNodeData {
  type: ChartBlockType;
  data: ChartData;
  options?: ChartOptions;
}

export interface ChartBlockProps {
  data: ChartNodeData;
  editable: boolean;
  onUpdate: (data: ChartNodeData) => void;
}

export interface ChartEditorModalProps {
  initialData: ChartNodeData;
  onSave: (data: ChartNodeData) => void;
  onCancel: () => void;
}

export const DEFAULT_CHART_COLORS = [
  'rgba(59, 130, 246, 0.7)',
  'rgba(236, 72, 153, 0.7)',
  'rgba(34, 197, 94, 0.7)',
  'rgba(251, 146, 60, 0.7)',
  'rgba(139, 92, 246, 0.7)',
  'rgba(14, 165, 233, 0.7)',
  'rgba(244, 63, 94, 0.7)',
  'rgba(234, 179, 8, 0.7)',
] as const;

export const DEFAULT_BORDER_COLORS = [
  'rgba(59, 130, 246, 1)',
  'rgba(236, 72, 153, 1)',
  'rgba(34, 197, 94, 1)',
  'rgba(251, 146, 60, 1)',
  'rgba(139, 92, 246, 1)',
  'rgba(14, 165, 233, 1)',
  'rgba(244, 63, 94, 1)',
  'rgba(234, 179, 8, 1)',
] as const;

export const DEFAULT_CHART_OPTIONS: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  colorScheme: {
    mode: 'default',
  },
  plugins: {
    title: {
      display: true,
      text: 'Chart Title',
      color: 'var(--ob-foreground, #37352f)',
      font: {
        size: 16,
        weight: 'bold',
      },
    },
    legend: {
      display: true,
      position: 'top',
    },
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function interpolate(start: number, end: number, ratio: number): number {
  return start + (end - start) * ratio;
}

function createRandomishHue(index: number): number {
  return (index * 137.508 + 18) % 360;
}

function createGradientHue(index: number, count: number): number {
  const ratio = count <= 1 ? 0.5 : index / (count - 1);
  return interpolate(212, 294, ratio);
}

function buildChartColor(index: number, count: number, mode: ChartColorMode): { backgroundColor: string; borderColor: string } {
  if (mode === 'random') {
    const hue = createRandomishHue(index);
    return {
      backgroundColor: `hsla(${hue.toFixed(1)}, 76%, 64%, 0.72)`,
      borderColor: `hsl(${hue.toFixed(1)}, 76%, 46%)`,
    };
  }

  if (mode === 'gradient') {
    const hue = createGradientHue(index, count);
    const ratio = count <= 1 ? 0.5 : index / (count - 1);
    const saturation = interpolate(78, 68, ratio);
    const lightness = interpolate(58, 66, ratio);
    return {
      backgroundColor: `hsla(${hue.toFixed(1)}, ${saturation.toFixed(1)}%, ${lightness.toFixed(1)}%, 0.74)`,
      borderColor: `hsl(${hue.toFixed(1)}, ${saturation.toFixed(1)}%, ${clamp(lightness - 14, 36, 58).toFixed(1)}%)`,
    };
  }

  const colorIndex = index % DEFAULT_CHART_COLORS.length;
  return {
    backgroundColor: DEFAULT_CHART_COLORS[colorIndex],
    borderColor: DEFAULT_BORDER_COLORS[colorIndex],
  };
}

export function createCategoryColorPalette(
  count: number,
  mode: ChartColorMode = 'default'
): { backgroundColor: string[]; borderColor: string[] } {
  const palette = { backgroundColor: [] as string[], borderColor: [] as string[] };
  for (let index = 0; index < count; index += 1) {
    const color = buildChartColor(index, count, mode);
    palette.backgroundColor.push(color.backgroundColor);
    palette.borderColor.push(color.borderColor);
  }
  return palette;
}

export function createDefaultDataset(label: string, data: number[], index: number): ChartDataset {
  const colorIndex = index % DEFAULT_CHART_COLORS.length;
  return {
    label,
    data,
    backgroundColor: DEFAULT_CHART_COLORS[colorIndex],
    borderColor: DEFAULT_BORDER_COLORS[colorIndex],
    borderWidth: 2,
  };
}

export function createDefaultChartData(type: ChartBlockType): ChartNodeData {
  return {
    type,
    data: {
      labels: ['Category 1', 'Category 2', 'Category 3', 'Category 4'],
      datasets: [createDefaultDataset('Dataset 1', [12, 19, 3, 5], 0)],
    },
    options: { ...DEFAULT_CHART_OPTIONS, colorScheme: { mode: DEFAULT_CHART_OPTIONS.colorScheme?.mode ?? 'default' } },
  };
}
