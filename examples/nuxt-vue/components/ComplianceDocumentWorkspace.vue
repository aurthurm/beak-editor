<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import type { Block, CommentThread } from '@aurthurm/beakblock-core';
import type { ComplianceSectionDefinition } from '~/data';
import {
  mergeComplianceSectionsWithManifest,
  type ComplianceMergeManifest,
} from '~/utils/complianceMerge';
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
import ComplianceSectionEditor from './ComplianceSectionEditor.vue';

const props = defineProps<{
  sections: ComplianceSectionDefinition[];
  reviewerOnly?: boolean;
  aiGovernanceMode?: 'off' | 'governed';
}>();

const mergedBlocks = defineModel<Block[]>('mergedBlocks', { default: () => [] });

type SectionInst = InstanceType<typeof ComplianceSectionEditor>;
const sectionRefs = ref<Record<string, SectionInst | undefined>>({});

const previewWaiverReason = ref('');

const approvals = ref<Record<string, SectionApprovalRecord>>({});
const requireApprovalToPublish = ref(false);
const requireDocumentReleaseForExport = ref(false);
const documentRelease = ref<DocumentReleaseRecord>(emptyDocumentRelease(DOCUMENT_RELEASE_DOC_KEY));
const documentReleaseNote = ref('');

const lastManifest = ref<ComplianceMergeManifest | null>(null);

function setSectionRef(id: string, el: unknown) {
  if (el && typeof el === 'object' && 'editor' in el) {
    sectionRefs.value[id] = el as SectionInst;
  } else {
    delete sectionRefs.value[id];
  }
}

function getMergedDocument(): Block[] {
  const sources = props.sections.map((def) => {
    const inst = sectionRefs.value[def.id];
    const doc = inst?.editor?.getDocument();
    return {
      sectionId: def.id,
      title: def.title,
      blocks: doc && doc.length ? doc : def.initialBlocks,
    };
  });
  const { blocks, manifest } = mergeComplianceSectionsWithManifest(sources, {
    documentTitle: 'Gram stain — standard operating procedure (preview)',
    sectionHeadingLevel: 2,
  });
  lastManifest.value = manifest;
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
  return props.sections.map((def) => {
    const inst = sectionRefs.value[def.id];
    const doc = inst?.editor?.getDocument();
    const blocks = doc && doc.length ? doc : def.initialBlocks;
    const { ok: contentOk, issues: contentIssues } = validateComplianceSectionBlocks(
      def.required,
      blocks,
      validationOptions
    );
    const ur = inst?.getUnresolvedCount?.() ?? 0;
    const pt = inst?.getPendingTrackGroupCount?.() ?? 0;
    const issues = [...contentIssues];
    if (ur > 0) issues.push(`${ur} unresolved comment thread(s).`);
    if (pt > 0) issues.push(`${pt} pending track change group(s).`);
    const ok = contentOk && ur === 0 && pt === 0;
    return {
      sectionId: def.id,
      title: def.title,
      required: def.required,
      ok,
      issues,
      unresolvedComments: ur,
      pendingTrackGroups: pt,
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
  const commentsBySection: Record<string, CommentThread[]> = {};
  const sectionTitles: Record<string, string> = {};
  for (const def of props.sections) {
    const inst = sectionRefs.value[def.id];
    commentsBySection[def.id] = inst?.getCommentSnapshot?.() ?? [];
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
      Live multi-user collaboration (Yjs) is not used here — each section is a single editor instance. Use
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
          <span v-if="row.pendingTrackGroups > 0" class="compliance-workspace__status-tracks"
            >{{ row.pendingTrackGroups }} track group(s)</span
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
      This sample is a <strong>Gram stain</strong> standard operating procedure. Each block below is a controlled section; authors
      edit only inside that field. Figures must use allowlisted hosts with caption and alt text. Authors
      <strong>submit for review</strong>; reviewers <strong>sign off</strong> (optional gate above). Use
      <strong>Preview document</strong>
      to merge sections; use <strong>Export bundle</strong> for JSON, Markdown, HTML, checksum, section approvals (with history), and document release.
    </p>
    <div class="compliance-workspace__sections">
      <ComplianceSectionEditor
        v-for="def in sections"
        :key="def.id"
        :ref="(el) => setSectionRef(def.id, el)"
        :section-id="def.id"
        :section-title="def.title"
        :required="def.required"
        :initial-blocks="def.initialBlocks"
        :reviewer-only="reviewerOnly"
        :ai-governance-mode="aiGovernanceMode ?? 'governed'"
        :approval="approvals[def.id] ?? draftApprovalRecord(def.id)"
        @update="refreshMerged"
        @update:approval="onApprovalUpdate"
      />
    </div>
  </div>
</template>
