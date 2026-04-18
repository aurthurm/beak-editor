<script setup lang="ts">
import { ref } from 'vue';
import type { SectionApprovalPayload, SectionApprovalRecord } from '~/utils/complianceApproval';
import { COMPLIANCE_DEMO_USER } from '~/utils/complianceIdentity';

const props = defineProps<{
  sectionId: string;
  sectionTitle: string;
  required: boolean;
  reviewerOnly?: boolean;
  approval: SectionApprovalRecord;
  /** True when validation, comments, and track changes allow submit. */
  sectionReady: boolean;
}>();

const emit = defineEmits<{
  'update:approval': [SectionApprovalPayload];
}>();

const approvalNoteDraft = ref('');

function submitForReview() {
  if (!props.sectionReady || props.approval.state !== 'draft') return;
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
</script>

<template>
  <section class="compliance-approval-panel" :data-section-id="sectionId" role="region" :aria-label="`Approval · ${sectionTitle}`">
    <div class="compliance-approval-panel__head">
      <span class="compliance-approval-panel__title">{{ sectionTitle }}</span>
      <span v-if="required" class="compliance-approval-panel__badge">Required</span>
      <span v-else class="compliance-approval-panel__badge compliance-approval-panel__badge--optional">Optional</span>
    </div>
    <p class="compliance-approval-panel__state">
      <strong>{{ approval.state === 'draft' ? 'Draft' : approval.state === 'in_review' ? 'In review' : 'Approved' }}</strong>
      <span v-if="approval.submittedForReviewAt" class="compliance-approval-panel__meta">
        · Submitted {{ approval.submittedForReviewAt }}
      </span>
      <span v-if="approval.approvedAt" class="compliance-approval-panel__meta">
        · Signed {{ approval.approvedAt }} by {{ approval.approvedByDisplayName || approval.approvedByUserId || '—' }}
      </span>
    </p>
    <p v-if="approval.approvalNote" class="compliance-approval-panel__note">Reviewer note: {{ approval.approvalNote }}</p>
    <div class="compliance-approval-panel__actions">
      <button
        v-if="!reviewerOnly && approval.state === 'draft'"
        type="button"
        class="compliance-section__approval-btn compliance-section__approval-btn--primary"
        :disabled="!sectionReady"
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
    <p v-if="!reviewerOnly && approval.state === 'draft' && !sectionReady" class="compliance-section__approval-hint">
      Complete validation for this section, resolve its comments, and clear pending track changes in the document before submitting.
    </p>
    <details v-if="(approval.history?.length ?? 0) > 0" class="compliance-section__approval-history">
      <summary>Approval log ({{ approval.history?.length ?? 0 }} events)</summary>
      <ol class="compliance-section__approval-history-list">
        <li v-for="(h, idx) in approval.history" :key="`${h.at}-${idx}`" class="compliance-section__approval-history-item">
          <span class="compliance-section__approval-history-kind">{{ h.kind.replace(/_/g, ' ') }}</span>
          <span class="compliance-section__approval-history-meta">{{ h.at }} · {{ h.displayName }} → {{ h.state }}</span>
          <span v-if="h.note" class="compliance-section__approval-history-note">{{ h.note }}</span>
        </li>
      </ol>
    </details>
  </section>
</template>
