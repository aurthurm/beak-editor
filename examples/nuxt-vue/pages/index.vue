<script setup lang="ts">
import { ref } from 'vue';
import {
  AIModal,
  CommentModal,
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
} from '@aurthurm/beakblock-vue';
import {
  BUBBLE_AI_PRESETS,
  SLASH_AI_PRESETS,
  createCommentPlugin,
  InMemoryCommentStore,
} from '@aurthurm/beakblock-core';
import { sampleDocument } from '~/data';
import { sendAIRequest } from '../../shared/ai';

useHead({
  title: 'BeakBlock Vue Showcase',
});

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

const runAIPrompt = async (request: Parameters<typeof sendAIRequest>[0]) => sendAIRequest(request, '/api/ai');

const applyDemoAI = async ({ output }: { output: string }) => {
  editor.value?.pm.insertText(output);
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
</script>

<template>
  <div class="page-shell">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Nuxt + Vue example</p>
        <h1>Almost every block in one editorial page.</h1>
        <p>
          BeakBlock inside Nuxt is presented as a calm printed spread: warm paper, crisp type, and a dense block showcase that includes tables, columns, media, charts, icons, and inline links.
        </p>
      </div>

      <aside class="hero-panel">
        <div class="hero-stat">
          <span class="hero-stat-label">Package</span>
          <span class="hero-stat-value">@aurthurm/beakblock-vue</span>
        </div>
        <div class="hero-stat">
          <span class="hero-stat-label">Aesthetic</span>
          <span class="hero-stat-value">Editorial premium</span>
        </div>
        <div class="hero-stat">
          <span class="hero-stat-label">Rendering</span>
          <span class="hero-stat-value">Client-only editor island</span>
        </div>
      </aside>
    </header>

    <main class="layout">
      <section class="editor-stage">
        <ClientOnly>
          <BeakBlockView :editor="editor" class-name="editor-view" />
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
            subtitle="Use curated prompts to rewrite the selection or continue the document."
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
            subtitle="Leave threads, replies, reactions, or mark notes resolved."
            :on-close="closeCommentModal"
          />
        </ClientOnly>
      </section>

      <section class="inspector">
        <p class="section-label">Document readout</p>
        <h2>Document JSON</h2>
        <p class="inspector__lede">The serialized blocks below reflect the live Nuxt editor state without affecting the main page composition.</p>
        <pre>{{ JSON.stringify(blocks, null, 2) }}</pre>
      </section>
    </main>
  </div>
</template>
