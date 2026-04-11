/**
 * @aurthurm/beakblock-react
 *
 * React bindings for BeakBlock editor.
 *
 * @example
 * ```tsx
 * import { useBeakBlock, BeakBlockView } from '@aurthurm/beakblock-react';
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
  TableMenuProps,
  TableHandlesProps,
  MediaMenuProps,
  ColorPickerProps,
  ColorOption,
} from './components';

// Custom blocks
export {
  createReactBlockSpec,
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
} from '@aurthurm/beakblock-core';
