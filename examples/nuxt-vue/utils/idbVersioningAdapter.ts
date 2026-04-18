import type { DocumentVersion, VersioningAdapter } from '@aurthurm/beakblock-core';

import { openComplianceDb, VERSIONS_STORE } from './complianceDb';

type VersionRow = DocumentVersion & { sectionKey: string };

/**
 * Persists document versions per compliance section in IndexedDB (survives refresh).
 */
export function createIndexedDbVersioningAdapter(sectionKey: string): VersioningAdapter {
  return {
    async listVersions(): Promise<DocumentVersion[]> {
      if (typeof indexedDB === 'undefined') return [];
      const db = await openComplianceDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(VERSIONS_STORE, 'readonly');
        const index = tx.objectStore(VERSIONS_STORE).index('sectionKey');
        const req = index.getAll(sectionKey);
        req.onerror = (): void => reject(req.error ?? new Error('listVersions failed'));
        req.onsuccess = (): void => {
          const rows = (req.result as VersionRow[]).map(({ sectionKey: _sk, ...v }) => v);
          rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          resolve(rows);
        };
      });
    },

    async getVersion(id: string): Promise<DocumentVersion | null> {
      if (typeof indexedDB === 'undefined') return null;
      const db = await openComplianceDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(VERSIONS_STORE, 'readonly');
        const req = tx.objectStore(VERSIONS_STORE).get(id);
        req.onerror = (): void => reject(req.error ?? new Error('getVersion failed'));
        req.onsuccess = (): void => {
          const row = req.result as VersionRow | undefined;
          if (!row || row.sectionKey !== sectionKey) {
            resolve(null);
            return;
          }
          const { sectionKey: _sk, ...v } = row;
          resolve(structuredClone(v));
        };
      });
    },

    async saveVersion(version: DocumentVersion): Promise<void> {
      if (typeof indexedDB === 'undefined') {
        console.warn('[compliance] IndexedDB unavailable; version not persisted');
        return;
      }
      const db = await openComplianceDb();
      const row: VersionRow = { ...structuredClone(version), sectionKey };
      return new Promise((resolve, reject) => {
        const tx = db.transaction(VERSIONS_STORE, 'readwrite');
        tx.objectStore(VERSIONS_STORE).put(row);
        tx.oncomplete = (): void => resolve();
        tx.onerror = (): void => reject(tx.error ?? new Error('saveVersion failed'));
      });
    },

    async deleteVersion(id: string): Promise<void> {
      if (typeof indexedDB === 'undefined') return;
      const db = await openComplianceDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(VERSIONS_STORE, 'readwrite');
        const store = tx.objectStore(VERSIONS_STORE);
        const getReq = store.get(id);
        getReq.onsuccess = (): void => {
          const row = getReq.result as VersionRow | undefined;
          if (row?.sectionKey === sectionKey) store.delete(id);
        };
        tx.oncomplete = (): void => resolve();
        tx.onerror = (): void => reject(tx.error ?? new Error('deleteVersion failed'));
      });
    },
  };
}
