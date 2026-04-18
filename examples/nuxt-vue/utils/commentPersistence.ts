import type { CommentEntry, CommentThread } from '@aurthurm/beakblock-core';
import { COMMENTS_STORE, openComplianceDb } from './complianceDb';

function reviveEntry(raw: CommentEntry): CommentEntry {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
    deletedAt: raw.deletedAt ? new Date(raw.deletedAt) : undefined,
    reactions: raw.reactions.map((r) => ({
      ...r,
      createdAt: new Date(r.createdAt),
    })),
  };
}

function reviveThread(raw: CommentThread): CommentThread {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
    resolvedAt: raw.resolvedAt ? new Date(raw.resolvedAt) : undefined,
    deletedAt: raw.deletedAt ? new Date(raw.deletedAt) : undefined,
    comments: raw.comments.map(reviveEntry),
  };
}

export async function loadSectionComments(sectionKey: string): Promise<CommentThread[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openComplianceDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(COMMENTS_STORE, 'readonly');
      const req = tx.objectStore(COMMENTS_STORE).get(sectionKey);
      req.onerror = (): void => reject(req.error ?? new Error('load comments failed'));
      req.onsuccess = (): void => {
        const row = req.result as { sectionKey: string; payload: string } | undefined;
        if (!row?.payload) {
          resolve([]);
          return;
        }
        try {
          const parsed = JSON.parse(row.payload) as CommentThread[];
          resolve(parsed.map(reviveThread));
        } catch {
          resolve([]);
        }
      };
    });
  } catch {
    return [];
  }
}

export async function saveSectionComments(sectionKey: string, threads: CommentThread[]): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openComplianceDb();
  const payload = JSON.stringify(threads);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COMMENTS_STORE, 'readwrite');
    tx.objectStore(COMMENTS_STORE).put({ sectionKey, payload });
    tx.oncomplete = (): void => resolve();
    tx.onerror = (): void => reject(tx.error ?? new Error('save comments failed'));
  });
}
