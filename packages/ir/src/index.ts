/**
 * @amusendame/beakblock-ir
 *
 * BeakDoc IR: an OOXML-shaped intermediate representation of a BeakBlock
 * document (styles, numbering, sections, fields, tables). Every exporter
 * (DOCX, PDF, layout) reads this IR; {@link irToDocument} restores the canonical
 * document losslessly.
 *
 * @example
 * ```typescript
 * import { documentToIR, irToDocument, validateIR } from '@amusendame/beakblock-ir';
 *
 * const ir = documentToIR(doc);
 * const issues = validateIR(ir);
 * const same = irToDocument(ir);
 * ```
 *
 * @module
 */

export type {
  IRBlock,
  IRBreak,
  IRCustomInline,
  IRDocument,
  IRField,
  IRFootnoteRef,
  IRHeaderFooterSet,
  IRIcon,
  IRImageBlock,
  IRInline,
  IRInlineImage,
  IRIssue,
  IRLink,
  IRListMembership,
  IRParagraph,
  IRPassthrough,
  IRRevision,
  IRRun,
  IRSdt,
  IRSection,
  IRSource,
  IRTable,
  IRTableCell,
  IRTableLook,
  IRTableRow,
} from './types';
export { IR_VERSION, MAX_NUMBERING_LEVEL } from './types';
export type { IRWarning } from './types';

export { fieldInstruction } from './fieldInstr';

export { documentToIR, blocksToIR } from './fromDocument';
export type { BlockRegistryEntryLike, BlockRegistryLike, DocumentToIROptions } from './fromDocument';

export { irToDocument, runsToInline, runPropsToStyles, reverseBlocks } from './toDocument';
export type { IRToDocumentOptions } from './toDocument';

export { validateIR } from './validate';
