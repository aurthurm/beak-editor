/**
 * BeakBlock review: durable track changes, review operations, anchored comments, revision compare
 * and snapshot restore.
 *
 * @module
 */

export {
  insertionMarkSpec,
  deletionMarkSpec,
  REVISION_MARK_ATTRS,
} from './marks';

export type {
  RevisionKind,
  RevisionStatus,
  RevisionRecord,
  RevisionStore,
  CommentAnchor,
  CommentEntry,
  AnchoredComment,
  CommentThreadStore,
  NewCommentInput,
  ReplyInput,
  ReviewAuthor,
  ReviewView,
  RevisionStyleRef,
} from './types';

export {
  createRevisionTrackingPlugin,
  getReviewState,
  isTrackChangesEnabled,
  setTrackChangesEnabledTransaction,
  REVIEW_PLUGIN_KEY,
  REVIEW_META_SKIP,
  REVIEW_META_INTERNAL,
  REVIEW_META_SET_ENABLED,
} from './trackChanges';
export type { RevisionTrackingOptions, RevisionTrackingState } from './trackChanges';

export {
  acceptRevision,
  rejectRevision,
  acceptAll,
  rejectAll,
  listPendingRevisions,
  proposeChange,
} from './operations';
export type { ProposeChangeOptions, ProposedChange } from './operations';

export { applyTrackedChange } from './tracked';
export type { TrackedChangeOptions, TrackedChangeResult } from './tracked';

export { InMemoryRevisionStore, InMemoryCommentThreadStore, parseMentions } from './store';
export type { InMemoryCommentThreadStoreOptions } from './store';

export { createCommentAnchor, createCommentAnchorFromSelection, reanchorComments } from './comments';

export { setReviewView, getReviewView, projectBlocks, REVIEW_VIEWS, REVIEW_VIEW_CLASS_PREFIX } from './views';
export type { ReviewViewTarget } from './views';

export { compareRevisions, renderRedlineHTML, diffWords } from './compare';
export type {
  BlockDiff,
  BlockDiffStatus,
  CompareSummary,
  InlineSegment,
  RevisionComparison,
} from './compare';

export { restoreSnapshotPreservingRevisions } from './restore';
export type { DroppedRevision, SnapshotRestoreResult } from './restore';

export { reviewExtension } from './extension';
export type { ReviewExtension, ReviewExtensionContext } from './extension';
