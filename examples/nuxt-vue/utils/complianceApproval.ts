import { APPROVALS_STORE, openComplianceDb } from './complianceDb';

export type SectionApprovalState = 'draft' | 'in_review' | 'approved';

export type SectionApprovalEventKind =
  | 'submit_for_review'
  | 'withdraw'
  | 'send_back'
  | 'approve'
  | 'revoke';

export type SectionApprovalHistoryEntry = {
  at: string;
  kind: SectionApprovalEventKind;
  userId: string;
  displayName: string;
  /** Workflow state after this event. */
  state: SectionApprovalState;
  note?: string;
};

/** Payload from section editor → workspace (workspace merges history). */
export type SectionApprovalPayload = {
  record: SectionApprovalRecord;
  event: SectionApprovalEventKind;
  note?: string;
  actor: { userId: string; displayName: string };
};

/** Electronic sign-off metadata for a controlled section (demo). */
export type SectionApprovalRecord = {
  sectionKey: string;
  state: SectionApprovalState;
  submittedForReviewAt?: string;
  approvedAt?: string;
  approvedByUserId?: string;
  approvedByDisplayName?: string;
  approvalNote?: string;
  /** Append-only audit tail (capped). */
  history?: SectionApprovalHistoryEntry[];
};

const MAX_SECTION_APPROVAL_HISTORY = 80;

export function draftApprovalRecord(sectionKey: string): SectionApprovalRecord {
  return { sectionKey, state: 'draft', history: [] };
}

export function normalizeSectionApprovalRecord(row: SectionApprovalRecord): SectionApprovalRecord {
  return {
    ...row,
    history: Array.isArray(row.history) ? row.history : [],
  };
}

/**
 * Append one audit entry and return the next persisted record (clears draft-only fields when returning to draft).
 */
export function applySectionApprovalTransition(
  prev: SectionApprovalRecord | undefined,
  incoming: SectionApprovalRecord,
  event: SectionApprovalEventKind,
  actor: { userId: string; displayName: string },
  note?: string
): SectionApprovalRecord {
  const prevHist = normalizeSectionApprovalRecord(prev ?? incoming).history ?? [];
  const entry: SectionApprovalHistoryEntry = {
    at: new Date().toISOString(),
    kind: event,
    userId: actor.userId,
    displayName: actor.displayName,
    state: incoming.state,
    ...(note ? { note } : {}),
  };
  const history = [...prevHist, entry].slice(-MAX_SECTION_APPROVAL_HISTORY);

  if (incoming.state === 'draft') {
    return {
      sectionKey: incoming.sectionKey,
      state: 'draft',
      history,
    };
  }

  return {
    ...incoming,
    sectionKey: incoming.sectionKey,
    history,
  };
}

export async function loadAllSectionApprovals(): Promise<Record<string, SectionApprovalRecord>> {
  const db = await openComplianceDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APPROVALS_STORE, 'readonly');
    const req = tx.objectStore(APPROVALS_STORE).getAll();
    req.onerror = (): void => reject(req.error ?? new Error('read approvals'));
    req.onsuccess = (): void => {
      const out: Record<string, SectionApprovalRecord> = {};
      for (const row of req.result as SectionApprovalRecord[]) {
        if (row?.sectionKey) out[row.sectionKey] = normalizeSectionApprovalRecord(row);
      }
      resolve(out);
    };
  });
}

export async function saveSectionApproval(record: SectionApprovalRecord): Promise<void> {
  const db = await openComplianceDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APPROVALS_STORE, 'readwrite');
    tx.oncomplete = (): void => resolve();
    tx.onerror = (): void => reject(tx.error ?? new Error('write approval'));
    tx.objectStore(APPROVALS_STORE).put(normalizeSectionApprovalRecord(record));
  });
}
