import type { CommentThread } from '@aurthurm/beakblock-core';

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
