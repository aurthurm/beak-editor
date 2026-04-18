<script setup lang="ts">
import { ref } from 'vue';
import {
  AIModal,
  CommentModal,
  CommentRail,
  BubbleMenu,
  createChartBlockSpec,
  MediaMenu,
  BeakBlockView,
  SlashMenu,
  TableHandles,
  TableMenu,
  useCustomSlashMenuItems,
  useEditorContent,
  useBeakBlock,
} from '@amusendame/beakblock-vue';
import {
  BUBBLE_AI_PRESETS,
  SLASH_AI_PRESETS,
  createCommentPlugin,
  InMemoryCommentStore,
} from '@amusendame/beakblock-core';
import { sampleDocument } from './data';
import { sendAIRequest } from '../../shared/ai';

const customBlocks = [createChartBlockSpec()];
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

const editor = useBeakBlock({
  initialContent: sampleDocument,
  customBlocks,
  prosemirror: {
    plugins: [createCommentPlugin(commentStore)],
  },
});

const blocks = useEditorContent(editor);
const customSlashItems = useCustomSlashMenuItems(editor, customBlocks);

const runAIPrompt = async (request: Parameters<typeof sendAIRequest>[0]) => sendAIRequest(request, '/api/ai');

const applyDemoAI = async ({ output }: { output: string }) => {
  editor.value?.pm.insertText(output);
};
</script>

<template>
  <div class="app-shell">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Vue + Vite example</p>
        <h1>Almost every block in one editorial page.</h1>
        <p>
          BeakBlock’s Vue package is wrapped here like a print spread: warm paper, restrained ink, and a dense block showcase that includes tables, columns, media, charts, icons, and inline links.
        </p>
      </div>

      <aside class="hero-panel">
        <div class="hero-stat">
          <span class="hero-stat-label">Package</span>
          <span class="hero-stat-value">@amusendame/beakblock-vue</span>
        </div>
        <div class="hero-stat">
          <span class="hero-stat-label">Aesthetic</span>
          <span class="hero-stat-value">Editorial premium</span>
        </div>
        <div class="hero-stat">
          <span class="hero-stat-label">Menus</span>
          <span class="hero-stat-value">Anchored to the editor</span>
        </div>
      </aside>
    </header>

    <main class="layout">
      <section class="editor-stage">
        <CommentRail :editor="editor" :store="commentStore" current-user-id="amusendame">
          <BeakBlockView :editor="editor" class-name="editor-view" />
        </CommentRail>
        <SlashMenu
          :editor="editor"
          :custom-items="customSlashItems"
          @ai="() => openAiModal('slash')"
        />
        <BubbleMenu
          :editor="editor"
          @comment="openCommentModal"
          @ai="() => openAiModal('bubble')"
        />
        <TableMenu :editor="editor" />
        <TableHandles :editor="editor" />
        <MediaMenu :editor="editor" />
      </section>

      <AIModal
        :open="aiOpen"
        :editor="editor"
        :mode="aiMode"
        :presets="aiMode === 'bubble' ? BUBBLE_AI_PRESETS : SLASH_AI_PRESETS"
        title="AI assistant"
        subtitle="Use curated prompts to rewrite the selection or continue the document."
        :on-close="closeAiModal"
        :on-execute="runAIPrompt"
        :on-apply="applyDemoAI"
      />

      <CommentModal
        :open="commentOpen"
        :editor="editor"
        :store="commentStore"
        current-user-id="amusendame"
        title="Comments"
        subtitle="Leave threads, replies, reactions, or mark notes resolved."
        :on-close="closeCommentModal"
      />

      <section class="inspector">
        <p class="section-label">Document readout</p>
        <h2>Document JSON</h2>
        <p class="inspector__lede">The serialized blocks below reflect the live Vue editor state without affecting the main page composition.</p>
        <pre>{{ JSON.stringify(blocks, null, 2) }}</pre>
      </section>
    </main>
  </div>
</template>
