<script setup lang="ts">
import { computed, reactive, ref, watch, watchEffect } from 'vue';
import {
  AIModal,
  CommentModal,
  BeakBlockView,
  createChartBlockSpec,
  useBeakBlock,
} from '@aurthurm/beakblock-vue';
import { BUBBLE_AI_PRESETS, SLASH_AI_PRESETS } from '@aurthurm/beakblock-core';
import type { BeakBlockEditor, Block, CommentStore } from '@aurthurm/beakblock-core';
import { complianceSopSections, financialAnalystCvDocument, sampleDocument } from '~/data';
import {
  boardOnePagerDocument,
  lessonPlanDocument,
  newsletterShowcaseDocument,
  postmortemDocument,
  prdShowcaseDocument,
  runbookShowcaseDocument,
} from '~/data/showcase-documents';
import { sendAIRequest } from '../../shared/ai';

useHead({
  title: 'BeakBlock Vue Showcase',
});

type PanelApi = {
  getEditor: () => BeakBlockEditor | null;
  getBlocks: () => Block[];
  getCommentStore: () => CommentStore;
};

const documentTabs = [
  { id: 'generic', label: 'Generic showcase', sub: 'Full block tour', document: sampleDocument, editorClass: undefined as string | undefined },
  { id: 'cv', label: 'Financial CV', sub: 'Columns & résumé', document: financialAnalystCvDocument, editorClass: 'editor-view--cv' },
  { id: 'prd', label: 'PRD brief', sub: 'Product specs', document: prdShowcaseDocument, editorClass: undefined },
  { id: 'runbook', label: 'On-call runbook', sub: 'Code & checks', document: runbookShowcaseDocument, editorClass: undefined },
  { id: 'board', label: 'Board one-pager', sub: 'KPIs & chart', document: boardOnePagerDocument, editorClass: undefined },
  { id: 'lesson', label: 'Lesson plan', sub: 'Agenda & HW', document: lessonPlanDocument, editorClass: undefined },
  { id: 'postmortem', label: 'Postmortem', sub: 'Incident review', document: postmortemDocument, editorClass: undefined },
  { id: 'newsletter', label: 'Newsletter', sub: 'Magazine layout', document: newsletterShowcaseDocument, editorClass: 'editor-view--newsletter' },
] as const;

type DocumentTabId = (typeof documentTabs)[number]['id'];

const viewMode = ref<DocumentTabId | 'compliance'>('generic');
const previewOpen = ref(false);
const complianceWorkspaceRef = ref<{
  getMergedDocument: () => Block[];
} | null>(null);
const complianceMerged = ref<Block[]>([]);

const panelRefs = reactive<Record<string, PanelApi | null>>({});

function setPanelRef(id: string, el: unknown) {
  if (el && typeof el === 'object' && 'getEditor' in el) {
    panelRefs[id] = el as PanelApi;
  } else {
    panelRefs[id] = null;
  }
}

const customBlocks = [createChartBlockSpec()];

const commentOpen = ref(false);
const aiOpen = ref(false);
const aiMode = ref<'bubble' | 'slash'>('bubble');

watch(viewMode, () => {
  commentOpen.value = false;
  aiOpen.value = false;
});

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

const modalTargetEditor = computed((): BeakBlockEditor | null => {
  if (viewMode.value === 'compliance') return null;
  return panelRefs[viewMode.value]?.getEditor() ?? null;
});

const modalCommentStore = computed(() => {
  if (viewMode.value === 'compliance') return null;
  return panelRefs[viewMode.value]?.getCommentStore() ?? null;
});

const applyDemoAI = async ({ output }: { output: string }) => {
  modalTargetEditor.value?.pm.insertText(output);
};

const previewEditor = useBeakBlock({
  initialContent: [],
  editable: false,
  customBlocks,
});

function openDocumentPreview() {
  previewOpen.value = true;
}

function closeDocumentPreview() {
  previewOpen.value = false;
}

watch(
  () => [previewOpen.value, previewEditor.value] as const,
  ([open, pmEditor]) => {
    if (!open || !pmEditor || pmEditor.isDestroyed) return;
    const merged = complianceWorkspaceRef.value?.getMergedDocument() ?? complianceMerged.value;
    pmEditor.setDocument(merged);
  },
  { flush: 'post' }
);

const inspectorBlocks = ref<Block[]>([]);

watchEffect((onCleanup) => {
  if (viewMode.value === 'compliance') {
    inspectorBlocks.value = complianceMerged.value;
    return;
  }
  const panel = panelRefs[viewMode.value];
  if (!panel) {
    inspectorBlocks.value = [];
    return;
  }
  inspectorBlocks.value = panel.getBlocks();
  const ed = panel.getEditor();
  if (ed && !ed.isDestroyed) {
    const off = ed.on('change', () => {
      inspectorBlocks.value = panel.getBlocks();
    });
    onCleanup(() => {
      off();
    });
  }
});
</script>

<template>
  <div class="page-shell">
    <div class="page-shell__mesh" aria-hidden="true" />
    <header class="hero hero--enter">
      <div class="hero-copy">
        <p class="eyebrow">Nuxt + Vue example</p>
        <h1>Almost every block in one editorial page.</h1>
        <p>
          Pick a sample from the <strong>left rail</strong> — each opens a dedicated editor with comments, AI, tables, media, and charts where the document uses them. The
          <strong>Gram stain SOP</strong> mode demonstrates multi-section compliance authoring and a merged preview.
        </p>
      </div>

      <aside class="hero-panel hero-panel--enter">
        <div class="hero-stat">
          <span class="hero-stat-label">Package</span>
          <span class="hero-stat-value">@aurthurm/beakblock-vue</span>
        </div>
        <div class="hero-stat">
          <span class="hero-stat-label">Samples</span>
          <span class="hero-stat-value">9 scenarios</span>
        </div>
        <div class="hero-stat">
          <span class="hero-stat-label">Layout</span>
          <span class="hero-stat-value">Sticky nav + editor</span>
        </div>
      </aside>
    </header>

    <main class="layout layout--with-sidebar">
      <aside class="sample-sidebar sample-sidebar--enter" aria-label="Sample documents">
        <p class="sample-sidebar__title">Samples</p>
        <nav class="sample-sidebar__nav">
          <button
            v-for="tab in documentTabs"
            :key="tab.id"
            type="button"
            class="sample-sidebar__btn"
            :class="{ 'sample-sidebar__btn--active': viewMode === tab.id }"
            @click="viewMode = tab.id"
          >
            {{ tab.label }}
            <span class="sample-sidebar__sub">{{ tab.sub }}</span>
          </button>
        </nav>
        <div class="sample-sidebar__divider" role="presentation" />
        <button
          type="button"
          class="sample-sidebar__btn sample-sidebar__btn--compliance"
          :class="{ 'sample-sidebar__btn--active': viewMode === 'compliance' }"
          @click="viewMode = 'compliance'"
        >
          Gram stain SOP
          <span class="sample-sidebar__sub">Compliance + preview</span>
        </button>
      </aside>

      <div class="layout__main">
        <section class="editor-stage editor-stage--enter">
          <div :key="viewMode" class="editor-stage__sheen" aria-hidden="true" />
          <ClientOnly>
            <ExampleEditorPanel
              v-for="tab in documentTabs"
              :key="tab.id"
              v-show="viewMode === tab.id"
              :ref="(el) => setPanelRef(tab.id, el)"
              :initial-document="tab.document"
              :class-name="tab.editorClass ?? 'editor-view'"
              @ai="openAiModal"
              @comment="openCommentModal"
            />

            <AIModal
              :open="aiOpen && viewMode !== 'compliance'"
              :editor="modalTargetEditor"
              :mode="aiMode"
              :presets="aiMode === 'bubble' ? BUBBLE_AI_PRESETS : SLASH_AI_PRESETS"
              title="AI assistant"
              subtitle="Use curated prompts to rewrite the selection or continue the document."
              :on-close="closeAiModal"
              :on-execute="runAIPrompt"
              :on-apply="applyDemoAI"
            />

            <CommentModal
              v-if="modalCommentStore"
              :open="commentOpen && viewMode !== 'compliance'"
              :editor="modalTargetEditor"
              :store="modalCommentStore"
              current-user-id="aurthurm"
              title="Comments"
              subtitle="Leave threads, replies, reactions, or mark notes resolved."
              :on-close="closeCommentModal"
            />

            <div v-show="viewMode === 'compliance'" class="editor-stage__panel editor-stage__panel--compliance">
              <div class="compliance-toolbar">
                <p class="compliance-toolbar__label">Gram stain — controlled SOP</p>
                <button type="button" class="compliance-toolbar__preview" @click="openDocumentPreview">Preview document</button>
              </div>
              <ComplianceDocumentWorkspace
                ref="complianceWorkspaceRef"
                v-model:merged-blocks="complianceMerged"
                :sections="complianceSopSections"
              />
            </div>

            <Teleport to="body">
              <Transition name="modal-dim">
                <div v-if="previewOpen" class="doc-preview-backdrop" @click.self="closeDocumentPreview">
                  <div class="doc-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="doc-preview-title">
                    <header class="doc-preview-dialog__head">
                      <div>
                        <p id="doc-preview-title" class="doc-preview-dialog__title">Gram stain SOP — merged preview</p>
                        <p class="doc-preview-dialog__sub">Read-only — all controlled sections and reference images combined with section headings.</p>
                      </div>
                      <button type="button" class="doc-preview-dialog__close" @click="closeDocumentPreview">Close</button>
                    </header>
                    <div class="doc-preview-dialog__body">
                      <BeakBlockView :editor="previewEditor" class-name="editor-view doc-preview-dialog__editor" />
                    </div>
                  </div>
                </div>
              </Transition>
            </Teleport>
          </ClientOnly>
        </section>

        <section class="inspector inspector--enter">
          <p class="section-label">Document readout</p>
          <h2>Document JSON</h2>
          <p class="inspector__lede">
            <template v-if="viewMode === 'compliance'">Live merge of every controlled section (same payload as Preview document).</template>
            <template v-else>Serialized blocks for the active sample tab.</template>
          </p>
          <Transition name="inspector-snap" mode="out-in">
            <pre :key="viewMode" class="inspector__pre">{{ JSON.stringify(inspectorBlocks, null, 2) }}</pre>
          </Transition>
        </section>
      </div>
    </main>
  </div>
</template>
