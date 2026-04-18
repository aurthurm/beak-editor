/**
 * Meta for resolving (accepting / rejecting) a single pending track change.
 * Dispatched together with {@link BEAKBLOCK_META_SKIP_TRACK_CHANGES} when the document is modified.
 *
 * @module
 */

/** Remove a track-change record after accept/reject handling (decorations rebuild from remaining log). */
export const BEAKBLOCK_META_TRACK_REMOVE = 'beakblock:trackRemoveId';
