<script setup lang="ts">
import { computed } from 'vue';
import V2OfficeSurface from './V2OfficeSurface.vue';
import V2ScenarioHeader from './V2ScenarioHeader.vue';
import { buildOfficeSopDocument, officeSopBlocks, V2_SCENARIOS } from '~/utils/v2/demoData';

const scenario = V2_SCENARIOS[0]!;
const base = buildOfficeSopDocument();
const blocks = officeSopBlocks();
const headerFieldsNote = computed(() => 'DOCPROPERTY docNumber/revision/effectiveDate and PAGE/NUMPAGES fields');
</script>

<template>
  <div class="v2-scenario">
    <V2ScenarioHeader :eyebrow="`BeakBlock 2.0 · ${scenario.label}`" :title="scenario.label" :capability="scenario.capability">
      <span class="v2-pill">Mode: office</span>
      <span class="v2-pill">Word keyboard on</span>
    </V2ScenarioHeader>

    <div class="v2-hint" role="note">
      <strong>Try:</strong>
      Ctrl+Enter for a page break, Ctrl+Alt+1 for a Heading 1, Tab in the last table cell to add a row, and type "quotes" to see smart quotes.
      Open <em>Print Preview</em> in the view control to see the rendered pages with {{ headerFieldsNote }}.
      The landscape appendix starts on its own section.
    </div>

    <V2OfficeSurface
      :blocks="blocks"
      :base-document="base"
      mode="office"
      label="Gram stain SOP"
    />
  </div>
</template>

<style scoped>
.v2-scenario {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.v2-pill {
  font-size: 12px;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid #c9c4bb;
  background: #fff;
}
.v2-hint {
  font-size: 13px;
  line-height: 1.5;
  padding: 10px 12px;
  border-left: 3px solid #2b579a;
  background: #f1f5fb;
  border-radius: 6px;
}
</style>
