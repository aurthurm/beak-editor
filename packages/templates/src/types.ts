/**
 * Public types for controlled templates, documents, lifecycles, composition and release.
 *
 * Units follow the schema package: points and twips internally.
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';
import type {
  BeakDocument,
  DocumentProperties,
  NumberingDefinitions,
  PageSetup,
  StyleSheet,
} from '@amusendame/beakblock-schema';

export type { Block, BeakDocument, DocumentProperties, NumberingDefinitions, PageSetup, StyleSheet };

/* -------------------------------------------------------------------------- */
/* Templates                                                                  */
/* -------------------------------------------------------------------------- */

/** Template lifecycle. Only `published` templates can be instantiated or composed. */
export type TemplateStatus = 'draft' | 'published' | 'retired';

/**
 * Rule for one document property (contract roadmap 5F placeholders table).
 *
 * - `generated`: the QMS service produces the value (for example the SOP number).
 * - `readOnly`: users cannot set the value after generation.
 * - `source: 'workflow'`: only the approval workflow may set the value (for example the effective date).
 */
export interface PropertyRule {
  required?: boolean;
  maxLength?: number;
  /** Regular expression source the value must match. */
  pattern?: string;
  generated?: boolean;
  readOnly?: boolean;
  source?: 'workflow' | 'author';
}

/** Rules keyed by document property name (`title`, `docNumber`, `effectiveDate`, ...). */
export type FieldRules = Record<string, PropertyRule>;

/** Page masters of a template. `landscape` is used by sections that set `pageMaster: 'landscape'`. */
export interface PageMasters {
  default: PageSetup;
  landscape?: PageSetup;
}

/** Default roles suggested for a section. */
export interface SectionDefaultRoles {
  author?: string;
  reviewer?: string;
  approver?: string;
}

/** One slot of a template (roadmap 5F, template authoring mode). */
export interface TemplateSectionDefinition {
  templateSectionId: string;
  title: string;
  required: boolean;
  /** `procedure` sections must contain at least one procedure step. */
  kind?: 'standard' | 'procedure';
  /** Boilerplate inserted as locked content. Hash-checked by validation. */
  lockedBoilerplate?: Block[];
  /** Block types that must appear among the section's direct children. */
  requiredBlocks?: string[];
  /** Block types the section may contain. `null` or undefined allows any type. */
  allowedBlocks?: string[] | null;
  defaultRoles: SectionDefaultRoles;
  /** Minimum number of non-placeholder direct children. */
  minBlocks?: number;
  /** Starter content the author replaces. Flagged as placeholders. */
  placeholder?: Block[];
  /** Page master for this section. Consecutive sections with the same master share a page setup. */
  pageMaster?: 'default' | 'landscape';
}

/** A controlled template. */
export interface TemplateDefinition {
  id: string;
  version: number;
  status: TemplateStatus;
  title: string;
  documentType: string;
  styles?: StyleSheet;
  numbering?: NumberingDefinitions;
  pageMasters: PageMasters;
  header?: Block[];
  footer?: Block[];
  properties: FieldRules;
  sections: TemplateSectionDefinition[];
  /** Watermark text for every rendition of documents built from this template. */
  watermark?: string;
  publishedAt?: string;
  /** Hash of the published content (set by `publishTemplate`). */
  contentHash?: string;
}

/** Owner of one section of a document instance. */
export interface SectionAssignment {
  ownerId: string;
  ownerName: string;
}

/** Assignments keyed by template section id. */
export type SectionAssignments = Record<string, SectionAssignment>;

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

/** A finding from `validateAgainstTemplate`. */
export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  sectionId?: string;
  templateSectionId?: string;
  blockId?: string;
}

/* -------------------------------------------------------------------------- */
/* Lifecycles                                                                 */
/* -------------------------------------------------------------------------- */

/** Section workflow states (roadmap 5F). */
export type SectionWorkflowState = 'draft' | 'submitted' | 'reviewed' | 'approved' | 'reopened';

/** Who performs a transition. */
export interface Actor {
  userId: string;
  displayName?: string;
  roles?: string[];
}

/** Audit record emitted for every transition. */
export interface TransitionAuditEvent {
  at: string;
  actor: Actor;
  from: string;
  to: string;
  sectionId: string;
  /** The event name that caused the transition. */
  event: string;
  comment?: string;
}

/** Workflow state of one section, with the people who moved it. */
export interface SectionLifecycle {
  sectionId: string;
  state: SectionWorkflowState;
  ownerId: string | null;
  submittedBy: string | null;
  reviewedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

/** Document lifecycle states (roadmap 5F). */
export type DocumentState =
  | 'draft'
  | 'review'
  | 'approved'
  | 'effective'
  | 'periodicReview'
  | 'superseded'
  | 'obsolete';

/** Workflow state of a whole document. */
export interface DocumentLifecycle {
  documentId: string;
  state: DocumentState;
  submittedBy: string | null;
  approvedBy: string | null;
  effectiveDate: string | null;
}

/** An immutable, approved revision of one section. */
export interface SectionRevision {
  sectionId: string;
  templateSectionId: string | null;
  revision: string;
  /** Hash of the section content (see `sectionContentHash`). */
  contentHash: string;
  blocks: Block[];
  approvedBy: string;
  approvedAt: string;
}

/** Reference to a pinned section revision in a manifest. */
export interface SectionRef {
  sectionId: string;
  templateSectionId?: string | null;
  revision: string;
  contentHash: string;
}

/* -------------------------------------------------------------------------- */
/* Composition and release                                                    */
/* -------------------------------------------------------------------------- */

/** A signature already produced by the signature service. */
export interface SignatureRecord {
  signatureId: string;
  role: string;
  signerName: string;
  signedAt: string;
  meaning: 'authored' | 'reviewed' | 'approved';
  contentHash: string;
}

/** The composed document plus its manifest draft (no signatures yet). */
export interface ManifestDraft {
  documentId: string;
  docNumber: string;
  revision: string;
  templateId: string;
  templateVersion: number;
  sections: SectionRef[];
}

/** A signature bound to a release (roadmap 5G). */
export interface ReleaseSignature {
  signatureId: string;
  signerId: string;
  meaning: 'authored' | 'reviewed' | 'approved';
  contentHash: string;
  at: string;
}

/** The release manifest: exact section revisions, the document hash and signatures. */
export interface ReleaseManifest {
  documentId: string;
  docNumber: string;
  revision: string;
  releasedAt: string;
  releasedBy: string;
  sections: SectionRef[];
  documentHash: string;
  renditionHash?: string;
  signatures: ReleaseSignature[];
}

/** One mismatch found by `verifyRelease`. */
export interface ReleaseMismatch {
  kind: 'document' | 'section' | 'signature' | 'rendition' | 'revision';
  sectionId?: string;
  signatureId?: string;
  expected: string;
  actual: string;
}
