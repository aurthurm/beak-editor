<script setup lang="ts">
import { onMounted, ref } from 'vue';
import V2OfficeSurface from './V2OfficeSurface.vue';
import V2ScenarioHeader from './V2ScenarioHeader.vue';
import { officeSopBlocks, V2_SCENARIOS } from '~/utils/v2/demoData';
import { contentHash } from '@amusendame/beakblock-templates';
import { qmsExtension } from '@amusendame/beakblock-blocks-qms';
import { officeBlocksExtension } from '@amusendame/beakblock-blocks-office';
import type { BeakBlockEditor, EditorMode } from '@amusendame/beakblock-core';

/**
 * One document, three projections. The surface keeps a single editor instance; switching the
 * projection only changes the editor mode. The hash check proves the document content is unchanged.
 */
const scenario = V2_SCENARIOS[1]!;
const blocks = officeSopBlocks();
const projections: Array<{ id: EditorMode; label: string; note: string }> = [
  { id: 'office', label: 'Office', note: 'Ribbon, pages, rulers, Word keyboard behaviour.' },
  { id: 'block', label: 'Block', note: 'Drag handles, slash menu and bubble menu. Ribbon and rulers step aside.' },
  { id: 'controlled', label: 'Controlled', note: 'Office look plus QMS governance (section ownership and workflow states).' },
];
const mode = ref<EditorMode>('block');
const hashes = ref<{ before: string; after: string | null }>({ before: '', after: null });
const editorRef = ref<BeakBlockEditor | null>(null);
const surface = ref<{ getEditor: () => BeakBlockEditor | null } | null>(null);
const extensions = [officeBlocksExtension({}), qmsExtension({})];

async function currentHash(): Promise<string> {
  const ed = surface.value?.getEditor();
  return contentHash(ed ? ed.getDocument() : []);
}

onMounted(async () => {
  hashes.value.before = await currentHash();
});

async function setProjection(next: EditorMode) {
  mode.value = next;
  await new Promise((r) => setTimeout(r, 60));
  hashes.value.after = await currentHash();
}

const unchanged = () => hashes.value.after !== null && hashes.value.after === hashes.value.before;
</script>

<template>
  <div class="v2-scenario">
    <V2ScenarioHeader :eyebrow="`BeakBlock 2.0 · ${scenario.label}`" :title="scenario.label" :capability="scenario.capability">
      <div class="v2-seg" role="group" aria-label="Projection">
        <button
          v-for="p in projections"
          :key="p.id"
          type="button"
          class="v2-seg__btn"
          :aria-pressed="mode === p.id"
          @click="setProjection(p.id)"
        >
          {{ p.label }}
        </button>
      </div>
    </V2ScenarioHeader>

    <div class="v2-hint" role="note">
      <strong>{{ projections.find((p) => p.id === mode)?.label }} projection.</strong>
      {{ projections.find((p) => p.id === mode)?.note }}
      <span class="v2-hash" :data-ok="unchanged()">
        Document content hash
        <code>{{ (hashes.after ?? hashes.before).slice(0, 16) }}</code>
        <template v-if="hashes.after">{{ unchanged() ? 'unchanged after switching' : 'changed' }}</template>
      </span>
    </div>

    <V2OfficeSurface
      ref="surface"
      :blocks="blocks"
      :mode="mode"
      :extensions="extensions"
      :navigation="mode !== 'block'"
      :show-rulers="mode !== 'block'"
      :initial-view-mode="mode === 'block' ? 'draft' : 'print'"
      label="One model, three projections"
      @ready="(ed: BeakBlockEditor) => (editorRef = ed)"
    />
  </div>
</template>

<style scoped>
.v2-scenario {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.v2-seg {
  display: inline-flex;
  border: 1px solid #c9c4bb;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.v2-seg__btn {
  border: 0;
  background: transparent;
  padding: 7px 14px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.v2-seg__btn[aria-pressed='true'] {
  background: #2b579a;
  color: #fff;
}
.v2-hint {
  font-size: 13px;
  line-height: 1.5;
  padding: 10px 12px;
  border-left: 3px solid #2b579a;
  background: #f1f5fb;
  border-radius: 6px;
}
.v2-hash {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #4a4642;
}
.v2-hash[data-ok='true'] code {
  color: #1e7b34;
}
.v2-hash code {
  font-size: 12px;
}
</style>
