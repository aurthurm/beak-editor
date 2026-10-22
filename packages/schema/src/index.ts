/**
 * @amusendame/beakblock-schema
 *
 * Versioned canonical document schema (v2), style sheet, numbering definitions,
 * page setup, and the migration path from the legacy `Block[]` format.
 *
 * @example
 * ```typescript
 * import { migrateDocument, documentToBlocks } from '@amusendame/beakblock-schema';
 *
 * const doc = migrateDocument(legacyBlocks);
 * const blocks = documentToBlocks(doc);
 * ```
 *
 * @module
 */

export type {
  Alignment,
  AbstractNumbering,
  BeakDocument,
  BorderSpec,
  Block,
  CharacterStyle,
  DocumentIssue,
  DocumentProperties,
  DocumentSection,
  FieldType,
  HeaderFooterSet,
  IndentProps,
  LineRule,
  NumberFormat,
  NumberingDefinitions,
  NumberingInstance,
  NumberingLevel,
  NumberingRef,
  PageColumns,
  PageMargins,
  PageSetup,
  PageSize,
  PageSizeName,
  ParaProps,
  ParagraphStyle,
  RunProps,
  SpacingProps,
  StyleSheet,
  TabKind,
  TabStop,
  TableConditionalPart,
  TableEdge,
  TableStyle,
  VertAlign,
} from './types';

export {
  TWIPS_PER_PT,
  TWIPS_PER_INCH,
  TWIPS_PER_PX,
  ptToTwips,
  twipsToPt,
  twipsToPx,
  pxToTwips,
  mmToTwips,
} from './units';

export {
  PAGE_SIZES,
  DEFAULT_MARGINS_TWIPS,
  createPageSetup,
  createDefaultPageSetup,
} from './page';
export type { PageSetupOptions } from './page';

export {
  FONTS,
  FONT_FALLBACKS,
  fontStack,
  createDefaultStyleSheet,
  resolveParagraphStyle,
} from './styles';
export type { ResolvedParagraphStyle } from './styles';

export { NUMBERING_IDS, ABSTRACT_NUMBERING_IDS, createDefaultNumbering } from './numbering';

export {
  SINGLE_LINE_240THS,
  LEGACY_LINE_MULTIPLIER_MAX,
  normalizeLineSpacing,
  normalizeStyleSheet,
} from './spacing';

export {
  CURRENT_SCHEMA_VERSION,
  blocksToDocument,
  documentToBlocks,
  validateDocumentStructure,
  createId,
  cloneValue,
} from './document';
export type { BlocksToDocumentOptions } from './document';

export {
  MigrationRegistry,
  createDefaultMigrationRegistry,
  defaultMigrations,
  migrateDocument,
} from './migrations';
export type { LegacyDocumentV1, MigrationRegistryOptions, MigrationStep } from './migrations';

export { richSopBlocks, richSopBlocksWithSections } from './__fixtures__/richDocument';
export * as fixtures from './__fixtures__/richDocument';
