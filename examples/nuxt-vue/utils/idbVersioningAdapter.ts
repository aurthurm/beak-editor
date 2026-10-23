import type { DocumentVersion, VersioningAdapter } from '@amusendame/beakblock-core';

import { dbDelete, dbGet, dbGetAllByIndex, dbPut, VERSIONS_STORE } from './complianceDb';

type VersionRow = DocumentVersion & { sectionKey: string };

/**
 * Persists document versions per compliance section (IndexedDB when available, session memory otherwise).
 */
export function createIndexedDbVersioningAdapter(sectionKey: string): VersioningAdapter {
  return {
    async listVersions(): Promise<DocumentVersion[]> {
      const rows = await dbGetAllByIndex<VersionRow>(VERSIONS_STORE, 'sectionKey', sectionKey);
      const versions = rows.map(({ sectionKey: _sk, ...v }) => v);
      versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return versions;
    },

    async getVersion(id: string): Promise<DocumentVersion | null> {
      const row = await dbGet<VersionRow>(VERSIONS_STORE, id);
      if (!row || row.sectionKey !== sectionKey) return null;
      const { sectionKey: _sk, ...v } = row;
      return v;
    },

    async saveVersion(version: DocumentVersion): Promise<void> {
      const row: VersionRow = { ...version, sectionKey };
      await dbPut(VERSIONS_STORE, row);
    },

    async deleteVersion(id: string): Promise<void> {
      const row = await dbGet<VersionRow>(VERSIONS_STORE, id);
      if (row?.sectionKey === sectionKey) await dbDelete(VERSIONS_STORE, id);
    },
  };
}
