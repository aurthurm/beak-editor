<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { importDocxToDocument, detectHeadings, ooxmlPassthroughExtension, type LossReport, type HeadingCandidate } from '@amusendame/beakblock-import-docx';
import { exportDocx, DOCX_MIME } from '@amusendame/beakblock-export-docx';
import { documentToIR, type IRDocument } from '@amusendame/beakblock-ir';
import { mapImportToTemplate, type SectionMappingSuggestion, type TemplateDefinition } from '@amusendame/beakblock-templates';
import { documentToBlocks, type BeakDocument } from '@amusendame/beakblock-schema';
import type { Block } from '@amusendame/beakblock-core';
import V2OfficeSurface from './V2OfficeSurface.vue';
import V2ScenarioHeader from './V2ScenarioHeader.vue';
import { buildOfficeSopDocument, V2_SCENARIOS } from '~/utils/v2/demoData';
import { documentFromBlocks } from '~/utils/v2/layoutTools';
import { publishSopTemplate } from '~/utils/v2/controlledFlow';

const scenario = V2_SCENARIOS[4]!;

const sourceName = ref('');
const busy = ref(false);
const error = ref('');
const importedDoc = shallowRef<BeakDocument | null>(null);
const importedIr = shallowRef<IRDocument | null>(null);
const losses = ref<LossReport[]>([]);
const headings = ref<HeadingCandidate[]>([]);
const mapping = ref<SectionMappingSuggestion[]>([]);
const template = shallowRef<TemplateDefinition | null>(null);
const blocks = shallowRef<Block[]>([]);
const editorKey = ref(0);
const surface = ref<{ getBlocks: () => Block[]; getEditor: () => unknown } | null>(null);
const roundTrip = ref<null | { before: Counts; after: Counts; bytes: number; ok: boolean }>(null);
const exportedBytes = shallowRef<Uint8Array | null>(null);
const exportedName = ref('');

interface Counts {
  paragraphs: number;
  headings: number;
  tables: number;
  passthrough: number;
  losses: number;
}

function countIr(ir: IRDocument, lossCount: number): Counts {
  const counts: Counts = { paragraphs: 0, headings: 0, tables: 0, passthrough: 0, losses: lossCount };
  const visit = (list: Array<{ type: string; props?: Record<string, unknown>; blocks?: unknown[]; rows?: unknown[] }>) => {
    for (const b of list) {
      if (b.type === 'paragraph') {
        counts.paragraphs += 1;
        if (b.props && (b.props as { styleId?: string }).styleId?.startsWith('Heading')) counts.headings += 1;
      } else if (b.type === 'table') counts.tables += 1;
      else if (b.type === 'passthrough') counts.passthrough += 1;
      if (Array.isArray(b.blocks)) visit(b.blocks as never);
      if (Array.isArray(b.rows)) for (const row of b.rows as Array<{ cells: Array<{ blocks: unknown[] }> }>) for (const cell of row.cells) visit(cell.blocks as never);
    }
  };
  for (const section of ir.sections) visit(section.body as never);
  return counts;
}

async function loadBytes(bytes: Uint8Array, name: string) {
  busy.value = true;
  error.value = '';
  try {
    sourceName.value = name;
    const result = await importDocxToDocument(bytes, { keepPassthrough: true });
    importedDoc.value = result.document;
    importedIr.value = result.ir;
    losses.value = result.losses;
    headings.value = detectHeadings(result.ir);
    template.value = template.value ?? (await publishSopTemplate());
    mapping.value = mapImportToTemplate(
      headings.value.map((h) => ({ index: h.index, text: h.text, level: h.level })),
      template.value
    );
    blocks.value = documentToBlocks(result.document);
    editorKey.value += 1;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Import failed';
  } finally {
    busy.value = false;
  }
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await loadBytes(bytes, file.name);
  input.value = '';
}

/** Generates a DOCX from the SOP model so the page works without a file. */
async function generateSample() {
  busy.value = true;
  try {
    const bytes = await exportDocx(documentToIR(buildOfficeSopDocument()));
    await loadBytes(bytes, 'generated-sop-0042.docx');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Generation failed';
  } finally {
    busy.value = false;
  }
}

async function exportCurrent() {
  if (!importedDoc.value) {
    error.value = 'Import or generate a document first.';
    return;
  }
  busy.value = true;
  try {
    const current = surface.value?.getBlocks() ?? [];
    const doc = documentFromBlocks(current, importedDoc.value);
    const ir = documentToIR(doc);
    const bytes = await exportDocx(ir);
    exportedBytes.value = bytes;
    exportedName.value = `${(sourceName.value || 'document').replace(/\.docx$/i, '')}-export.docx`;
    // Round-trip: import what we just exported and compare structure.
    const again = await importDocxToDocument(bytes, { keepPassthrough: true });
    const before = countIr(ir, losses.value.length);
    const after = countIr(again.ir, again.losses.length);
    roundTrip.value = { before, after, bytes: bytes.byteLength, ok: before.paragraphs === after.paragraphs && before.tables === after.tables };
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Export failed';
  } finally {
    busy.value = false;
  }
}

function downloadExport() {
  if (!exportedBytes.value) return;
  const blob = new Blob([exportedBytes.value as BlobPart], { type: DOCX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportedName.value;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const passthroughCount = computed(() => (importedIr.value ? countIr(importedIr.value, 0).passthrough : 0));
const extensions = [ooxmlPassthroughExtension()];
const lossSummary = computed(() => {
  const by: Record<string, number> = {};
  for (const l of losses.value) by[l.severity] = (by[l.severity] ?? 0) + 1;
  return by;
});
</script>

<template>
  <div class="v2-scenario">
    <V2ScenarioHeader :eyebrow="`BeakBlock 2.0 · ${scenario.label}`" :title="scenario.label" :capability="scenario.capability">
      <label class="dx-file">
        <input type="file" accept=".docx" :disabled="busy" @change="onFile" />
        <span>Choose a .docx file</span>
      </label>
      <button type="button" class="dx-btn" :disabled="busy" @click="generateSample">Generate sample .docx</button>
      <button type="button" class="dx-btn dx-btn--primary" :disabled="busy || !importedDoc" @click="exportCurrent">Export current document</button>
      <button type="button" class="dx-btn" :disabled="!exportedBytes" @click="downloadExport">Download {{ exportedName || '.docx' }}</button>
    </V2ScenarioHeader>

    <p v-if="error" class="dx-error" role="alert">{{ error }}</p>

    <div class="dx-grid">
      <section class="dx-card">
        <p class="dx-label">Source</p>
        <p class="dx-hint">{{ sourceName ? `Imported ${sourceName}` : 'Nothing imported yet. Choose a file or generate a sample.' }}</p>
        <p class="dx-hint">Passthrough (unsupported Word content kept as OOXML): <strong>{{ passthroughCount }}</strong></p>
      </section>

      <section class="dx-card">
        <p class="dx-label">Loss report ({{ losses.length }})</p>
        <p class="dx-hint">
          <span v-for="(n, sev) in lossSummary" :key="sev" class="dx-sev" :data-sev="sev">{{ sev }}: {{ n }}</span>
          <span v-if="!losses.length">No losses reported.</span>
        </p>
        <ul class="dx-list dx-list--scroll">
          <li v-for="(l, i) in losses" :key="i">
            <span class="dx-sev" :data-sev="l.severity">{{ l.severity }}</span>
            <code>{{ l.code }}</code> {{ l.message }}
            <span v-if="l.location" class="dx-loc">{{ l.location }}</span>
          </li>
        </ul>
      </section>

      <section class="dx-card">
        <p class="dx-label">Detected headings ({{ headings.length }})</p>
        <ul class="dx-list dx-list--scroll">
          <li v-for="h in headings" :key="h.index" :style="{ paddingLeft: `${(h.level - 1) * 12}px` }">H{{ h.level }} · {{ h.text }}</li>
          <li v-if="!headings.length" class="dx-hint">Headings appear after import.</li>
        </ul>
      </section>

      <section class="dx-card">
        <p class="dx-label">Map to controlled template (legacy SOP migration)</p>
        <p class="dx-hint">Template: {{ template?.title ?? 'Standard operating procedure' }} · {{ template?.sections.length ?? 0 }} sections</p>
        <table v-if="mapping.length" class="dx-table">
          <thead>
            <tr><th>Template section</th><th>Matched heading</th><th>Confidence</th></tr>
          </thead>
          <tbody>
            <tr v-for="m in mapping" :key="m.templateSectionId">
              <td>{{ template?.sections.find((s) => s.templateSectionId === m.templateSectionId)?.title ?? m.templateSectionId }}</td>
              <td>{{ m.matchedText ?? (m.startIndex === -1 ? '—' : 'heading ' + m.startIndex) }}</td>
              <td>
                <span class="dx-conf" :data-ok="m.confidence >= 0.6">{{ Math.round(m.confidence * 100) }}%</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="dx-hint">Mapping suggestions appear after import. Confidence of 60% or more is suggested.</p>
      </section>

      <section v-if="roundTrip" class="dx-card dx-card--wide">
        <p class="dx-label">Export and re-import round trip</p>
        <div class="dx-rt">
          <div>
            <strong>Before export</strong>
            <p class="dx-hint">{{ roundTrip.before.paragraphs }} paragraphs · {{ roundTrip.before.headings }} headings · {{ roundTrip.before.tables }} tables</p>
          </div>
          <div>
            <strong>After re-import</strong>
            <p class="dx-hint">{{ roundTrip.after.paragraphs }} paragraphs · {{ roundTrip.after.headings }} headings · {{ roundTrip.after.tables }} tables</p>
          </div>
          <div>
            <strong>Result</strong>
            <p class="dx-hint">
              {{ roundTrip.bytes.toLocaleString() }} bytes · <span class="dx-conf" :data-ok="roundTrip.ok">{{ roundTrip.ok ? 'structure preserved' : 'structure changed' }}</span>
            </p>
          </div>
        </div>
      </section>
    </div>

    <section class="dx-card dx-card--editor">
      <p class="dx-label">Imported content (with passthrough previews)</p>
      <V2OfficeSurface
        v-if="blocks.length"
        :key="editorKey"
        ref="surface"
        :blocks="blocks"
        :base-document="importedDoc"
        mode="office"
        :extensions="extensions"
        :navigation="false"
        label="Imported document"
      />
      <p v-else class="dx-hint">Import a .docx or generate the sample to load the editor.</p>
    </section>
  </div>
</template>

<style scoped>
.v2-scenario {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dx-file {
  border: 1px dashed #9aa6b8;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 13px;
  cursor: pointer;
  background: #fff;
}
.dx-file input {
  font-size: 12px;
  max-width: 200px;
}
.dx-btn {
  border: 1px solid #c9c4bb;
  background: #fff;
  border-radius: 6px;
  padding: 5px 10px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.dx-btn--primary {
  background: #2b579a;
  color: #fff;
  border-color: #2b579a;
}
.dx-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dx-error {
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: #fdecea;
  color: #8a2a1e;
  font-size: 13px;
}
.dx-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.dx-card {
  border: 1px solid #d6d3cd;
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px;
  min-width: 0;
}
.dx-card--wide {
  grid-column: 1 / -1;
}
.dx-card--editor {
  padding: 0;
  border: 0;
  background: transparent;
}
.dx-label {
  margin: 0 0 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #5b5752;
  font-weight: 600;
}
.dx-hint {
  margin: 4px 0;
  font-size: 12px;
  color: #5b5752;
  line-height: 1.45;
}
.dx-list {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  line-height: 1.6;
}
.dx-list--scroll {
  max-height: 180px;
  overflow: auto;
}
.dx-sev {
  display: inline-block;
  font-size: 11px;
  border-radius: 4px;
  padding: 0 6px;
  margin-right: 4px;
  background: #eef0f3;
}
.dx-sev[data-sev='error'],
.dx-sev[data-sev='major'] {
  background: #fdecea;
}
.dx-sev[data-sev='warning'],
.dx-sev[data-sev='minor'] {
  background: #fff4d6;
}
.dx-loc {
  color: #7a756e;
  font-size: 11px;
}
.dx-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.dx-table th,
.dx-table td {
  text-align: left;
  border-bottom: 1px solid #ece9e3;
  padding: 4px 6px;
}
.dx-conf {
  font-size: 11px;
  border-radius: 4px;
  padding: 0 6px;
  background: #fdecea;
}
.dx-conf[data-ok='true'] {
  background: #dff3e4;
  color: #1e5f2d;
}
.dx-rt {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 1100px) {
  .dx-grid,
  .dx-rt {
    grid-template-columns: 1fr;
  }
}
</style>
