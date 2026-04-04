<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import type { Block } from '@aurthurm/beakblock-core';
import type { ComplianceSectionDefinition } from '~/data';
import { mergeComplianceSections } from '~/utils/complianceMerge';
import ComplianceSectionEditor from './ComplianceSectionEditor.vue';

const props = defineProps<{
  sections: ComplianceSectionDefinition[];
}>();

const mergedBlocks = defineModel<Block[]>('mergedBlocks', { default: () => [] });

type SectionInst = InstanceType<typeof ComplianceSectionEditor>;
const sectionRefs = ref<Record<string, SectionInst | undefined>>({});

function setSectionRef(id: string, el: unknown) {
  if (el && typeof el === 'object' && 'editor' in el) {
    sectionRefs.value[id] = el as SectionInst;
  } else {
    delete sectionRefs.value[id];
  }
}

function getMergedDocument(): Block[] {
  const sources = props.sections.map((def) => {
    const inst = sectionRefs.value[def.id];
    const doc = inst?.editor?.getDocument();
    return {
      title: def.title,
      blocks: doc && doc.length ? doc : def.initialBlocks,
    };
  });
  return mergeComplianceSections(sources, {
    documentTitle: 'Gram stain — standard operating procedure (preview)',
    sectionHeadingLevel: 2,
  });
}

function refreshMerged() {
  mergedBlocks.value = getMergedDocument();
}

onMounted(() => {
  nextTick(() => refreshMerged());
});

defineExpose({
  getMergedDocument,
});
</script>

<template>
  <div class="compliance-workspace">
    <p class="compliance-workspace__lede">
      This sample is a <strong>Gram stain</strong> standard operating procedure. Each block below is a controlled section; authors
      edit only inside that field. Figures mix Unsplash and Wikimedia Commons microscopy (see captions for sources). Use
      <strong>Preview document</strong> to merge every section into one continuous read-only document with headings.
    </p>
    <div class="compliance-workspace__sections">
      <ComplianceSectionEditor
        v-for="def in sections"
        :key="def.id"
        :ref="(el) => setSectionRef(def.id, el)"
        :section-id="def.id"
        :section-title="def.title"
        :required="def.required"
        :initial-blocks="def.initialBlocks"
        @update="refreshMerged"
      />
    </div>
  </div>
</template>
