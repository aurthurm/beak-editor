<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { qmsExtension } from '@amusendame/beakblock-blocks-qms';
import { createAICommandLayer, createFetchProvider, createMockProvider, AI_DISCLAIMER, type AICommandId, type AICommandLayer, type AIProvider, type AIResult } from '@amusendame/beakblock-ai';
import { reviewExtension, InMemoryRevisionStore, acceptRevision, rejectRevision, type RevisionRecord } from '@amusendame/beakblock-review';
import type { BeakBlockEditor, Block } from '@amusendame/beakblock-core';
import type { TemplateDefinition } from '@amusendame/beakblock-templates';
import V2OfficeSurface from './V2OfficeSurface.vue';
import V2ScenarioHeader from './V2ScenarioHeader.vue';
import { V2_SCENARIOS } from '~/utils/v2/demoData';
import { DEMO_USERS, instantiateSop, policyContextFor, publishSopTemplate, type DemoUser } from '~/utils/v2/controlledFlow';

const scenario = V2_SCENARIOS[6]!;

const users = DEMO_USERS.filter((u) => ['ann', 'ben', 'rita'].includes(u.id));
const user = ref<DemoUser>(users[0]!);
const blocks = shallowRef<Block[]>([]);
const editorKey = ref(0);
const surface = ref<{ getEditor: () => BeakBlockEditor | null } | null>(null);
const store = new InMemoryRevisionStore();
const proposals = shallowRef<RevisionRecord[]>([]);
const results = ref<Array<{ id: number; command: string; status: string; detail: string; at: string }>>([]);
const providerMode = ref<'checking' | 'live' | 'mock'>('checking');
const providerCalls = ref(0);
const goal = ref('Gram stain of a sputum smear');
const instruction = ref('Keep it formal and concise');
const busy = ref(false);
const selectionText = ref('');
const layer = shallowRef<AICommandLayer | null>(null);
let counter = 0;

const mockProvider = createMockProvider({
  'ai.rewriteSelection': () => ({ text: 'Gram staining separates bacteria into two groups according to the structure of their cell walls.' }),
  'ai.proposeProcedureSteps': () => ({
    json: {
      steps: [
        'Label the slide with the specimen identifier and date.',
        'Prepare a thin, even smear and allow it to air dry.',
        'Heat fix by passing the slide three times through the flame.',
        'Flood with crystal violet for 30 seconds, then rinse with water.',
        'Apply Gram iodine for 60 seconds, then decolourise and counterstain.',
      ],
    },
  }),
  'ai.reviewDocumentConsistency': () => ({
    json: {
      findings: [
        { severity: 'warning', message: 'The Records section refers to a five-year retention period that is not stated in the Scope.' },
        { severity: 'info', message: 'Purpose and Scope describe the bench with different names.' },
      ],
    },
  }),
});

function countingProvider(inner: AIProvider): AIProvider {
  return async (request, signal) => {
    providerCalls.value += 1;
    return inner(request, signal);
  };
}

const extensions = [
  qmsExtension({
    getPolicyContext: () => policyContextFor(blocks.value, user.value),
  }),
  reviewExtension({ enabled: true, author: { id: user.value.id, name: user.value.name }, store }),
];

function describe(result: AIResult): { status: string; detail: string } {
  switch (result.status) {
    case 'proposed':
      return { status: 'proposed', detail: `${result.revisionIds.length} tracked revision(s) created${result.validation.length ? ` · ${result.validation.length} validation note(s)` : ''}` };
    case 'advisory':
      return { status: 'advisory', detail: `${result.findings.length} finding(s), nothing applied` };
    case 'denied':
      return { status: 'denied', detail: result.reason };
    case 'error':
      return { status: 'error', detail: result.error.message };
    case 'cancelled':
      return { status: 'cancelled', detail: 'cancelled' };
  }
}

async function run(command: AICommandId, args?: Record<string, unknown>) {
  const l = layer.value;
  if (!l) return;
  busy.value = true;
  const before = providerCalls.value;
  try {
    const result = await l.run(command, args);
    const { status, detail } = describe(result);
    const called = providerCalls.value - before;
    results.value = [
      { id: ++counter, command, status, detail: `${detail}${status === 'denied' ? ` · provider calls: ${called}` : ''}`, at: new Date().toLocaleTimeString() },
      ...results.value,
    ].slice(0, 12);
    proposals.value = store.list().filter((r) => r.status === 'pending' && r.aiGenerated);
  } finally {
    busy.value = false;
  }
}

async function setup(ed: BeakBlockEditor) {
  let provider: AIProvider = countingProvider(mockProvider);
  try {
    const res = await fetch('/api/v2/ai-status');
    const status = (await res.json()) as { configured: boolean };
    if (status.configured) {
      providerMode.value = 'live';
      provider = countingProvider(createFetchProvider({ url: '/api/v2/ai' }));
    } else {
      providerMode.value = 'mock';
    }
  } catch {
    providerMode.value = 'mock';
  }
  layer.value = createAICommandLayer({
    provider,
    editor: ed,
    getPolicyContext: () => policyContextFor(blocks.value, user.value),
    author: { id: 'ai-assistant', name: 'AI assistant' },
    options: {},
  });
  ed.on('selectionChange', () => {
    const { $from, $to, empty } = ed.pm.state.selection;
    selectionText.value = empty || !$from.sameParent($to) ? '' : $from.parent.textContent.slice($from.parentOffset, $to.parentOffset);
  });
  ed.on('change', () => {
    proposals.value = store.list().filter((r) => r.status === 'pending' && r.aiGenerated);
  });
}

function onReady(ed: BeakBlockEditor) {
  void setup(ed);
}

const unsub = ref<null | (() => void)>(null);
onMounted(async () => {
  unsub.value = store.subscribe(() => {
    proposals.value = store.list().filter((r) => r.status === 'pending' && r.aiGenerated);
  });
  const template: TemplateDefinition = await publishSopTemplate();
  blocks.value = await instantiateSop(template);
  editorKey.value += 1;
});

function switchUser(next: DemoUser) {
  const ed = surface.value?.getEditor();
  if (ed) blocks.value = ed.getDocument();
  user.value = next;
  editorKey.value += 1;
}

function act(id: string, kind: 'accept' | 'reject') {
  const ed = surface.value?.getEditor();
  if (!ed) return;
  const by = user.value.id;
  if (kind === 'accept') acceptRevision(ed.pm.view as never, id, by);
  else rejectRevision(ed.pm.view as never, id, by);
  proposals.value = store.list().filter((r) => r.status === 'pending' && r.aiGenerated);
}

/** Selects a long paragraph inside the given controlled section (by templateSectionId). */
function selectParagraphIn(templateSectionId: string) {
  const ed = surface.value?.getEditor();
  if (!ed) return;
  const doc = ed.pm.state.doc;
  let found: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === 'controlledSection' && node.attrs.templateSectionId === templateSectionId) {
      node.descendants((child, childPos) => {
        if (found) return false;
        if (child.isTextblock && child.textContent.length > 20) {
          const start = pos + 1 + childPos + 1;
          found = { from: start, to: start + child.textContent.length };
          return false;
        }
        return true;
      });
      return false;
    }
    return true;
  });
  const target = found as { from: number; to: number } | null;
  if (!target) return;
  // TextSelection is reached through the current selection's class, avoiding a direct prosemirror import.
  const TextSelectionClass = ed.pm.state.selection.constructor as unknown as { create: (d: typeof doc, a: number, h: number) => unknown };
  ed.pm.dispatch(ed.pm.state.tr.setSelection(TextSelectionClass.create(doc, target.from, target.to) as never));
}

const denialHint = computed(() => 'Select text in a section this user cannot edit, then rewrite: the provider is never called.');
</script>

<template>
  <div class="v2-scenario">
    <V2ScenarioHeader :eyebrow="`BeakBlock 2.0 · ${scenario.label}`" :title="scenario.label" :capability="scenario.capability">
      <span class="ai-provider" :data-mode="providerMode">
        {{ providerMode === 'live' ? 'Live provider' : providerMode === 'mock' ? 'Mock provider (canned replies)' : 'Checking provider…' }}
      </span>
      <div class="ai-users" role="group" aria-label="Acting as">
        <button v-for="u in users" :key="u.id" type="button" class="ai-chip" :aria-pressed="user.id === u.id" @click="switchUser(u)">{{ u.name }}</button>
      </div>
    </V2ScenarioHeader>

    <p class="ai-disclaimer" role="note">{{ AI_DISCLAIMER }}. Every AI output is a tracked change attributed to the AI assistant. Nothing is applied until a person accepts it.</p>

    <div class="ai-grid">
      <div class="ai-editor">
        <V2OfficeSurface
          v-if="blocks.length"
          :key="editorKey"
          ref="surface"
          :blocks="blocks"
          mode="controlled"
          :extensions="extensions"
          :navigation="false"
          label="AI-assisted controlled SOP"
          @ready="onReady"
        />
        <p class="ai-hint">{{ denialHint }} Selected text: <strong>{{ selectionText ? `“${selectionText.slice(0, 60)}…”` : 'none' }}</strong></p>
      </div>

      <aside class="ai-side" aria-label="AI commands">
        <section class="ai-card">
          <p class="ai-label">Commands</p>
          <button type="button" class="ai-btn" :disabled="busy || !selectionText" @click="run('ai.rewriteSelection', { instruction: instruction })">Rewrite selection</button>
          <label class="ai-field">
            Instruction
            <input v-model="instruction" class="ai-input" />
          </label>
          <label class="ai-field">
            Goal for procedure steps
            <input v-model="goal" class="ai-input" />
          </label>
          <button type="button" class="ai-btn" :disabled="busy" @click="run('ai.proposeProcedureSteps', { goal, maxSteps: 6 })">Propose procedure steps (at cursor)</button>
          <button type="button" class="ai-btn" :disabled="busy" @click="run('ai.reviewDocumentConsistency', {})">Review document consistency (advisory)</button>
          <div class="ai-row">
            <button type="button" class="ai-btn ai-btn--ghost" @click="selectParagraphIn('scope')">Select text in Scope</button>
            <button type="button" class="ai-btn ai-btn--ghost" @click="selectParagraphIn('purpose')">Select text in Purpose</button>
          </div>
        </section>

        <section class="ai-card">
          <p class="ai-label">Run log</p>
          <ul class="ai-log">
            <li v-for="r in results" :key="r.id" :data-status="r.status">
              <span class="ai-status">{{ r.status }}</span>
              <code>{{ r.command }}</code>
              <span class="ai-detail">{{ r.detail }}</span>
            </li>
            <li v-if="!results.length" class="ai-hint">Run a command to see its outcome.</li>
          </ul>
        </section>

        <section class="ai-card">
          <p class="ai-label">Pending AI proposals ({{ proposals.length }})</p>
          <ul class="ai-log">
            <li v-for="p in proposals" :key="p.id" class="ai-proposal">
              <div><span class="ai-ai">AI-generated</span> <span class="ai-kind">{{ p.kind }}</span></div>
              <p class="ai-quote">{{ p.text ?? '' }}</p>
              <div class="ai-row">
                <button type="button" class="ai-btn ai-btn--small" @click="act(p.id, 'accept')">Accept</button>
                <button type="button" class="ai-btn ai-btn--small" @click="act(p.id, 'reject')">Reject</button>
              </div>
            </li>
            <li v-if="!proposals.length" class="ai-hint">No pending proposals.</li>
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
.ai-provider {
  font-size: 12px;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid #c9c4bb;
  background: #fff;
}
.ai-provider[data-mode='mock'] {
  background: #fff4d6;
  border-color: #e0c270;
}
.ai-provider[data-mode='live'] {
  background: #dff3e4;
  border-color: #8cc79b;
}
.ai-users {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.ai-chip,
.ai-btn {
  border: 1px solid #c9c4bb;
  background: #fff;
  border-radius: 6px;
  padding: 5px 10px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}
.ai-chip[aria-pressed='true'] {
  background: #2b579a;
  color: #fff;
  border-color: #2b579a;
}
.ai-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ai-btn--small {
  padding: 3px 8px;
}
.ai-btn--ghost {
  background: transparent;
}
.ai-disclaimer {
  margin: 0;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #f1e9ff;
  color: #3f2570;
}
.ai-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 12px;
  align-items: start;
}
.ai-editor {
  min-width: 0;
}
.ai-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ai-card {
  border: 1px solid #d6d3cd;
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ai-label {
  margin: 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #5b5752;
  font-weight: 600;
}
.ai-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: #4a4642;
}
.ai-input {
  font: inherit;
  font-size: 12px;
  border: 1px solid #c9c4bb;
  border-radius: 6px;
  padding: 4px 6px;
}
.ai-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.ai-log {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}
.ai-log li {
  border-top: 1px solid #ece9e3;
  padding-top: 6px;
}
.ai-status {
  display: inline-block;
  min-width: 64px;
  text-align: center;
  font-size: 11px;
  border-radius: 4px;
  padding: 0 6px;
  margin-right: 4px;
  background: #eef0f3;
}
.ai-log li[data-status='proposed'] .ai-status {
  background: #dff3e4;
}
.ai-log li[data-status='denied'] .ai-status {
  background: #fdecea;
  color: #8a2a1e;
}
.ai-log li[data-status='advisory'] .ai-status {
  background: #e4edff;
}
.ai-detail {
  color: #4a4642;
}
.ai-ai {
  font-size: 11px;
  background: #f1e9ff;
  color: #5b2aa0;
  padding: 0 6px;
  border-radius: 4px;
}
.ai-kind {
  font-size: 11px;
  color: #5b5752;
  margin-left: 4px;
}
.ai-quote {
  margin: 4px 0;
  color: #3b3935;
}
.ai-hint {
  font-size: 12px;
  color: #5b5752;
  margin: 4px 0;
}
@media (max-width: 1100px) {
  .ai-grid {
    grid-template-columns: 1fr;
  }
}
</style>
