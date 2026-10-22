/**
 * Transaction meta set by `BeakBlockEditor.setDocument`. It marks a whole-document load, not a
 * user edit. Plugins that guard edits (for example signature protection) may allow content that
 * was already saved, such as a signed block. Plugins must still verify the change on the server.
 *
 * @module
 */

/** Meta key set to `true` on whole-document loads. */
export const BEAKBLOCK_META_LOAD_DOCUMENT = 'beakblock-load-document';
