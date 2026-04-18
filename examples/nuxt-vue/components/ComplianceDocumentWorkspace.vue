<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import type { Block, CommentThread } from '@amusendame/beakblock-core';
import type { ComplianceSectionDefinition } from '~/data';
import {
  buildComplianceFullDocumentBlocks,
  buildMergeManifestFromFullDoc,
  sliceComplianceFullDocument,
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
  loadAllSectionApprovals,
  saveSectionApproval,
  type SectionApprovalPayload,
  type SectionApprovalRecord,
} from '~/utils/complianceApproval';
import {
  DOCUMENT_RELEASE_DOC_KEY,
  documentReleaseIsComplete,
  emptyDocumentRelease,
  loadDocumentRelease,
  saveDocumentRelease,
  type DocumentReleaseRecord,
} from '~/utils/complianceDocumentRelease';
import { COMPLIANCE_DEMO_USER, COMPLIANCE_SECOND_APPROVER } from '~/utils/complianceIdentity';
import ComplianceFullDocumentEditor from './ComplianceFullDocumentEditor.vue';
import ComplianceSectionApprovalPanel from './ComplianceSectionApprovalPanel.vue';

const props = defineProps<{
  sections: ComplianceSectionDefinition[];
  reviewerOnly?: boolean;
  aiGovernanceMode?: 'off' | 'governed';
}>();

const mergedBlocks = defineModel<Block[]>('mergedBlocks', { default: () => [] });

const fullDocRef = ref<InstanceType<typeof ComplianceFullDocumentEditor> | null>(null);

const previewWaiverReason = ref('');

const DOC_TITLE = 'Gram stain — standard operating procedure (controlled)';

const fullDocInitialBlocks = computed(() => buildComplianceFullDocumentBlocks(props.sections, DOC_TITLE));

const approvals = ref<Record<string, SectionApprovalRecord>>({});
const requireApprovalToPublish = ref(false);
const requireDocumentReleaseForExport = ref(false);
const documentRelease = ref<DocumentReleaseRecord>(emptyDocumentRelease(DOCUMENT_RELEASE_DOC_KEY));
const documentReleaseNote = ref('');

const lastManifest = ref<ComplianceMergeManifest | null>(null);

function getMergedDocument(): Block[] {
  const inst = fullDocRef.value;
  const ed = inst?.editor;
  const live = ed && !ed.isDestroyed ? ed.getDocument() : [];
  const blocks = live.length > 0 ? live : fullDocInitialBlocks.value;
  lastManifest.value = buildMergeManifestFromFullDoc(blocks, props.sections, 'Gram stain — standard operating procedure (preview)');
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

const sectionValidations = computed((): SectionValidationResult[] => {
  const inst = fullDocRef.value;
  const ed = inst?.editor;
  const doc = ed && !ed.isDestroyed ? ed.getDocument() : fullDocInitialBlocks.value;
  const sliced = sliceComplianceFullDocument(doc, props.sections);
  const globalPending = inst?.getPendingTrackGroupCount?.() ?? 0;
  return props.sections.map((def, idx) => {
    const blocks = sliced[idx]?.blocks ?? [];
    const { ok: contentOk, issues: contentIssues } = validateComplianceSectionBlocks(
      def.required,
      blocks,
      validationOptions
    );
    const ur = inst?.countUnresolvedInSection?.(def.id) ?? 0;
    const issues = [...contentIssues];
    if (ur > 0) issues.push(`${ur} unresolved comment thread(s) in this section.`);
    if (globalPending > 0 && idx === 0) {
      issues.push(`${globalPending} pending track change group(s) in the document.`);
    }
    const ok = contentOk && ur === 0 && globalPending === 0;
    return {
      sectionId: def.id,
      title: def.title,
      required: def.required,
      ok,
      issues,
      unresolvedComments: ur,
      pendingTrackGroups: globalPending,
    };
  });
});

const allSectionsPass = computed(() => sectionValidations.value.every((s) => s.ok));

const allSectionsApproved = computed(() =>
  props.sections.every((def) => approvals.value[def.id]?.state === 'approved')
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

function onApprovalUpdate(payload: SectionApprovalPayload) {
  const prev = approvals.value[payload.record.sectionKey];
  const next = applySectionApprovalTransition(
    prev,
    payload.record,
    payload.event,
    payload.actor,
    payload.note
  );
  approvals.value = { ...approvals.value, [payload.record.sectionKey]: next };
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
  for (const def of props.sections) {
    commentsBySection[def.id] = commentsSnapshot.filter(
      (t) => String(t.metadata?.complianceSectionId ?? '') === def.id
    );
    sectionTitles[def.id] = def.title;
  }
  await downloadComplianceExports({
    documentTitle: 'Gram stain — standard operating procedure',
    blocks,
    mergeManifest: manifest,
    commentsBySection,
    sectionTitles,
    sectionApprovals: { ...approvals.value },
    documentRelease: { ...documentRelease.value },
  });
}

onMounted(async () => {
  const loaded = await loadAllSectionApprovals();
  const map: Record<string, SectionApprovalRecord> = {};
  for (const def of props.sections) {
    map[def.id] = loaded[def.id] ?? draftApprovalRecord(def.id);
  }
  approvals.value = map;
  documentRelease.value = await loadDocumentRelease(DOCUMENT_RELEASE_DOC_KEY);
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
      The Gram stain SOP is one continuous document: numbered <strong>section headings are locked</strong> (not editable or reorderable); body content under each heading is editable. Live multi-user collaboration (Yjs) is not used here. Use
      <strong>Reviewer view</strong>
      in the toolbar for read-only review with comments.
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
          <span class="compliance-workspace__status-label">{{ row.title }}</span>
          <span v-if="row.required" class="compliance-workspace__status-badge">Required</span>
          <span v-else class="compliance-workspace__status-badge compliance-workspace__status-badge--optional">Optional</span>
          <span :class="row.ok ? 'compliance-workspace__status-ok' : 'compliance-workspace__status-bad'">
            {{ row.ok ? 'Complete' : 'Incomplete' }}
          </span>
          <span v-if="row.unresolvedComments > 0" class="compliance-workspace__status-comments"
            >{{ row.unresolvedComments }} open comments</span
          >
          <span
            v-if="row.pendingTrackGroups > 0 && row.sectionId === sections[0]?.id"
            class="compliance-workspace__status-tracks"
            >{{ row.pendingTrackGroups }} document track group(s)</span
          >
          <span
            class="compliance-workspace__status-approval"
            :data-approval="approvals[row.sectionId]?.state ?? 'draft'"
            >{{ approvalStatusLabel(row) }}</span
          >
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
      This sample is a <strong>Gram stain</strong> standard operating procedure in a <strong>single full editor</strong> with slash menu, bubble menu, tables, media, comments, versions, and track changes. Section titles are fixed; authors edit body content under each heading. Figures must use allowlisted hosts with caption and alt text. Use the
      <strong>per-section approval cards</strong> below the editor to submit and sign off. Use
      <strong>Preview document</strong>
      to open the merged readout; use <strong>Export bundle</strong> for JSON, Markdown, HTML, checksum, section approvals (with history), and document release.
    </p>

    <ComplianceFullDocumentEditor
      ref="fullDocRef"
      :sections="sections"
      :initial-blocks="fullDocInitialBlocks"
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
          v-for="def in sections"
          :key="def.id"
          :section-id="def.id"
          :section-title="def.title"
          :required="def.required"
          :reviewer-only="reviewerOnly"
          :approval="approvals[def.id] ?? draftApprovalRecord(def.id)"
          :section-ready="sectionValidations.find((r) => r.sectionId === def.id)?.ok ?? false"
          @update:approval="onApprovalUpdate"
        />
      </div>
    </div>
  </div>
</template>
