/** Shared IndexedDB for compliance demo: section versions + comment snapshots. */

export const COMPLIANCE_DB_NAME = 'beakblock-compliance-demo';
export const COMPLIANCE_DB_VERSION = 5;

export const VERSIONS_STORE = 'sectionVersions';
export const COMMENTS_STORE = 'sectionComments';
export const APPROVALS_STORE = 'sectionApprovals';
export const DOCUMENT_RELEASE_STORE = 'documentRelease';
export const TEMPLATES_STORE = 'complianceTemplates';

export function openComplianceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(COMPLIANCE_DB_NAME, COMPLIANCE_DB_VERSION);
    req.onerror = (): void => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onsuccess = (): void => resolve(req.result);
    req.onupgradeneeded = (ev): void => {
      const db = req.result;
      const old = ev.oldVersion;
      if (old < 1 && !db.objectStoreNames.contains(VERSIONS_STORE)) {
        const store = db.createObjectStore(VERSIONS_STORE, { keyPath: 'id' });
        store.createIndex('sectionKey', 'sectionKey', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (old < 2 && !db.objectStoreNames.contains(COMMENTS_STORE)) {
        db.createObjectStore(COMMENTS_STORE, { keyPath: 'sectionKey' });
      }
      if (old < 3 && !db.objectStoreNames.contains(APPROVALS_STORE)) {
        db.createObjectStore(APPROVALS_STORE, { keyPath: 'sectionKey' });
      }
      if (old < 4 && !db.objectStoreNames.contains(DOCUMENT_RELEASE_STORE)) {
        db.createObjectStore(DOCUMENT_RELEASE_STORE, { keyPath: 'docKey' });
      }
      if (old < 5 && !db.objectStoreNames.contains(TEMPLATES_STORE)) {
        db.createObjectStore(TEMPLATES_STORE, { keyPath: 'id' });
      }
    };
  });
}
