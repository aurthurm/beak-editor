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
} from '@aurthurm/beakblock-vue';
import {
  BUBBLE_AI_PRESETS,
  SLASH_AI_PRESETS,
  createCommentPlugin,
  groupContiguousInsertTrackChanges,
  InMemoryCommentStore,
  type TrackedChangeRecord,
} from '@aurthurm/beakblock-core';
import type { AIContext, Block } from '@aurthurm/beakblock-core';
import { sendAIRequest } from '../../shared/ai';
import { appendComplianceAiLog } from '~/utils/complianceAiLog';
import { COMPLIANCE_DEMO_USER } from '~/utils/complianceIdentity';
import { loadSectionComments, saveSectionComments } from '~/utils/commentPersistence';
import { createIndexedDbVersioningAdapter } from '~/utils/idbVersioningAdapter';
import { diffBlockTrees, type BlockDiffLine } from '~/utils/blockTreeDiff';
import { sha256HexUtf8 } from '~/utils/documentHash';
import {
  countUnresolvedCommentThreads,
  validateComplianceSectionBlocks,
} from '~/utils/complianceValidation';
import { DEFAULT_COMPLIANCE_IMAGE_HOST_ALLOWLIST } from '~/utils/complianceMediaPolicy';
import type { SectionApprovalPayload, SectionApprovalRecord } from '~/utils/complianceApproval';

const props = defineProps<{
  sectionId: string;
  sectionTitle: string;
  required: boolean;
  initialBlocks: Block[];
  aiGovernanceMode?: 'off' | 'governed';
  reviewerOnly?: boolean;
  approval: SectionApprovalRecord;
}>();

const emit = defineEmits<{
  update: [];
  'update:approval': [SectionApprovalPayload];
}>();

const aiGov = computed(() => props.aiGovernanceMode ?? 'governed');

/** Authors cannot edit body after section is signed off until a reviewer revokes. */
const isContentLockedByApproval = computed(
  () => props.approval.state === 'approved' && !props.reviewerOnly
);

const commentStore = new InMemoryCommentStore();
const commentOpen = ref(false);
const aiOpen = ref(false);
const aiMode = ref<'bubble' | 'slash'>('bubble');
const aiContextSnapshot = ref<AIContext | null>(null);

const versionAdapter = createIndexedDbVersioningAdapter(props.sectionId);

const lastCheckpointId = ref<string | null>(null);
const unresolvedCommentCount = ref(0);

const newThreadMetadata = computed(() => ({
  complianceSectionId: props.sectionId,
  raisedAgainstCheckpointId: lastCheckpointId.value,
}));

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

const runAIPrompt = async (request: Parameters<typeof sendAIRequest>[0]) => {
  const out = await sendAIRequest(request, '/api/ai');
  if (aiGov.value === 'governed' && typeof out === 'string') {
    appendComplianceAiLog({
      at: new Date().toISOString(),
      sectionId: props.sectionId,
      sectionTitle: props.sectionTitle,
      userId: COMPLIANCE_DEMO_USER.userId,
      displayName: COMPLIANCE_DEMO_USER.displayName,
      presetId: request.preset?.id,
      instruction: request.instruction,
      outputPreview: out.slice(0, 400),
    });
  }
  return out;
};

const applyDemoAI = async (payload: Parameters<typeof applyAIBlockOutput>[1] & { output: string }) => {
  const ed = editor.value;
  if (!ed) return;
  applyAIBlockOutput(ed, payload, payload.output);
};

const customBlocks = [createChartBlockSpec()];
const editor = useBeakBlock({
  initialContent: props.initialBlocks,
  customBlocks,
  versioning: { adapter: versionAdapter },
  prosemirror: {
    plugins: [createCommentPlugin(commentStore)],
  },
});

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

const complianceValidationOptions = {
  imageHostAllowlist: DEFAULT_COMPLIANCE_IMAGE_HOST_ALLOWLIST,
};

const approvalNoteDraft = ref('');

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

const sectionReadyForReview = computed(() => {
  const ed = editor.value;
  if (!ed || ed.isDestroyed) return false;
  const { ok } = validateComplianceSectionBlocks(props.required, ed.getDocument(), complianceValidationOptions);
  return ok && unresolvedCommentCount.value === 0 && pendingTrackGroups.value.length === 0;
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
    const off = ed.on('transaction', syncPending);
    onCleanup(() => off());
  },
  { immediate: true }
);

watch(
  [editor, () => props.reviewerOnly, isContentLockedByApproval],
  ([ed, ro, locked]) => {
    if (ed && !ed.isDestroyed) ed.setEditable(!ro && !locked);
  },
  { immediate: true }
);

const toggleTrackChanges = () => {
  const ed = editor.value;
  if (!ed || props.reviewerOnly || isContentLockedByApproval.value) return;
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
    label: `Checkpoint · ${props.sectionTitle.slice(0, 48)}`,
    meta: {
      userId: COMPLIANCE_DEMO_USER.userId,
      displayName: COMPLIANCE_DEMO_USER.displayName,
      sectionId: props.sectionId,
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

/** Reject insert/replace hunks right-to-left so positions stay valid; then any remaining (e.g. pure delete). */
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
  const snap = await loadSectionComments(props.sectionId);
  if (snap.length) commentStore.hydrate(snap);
  syncUnresolved();
  unsubscribePersist = commentStore.subscribe(() => {
    syncUnresolved();
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      void saveSectionComments(props.sectionId, commentStore.snapshot());
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

function submitForReview() {
  if (!sectionReadyForReview.value || props.approval.state !== 'draft') return;
  emit('update:approval', {
    record: {
      ...props.approval,
      state: 'in_review',
      submittedForReviewAt: new Date().toISOString(),
    },
    event: 'submit_for_review',
    actor: { userId: COMPLIANCE_DEMO_USER.userId, displayName: COMPLIANCE_DEMO_USER.displayName },
  });
}

function withdrawFromReview() {
  if (props.approval.state !== 'in_review') return;
  emit('update:approval', {
    record: { sectionKey: props.sectionId, state: 'draft' },
    event: 'withdraw',
    actor: { userId: COMPLIANCE_DEMO_USER.userId, displayName: COMPLIANCE_DEMO_USER.displayName },
  });
  approvalNoteDraft.value = '';
}

function approveSection() {
  if (!props.reviewerOnly || props.approval.state !== 'in_review') return;
  const note = approvalNoteDraft.value.trim() || undefined;
  emit('update:approval', {
    record: {
      ...props.approval,
      state: 'approved',
      approvedAt: new Date().toISOString(),
      approvedByUserId: COMPLIANCE_DEMO_USER.userId,
      approvedByDisplayName: COMPLIANCE_DEMO_USER.displayName,
      approvalNote: note,
    },
    event: 'approve',
    actor: { userId: COMPLIANCE_DEMO_USER.userId, displayName: COMPLIANCE_DEMO_USER.displayName },
    note,
  });
  approvalNoteDraft.value = '';
}

function sendBackToDraft() {
  if (!props.reviewerOnly || props.approval.state !== 'in_review') return;
  emit('update:approval', {
    record: { sectionKey: props.sectionId, state: 'draft' },
    event: 'send_back',
    actor: { userId: COMPLIANCE_DEMO_USER.userId, displayName: COMPLIANCE_DEMO_USER.displayName },
  });
  approvalNoteDraft.value = '';
}

function revokeApproval() {
  if (!props.reviewerOnly || props.approval.state !== 'approved') return;
  emit('update:approval', {
    record: { sectionKey: props.sectionId, state: 'draft' },
    event: 'revoke',
    actor: { userId: COMPLIANCE_DEMO_USER.userId, displayName: COMPLIANCE_DEMO_USER.displayName },
  });
}

defineExpose({
  editor,
  getUnresolvedCount: () => unresolvedCommentCount.value,
  getCommentSnapshot,
  getPendingTrackGroupCount: () => pendingTrackGroups.value.length,
});
</script>

<template>
  <article class="compliance-section" :data-section-id="sectionId">
    <div class="visually-hidden" aria-live="polite">{{ trackChangesLiveMessage }}</div>
    <header class="compliance-section__head">
      <div class="compliance-section__labels">
        <span class="compliance-section__title">{{ sectionTitle }}</span>
        <span v-if="required" class="compliance-section__badge">Controlled · required</span>
        <span v-else class="compliance-section__badge compliance-section__badge--optional">Controlled · optional</span>
        <span v-if="reviewerOnly" class="compliance-section__badge compliance-section__badge--reviewer">Reviewer view</span>
        <span v-if="unresolvedCommentCount > 0" class="compliance-section__badge compliance-section__badge--comments">
          {{ unresolvedCommentCount }} open comments
        </span>
        <span
          v-if="approval.state === 'in_review'"
          class="compliance-section__badge compliance-section__badge--approval-pending"
          >In review</span
        >
        <span
          v-else-if="approval.state === 'approved'"
          class="compliance-section__badge compliance-section__badge--approval-done"
          >Signed off</span
        >
      </div>
      <p class="compliance-section__hint">Content for this heading is authored only in this field.</p>
      <p v-if="isContentLockedByApproval" class="compliance-section__locked-notice" role="status">
        This section is <strong>signed off</strong>. The editor is read-only until a reviewer revokes approval.
      </p>
      <div class="compliance-section__version-bar" role="group" aria-label="Versioning and track changes">
        <label class="compliance-section__version-check">
          <input
            type="checkbox"
            v-model="trackChangesOn"
            :disabled="reviewerOnly || isContentLockedByApproval"
            @change="toggleTrackChanges"
          />
          Track changes
        </label>
        <button
          type="button"
          class="compliance-section__version-btn"
          :disabled="reviewerOnly || isContentLockedByApproval"
          @click="onSaveVersion"
        >
          Save version
        </button>
        <select
          v-model="restoreSelect"
          class="compliance-section__version-select"
          aria-label="Restore saved version"
          :disabled="reviewerOnly || isContentLockedByApproval"
          @change="onRestoreSelect"
        >
          <option value="">Restore snapshot…</option>
          <option v-for="v in versions" :key="v.id" :value="v.id">
            {{ v.label || v.createdAt }}
          </option>
        </select>
      </div>

      <div class="compliance-section__approval" role="region" aria-label="Section approval and sign-off">
        <p class="compliance-section__approval-title">Approval</p>
        <p class="compliance-section__approval-state">
          <strong>{{ approval.state === 'draft' ? 'Draft' : approval.state === 'in_review' ? 'In review' : 'Approved' }}</strong>
          <span v-if="approval.submittedForReviewAt" class="compliance-section__approval-meta">
            · Submitted {{ approval.submittedForReviewAt }}
          </span>
          <span v-if="approval.approvedAt" class="compliance-section__approval-meta">
            · Signed {{ approval.approvedAt }} by {{ approval.approvedByDisplayName || approval.approvedByUserId || '—' }}
          </span>
        </p>
        <p v-if="approval.approvalNote" class="compliance-section__approval-note">Reviewer note: {{ approval.approvalNote }}</p>
        <div class="compliance-section__approval-actions">
          <button
            v-if="!reviewerOnly && approval.state === 'draft'"
            type="button"
            class="compliance-section__approval-btn compliance-section__approval-btn--primary"
            :disabled="!sectionReadyForReview"
            @click="submitForReview"
          >
            Submit for review
          </button>
          <button
            v-if="!reviewerOnly && approval.state === 'in_review'"
            type="button"
            class="compliance-section__approval-btn"
            @click="withdrawFromReview"
          >
            Withdraw from review
          </button>
          <template v-if="reviewerOnly && approval.state === 'in_review'">
            <label class="compliance-section__approval-label">
              Sign-off note (optional)
              <textarea
                v-model="approvalNoteDraft"
                class="compliance-section__approval-textarea"
                rows="2"
                placeholder="e.g. Approved for controlled use after QA review."
              />
            </label>
            <div class="compliance-section__approval-row">
              <button type="button" class="compliance-section__approval-btn compliance-section__approval-btn--primary" @click="approveSection">
                Approve section
              </button>
              <button type="button" class="compliance-section__approval-btn compliance-section__approval-btn--warn" @click="sendBackToDraft">
                Send back to author
              </button>
            </div>
          </template>
          <button
            v-if="reviewerOnly && approval.state === 'approved'"
            type="button"
            class="compliance-section__approval-btn compliance-section__approval-btn--warn"
            @click="revokeApproval"
          >
            Revoke approval
          </button>
        </div>
        <p v-if="!reviewerOnly && approval.state === 'draft' && !sectionReadyForReview" class="compliance-section__approval-hint">
          Complete validation, resolve comments, and clear pending track changes before submitting.
        </p>
        <details
          v-if="(approval.history?.length ?? 0) > 0"
          class="compliance-section__approval-history"
        >
          <summary>Approval log ({{ approval.history?.length ?? 0 }} events)</summary>
          <ol class="compliance-section__approval-history-list">
            <li v-for="(h, idx) in approval.history" :key="`${h.at}-${idx}`" class="compliance-section__approval-history-item">
              <span class="compliance-section__approval-history-kind">{{ h.kind.replace(/_/g, ' ') }}</span>
              <span class="compliance-section__approval-history-meta"
                >{{ h.at }} · {{ h.displayName }} → {{ h.state }}</span
              >
              <span v-if="h.note" class="compliance-section__approval-history-note">{{ h.note }}</span>
            </li>
          </ol>
        </details>
      </div>

      <details class="compliance-section__diff">
        <summary>Compare two saved versions (this section)</summary>
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
        <p v-else-if="!compareBusy && compareFrom && compareTo && compareFrom !== compareTo" class="compliance-section__diff-empty">No structural differences by block id.</p>
      </details>
      <div
        v-if="pendingTrackGroups.length > 0"
        class="compliance-section__pending-tracks"
        role="region"
        :aria-label="`Pending track changes, ${pendingTrackGroups.length} groups from ${pendingChanges.length} steps`"
      >
        <p class="compliance-section__pending-title">
          Pending changes — {{ pendingTrackGroups.length }} group(s), {{ pendingChanges.length }} step(s)
          <span v-if="pendingChanges.length > pendingTrackGroups.length" class="compliance-section__pending-title-note">
            · sequential runs combined
          </span>
        </p>
        <p v-if="pendingChanges.length > pendingTrackGroups.length" class="compliance-section__pending-hint">
          Rows below group touching insert/replace highlights so you can accept or reject a full typed sequence at once.
        </p>
        <ul class="compliance-section__pending-list">
          <li v-for="g in pendingTrackGroups" :key="g.key" class="compliance-section__pending-item">
            <div class="compliance-section__pending-row">
              <span class="compliance-section__pending-kind">{{ g.kindLabel }}</span>
              <span class="compliance-section__pending-meta">{{ g.atLabel }}</span>
              <span v-if="g.stepCount > 1" class="compliance-section__pending-hunks">{{ g.stepCount }} steps</span>
            <button
              type="button"
              class="compliance-section__pending-btn"
              :disabled="reviewerOnly || isContentLockedByApproval"
              @click="onAcceptTrackGroup(g.records)"
            >
                Accept
              </button>
            <button
              type="button"
              class="compliance-section__pending-btn compliance-section__pending-btn--reject"
              :disabled="reviewerOnly || isContentLockedByApproval"
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
        <BeakBlockView :editor="editor" class-name="editor-view compliance-section__editor" />
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
        subtitle="Use curated prompts to rewrite the selection or continue this section."
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
        subtitle="Threads and replies for this section only. New threads record the last checkpoint id when present."
        :on-close="closeCommentModal"
      />
    </div>
  </article>
</template>
