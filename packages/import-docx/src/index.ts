/**
 * @amusendame/beakblock-import-docx
 *
 * DOCX (OOXML) to BeakDoc IR importer. Unsupported Word content is preserved as
 * `ooxmlPassthrough` blocks and reported as losses.
 *
 * @example
 * ```typescript
 * import { importDocx, ooxmlPassthroughExtension, detectHeadings } from '@amusendame/beakblock-import-docx';
 *
 * const { ir, losses } = await importDocx(bytes);
 * const headings = detectHeadings(ir);
 * ```
 *
 * @module
 */

export { importDocx, importDocxToDocument } from './importDocx';
export type { ImportDocxOptions, ImportDocxResult, ImportDocxToDocumentResult } from './importDocx';

export { LOSS_CODES } from './losses';
export type { LossCode, LossReport, LossSeverity } from './losses';

export { ooxmlPassthroughExtension, ooxmlPassthroughBlockDefinition, OOXML_PASSTHROUGH_NODE_SPEC } from './passthrough';

export { detectHeadings, SOP_SECTION_SYNONYMS } from './headings';
export type { HeadingCandidate } from './headings';

export type { DomParserLike } from './dom';
