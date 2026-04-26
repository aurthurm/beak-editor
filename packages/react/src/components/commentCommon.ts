import type { CommentThread } from '@amusendame/beakblock-core';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉'];

export function formatCommentDate(date: Date | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function threadRangeLabel(thread: CommentThread): string {
  return `Range ${thread.from} - ${thread.to}`;
}

/** Compliance / audit fields stored on thread metadata (optional). */
export function threadAuditMetaLine(thread: CommentThread): string | null {
  const m = thread.metadata;
  if (!m) return null;
  const ck = m.raisedAgainstCheckpointId;
  const sid = m.complianceSectionId;
  const parts: string[] = [];
  if (ck != null && String(ck).length > 0) parts.push(`Checkpoint: ${String(ck)}`);
  if (sid != null && String(sid).length > 0) parts.push(`Section: ${String(sid)}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}
