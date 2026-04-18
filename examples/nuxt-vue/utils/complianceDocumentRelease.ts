import { DOCUMENT_RELEASE_STORE, openComplianceDb } from './complianceDb';

export const DOCUMENT_RELEASE_DOC_KEY = 'gram-sop-demo';

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
  const db = await openComplianceDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCUMENT_RELEASE_STORE, 'readonly');
    const req = tx.objectStore(DOCUMENT_RELEASE_STORE).get(docKey);
    req.onerror = (): void => reject(req.error ?? new Error('read document release'));
    req.onsuccess = (): void => {
      const row = req.result as DocumentReleaseRecord | undefined;
      if (!row) {
        resolve(emptyDocumentRelease(docKey));
        return;
      }
      resolve({
        docKey: row.docKey,
        requireTwoApprovers: Boolean(row.requireTwoApprovers),
        signOffs: Array.isArray(row.signOffs) ? row.signOffs : [],
      });
    };
  });
}

export async function saveDocumentRelease(record: DocumentReleaseRecord): Promise<void> {
  const db = await openComplianceDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCUMENT_RELEASE_STORE, 'readwrite');
    tx.oncomplete = (): void => resolve();
    tx.onerror = (): void => reject(tx.error ?? new Error('write document release'));
    tx.objectStore(DOCUMENT_RELEASE_STORE).put(record);
  });
}
