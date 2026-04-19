<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import type { Block } from '@amusendame/beakblock-core';
import ComplianceFullDocumentEditor from './ComplianceFullDocumentEditor.vue';
import {
  deleteTemplate,
  emptyComplianceTemplateBlocks,
  getTemplate,
  listTemplates,
  putTemplate,
  seedGramStainTemplateIfEmpty,
  validateTemplateDocument,
  type ComplianceTemplateRecord,
} from '~/utils/complianceTemplates';
import { sliceComplianceDocumentByLockedHeadings } from '~/utils/complianceFullDocument';

const emit = defineEmits<{
  /** Emitted after templates may have changed (save/delete). */
  templatesUpdated: [];
}>();

const loading = ref(true);
const templates = ref<ComplianceTemplateRecord[]>([]);
const editId = ref<string | null>(null);
const editName = ref('');
const editRequiredMap = ref<Record<string, boolean>>({});
const editInitialBlocks = ref<Block[]>([]);
const saveError = ref('');
const editorRef = ref<InstanceType<typeof ComplianceFullDocumentEditor> | null>(null);

async function refreshList() {
  templates.value = await listTemplates();
}

function syncRequiredMapFromDoc(blocks: Block[]) {
  const slices = sliceComplianceDocumentByLockedHeadings(blocks);
  const next = { ...editRequiredMap.value };
  for (const s of slices) {
    if (!(s.sectionId in next)) next[s.sectionId] = true;
  }
  for (const k of Object.keys(next)) {
    if (!slices.some((s) => s.sectionId === k)) delete next[k];
  }
  editRequiredMap.value = next;
}

function onEditorUpdate() {
  const ed = editorRef.value?.editor;
  const doc = ed && !ed.isDestroyed ? ed.getDocument() : editInitialBlocks.value;
  syncRequiredMapFromDoc(doc);
}

onMounted(async () => {
  await seedGramStainTemplateIfEmpty();
  await refreshList();
  loading.value = false;
});

function startNew() {
  saveError.value = '';
  const id = crypto.randomUUID();
  editId.value = id;
  editName.value = 'New template';
  const blocks = emptyComplianceTemplateBlocks('Untitled procedure (template)');
  editInitialBlocks.value = blocks;
  editRequiredMap.value = {};
  syncRequiredMapFromDoc(blocks);
}

async function startEdit(id: string) {
  saveError.value = '';
  const t = await getTemplate(id);
  if (!t) return;
  editId.value = t.id;
  editName.value = t.name;
  editInitialBlocks.value = structuredClone(t.blocks);
  editRequiredMap.value = { ...t.sectionRequiredByLockId };
  syncRequiredMapFromDoc(editInitialBlocks.value);
  await nextTick();
}

function cancelEdit() {
  editId.value = null;
  saveError.value = '';
}

async function saveEdit() {
  const ed = editorRef.value?.editor;
  const blocks = ed && !ed.isDestroyed ? ed.getDocument() : editInitialBlocks.value;
  const v = validateTemplateDocument(blocks);
  if (!v.ok) {
    saveError.value = v.issues[0] ?? 'Invalid template structure.';
    return;
  }
  saveError.value = '';
  syncRequiredMapFromDoc(blocks);
  const sectionRequiredByLockId = { ...editRequiredMap.value };
  await putTemplate({
    id: editId.value!,
    name: editName.value.trim() || 'Untitled template',
    updatedAt: new Date().toISOString(),
    blocks: structuredClone(blocks),
    sectionRequiredByLockId,
  });
  await refreshList();
  emit('templatesUpdated');
  cancelEdit();
}

async function removeTemplate(id: string) {
  if (!confirm('Delete this template? Compliance documents using it are unaffected.')) return;
  await deleteTemplate(id);
  await refreshList();
  emit('templatesUpdated');
}

const sectionSidebarRows = ref<{ sectionId: string; title: string }[]>([]);

function refreshSidebarTitles() {
  const ed = editorRef.value?.editor;
  const doc = ed && !ed.isDestroyed ? ed.getDocument() : editInitialBlocks.value;
  sectionSidebarRows.value = sliceComplianceDocumentByLockedHeadings(doc).map((s) => ({
    sectionId: s.sectionId,
    title: `${'\u2003'.repeat(s.level - 1)}H${s.level} · ${s.title || '(untitled section)'}`,
  }));
}

function onEditorUpdateWithSidebar() {
  onEditorUpdate();
  refreshSidebarTitles();
}

watch(editId, async (id) => {
  if (!id) {
    sectionSidebarRows.value = [];
    return;
  }
  await nextTick();
  refreshSidebarTitles();
});
</script>

<template>
  <div class="compliance-template-studio">
    <template v-if="loading">
      <p class="compliance-template-studio__loading">Loading templates…</p>
    </template>
    <template v-else-if="!editId">
      <div class="compliance-template-studio__list-head">
        <h2 class="compliance-template-studio__title">Compliance templates</h2>
        <p class="compliance-template-studio__lede">
          Templates are full documents: an optional title line (H1 without lock id), then a hierarchy of
          <strong>H1–H3</strong> headings with lock ids (subsections nest under deeper levels). Save a template, then start a new controlled document from it.
        </p>
        <button type="button" class="compliance-template-studio__btn compliance-template-studio__btn--primary" @click="startNew">
          New template
        </button>
      </div>
      <ul v-if="templates.length" class="compliance-template-studio__list">
        <li v-for="t in templates" :key="t.id" class="compliance-template-studio__row">
          <span class="compliance-template-studio__name">{{ t.name }}</span>
          <span class="compliance-template-studio__meta">Updated {{ t.updatedAt.slice(0, 10) }}</span>
          <button type="button" class="compliance-template-studio__btn" @click="startEdit(t.id)">Edit</button>
          <button type="button" class="compliance-template-studio__btn compliance-template-studio__btn--danger" @click="removeTemplate(t.id)">
            Delete
          </button>
        </li>
      </ul>
      <p v-else class="compliance-template-studio__empty">No templates yet.</p>
    </template>
    <template v-else>
      <div class="compliance-template-studio__editor-shell">
        <header class="compliance-template-studio__toolbar">
          <label class="compliance-template-studio__name-field">
            Template name
            <input v-model="editName" type="text" class="compliance-template-studio__input" />
          </label>
          <div class="compliance-template-studio__toolbar-actions">
            <button type="button" class="compliance-template-studio__btn" @click="cancelEdit">Back</button>
            <button
              type="button"
              class="compliance-template-studio__btn compliance-template-studio__btn--primary"
              @click="saveEdit"
            >
              Save template
            </button>
          </div>
        </header>
        <p v-if="saveError" class="compliance-template-studio__error" role="alert">{{ saveError }}</p>
        <div class="compliance-template-studio__split">
          <aside class="compliance-template-studio__aside" aria-label="Section requirements">
            <p class="compliance-template-studio__aside-title">Sections</p>
            <p class="compliance-template-studio__aside-hint">Toggle whether each section is required for validation in authored documents.</p>
            <ul class="compliance-template-studio__aside-list">
              <li v-for="row in sectionSidebarRows" :key="row.sectionId" class="compliance-template-studio__aside-item">
                <label class="compliance-template-studio__check">
                  <input v-model="editRequiredMap[row.sectionId]" type="checkbox" />
                  <span>{{ row.title }}</span>
                </label>
              </li>
            </ul>
          </aside>
          <div class="compliance-template-studio__editor-panel">
            <ComplianceFullDocumentEditor
              :key="editId"
              ref="editorRef"
              :initial-blocks="editInitialBlocks"
              :versioning-key="`${editId}::template-edit`"
              :comment-storage-key="`${editId}::template-comments`"
              :compliance-lock-enabled="false"
              :template-authoring="true"
              version-checkpoint-label="Checkpoint · template draft"
              surface-title="Template draft"
              surface-hint="Section boundaries are locked level-2 headings with ids. Edit titles and body freely. Use Add section for another locked heading. Save when the outline matches what controlled documents should follow."
              ai-governance-mode="governed"
              @update="onEditorUpdateWithSidebar"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.compliance-template-studio {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.compliance-template-studio__loading,
.compliance-template-studio__empty {
  color: #64748b;
  font-size: 0.95rem;
}
.compliance-template-studio__list-head {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.compliance-template-studio__title {
  margin: 0;
  font-size: 1.15rem;
}
.compliance-template-studio__lede {
  margin: 0;
  font-size: 0.88rem;
  color: #475569;
  max-width: 52rem;
}
.compliance-template-studio__list {
  list-style: none;
  padding: 0;
  margin: 0.75rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.compliance-template-studio__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fafafa;
}
.compliance-template-studio__name {
  font-weight: 600;
  flex: 1 1 8rem;
}
.compliance-template-studio__meta {
  font-size: 0.82rem;
  color: #64748b;
}
.compliance-template-studio__btn {
  font-size: 0.85rem;
  padding: 0.35rem 0.65rem;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #fff;
  cursor: pointer;
}
.compliance-template-studio__btn--primary {
  background: #1e293b;
  color: #fff;
  border-color: #1e293b;
}
.compliance-template-studio__btn--danger {
  border-color: #fecaca;
  color: #b91c1c;
}
.compliance-template-studio__editor-shell {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.compliance-template-studio__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem 1rem;
}
.compliance-template-studio__name-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.82rem;
  color: #475569;
  flex: 1 1 12rem;
}
.compliance-template-studio__input {
  padding: 0.4rem 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.95rem;
}
.compliance-template-studio__toolbar-actions {
  display: flex;
  gap: 0.5rem;
}
.compliance-template-studio__error {
  margin: 0;
  color: #b91c1c;
  font-size: 0.88rem;
}
.compliance-template-studio__split {
  display: grid;
  grid-template-columns: minmax(200px, 260px) 1fr;
  gap: 1rem;
  align-items: start;
}
@media (max-width: 900px) {
  .compliance-template-studio__split {
    grid-template-columns: 1fr;
  }
}
.compliance-template-studio__aside {
  position: sticky;
  top: 0.5rem;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  font-size: 0.85rem;
}
.compliance-template-studio__aside-title {
  margin: 0 0 0.35rem;
  font-weight: 600;
}
.compliance-template-studio__aside-hint {
  margin: 0 0 0.65rem;
  color: #64748b;
  font-size: 0.8rem;
}
.compliance-template-studio__aside-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.compliance-template-studio__check {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  cursor: pointer;
}
.compliance-template-studio__editor-panel {
  min-width: 0;
}
</style>
