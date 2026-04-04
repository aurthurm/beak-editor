<script setup lang="ts">
import {
  BeakBlockView,
  BubbleMenu,
  createChartBlockSpec,
  CommentRail,
  MediaMenu,
  SlashMenu,
  TableHandles,
  TableMenu,
  useBeakBlock,
  useCustomSlashMenuItems,
  useEditorContent,
} from '@aurthurm/beakblock-vue';
import { createCommentPlugin, InMemoryCommentStore } from '@aurthurm/beakblock-core';
import type { BeakBlockEditor } from '@aurthurm/beakblock-core';
import type { Block } from '@aurthurm/beakblock-core';

const emit = defineEmits<{
  ai: [mode: 'bubble' | 'slash'];
  comment: [];
}>();

const props = withDefaults(
  defineProps<{
    initialDocument: Block[];
    /** Extra classes on BeakBlockView wrapper (e.g. editor-view--cv) */
    className?: string;
  }>(),
  { className: 'editor-view' }
);

const commentStore = new InMemoryCommentStore();
const customBlocks = [createChartBlockSpec()];

const editor = useBeakBlock({
  initialContent: props.initialDocument,
  customBlocks,
  prosemirror: {
    plugins: [createCommentPlugin(commentStore)],
  },
});

const customSlashItems = useCustomSlashMenuItems(editor, customBlocks);
const blocks = useEditorContent(editor);

defineExpose({
  getEditor: (): BeakBlockEditor | null => editor.value,
  getBlocks: (): Block[] => blocks.value,
  getCommentStore: () => commentStore,
});
</script>

<template>
  <div class="example-editor-panel">
    <CommentRail :editor="editor" :store="commentStore" current-user-id="aurthurm">
      <BeakBlockView :editor="editor" :class-name="className" />
    </CommentRail>
    <SlashMenu :editor="editor" :custom-items="customSlashItems" @ai="emit('ai', 'slash')" />
    <BubbleMenu :editor="editor" @comment="emit('comment')" @ai="emit('ai', 'bubble')" />
    <TableMenu :editor="editor" />
    <TableHandles :editor="editor" />
    <MediaMenu :editor="editor" />
  </div>
</template>
