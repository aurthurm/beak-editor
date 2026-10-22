/**
 * Public types and meta keys for the QMS block family.
 *
 * Authorization data never lives in the document. The attributes here describe
 * presentation and workflow state only; the server decides what a user may do.
 *
 * @module
 */

import type { PolicyContext, PolicyDecision } from '@amusendame/beakblock-permissions';
import type { EditorState, Transaction } from 'prosemirror-state';

/** Node type of a controlled section (re-declared here so callers need one import). */
export const CONTROLLED_SECTION_TYPE = 'controlledSection';

/** Workflow states of a controlled section (section lifecycle, roadmap 5F). */
export const WORKFLOW_STATES = ['draft', 'submitted', 'reviewed', 'approved', 'reopened'] as const;
export type WorkflowState = (typeof WORKFLOW_STATES)[number];

/** Meaning of an electronic signature. */
export const SIGNATURE_MEANINGS = ['authored', 'reviewed', 'approved'] as const;
export type SignatureMeaning = (typeof SIGNATURE_MEANINGS)[number];

/** Kinds of controlled notice. */
export const NOTICE_KINDS = ['uncontrolledWhenPrinted', 'controlledCopy', 'draft', 'superseded'] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

/** Attributes of a `controlledSection` node. Contract section 7. */
export interface ControlledSectionAttrs {
  id: string | null;
  sectionId: string | null;
  templateSectionId: string | null;
  policyRef: string | null;
  required: boolean;
  allowedBlocks: string[] | null;
  title: string;
  ownerName: string | null;
  workflowState: WorkflowState;
  /** Presentation only. Anyone may toggle it; it is not authorization. */
  locked: boolean;
}

/** Attributes of a `signatureBlock` atom. Written only by the signature service. */
export interface SignatureBlockAttrs {
  id: string | null;
  role: string;
  signerName: string | null;
  signedAt: string | null;
  meaning: SignatureMeaning;
  contentHash: string | null;
  signatureId: string | null;
}

/** One approver row of an `approvalBlock`. */
export interface ApprovalEntry {
  role: string;
  name: string | null;
  signedAt?: string | null;
  signatureId?: string | null;
}

/** Attributes of an `approvalBlock` atom. */
export interface ApprovalBlockAttrs {
  id: string | null;
  approvers: ApprovalEntry[];
}

/** One row of a `revisionHistory` atom. */
export interface RevisionHistoryEntry {
  revision: string;
  date: string;
  author: string;
  description: string;
}

/** Attributes of a `revisionHistory` atom. */
export interface RevisionHistoryAttrs {
  id: string | null;
  entries: RevisionHistoryEntry[];
}

/** Attributes of a `controlledNotice` atom. */
export interface ControlledNoticeAttrs {
  id: string | null;
  kind: NoticeKind;
  copyNumber: number | null;
}

/** Attributes of an `acknowledgement` atom. */
export interface AcknowledgementAttrs {
  id: string | null;
  statement: string;
  required: boolean;
}

/** Attributes of a `documentIdentifier` inline atom. */
export interface DocumentIdentifierAttrs {
  id: string | null;
  property: 'docNumber' | 'revision' | 'docNumberRevision';
  fallback: string | null;
}

/**
 * Transaction meta set by the QMS service. Bypasses the section-protection checks
 * (protected attributes, deletion of required sections). Never honoured for signatures.
 */
export const QMS_SERVICE_META = 'beakblock-qms-service';

/** Transaction meta set by the signature service. The only way to change a signature block. */
export const SIGNATURE_SERVICE_META = 'beakblock-signature-service';

/**
 * Transaction meta set by the workflow commands (`qms.submitSection`). Allows a
 * `workflowState` change only. The server re-verifies every transition.
 */
export const QMS_WORKFLOW_META = 'beakblock-qms-workflow';

/** Options accepted by the controlled-section plugin and the QMS extension. */
export interface ControlledSectionPluginOptions {
  /**
   * Principal and grants for the current state. When given, the permission guard
   * composes in (UX only) and read-only sections are decorated.
   */
  getPolicyContext?: (state: EditorState) => PolicyContext;
  /** Called with the denied decisions (and the rejected transaction) when a change is refused. */
  onDenied?: (decisions: PolicyDecision[], tr: Transaction) => void;
  /** Reject blocks whose type is not in the section's `allowedBlocks`. Default true. */
  enforceAllowedBlocks?: boolean;
}

/** Options for {@link qmsExtension}. */
export interface QmsExtensionOptions extends ControlledSectionPluginOptions {
  /** Inject the QMS stylesheet when the extension is created. Default true. */
  injectStyles?: boolean;
}
