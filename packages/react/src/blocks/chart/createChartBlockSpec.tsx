import { createReactBlockSpec, type SlashMenuConfig } from '../createReactBlockSpec';
import { ChartBlock } from './ChartBlock';
import { createDefaultChartData, type ChartBlockType, type ChartNodeData } from './chartTypes';

export interface ChartBlockSpecOptions {
  defaultType?: ChartBlockType;
  slashMenu?: SlashMenuConfig;
}

const DEFAULT_SLASH_MENU: SlashMenuConfig = {
  title: 'Chart',
  description: 'Insert an interactive chart',
  icon: 'chart',
  aliases: ['chart', 'graph', 'plot'],
  group: 'Insert',
};

export function createChartBlockSpec(options: ChartBlockSpecOptions = {}) {
  const defaultType = options.defaultType ?? 'bar';
  return createReactBlockSpec(
    {
      type: 'chart',
      propSchema: {
        data: {
          default: createDefaultChartData(defaultType),
        },
      },
      content: 'none',
    },
    {
      render: ChartBlock as never,
      slashMenu: {
        ...DEFAULT_SLASH_MENU,
        ...options.slashMenu,
      },
    }
  );
}

export type { ChartBlockType, ChartNodeData };
export {
  createDefaultChartData,
  createDefaultDataset,
  createCategoryColorPalette,
  DEFAULT_CHART_CANVAS_MIN_HEIGHT_PX,
  DEFAULT_CHART_OPTIONS,
  DEFAULT_BORDER_COLORS,
  DEFAULT_CHART_COLORS,
} from './chartTypes';
