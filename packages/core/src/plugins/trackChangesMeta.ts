/**
 * Transaction meta keys shared by the editor and plugins.
 *
 * @module
 */

/** When set, track-changes does not record decorations or log entries (e.g. setDocument / restore). */
export const BEAKBLOCK_META_SKIP_TRACK_CHANGES = 'beakblock:skipTrackChanges';

/** When set with {@link BEAKBLOCK_META_SKIP_TRACK_CHANGES}, drop the track-change log (full document replace). */
export const BEAKBLOCK_META_TRACK_CLEAR_LOG = 'beakblock:trackClearLog';
