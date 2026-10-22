/**
 * @amusendame/beakblock-blocks-qms
 *
 * QMS control blocks for BeakBlock 2.0: controlled sections (content controls with
 * workflow state and allowed blocks), signature placeholders written only by the signature
 * service, approval tables, revision history, controlled notices and acknowledgements.
 *
 * Client-side protection is UX and early rejection. The server must run
 * `verifyDocumentChange` from `@amusendame/beakblock-permissions` on every submitted document.
 *
 * @example
 * ```typescript
 * import { qmsExtension, createQmsCommands } from '@amusendame/beakblock-blocks-qms';
 *
 * const editor = new BeakBlockEditor({
 *   element,
 *   mode: 'controlled',
 *   extensions: [qmsExtension({ getPolicyContext })],
 * });
 * registry.register(createQmsCommands());
 * ```
 *
 * @module
 */

export { qmsExtension } from './extension';

export {
  createControlledSectionPlugin,
  checkControlledSectionChange,
  canEditControlledSection,
  CONTROLLED_SECTION_PLUGIN_KEY,
} from './plugin';

export {
  controlledSectionNode,
  signatureBlockNode,
  approvalBlockNode,
  revisionHistoryNode,
  controlledNoticeNode,
  acknowledgementNode,
  documentIdentifierNode,
  QMS_NODE_SPECS,
} from './nodes';

export {
  ControlledSectionView,
  qmsNodeViews,
  noticeText,
  WORKFLOW_STATE_LABELS,
} from './nodeViews';

export {
  qmsBlockDefinitions,
  renderQmsPrint,
  validateControlledSection,
  validateSignatureBlock,
  validateControlledNotice,
  escapeHtml,
} from './blockDefinitions';

export { createQmsCommands, findControlledSection, newQmsId } from './commands';
export type {
  QmsCommandContext,
  QmsCommandDefinition,
  QmsCommandEditor,
  InsertSectionArgs,
  InsertSignatureArgs,
  InsertNoticeArgs,
  InsertRevisionHistoryArgs,
} from './commands';

export { qmsStyles, injectQmsStyles, QMS_STYLE_ELEMENT_ID } from './styles';

export {
  CONTROLLED_SECTION_TYPE,
  WORKFLOW_STATES,
  SIGNATURE_MEANINGS,
  NOTICE_KINDS,
  QMS_SERVICE_META,
  SIGNATURE_SERVICE_META,
  QMS_WORKFLOW_META,
} from './types';
export type {
  ControlledSectionAttrs,
  ControlledSectionPluginOptions,
  AcknowledgementAttrs,
  ApprovalBlockAttrs,
  ApprovalEntry,
  ControlledNoticeAttrs,
  DocumentIdentifierAttrs,
  NoticeKind,
  QmsExtensionOptions,
  RevisionHistoryAttrs,
  RevisionHistoryEntry,
  SignatureBlockAttrs,
  SignatureMeaning,
  WorkflowState,
} from './types';
