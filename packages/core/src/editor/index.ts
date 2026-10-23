/**
 * Editor module for BeakBlock.
 *
 * @module
 */

export { BeakBlockEditor } from './Editor';
export type { SetDocumentOptions } from './Editor';
export { defaultConfig } from './EditorConfig';
export type {
  EditorConfig,
  EditorEvents,
  EventHandler,
  CollaborationConfig,
  CollaborationSyncConfig,
  CollaborationSyncSource,
  CollaborationDocLike,
  CollaborationFragmentLike,
  CollaborationMapLike,
  TrackChangesConfig,
  ReviewView,
} from './EditorConfig';
export { REVIEW_VIEWS, EDITOR_MODES } from './EditorConfig';
export type { ComplianceLockPluginOptions } from '../plugins/complianceLockPlugin';
