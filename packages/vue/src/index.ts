/**
 * @amusendame/beakblock-vue
 *
 * Vue bindings for BeakBlock editor.
 *
 * @packageDocumentation
 */

export { useBeakBlock, useEditorContent, useEditorSelection, useEditorFocus, useDocumentVersions } from './composables';
export { useCustomSlashMenuItems } from './composables';
export type { UseBeakBlockOptions } from './composables';

export {
  BeakBlockView,
  SlashMenu,
  BubbleMenu,
  AIModal,
  CommentModal,
  CommentRail,
  LinkPopover,
  ColorPicker,
  TableMenu,
  TableHandles,
  MediaMenu,
  BUBBLE_MENU_ITEMS,
  DEFAULT_BUBBLE_MENU_ORDER,
  DEFAULT_TEXT_COLORS,
  DEFAULT_BACKGROUND_COLORS,
} from './components';
export type { BeakBlockViewProps } from './components';
export type {
  SlashMenuProps,
  BubbleMenuProps,
  BubbleMenuItem,
  AIModalProps,
  CommentModalProps,
  CommentRailProps,
  LinkPopoverProps,
  ColorPickerProps,
  ColorOption,
  TableMenuProps,
  TableHandlesProps,
  MediaMenuProps,
} from './components';

export {
  createVueBlockSpec,
  createChartBlockSpec,
  createDefaultChartData,
  createDefaultDataset,
  createCategoryColorPalette,
  DEFAULT_CHART_CANVAS_MIN_HEIGHT_PX,
  DEFAULT_CHART_OPTIONS,
  DEFAULT_BORDER_COLORS,
  DEFAULT_CHART_COLORS,
  useBlockEditor,
  useUpdateBlock,
  BeakBlockEditorKey,
} from './blocks';
export type {
  PropSchema,
  BlockSpec,
  BlockRenderProps,
  BlockImplementation,
  VueBlockSpec,
  SlashMenuConfig,
  ChartColorMode,
  ChartBlockType,
  ChartNodeData,
  ChartDataset,
  ChartData,
  ChartOptions,
} from './blocks';

export type {
  BeakBlockEditor,
  EditorConfig,
  Block,
  PartialBlock,
  BlockIdentifier,
  BlockPlacement,
  TextStyles,
  StyledText,
  IconContent,
  HardBreakContent,
  InlineContent,
  SlashMenuItem,
} from '@amusendame/beakblock-core';
