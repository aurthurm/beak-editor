import { APPROVALS_STORE, dbGetAll, dbPut } from './complianceDb';

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

/** IndexedDB approval row key: isolates section sign-offs per document instance. */
export function formatApprovalSectionKey(documentInstanceId: string, sectionLockId: string): string {
  return `${documentInstanceId}::${sectionLockId}`;
}

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
  const rows = await dbGetAll<SectionApprovalRecord>(APPROVALS_STORE);
  const out: Record<string, SectionApprovalRecord> = {};
  for (const row of rows) {
    if (row?.sectionKey) out[row.sectionKey] = normalizeSectionApprovalRecord(row);
  }
  return out;
}

/** Approvals for one compliance document; keys are section lockIds; each record.sectionKey is the full storage key. */
export async function loadSectionApprovalsForDocument(
  documentInstanceId: string
): Promise<Record<string, SectionApprovalRecord>> {
  const prefix = `${documentInstanceId}::`;
  const rows = await dbGetAll<SectionApprovalRecord>(APPROVALS_STORE);
  const out: Record<string, SectionApprovalRecord> = {};
  for (const row of rows) {
    const sk = row?.sectionKey;
    if (!sk || !sk.startsWith(prefix)) continue;
    out[sk.slice(prefix.length)] = normalizeSectionApprovalRecord(row);
  }
  return out;
}

export async function saveSectionApproval(record: SectionApprovalRecord): Promise<void> {
  // dbPut stores a plain copy: records built from reactive state carry Vue proxies that IndexedDB cannot clone.
  await dbPut(APPROVALS_STORE, normalizeSectionApprovalRecord(record));
}
