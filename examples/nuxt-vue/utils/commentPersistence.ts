import type { CommentEntry, CommentThread } from '@amusendame/beakblock-core';
import { COMMENTS_STORE, dbGet, dbPut } from './complianceDb';

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
  const row = await dbGet<{ sectionKey: string; payload: string }>(COMMENTS_STORE, sectionKey);
  if (!row?.payload) return [];
  try {
    const parsed = JSON.parse(row.payload) as CommentThread[];
    return parsed.map(reviveThread);
  } catch {
    return [];
  }
}

export async function saveSectionComments(sectionKey: string, threads: CommentThread[]): Promise<void> {
  await dbPut(COMMENTS_STORE, { sectionKey, payload: JSON.stringify(threads) });
}
