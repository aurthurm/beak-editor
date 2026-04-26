<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import type { Block, CommentThread } from '@amusendame/beakblock-core';
import {
  buildMergeManifestFromFullDoc,
  isComplianceSectionHeadingLocked,
  sliceComplianceDocumentByLockedHeadings,
} from '~/utils/complianceFullDocument';
import type { ComplianceMergeManifest } from '~/utils/complianceMerge';
import {
  validateComplianceSectionBlocks,
  type SectionValidationResult,
} from '~/utils/complianceValidation';
import { DEFAULT_COMPLIANCE_IMAGE_HOST_ALLOWLIST } from '~/utils/complianceMediaPolicy';
import { downloadComplianceExports } from '~/utils/complianceExport';
import {
  applySectionApprovalTransition,
  draftApprovalRecord,
  formatApprovalSectionKey,
  loadSectionApprovalsForDocument,
  saveSectionApproval,
  type SectionApprovalPayload,
  type SectionApprovalRecord,
} from '~/utils/complianceApproval';
import {
  documentReleaseIsComplete,
  emptyDocumentRelease,
  loadDocumentRelease,
  saveDocumentRelease,
  type DocumentReleaseRecord,
} from '~/utils/complianceDocumentRelease';
import { COMPLIANCE_DEMO_USER, COMPLIANCE_SECOND_APPROVER } from '~/utils/complianceIdentity';
import ComplianceFullDocumentEditor from './ComplianceFullDocumentEditor.vue';
import ComplianceSectionApprovalPanel from './ComplianceSectionApprovalPanel.vue';

const props = withDefaults(
  defineProps<{
    /** Scopes IndexedDB approvals, document release, and full-doc version/comment keys. */
    documentInstanceId: string;
    initialDocumentBlocks: Block[];
    /** Required flags keyed by section lockId (from template); omitted sections default to required. */
    sectionRequiredByLockId?: Record<string, boolean>;
    /** Shown in export and merge manifest. */
    documentTitle: string;
    reviewerOnly?: boolean;
    aiGovernanceMode?: 'off' | 'governed';
  }>(),
  {
    sectionRequiredByLockId: () => ({}),
  }
);

const fullDocPersistenceKey = computed(() => `${props.documentInstanceId}::full-doc`);

const mergedBlocks = defineModel<Block[]>('mergedBlocks', { default: () => [] });

const fullDocRef = ref<InstanceType<typeof ComplianceFullDocumentEditor> | null>(null);

const previewWaiverReason = ref('');

const approvals = ref<Record<string, SectionApprovalRecord>>({});
const requireApprovalToPublish = ref(false);
const requireDocumentReleaseForExport = ref(false);
const documentRelease = ref<DocumentReleaseRecord>(emptyDocumentRelease(props.documentInstanceId));
const documentReleaseNote = ref('');

const lastManifest = ref<ComplianceMergeManifest | null>(null);

function getMergedDocument(): Block[] {
  const inst = fullDocRef.value;
  const ed = inst?.editor;
  const live = ed && !ed.isDestroyed ? ed.getDocument() : [];
  const blocks =
    live.length > 0 ? live : mergedBlocks.value.length > 0 ? mergedBlocks.value : props.initialDocumentBlocks;
  lastManifest.value = buildMergeManifestFromFullDoc(blocks, `${props.documentTitle} (preview)`);
  return blocks;
}

function getMergeManifest(): ComplianceMergeManifest | null {
  return lastManifest.value;
}

function refreshMerged() {
  mergedBlocks.value = getMergedDocument();
}

const validationOptions = {
  imageHostAllowlist: DEFAULT_COMPLIANCE_IMAGE_HOST_ALLOWLIST,
};

const liveComplianceDoc = computed((): Block[] => {
  const inst = fullDocRef.value;
  const ed = inst?.editor;
  return ed && !ed.isDestroyed ?
      ed.getDocument()
    : mergedBlocks.value.length > 0 ?
      mergedBlocks.value
    : props.initialDocumentBlocks;
});

const sectionSlices = computed(() =>
  sliceComplianceDocumentByLockedHeadings(liveComplianceDoc.value, props.sectionRequiredByLockId)
);

/** Whether each section's H2 is enforcement-locked (editable title when false). */
const sectionHeadingLockStates = computed(() => {
  const doc = liveComplianceDoc.value;
  const out: Record<string, boolean> = {};
  for (const s of sliceComplianceDocumentByLockedHeadings(doc, props.sectionRequiredByLockId)) {
    const v = isComplianceSectionHeadingLocked(doc, s.sectionId);
    if (v !== null) out[s.sectionId] = v;
  }
  return out;
});

function unlockSectionHeading(sectionLockId: string) {
  fullDocRef.value?.setSectionHeadingLockState(sectionLockId, false);
  refreshMerged();
}

function lockSectionHeading(sectionLockId: string) {
  fullDocRef.value?.setSectionHeadingLockState(sectionLockId, true);
  refreshMerged();
}

const sectionValidations = computed((): SectionValidationResult[] => {
  const inst = fullDocRef.value;
  const sliced = sectionSlices.value;
  const globalPending = inst?.getPendingTrackGroupCount?.() ?? 0;
  const firstSectionId = sliced[0]?.sectionId;
  return sliced.map((sec) => {
    const blocks = sec.blocks;
    const { ok: contentOk, issues: contentIssues } = validateComplianceSectionBlocks(
      sec.required,
      blocks,
      validationOptions
    );
    const ur = inst?.countUnresolvedInSection?.(sec.sectionId) ?? 0;
    const issues = [...contentIssues];
    if (ur > 0) issues.push(`${ur} unresolved comment thread(s) in this section.`);
    if (globalPending > 0 && sec.sectionId === firstSectionId) {
      issues.push(`${globalPending} pending track change group(s) in the document.`);
    }
    const ok = contentOk && ur === 0 && globalPending === 0;
    return {
      sectionId: sec.sectionId,
      title: sec.title,
      required: sec.required,
      headingLevel: sec.level,
      parentLockId: sec.parentLockId,
      ok,
      issues,
      unresolvedComments: ur,
      pendingTrackGroups: globalPending,
    };
  });
});

const allSectionsPass = computed(() => sectionValidations.value.every((s) => s.ok));

const allSectionsApproved = computed(() =>
  sectionSlices.value.every((s) => approvals.value[s.sectionId]?.state === 'approved')
);

const documentReleaseComplete = computed(() => documentReleaseIsComplete(documentRelease.value));

const waiverOk = computed(() => previewWaiverReason.value.trim().length >= 8);

const isPreviewAllowed = computed(
  () =>
    (allSectionsPass.value &&
      (!requireApprovalToPublish.value || allSectionsApproved.value) &&
      (!requireDocumentReleaseForExport.value || documentReleaseComplete.value)) ||
    waiverOk.value
);

function approvalStatusLabel(row: SectionValidationResult): string {
  const st = approvals.value[row.sectionId]?.state ?? 'draft';
  if (st === 'in_review') return 'In review';
  if (st === 'approved') return 'Signed off';
  return 'Draft';
}

function logicalSectionIdFromApprovalRecord(record: SectionApprovalRecord): string {
  const prefix = `${props.documentInstanceId}::`;
  const sk = record.sectionKey;
  return sk.startsWith(prefix) ? sk.slice(prefix.length) : sk;
}

function onApprovalUpdate(payload: SectionApprovalPayload) {
  const logicalId = logicalSectionIdFromApprovalRecord(payload.record);
  const prev = approvals.value[logicalId];
  const next = applySectionApprovalTransition(
    prev,
    payload.record,
    payload.event,
    payload.actor,
    payload.note
  );
  approvals.value = { ...approvals.value, [logicalId]: next };
  void saveSectionApproval(next);
}

function onDocReleaseTwoToggle(checked: boolean) {
  documentRelease.value = { ...documentRelease.value, requireTwoApprovers: checked };
  void saveDocumentRelease(documentRelease.value);
}

function signPrimaryDocumentRelease() {
  if (!props.reviewerOnly || !allSectionsApproved.value) return;
  const rec = documentRelease.value;
  if (rec.signOffs.length > 0) return;
  const note = documentReleaseNote.value.trim() || undefined;
  documentRelease.value = {
    ...rec,
    signOffs: [
      {
        at: new Date().toISOString(),
        userId: COMPLIANCE_DEMO_USER.userId,
        displayName: COMPLIANCE_DEMO_USER.displayName,
        round: 1,
        ...(note ? { note } : {}),
      },
    ],
  };
  documentReleaseNote.value = '';
  void saveDocumentRelease(documentRelease.value);
}

function signSecondaryDocumentRelease() {
  if (!props.reviewerOnly || !allSectionsApproved.value) return;
  const rec = documentRelease.value;
  if (!rec.requireTwoApprovers || rec.signOffs.length !== 1) return;
  const first = rec.signOffs[0];
  if (!first || first.userId === COMPLIANCE_SECOND_APPROVER.userId) return;
  const note = documentReleaseNote.value.trim() || undefined;
  documentRelease.value = {
    ...rec,
    signOffs: [
      ...rec.signOffs,
      {
        at: new Date().toISOString(),
        userId: COMPLIANCE_SECOND_APPROVER.userId,
        displayName: COMPLIANCE_SECOND_APPROVER.displayName,
        round: 2,
        ...(note ? { note } : {}),
      },
    ],
  };
  documentReleaseNote.value = '';
  void saveDocumentRelease(documentRelease.value);
}

function revokeDocumentRelease() {
  if (!props.reviewerOnly) return;
  documentRelease.value = { ...documentRelease.value, signOffs: [] };
  void saveDocumentRelease(documentRelease.value);
}

async function exportComplianceBundle() {
  const blocks = getMergedDocument();
  const manifest = lastManifest.value;
  const commentsSnapshot = fullDocRef.value?.getCommentSnapshot?.() ?? [];
  const commentsBySection: Record<string, CommentThread[]> = {};
  const sectionTitles: Record<string, string> = {};
  for (const s of sectionSlices.value) {
    commentsBySection[s.sectionId] = commentsSnapshot.filter(
      (t) => String(t.metadata?.complianceSectionId ?? '') === s.sectionId
    );
    sectionTitles[s.sectionId] = s.title;
  }
  await downloadComplianceExports({
    documentTitle: props.documentTitle,
    blocks,
    mergeManifest: manifest,
    commentsBySection,
    sectionTitles,
    sectionApprovals: { ...approvals.value },
    documentRelease: { ...documentRelease.value },
  });
}

onMounted(async () => {
  const loaded = await loadSectionApprovalsForDocument(props.documentInstanceId);
  const map: Record<string, SectionApprovalRecord> = {};
  const ids = sliceComplianceDocumentByLockedHeadings(
    props.initialDocumentBlocks,
    props.sectionRequiredByLockId
  ).map((s) => s.sectionId);
  for (const id of ids) {
    const sk = formatApprovalSectionKey(props.documentInstanceId, id);
    map[id] = loaded[id] ?? draftApprovalRecord(sk);
  }
  approvals.value = map;
  documentRelease.value = await loadDocumentRelease(props.documentInstanceId);
  nextTick(() => refreshMerged());
});

defineExpose({
  getMergedDocument,
  getMergeManifest,
  refreshMerged,
  sectionValidations,
  canOpenPreview: () => isPreviewAllowed.value,
  previewWaiverReason,
  exportComplianceBundle,
  allSectionsApproved: () => allSectionsApproved.value,
  documentReleaseComplete: () => documentReleaseComplete.value,
});
</script>

<template>
  <div class="compliance-workspace">
    <div class="compliance-workspace__banner" role="note">
      <strong>Controlled authoring mode.</strong>
      Section titles are normally <strong>compliance-locked</strong>. Use <strong>Unlock title</strong> on a row below to edit that heading, then <strong>Lock title</strong> when done. Body text under each heading stays editable when the title is locked. Live multi-user collaboration (Yjs) is not used here. Use
      <strong>Reviewer view</strong>
      for read-only review with comments (unlock is hidden there).
    </div>

    <div class="compliance-workspace__status" role="region" aria-label="Section validation">
      <p class="compliance-workspace__status-title">Controlled sections</p>
      <ul class="compliance-workspace__status-list">
        <li
          v-for="row in sectionValidations"
          :key="row.sectionId"
          class="compliance-workspace__status-item"
          :data-ok="row.ok"
        >
          <span
            class="compliance-workspace__status-label"
            :style="{ paddingLeft: `${(row.headingLevel - 1) * 14}px` }"
            :title="`H${row.headingLevel}${row.parentLockId ? ' · subsection' : ''}`"
            >{{ row.title }}</span
          >
          <span v-if="row.required" class="compliance-workspace__status-badge">Required</span>
          <span v-else class="compliance-workspace__status-badge compliance-workspace__status-badge--optional">Optional</span>
          <span :class="row.ok ? 'compliance-workspace__status-ok' : 'compliance-workspace__status-bad'">
            {{ row.ok ? 'Complete' : 'Incomplete' }}
          </span>
          <span v-if="row.unresolvedComments > 0" class="compliance-workspace__status-comments"
            >{{ row.unresolvedComments }} open comments</span
          >
          <span
            v-if="row.pendingTrackGroups > 0 && row.sectionId === sectionSlices[0]?.sectionId"
            class="compliance-workspace__status-tracks"
            >{{ row.pendingTrackGroups }} document track group(s)</span
          >
          <span
            class="compliance-workspace__status-approval"
            :data-approval="approvals[row.sectionId]?.state ?? 'draft'"
            >{{ approvalStatusLabel(row) }}</span
          >
          <span v-if="!reviewerOnly" class="compliance-workspace__status-lock">
            <button
              v-if="sectionHeadingLockStates[row.sectionId] === true"
              type="button"
              class="compliance-workspace__status-lock-btn"
              @click="unlockSectionHeading(row.sectionId)"
            >
              Unlock title
            </button>
            <button
              v-else-if="sectionHeadingLockStates[row.sectionId] === false"
              type="button"
              class="compliance-workspace__status-lock-btn compliance-workspace__status-lock-btn--warn"
              @click="lockSectionHeading(row.sectionId)"
            >
              Lock title
            </button>
          </span>
          <span v-if="!row.ok && row.issues.length" class="compliance-workspace__status-hint">{{ row.issues[0] }}</span>
        </li>
      </ul>
      <label class="compliance-workspace__approval-gate">
        <input v-model="requireApprovalToPublish" type="checkbox" />
        Require every section signed off for preview &amp; export (unless waived below)
      </label>
      <p v-if="requireApprovalToPublish && !allSectionsApproved" class="compliance-workspace__approval-gate-hint">
        {{ allSectionsPass ? 'All sections pass validation — complete reviewer sign-off on each section, or enter a waiver.' : 'Fix validation first; then sign off each section, or enter a waiver.' }}
      </p>
      <label class="compliance-workspace__approval-gate">
        <input v-model="requireDocumentReleaseForExport" type="checkbox" />
        Require document attestation for preview &amp; export (unless waived below)
      </label>
      <p v-if="requireDocumentReleaseForExport && !documentReleaseComplete" class="compliance-workspace__approval-gate-hint">
        {{
          allSectionsApproved
            ? 'All sections are signed off — add document release attestation in reviewer view, or enter a waiver.'
            : 'Complete section sign-offs first; then attest the document, or enter a waiver.'
        }}
      </p>

      <div class="compliance-workspace__doc-release" role="region" aria-label="Document release">
        <p class="compliance-workspace__doc-release-title">Document release</p>
        <p class="compliance-workspace__doc-release-lede">
          After every section is approved, a reviewer can record a controlled <strong>document-level</strong> attestation. Enable two approvers to require distinct signers (demo: primary vs QA lead).
        </p>
        <label class="compliance-workspace__approval-gate">
          <input
            type="checkbox"
            :checked="documentRelease.requireTwoApprovers"
            @change="onDocReleaseTwoToggle(($event.target as HTMLInputElement).checked)"
          />
          Require two distinct approvers for document release
        </label>
        <p v-if="documentReleaseComplete" class="compliance-workspace__doc-release-ok">Document release is complete.</p>
        <ul v-else-if="documentRelease.signOffs.length" class="compliance-workspace__doc-release-list">
          <li v-for="(s, i) in documentRelease.signOffs" :key="`${s.at}-${i}`">
            <strong>Round {{ s.round }}</strong> · {{ s.displayName }} · {{ s.at }}
            <template v-if="s.note"> — {{ s.note }}</template>
          </li>
        </ul>
        <template v-if="reviewerOnly && allSectionsApproved">
          <label class="compliance-workspace__doc-release-label">
            Attestation note (optional)
            <textarea
              v-model="documentReleaseNote"
              class="compliance-workspace__doc-release-textarea"
              rows="2"
              placeholder="e.g. Released for training use in lab 3."
            />
          </label>
          <div class="compliance-workspace__doc-release-actions">
            <template v-if="!documentRelease.requireTwoApprovers">
              <button
                v-if="documentRelease.signOffs.length === 0"
                type="button"
                class="compliance-section__version-btn"
                @click="signPrimaryDocumentRelease"
              >
                Attest document release ({{ COMPLIANCE_DEMO_USER.displayName }})
              </button>
            </template>
            <template v-else>
              <button
                v-if="documentRelease.signOffs.length === 0"
                type="button"
                class="compliance-section__version-btn"
                @click="signPrimaryDocumentRelease"
              >
                Primary attestation ({{ COMPLIANCE_DEMO_USER.displayName }})
              </button>
              <button
                v-if="documentRelease.signOffs.length === 1"
                type="button"
                class="compliance-section__version-btn"
                @click="signSecondaryDocumentRelease"
              >
                Second attestation ({{ COMPLIANCE_SECOND_APPROVER.displayName }})
              </button>
            </template>
            <button
              v-if="documentRelease.signOffs.length > 0"
              type="button"
              class="compliance-section__version-btn compliance-section__version-btn--warn"
              @click="revokeDocumentRelease"
            >
              Clear attestations
            </button>
          </div>
        </template>
      </div>

      <div v-if="!isPreviewAllowed" class="compliance-workspace__waiver">
        <label class="compliance-workspace__waiver-label" for="compliance-preview-waiver"
          >Preview waiver (min. 8 characters)</label
        >
        <textarea
          id="compliance-preview-waiver"
          v-model="previewWaiverReason"
          class="compliance-workspace__waiver-input"
          rows="2"
          placeholder="Use when validation, comments, track changes, or sign-off gate blocks preview — document why."
        />
        <p v-if="!isPreviewAllowed && !waiverOk" class="compliance-workspace__waiver-hint">
          Enter a waiver reason to enable merged preview and export, or clear the issues above (including sign-off if required).
        </p>
      </div>
    </div>

    <p class="compliance-workspace__lede">
      Controlled document in a <strong>single full editor</strong> with slash menu, bubble menu, tables, media, comments, versions, and track changes. Section titles are locked by default; use <strong>Unlock title</strong> in the section list to revise a heading, then lock again. Figures must use allowlisted hosts with caption and alt text. Use the
      <strong>per-section approval cards</strong> below the editor to submit and sign off. Use
      <strong>Preview document</strong>
      to open the merged readout; use <strong>Export bundle</strong> for JSON, Markdown, HTML, checksum, section approvals (with history), and document release.
    </p>

    <ComplianceFullDocumentEditor
      ref="fullDocRef"
      :initial-blocks="initialDocumentBlocks"
      :versioning-key="fullDocPersistenceKey"
      :comment-storage-key="fullDocPersistenceKey"
      :reviewer-only="reviewerOnly"
      :ai-governance-mode="aiGovernanceMode ?? 'governed'"
      @update="refreshMerged"
    />

    <div class="compliance-workspace__approval-grid">
      <h2 class="compliance-workspace__approval-grid-title">Section approvals</h2>
      <p class="compliance-workspace__approval-grid-lede">
        Validation uses the content under each numbered heading. Comment threads are attributed to a section when you start them with the cursor in that section.
      </p>
      <div class="compliance-workspace__approval-grid-list">
        <ComplianceSectionApprovalPanel
          v-for="sec in sectionSlices"
          :key="sec.sectionId"
          :section-id="sec.sectionId"
          :section-title="`${'\u2003'.repeat(sec.level - 1)}${sec.title}`"
          :required="sec.required"
          :reviewer-only="reviewerOnly"
          :approval="approvals[sec.sectionId] ?? draftApprovalRecord(sec.sectionId)"
          :section-ready="sectionValidations.find((r) => r.sectionId === sec.sectionId)?.ok ?? false"
          @update:approval="onApprovalUpdate"
        />
      </div>
    </div>
  </div>
</template>
