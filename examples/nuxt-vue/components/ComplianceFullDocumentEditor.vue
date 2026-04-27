<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  AIModal,
  CommentModal,
  CommentRail,
  BeakBlockView,
  applyAIBlockOutput,
  BubbleMenu,
  createChartBlockSpec,
  buildAIContext,
  MediaMenu,
  SlashMenu,
  TableHandles,
  TableMenu,
  useBeakBlock,
  useCustomSlashMenuItems,
  useDocumentVersions,
  useEditorContent,
} from '@amusendame/beakblock-vue';
import {
  BUBBLE_AI_PRESETS,
  SLASH_AI_PRESETS,
  createCommentPlugin,
  groupContiguousInsertTrackChanges,
  InMemoryCommentStore,
  type TrackedChangeRecord,
} from '@amusendame/beakblock-core';
import type { AIContext, BeakBlockEditor, Block } from '@amusendame/beakblock-core';
import { sendAIRequest } from '../../shared/ai';
import { appendComplianceAiLog } from '~/utils/complianceAiLog';
import { COMPLIANCE_DEMO_USER } from '~/utils/complianceIdentity';
import { loadSectionComments, saveSectionComments } from '~/utils/commentPersistence';
import { createIndexedDbVersioningAdapter } from '~/utils/idbVersioningAdapter';
import { diffBlockTrees, type BlockDiffLine } from '~/utils/blockTreeDiff';
import { sha256HexUtf8 } from '~/utils/documentHash';
import { countUnresolvedCommentThreads } from '~/utils/complianceValidation';
import {
  applyComplianceSectionHeadingLockState,
  findComplianceSectionIdForBlockId,
  findSectionTitleInDoc,
} from '~/utils/complianceFullDocument';

const props = withDefaults(
  defineProps<{
    initialBlocks: Block[];
    aiGovernanceMode?: 'off' | 'governed';
    reviewerOnly?: boolean;
    /** IndexedDB key for version snapshots (scope per document or template edit session). */
    versioningKey?: string;
    /** IndexedDB key for comment persistence. */
    commentStorageKey?: string;
    /** When false, compliance lock plugin is off (template authoring). */
    complianceLockEnabled?: boolean;
    versionCheckpointLabel?: string;
    surfaceTitle?: string;
    surfaceHint?: string;
    /** Show "Add section" for template authoring (locked H2 + paragraph). */
    templateAuthoring?: boolean;
  }>(),
  {
    versioningKey: 'compliance-gram-sop-full-doc',
    commentStorageKey: 'compliance-full-doc',
    complianceLockEnabled: true,
    versionCheckpointLabel: 'Checkpoint · controlled document (full document)',
    surfaceTitle: 'Full SOP document',
    surfaceHint:
      'One editor for the entire procedure. Section titles under locked headings are compliance-controlled; add body content under each heading. New comment threads record the section inferred from your cursor when possible.',
    templateAuthoring: false,
  }
);

const emit = defineEmits<{
  update: [];
}>();

const aiGov = computed(() => props.aiGovernanceMode ?? 'governed');

const commentStore = new InMemoryCommentStore();
const commentOpen = ref(false);
const aiOpen = ref(false);
const aiMode = ref<'bubble' | 'slash'>('bubble');
const aiContextSnapshot = ref<AIContext | null>(null);

const cursorComplianceSectionId = ref<string | undefined>();

const versionAdapter = createIndexedDbVersioningAdapter(props.versioningKey);

const lastCheckpointId = ref<string | null>(null);
const unresolvedCommentCount = ref(0);

const newThreadMetadata = computed(() => ({
  complianceSectionId: cursorComplianceSectionId.value,
  raisedAgainstCheckpointId: lastCheckpointId.value,
}));

/** Innermost doc block (paragraph, heading, etc.) containing the selection start. */
function innermostBlockIdAtSelection(ed: BeakBlockEditor): string | undefined {
  const $from = ed.pm.state.selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d);
    const id = n.attrs?.id;
    if (id != null && String(id) !== '') {
      return String(id);
    }
  }
  return undefined;
}

/**
 * If the caret is at the very start of the reference block, insert before it (e.g. before the next
 * section heading). Otherwise insert after the whole block.
 */
function insertPlacementRelativeToInnermostBlock(ed: BeakBlockEditor, refId: string): 'before' | 'after' {
  const $from = ed.pm.state.selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d);
    if (n.attrs?.id != null && String(n.attrs.id) === refId) {
      const firstContentPos = $from.start(d) + 1;
      return $from.pos <= firstContentPos ? 'before' : 'after';
    }
  }
  return 'after';
}

function syncCursorSection() {
  const ed = editor.value;
  if (!ed || ed.isDestroyed) {
    cursorComplianceSectionId.value = undefined;
    return;
  }
  const blockId = innermostBlockIdAtSelection(ed);
  if (!blockId) {
    cursorComplianceSectionId.value = undefined;
    return;
  }
  cursorComplianceSectionId.value = findComplianceSectionIdForBlockId(ed.getDocument(), blockId);
}

function syncUnresolved() {
  unresolvedCommentCount.value = countUnresolvedCommentThreads(commentStore);
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;
let unsubscribePersist: (() => void) | undefined;

const openCommentModal = () => {
  commentOpen.value = true;
};

const openAiModal = (mode: 'bubble' | 'slash') => {
  if (aiGov.value === 'off') return;
  aiMode.value = mode;
  aiContextSnapshot.value = editor.value ? buildAIContext(editor.value, mode, null, '') : null;
  aiOpen.value = true;
};

const closeAiModal = () => {
  aiOpen.value = false;
};

const closeCommentModal = () => {
  commentOpen.value = false;
};

const applyDemoAI = async (payload: Parameters<typeof applyAIBlockOutput>[1] & { output: string }) => {
  const ed = editor.value;
  if (!ed) return;
  applyAIBlockOutput(ed, payload, payload.output);
};

function appendComplianceSection(level: 1 | 2 | 3 = 2) {
  const ed = editor.value;
  if (!ed || ed.isDestroyed) return;
  const lockId = crypto.randomUUID();
  const doc = ed.getDocument();
  const label =
    level === 1 ? 'New part' : level === 2 ? 'New section' : 'New subsection';
  const lockReason =
    level === 1 ? 'Part heading (template)' : level === 2 ? 'Section heading (template)' : 'Subsection heading (template)';
  const toInsert: Block[] = [
    {
      id: crypto.randomUUID(),
      type: 'heading',
      props: {
        level,
        textAlign: 'left',
        locked: true,
        lockReason,
        lockId,
      },
      content: [{ type: 'text', text: label, styles: {} }],
    },
    {
      id: crypto.randomUUID(),
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: ' ', styles: {} }],
    },
  ];

  const beforeCount = doc.length;
  let refId = innermostBlockIdAtSelection(ed);
  if (!refId) {
    refId = doc[doc.length - 1]?.id;
  }
  if (refId) {
    const placement =
      innermostBlockIdAtSelection(ed) === refId ?
        insertPlacementRelativeToInnermostBlock(ed, refId)
      : 'after';
    ed.insertBlocks(toInsert, refId, placement);
    const afterCount = ed.getDocument().length;
    if (afterCount <= beforeCount) {
      ed.setDocument([...doc, ...toInsert]);
    }
  } else {
    ed.setDocument([...doc, ...toInsert]);
  }
  emit('update');
}

/** Toggle compliance enforcement on a section title (`props.locked`); boundary `lockId` is unchanged. */
function setSectionHeadingLockState(sectionLockId: string, locked: boolean) {
  const ed = editor.value;
  if (!ed || ed.isDestroyed) return;
  const doc = ed.getDocument();
  const next = applyComplianceSectionHeadingLockState(doc, sectionLockId, locked);
  ed.setDocument(next);
  emit('update');
}

const customBlocks = [createChartBlockSpec()];
const editor = useBeakBlock({
  initialContent: props.initialBlocks,
  customBlocks,
  complianceLock: props.complianceLockEnabled ? { allowReorder: false } : false,
  dragDrop: {
    headingLockBadge: 'all-headings',
  },
  versioning: { adapter: versionAdapter },
  prosemirror: {
    plugins: [createCommentPlugin(commentStore)],
  },
});

const runAIPrompt = async (request: Parameters<typeof sendAIRequest>[0]) => {
  const out = await sendAIRequest(request, '/api/ai');
  if (aiGov.value === 'governed' && typeof out === 'string') {
    const sid = cursorComplianceSectionId.value;
    const ed = editor.value;
    const doc = ed && !ed.isDestroyed ? ed.getDocument() : [];
    const title =
      sid ? (findSectionTitleInDoc(doc, sid) ?? 'Section') : 'Full document';
    appendComplianceAiLog({
      at: new Date().toISOString(),
      sectionId: sid ?? 'full-doc',
      sectionTitle: title,
      userId: COMPLIANCE_DEMO_USER.userId,
      displayName: COMPLIANCE_DEMO_USER.displayName,
      presetId: request.preset?.id,
      instruction: request.instruction,
      outputPreview: out.slice(0, 400),
    });
  }
  return out;
};

const { versions, saveVersion, restoreVersion } = useDocumentVersions(editor, versionAdapter);
const trackChangesOn = ref(false);
const restoreSelect = ref('');
const pendingChanges = ref<TrackedChangeRecord[]>([]);

const compareFrom = ref('');
const compareTo = ref('');
const compareLines = ref<BlockDiffLine[]>([]);
const compareBusy = ref(false);

const customSlashItems = useCustomSlashMenuItems(editor, customBlocks);
const content = useEditorContent(editor);

const aiHiddenItems = computed(() => (aiGov.value === 'off' ? ['ai'] : []));

const pendingTrackGroups = computed(() => {
  const ed = editor.value;
  const grouped = groupContiguousInsertTrackChanges(pendingChanges.value);
  return grouped.map((records) => {
    const withSpan = records.filter((r) => r.insertRange && r.insertRange.from < r.insertRange.to);
    let preview = '';
    if (ed && !ed.isDestroyed && withSpan.length) {
      const from = Math.min(...withSpan.map((r) => r.insertRange!.from));
      const to = Math.max(...withSpan.map((r) => r.insertRange!.to));
      try {
        preview = ed.pm.state.doc.textBetween(from, to, '\n', '\ufffc');
      } catch {
        preview = '';
      }
    } else if (records.length === 1 && records[0]!.deletedText) {
      const t = records[0]!.deletedText!;
      preview = t.length > 160 ? `${t.slice(0, 160)}…` : t;
    }
    const kinds = [...new Set(records.map((r) => r.kind))];
    const kindLabel =
      kinds.length === 1 ? kinds[0]!.toUpperCase() : `Sequence (${kinds.join(' + ')})`;
    return {
      key: records.map((r) => r.id).join('|'),
      records,
      kindLabel,
      atLabel: records[0]?.at ?? '',
      preview,
      stepCount: records.length,
    };
  });
});

const trackChangesLiveMessage = computed(() =>
  pendingTrackGroups.value.length ?
    `${pendingTrackGroups.value.length} pending track change group${pendingTrackGroups.value.length === 1 ? '' : 's'}`
  : ''
);

const syncTrackCheckbox = () => {
  trackChangesOn.value = editor.value?.isTrackChangesEnabled ?? false;
};

watch(
  editor,
  (ed, _prev, onCleanup) => {
    syncTrackCheckbox();
    if (!ed || ed.isDestroyed) {
      pendingChanges.value = [];
      return;
    }
    const syncPending = () => {
      pendingChanges.value = ed.getPendingTrackChanges();
    };
    syncPending();
    const offTr = ed.on('transaction', syncPending);
    const syncCursor = () => {
      syncCursorSection();
    };
    const offSel = ed.on('selectionChange', syncCursor);
    const offChange = ed.on('change', syncCursor);
    syncCursorSection();
    onCleanup(() => {
      offTr();
      offSel();
      offChange();
    });
  },
  { immediate: true }
);

watch(
  [editor, () => props.reviewerOnly],
  ([ed, ro]) => {
    if (ed && !ed.isDestroyed) ed.setEditable(!ro);
  },
  { immediate: true }
);

const toggleTrackChanges = () => {
  const ed = editor.value;
  if (!ed || props.reviewerOnly) return;
  if (trackChangesOn.value) {
    ed.enableTrackChanges({ authorId: COMPLIANCE_DEMO_USER.userId });
  } else {
    ed.disableTrackChanges();
  }
};

const onSaveVersion = async () => {
  const ed = editor.value;
  if (!ed) return;
  const blocks = ed.getDocument();
  const checksum = await sha256HexUtf8(JSON.stringify(blocks));
  const v = await saveVersion({
    label: props.versionCheckpointLabel,
    meta: {
      userId: COMPLIANCE_DEMO_USER.userId,
      displayName: COMPLIANCE_DEMO_USER.displayName,
      sectionId: props.versioningKey,
      contentChecksum: checksum,
    },
  });
  lastCheckpointId.value = v.id;
};

const onRestoreSelect = async () => {
  const id = restoreSelect.value;
  if (!id) return;
  await restoreVersion(id);
  restoreSelect.value = '';
  emit('update');
};

const onCompareVersions = async () => {
  const ed = editor.value;
  const a = compareFrom.value;
  const b = compareTo.value;
  if (!ed || ed.isDestroyed || !a || !b || a === b) {
    compareLines.value = [];
    return;
  }
  compareBusy.value = true;
  compareLines.value = [];
  try {
    const va = await ed.getVersion(a);
    const vb = await ed.getVersion(b);
    if (!va || !vb) return;
    compareLines.value = diffBlockTrees(va.blocks, vb.blocks, a.slice(0, 8), b.slice(0, 8));
  } finally {
    compareBusy.value = false;
  }
};

const onAcceptTrackGroup = (records: TrackedChangeRecord[]) => {
  const ed = editor.value;
  if (!ed) return;
  for (const r of records) {
    ed.acceptTrackedChange(r.id);
  }
};

const onRejectTrackGroup = (records: TrackedChangeRecord[]) => {
  const ed = editor.value;
  if (!ed) return;
  const ids = new Set(records.map((r) => r.id));
  const pendingWithInsert = () =>
    ed
      .getPendingTrackChanges()
      .filter((c) => ids.has(c.id) && c.insertRange && c.insertRange.from < c.insertRange.to);
  while (pendingWithInsert().length) {
    const rem = pendingWithInsert();
    const right = rem.reduce((a, b) => (a.insertRange!.from > b.insertRange!.from ? a : b));
    ed.rejectTrackedChange(right.id);
  }
  for (const id of ids) {
    if (ed.getPendingTrackChanges().some((e) => e.id === id)) {
      ed.rejectTrackedChange(id);
    }
  }
};

watch(
  content,
  () => {
    emit('update');
  },
  { deep: true }
);

onMounted(async () => {
  const snap = await loadSectionComments(props.commentStorageKey);
  if (snap.length) commentStore.hydrate(snap);
  syncUnresolved();
  unsubscribePersist = commentStore.subscribe(() => {
    syncUnresolved();
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      void saveSectionComments(props.commentStorageKey, commentStore.snapshot());
    }, 450);
  });
});

onBeforeUnmount(() => {
  clearTimeout(persistTimer);
  unsubscribePersist?.();
});

function getCommentSnapshot() {
  return commentStore.snapshot();
}

function countUnresolvedInSection(sectionId: string) {
  return commentStore
    .snapshot()
    .filter((t) => !t.resolved && String(t.metadata?.complianceSectionId ?? '') === sectionId).length;
}

defineExpose({
  editor,
  getUnresolvedCount: () => unresolvedCommentCount.value,
  getCommentSnapshot,
  getPendingTrackGroupCount: () => pendingTrackGroups.value.length,
  countUnresolvedInSection,
  appendComplianceSection,
  setSectionHeadingLockState,
});
</script>

<template>
  <article class="compliance-section compliance-full-doc">
    <div class="visually-hidden" aria-live="polite">{{ trackChangesLiveMessage }}</div>
    <header class="compliance-section__head">
      <div class="compliance-section__labels">
        <span class="compliance-section__title">{{ surfaceTitle }}</span>
        <span class="compliance-section__badge">{{
          complianceLockEnabled ? 'Controlled · section headings locked' : 'Template · headings editable'
        }}</span>
        <span v-if="reviewerOnly" class="compliance-section__badge compliance-section__badge--reviewer">Reviewer view</span>
        <span v-if="unresolvedCommentCount > 0" class="compliance-section__badge compliance-section__badge--comments">
          {{ unresolvedCommentCount }} open comments
        </span>
      </div>
      <p class="compliance-section__hint">{{ surfaceHint }}</p>

      <div class="compliance-section__version-bar" role="group" aria-label="Versioning and track changes">
        <template v-if="templateAuthoring">
          <button
            type="button"
            class="compliance-section__version-btn compliance-section__version-btn--primary"
            title="Insert after the block that contains the text cursor (place the cursor between sections or in a paragraph, then click)"
            @click="appendComplianceSection(1)"
          >
            Add H1 part
          </button>
          <button
            type="button"
            class="compliance-section__version-btn compliance-section__version-btn--primary"
            title="Insert after the block that contains the text cursor (place the cursor between sections or in a paragraph, then click)"
            @click="appendComplianceSection(2)"
          >
            Add H2 section
          </button>
          <button
            type="button"
            class="compliance-section__version-btn compliance-section__version-btn--primary"
            title="Insert after the block that contains the text cursor (place the cursor between sections or in a paragraph, then click)"
            @click="appendComplianceSection(3)"
          >
            Add H3 subsection
          </button>
        </template>
        <label class="compliance-section__version-check">
          <input type="checkbox" v-model="trackChangesOn" :disabled="reviewerOnly" @change="toggleTrackChanges" />
          Track changes
        </label>
        <button type="button" class="compliance-section__version-btn" :disabled="reviewerOnly" @click="onSaveVersion">
          Save version
        </button>
        <select
          v-model="restoreSelect"
          class="compliance-section__version-select"
          aria-label="Restore saved version"
          :disabled="reviewerOnly"
          @change="onRestoreSelect"
        >
          <option value="">Restore snapshot…</option>
          <option v-for="v in versions" :key="v.id" :value="v.id">
            {{ v.label || v.createdAt }}
          </option>
        </select>
      </div>

      <details class="compliance-section__diff">
        <summary>Compare two saved versions (full document)</summary>
        <div class="compliance-section__diff-row">
          <label class="compliance-section__diff-label">From</label>
          <select v-model="compareFrom" class="compliance-section__version-select" aria-label="Diff version A">
            <option value="">Select…</option>
            <option v-for="v in versions" :key="`a-${v.id}`" :value="v.id">{{ v.label || v.createdAt }}</option>
          </select>
          <label class="compliance-section__diff-label">To</label>
          <select v-model="compareTo" class="compliance-section__version-select" aria-label="Diff version B">
            <option value="">Select…</option>
            <option v-for="v in versions" :key="`b-${v.id}`" :value="v.id">{{ v.label || v.createdAt }}</option>
          </select>
          <button
            type="button"
            class="compliance-section__version-btn"
            :disabled="reviewerOnly || compareBusy || !compareFrom || !compareTo || compareFrom === compareTo"
            @click="onCompareVersions"
          >
            {{ compareBusy ? 'Comparing…' : 'Run diff' }}
          </button>
        </div>
        <pre v-if="compareLines.length" class="compliance-section__diff-out">{{ compareLines.map((l) => `[${l.kind}] ${l.path}: ${l.summary}`).join('\n') }}</pre>
        <p v-else-if="!compareBusy && compareFrom && compareTo && compareFrom !== compareTo" class="compliance-section__diff-empty">
          No structural differences by block id.
        </p>
      </details>

      <div
        v-if="pendingTrackGroups.length > 0"
        class="compliance-section__pending-tracks"
        role="region"
        :aria-label="`Pending track changes, ${pendingTrackGroups.length} groups`"
      >
        <p class="compliance-section__pending-title">
          Pending changes — {{ pendingTrackGroups.length }} group(s), {{ pendingChanges.length }} step(s)
        </p>
        <ul class="compliance-section__pending-list">
          <li v-for="g in pendingTrackGroups" :key="g.key" class="compliance-section__pending-item">
            <div class="compliance-section__pending-row">
              <span class="compliance-section__pending-kind">{{ g.kindLabel }}</span>
              <span class="compliance-section__pending-meta">{{ g.atLabel }}</span>
              <span v-if="g.stepCount > 1" class="compliance-section__pending-hunks">{{ g.stepCount }} steps</span>
              <button type="button" class="compliance-section__pending-btn" :disabled="reviewerOnly" @click="onAcceptTrackGroup(g.records)">
                Accept
              </button>
              <button
                type="button"
                class="compliance-section__pending-btn compliance-section__pending-btn--reject"
                :disabled="reviewerOnly"
                @click="onRejectTrackGroup(g.records)"
              >
                Reject
              </button>
            </div>
            <p v-if="g.preview" class="compliance-section__pending-preview">
              <span class="compliance-section__pending-preview-label">Inserted text</span>
              {{ g.preview }}
            </p>
          </li>
        </ul>
      </div>
    </header>

    <div class="compliance-section__editor-wrap">
      <CommentRail :editor="editor" :store="commentStore" :current-user-id="COMPLIANCE_DEMO_USER.userId">
        <BeakBlockView :editor="editor" class-name="editor-view compliance-section__editor compliance-full-doc__editor" />
      </CommentRail>
      <SlashMenu :editor="editor" :custom-items="customSlashItems" :hide-items="aiHiddenItems" @ai="() => openAiModal('slash')" />
      <BubbleMenu :editor="editor" :hide-items="aiHiddenItems" @comment="openCommentModal" @ai="() => openAiModal('bubble')" />
      <TableMenu :editor="editor" />
      <TableHandles :editor="editor" />
      <MediaMenu :editor="editor" />

      <AIModal
        v-if="aiGov !== 'off'"
        :open="aiOpen"
        :editor="editor"
        :mode="aiMode"
        :presets="aiMode === 'bubble' ? BUBBLE_AI_PRESETS : SLASH_AI_PRESETS"
        :custom-blocks="customBlocks"
        :context-snapshot="aiContextSnapshot"
        title="AI assistant"
        subtitle="Rewrite the selection or continue the section under your cursor."
        :require-apply-acknowledgment="aiGov === 'governed'"
        :on-close="closeAiModal"
        :on-execute="runAIPrompt"
        :on-apply="applyDemoAI"
      />

      <CommentModal
        :open="commentOpen"
        :editor="editor"
        :store="commentStore"
        :current-user-id="COMPLIANCE_DEMO_USER.userId"
        :new-thread-metadata="newThreadMetadata"
        title="Comments"
        subtitle="Threads for the full document. New threads tag the compliance section from your cursor when possible."
        :on-close="closeCommentModal"
      />
    </div>
  </article>
</template>
