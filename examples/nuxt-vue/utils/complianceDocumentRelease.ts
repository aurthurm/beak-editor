import { DOCUMENT_RELEASE_STORE, dbGet, dbPut } from './complianceDb';

export type DocumentReleaseSignOff = {
  at: string;
  userId: string;
  displayName: string;
  round: 1 | 2;
  note?: string;
};

/** Document-level attestation after all sections are approved (optional second sign-off). */
export type DocumentReleaseRecord = {
  docKey: string;
  requireTwoApprovers: boolean;
  signOffs: DocumentReleaseSignOff[];
};

export function emptyDocumentRelease(docKey: string): DocumentReleaseRecord {
  return { docKey, requireTwoApprovers: false, signOffs: [] };
}

export function documentReleaseIsComplete(rec: DocumentReleaseRecord | null): boolean {
  if (!rec?.signOffs.length) return false;
  const need = rec.requireTwoApprovers ? 2 : 1;
  if (rec.signOffs.length < need) return false;
  if (!rec.requireTwoApprovers) return true;
  const a = rec.signOffs[0];
  const b = rec.signOffs[1];
  return Boolean(a && b && a.userId !== b.userId);
}

export async function loadDocumentRelease(docKey: string): Promise<DocumentReleaseRecord> {
  const row = await dbGet<DocumentReleaseRecord>(DOCUMENT_RELEASE_STORE, docKey);
  if (!row) return emptyDocumentRelease(docKey);
  return {
    docKey: row.docKey,
    requireTwoApprovers: Boolean(row.requireTwoApprovers),
    signOffs: Array.isArray(row.signOffs) ? row.signOffs : [],
  };
}

export async function saveDocumentRelease(record: DocumentReleaseRecord): Promise<void> {
  // dbPut stores a plain copy, so reactive state (Vue proxies) is safe to pass in.
  await dbPut(DOCUMENT_RELEASE_STORE, record);
}
