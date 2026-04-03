<script setup lang="ts">
import { computed } from 'vue';
import {
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
import { sampleDocument } from '~/data';

useHead({
  title: 'BeakBlock Vue Showcase',
});

const customBlocks = [createChartBlockSpec()];

const editor = useBeakBlock({
  initialContent: sampleDocument,
  customBlocks,
});

const blocks = useEditorContent(editor);
const customSlashItems = useCustomSlashMenuItems(editor, customBlocks);
const isReady = computed(() => Boolean(editor.value));
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
          <SlashMenu :editor="editor" :custom-items="customSlashItems" />
          <BubbleMenu :editor="editor" />
          <TableMenu :editor="editor" />
          <TableHandles :editor="editor" />
          <MediaMenu :editor="editor" />
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
