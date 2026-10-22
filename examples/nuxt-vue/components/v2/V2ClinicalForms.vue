<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { clinicalExtension, formsExtension, validateClinicalDocument, validateForm, validateEquipmentReferences, DEFAULT_REAGENT_COLUMNS } from '@amusendame/beakblock-blocks-clinical';
import { officeBlocksExtension, refreshOfficeBlocks } from '@amusendame/beakblock-blocks-office';
import type { BeakBlockEditor, Block } from '@amusendame/beakblock-core';
import type { ValidationIssue } from '@amusendame/beakblock-core';
import V2OfficeSurface from './V2OfficeSurface.vue';
import V2ScenarioHeader from './V2ScenarioHeader.vue';
import { CLINICAL_VARIABLES, clinicalDemoBlocks, createMockLimsProvider, V2_SCENARIOS } from '~/utils/v2/demoData';

const scenario = V2_SCENARIOS[5]!;

const lims = createMockLimsProvider(150);
const biohazard = ref<boolean>(CLINICAL_VARIABLES.biohazard);
const variables = computed(() => ({ ...CLINICAL_VARIABLES, biohazard: biohazard.value }));
const blocks = clinicalDemoBlocks(DEFAULT_REAGENT_COLUMNS);
const surface = ref<{ getEditor: () => BeakBlockEditor | null; getBlocks: () => Block[] } | null>(null);

const extensions = [
  clinicalExtension({ equipmentProvider: lims }),
  formsExtension({}),
  officeBlocksExtension({ variables: () => variables.value }),
];

interface Group {
  source: string;
  issues: ValidationIssue[];
}
const groups = shallowRef<Group[]>([]);
const checkedAt = ref('');
const validating = ref(false);

async function validate() {
  const ed = surface.value?.getEditor();
  if (!ed) return;
  validating.value = true;
  try {
    const current = ed.getDocument();
    const registry = ed.blockRegistry.validate(current);
    const clinical = validateClinicalDocument(current, { equipmentProvider: lims });
    const forms = validateForm(current);
    const equipment = await validateEquipmentReferences(ed.pm.state.doc, lims);
    // Registry and clinical validation both report on the same blocks; keep one row per (code, blockId, message).
    const seen = new Set<string>();
    const dedupe = (issues: ValidationIssue[]) =>
      issues.filter((i) => {
        const key = `${i.code}|${i.blockId ?? ''}|${i.message}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    groups.value = [
      { source: 'Block registry', issues: dedupe(registry) },
      { source: 'Clinical rules', issues: dedupe(clinical) },
      { source: 'Forms', issues: dedupe(forms) },
      { source: 'Equipment (mock LIMS)', issues: dedupe(equipment) },
    ];
    checkedAt.value = new Date().toLocaleTimeString();
  } finally {
    validating.value = false;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
function onReady(ed: BeakBlockEditor) {
  ed.on('change', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void validate(), 400);
  });
  void validate();
}

function toggleBiohazard() {
  biohazard.value = !biohazard.value;
  const ed = surface.value?.getEditor();
  if (ed) refreshOfficeBlocks(ed);
}

const totals = computed(() => {
  const all = groups.value.flatMap((g) => g.issues);
  return {
    errors: all.filter((i) => i.severity === 'error').length,
    warnings: all.filter((i) => i.severity === 'warning').length,
    info: all.filter((i) => i.severity === 'info').length,
  };
});
</script>

<template>
  <div class="v2-scenario">
    <V2ScenarioHeader :eyebrow="`BeakBlock 2.0 · ${scenario.label}`" :title="scenario.label" :capability="scenario.capability">
      <button type="button" class="cl-btn" :aria-pressed="biohazard" @click="toggleBiohazard">
        Biohazard variable: {{ biohazard ? 'true' : 'false' }}
      </button>
      <button type="button" class="cl-btn" :disabled="validating" @click="validate">{{ validating ? 'Validating…' : 'Re-run validation' }}</button>
    </V2ScenarioHeader>

    <div class="cl-hint" role="note">
      The LIMS mock marks <code>CEN-004</code> as inactive: the centrifuge reference in step 3 is flagged.
      Form fields use units and calculations (<em>sample × 5</em>). The footnote, the caption and the cross-reference
      update live. Toggle the biohazard variable to show or hide the conditional block.
    </div>

    <div class="cl-grid">
      <div class="cl-editor">
        <V2OfficeSurface
          ref="surface"
          :blocks="blocks"
          mode="office"
          :extensions="extensions"
          :navigation="false"
          label="Clinical SOP"
          @ready="onReady"
        />
      </div>

      <aside class="cl-side" aria-label="Validation">
        <section class="cl-card">
          <p class="cl-label">Validation summary</p>
          <p class="cl-totals">
            <span class="cl-pill" data-sev="error">{{ totals.errors }} errors</span>
            <span class="cl-pill" data-sev="warning">{{ totals.warnings }} warnings</span>
            <span class="cl-pill" data-sev="info">{{ totals.info }} info</span>
          </p>
          <p class="cl-hint-small">Last checked {{ checkedAt || '—' }}</p>
        </section>
        <section v-for="g in groups" :key="g.source" class="cl-card">
          <p class="cl-label">{{ g.source }} ({{ g.issues.length }})</p>
          <ul class="cl-list">
            <li v-for="(i, idx) in g.issues" :key="idx">
              <span class="cl-pill" :data-sev="i.severity">{{ i.severity }}</span>
              <code>{{ i.code }}</code> {{ i.message }}
            </li>
            <li v-if="!g.issues.length" class="cl-hint-small">No issues.</li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.v2-scenario {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cl-btn {
  border: 1px solid #c9c4bb;
  background: #fff;
  border-radius: 6px;
  padding: 5px 10px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.cl-btn[aria-pressed='true'] {
  background: #2b579a;
  color: #fff;
  border-color: #2b579a;
}
.cl-btn:disabled {
  opacity: 0.5;
}
.cl-hint {
  font-size: 13px;
  line-height: 1.5;
  padding: 10px 12px;
  border-left: 3px solid #2b579a;
  background: #f1f5fb;
  border-radius: 6px;
}
.cl-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 12px;
  align-items: start;
}
.cl-editor {
  min-width: 0;
}
.cl-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cl-card {
  border: 1px solid #d6d3cd;
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px;
}
.cl-label {
  margin: 0 0 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #5b5752;
  font-weight: 600;
}
.cl-totals {
  margin: 0;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.cl-pill {
  display: inline-block;
  font-size: 11px;
  border-radius: 4px;
  padding: 1px 6px;
  margin-right: 4px;
  background: #eef0f3;
}
.cl-pill[data-sev='error'] {
  background: #fdecea;
  color: #8a2a1e;
}
.cl-pill[data-sev='warning'] {
  background: #fff4d6;
}
.cl-pill[data-sev='info'] {
  background: #e4edff;
}
.cl-list {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  line-height: 1.6;
}
.cl-hint-small {
  margin: 4px 0;
  font-size: 12px;
  color: #5b5752;
}
@media (max-width: 1100px) {
  .cl-grid {
    grid-template-columns: 1fr;
  }
}
</style>
