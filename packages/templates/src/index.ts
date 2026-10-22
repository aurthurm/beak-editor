/**
 * @amusendame/beakblock-templates
 *
 * Controlled templates for BeakBlock 2.0: template authoring and publication, instantiation with
 * section ownership, validation against the template, section and document lifecycles, the document
 * composer, release manifests with signatures bound to hashes, controlled-copy stamps and legacy
 * heading mapping.
 *
 * Client checks are feedback only. The server must verify every change with
 * `verifyDocumentChange` (permissions) and `validateAgainstTemplate`.
 *
 * @example
 * ```typescript
 * const tpl = await publishTemplate(createTemplate({ id: 'sop', title: 'SOP', documentType: 'SOP' }));
 * ```
 *
 * @module
 */

export type * from './types';

export { contentHash, sha256Hex, sectionContentHash } from './hash';
export { cloneDeep, cloneWithNewIds, deepFreeze, findBlocks, newId, paragraph, defaultHeaderBlocks, defaultFooterBlocks, fieldContent } from './blocks';

export {
  TemplateError,
  defaultFieldRules,
  createTemplate,
  addSection,
  updateSection,
  moveSection,
  removeSection,
  publishTemplate,
  createDraftFromPublished,
  templateFromDocument,
  flattenBlocks,
  controlledSectionsOf,
} from './authoring';
export type { CreateTemplateInput } from './authoring';

export { instantiateDocument, buildPolicyContext, OWNER_GRANTS, QUALITY_MANAGER_GRANTS } from './instantiate';
export type { InstantiateOptions } from './instantiate';

export { validateAgainstTemplate, validateProperties, DEFAULT_PROCEDURE_BLOCK_TYPES } from './validate';
export type { BlockValidator, ValidateOptions } from './validate';

export {
  LifecycleError,
  InvalidTransitionError,
  GuardViolationError,
  createSectionLifecycle,
  transitionSection,
  freezeSectionRevision,
  createDocumentLifecycle,
  transitionDocument,
} from './lifecycle';
export type { SectionEvent, DocumentEvent } from './lifecycle';

export { composeDocument, ComposeError } from './compose';
export type { ComposeOptions, ComposedDocument, GeneratedParts } from './compose';

export {
  createRelease,
  bindSignature,
  attachRendition,
  verifyRelease,
  documentHashOf,
  signatureInputFromRecord,
  SignatureBindingError,
} from './release';
export type { ReleaseOptions, SignatureInput } from './release';

export { stampControlledCopy, createPrintRegisterEntry, PrintError } from './print';
export type { ControlledPrintInput, ControlledPrintStamp, PrintRegisterEntry } from './print';

export { mapImportToTemplate, headingSimilarity, normaliseHeading } from './mapping';
export type { HeadingInput, SectionMappingSuggestion } from './mapping';
