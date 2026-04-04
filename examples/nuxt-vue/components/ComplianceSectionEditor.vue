<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  AIModal,
  CommentModal,
  CommentRail,
  BeakBlockView,
  BubbleMenu,
  createChartBlockSpec,
  MediaMenu,
  SlashMenu,
  TableHandles,
  TableMenu,
  useBeakBlock,
  useCustomSlashMenuItems,
  useEditorContent,
} from '@aurthurm/beakblock-vue';
import {
  BUBBLE_AI_PRESETS,
  SLASH_AI_PRESETS,
  createCommentPlugin,
  InMemoryCommentStore,
} from '@aurthurm/beakblock-core';
import type { Block } from '@aurthurm/beakblock-core';
import { sendAIRequest } from '../../shared/ai';

const props = defineProps<{
  sectionId: string;
  sectionTitle: string;
  required: boolean;
  initialBlocks: Block[];
}>();

const emit = defineEmits<{
  update: [];
}>();

const commentStore = new InMemoryCommentStore();
const commentOpen = ref(false);
const aiOpen = ref(false);
const aiMode = ref<'bubble' | 'slash'>('bubble');

const openCommentModal = () => {
  commentOpen.value = true;
};

const openAiModal = (mode: 'bubble' | 'slash') => {
  aiMode.value = mode;
  aiOpen.value = true;
};

const closeAiModal = () => {
  aiOpen.value = false;
};

const closeCommentModal = () => {
  commentOpen.value = false;
};

const runAIPrompt = async (request: Parameters<typeof sendAIRequest>[0]) => sendAIRequest(request, '/api/ai');

const applyDemoAI = async ({ output }: { output: string }) => {
  editor.value?.pm.insertText(output);
};

const customBlocks = [createChartBlockSpec()];
const editor = useBeakBlock({
  initialContent: props.initialBlocks,
  customBlocks,
  prosemirror: {
    plugins: [createCommentPlugin(commentStore)],
  },
});

const customSlashItems = useCustomSlashMenuItems(editor, customBlocks);
const content = useEditorContent(editor);

watch(
  content,
  () => {
    emit('update');
  },
  { deep: true }
);

defineExpose({
  editor,
});
</script>

<template>
  <article class="compliance-section" :data-section-id="sectionId">
    <header class="compliance-section__head">
      <div class="compliance-section__labels">
        <span class="compliance-section__title">{{ sectionTitle }}</span>
        <span v-if="required" class="compliance-section__badge">Controlled · required</span>
        <span v-else class="compliance-section__badge compliance-section__badge--optional">Controlled · optional</span>
      </div>
      <p class="compliance-section__hint">Content for this heading is authored only in this field.</p>
    </header>

    <div class="compliance-section__editor-wrap">
      <CommentRail :editor="editor" :store="commentStore" current-user-id="aurthurm">
        <BeakBlockView :editor="editor" class-name="editor-view compliance-section__editor" />
      </CommentRail>
      <SlashMenu :editor="editor" :custom-items="customSlashItems" @ai="() => openAiModal('slash')" />
      <BubbleMenu :editor="editor" @comment="openCommentModal" @ai="() => openAiModal('bubble')" />
      <TableMenu :editor="editor" />
      <TableHandles :editor="editor" />
      <MediaMenu :editor="editor" />

      <AIModal
        :open="aiOpen"
        :editor="editor"
        :mode="aiMode"
        :presets="aiMode === 'bubble' ? BUBBLE_AI_PRESETS : SLASH_AI_PRESETS"
        title="AI assistant"
        subtitle="Use curated prompts to rewrite the selection or continue this section."
        :on-close="closeAiModal"
        :on-execute="runAIPrompt"
        :on-apply="applyDemoAI"
      />

      <CommentModal
        :open="commentOpen"
        :editor="editor"
        :store="commentStore"
        current-user-id="aurthurm"
        title="Comments"
        subtitle="Threads and replies for this section only."
        :on-close="closeCommentModal"
      />
    </div>
  </article>
</template>
