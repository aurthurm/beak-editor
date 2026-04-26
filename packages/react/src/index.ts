/**
 * @amusendame/beakblock-react
 *
 * React bindings for BeakBlock editor.
 *
 * @example
 * ```tsx
 * import { useBeakBlock, BeakBlockView } from '@amusendame/beakblock-react';
 *
 * function MyEditor() {
 *   const editor = useBeakBlock({
 *     initialContent: [
 *       { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Hello', styles: {} }] },
 *       { type: 'paragraph', content: [{ type: 'text', text: 'World', styles: {} }] },
 *     ],
 *   });
 *
 *   return <BeakBlockView editor={editor} />;
 * }
 * ```
 *
 * @packageDocumentation
 */

// Hooks
export {
  useBeakBlock,
  useEditorContent,
  useEditorSelection,
  useEditorFocus,
  useCustomSlashMenuItems,
  useDocumentVersions,
} from './hooks';
export type { UseBeakBlockOptions } from './hooks';

// Components
export {
  BeakBlockView,
  SlashMenu,
  BubbleMenu,
  AIModal,
  CommentModal,
  CommentRail,
  LinkPopover,
  TableMenu,
  TableHandles,
  MediaMenu,
  ColorPicker,
  // BubbleMenu constants
  BUBBLE_MENU_ITEMS,
  DEFAULT_BUBBLE_MENU_ORDER,
  // ColorPicker constants
  DEFAULT_TEXT_COLORS,
  DEFAULT_BACKGROUND_COLORS,
} from './components';
export type {
  BeakBlockViewProps,
  BeakBlockViewRef,
  SlashMenuProps,
  BubbleMenuProps,
  BubbleMenuItem,
  AIModalProps,
  CommentModalProps,
  CommentRailProps,
  LinkPopoverProps,
  TableMenuProps,
  TableHandlesProps,
  MediaMenuProps,
  ColorPickerProps,
  ColorOption,
} from './components';

// Custom blocks
export {
  createReactBlockSpec,
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
} from './blocks';
export type {
  PropSchema,
  BlockSpec,
  BlockRenderProps,
  BlockImplementation,
  ReactBlockSpec,
  SlashMenuConfig,
  ChartBlockType,
  ChartColorMode,
  ChartNodeData,
  ChartDataset,
  ChartData,
  ChartOptions,
} from './blocks';

// Re-export core types for convenience
export type {
  BeakBlockEditor,
  EditorConfig,
  Block,
  PartialBlock,
  BlockIdentifier,
  BlockPlacement,
  TextStyles,
  StyledText,
  HardBreakContent,
  InlineContent,
  SlashMenuItem,
} from '@amusendame/beakblock-core';
