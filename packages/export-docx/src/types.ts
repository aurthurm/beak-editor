/**
 * Public and internal types for the DOCX writer.
 *
 * Document property types are derived from the IR so that this package does
 * not need a direct dependency on `@amusendame/beakblock-schema`.
 *
 * @module
 */

import type { IRDocument, IRParagraph, IRRun, IRSection } from '@amusendame/beakblock-ir';

/** Paragraph properties (IR form). */
export type ParaProps = IRParagraph['props'];
/** Character properties (IR form). */
export type RunProps = IRRun['props'];
/** Style sheet (IR form). */
export type StyleSheet = IRDocument['styles'];
/** Numbering definitions (IR form). */
export type NumberingDefinitions = IRDocument['numbering'];
/** Numbering level (IR form). */
export type NumberingLevel = NumberingDefinitions['abstract'][string]['levels'][number];
/** Page setup of a section (IR form). */
export type PageSetup = IRSection['pageSetup'];
/** Document properties (IR form). */
export type DocumentProperties = IRDocument['properties'];
/** Paragraph style (IR form). */
export type ParagraphStyle = StyleSheet['paragraph'][string];
/** Table style (IR form). */
export type TableStyle = StyleSheet['table'][string];
/** Border specification of a table style. */
export type BorderSpec = NonNullable<NonNullable<TableStyle['borders']>[keyof NonNullable<TableStyle['borders']>]>;

/**
 * Stable codes for everything the writer could not represent exactly.
 *
 * - `image-remote`: a remote image URL was skipped (only data URIs are embedded).
 * - `image-invalid`: a data URI could not be decoded.
 * - `image-unsupported`: the image type has no OOXML mapping here (png, jpeg, gif only).
 * - `passthrough-invalid`: a passthrough XML fragment was not well formed; a placeholder was written.
 * - `footnote-unsupported`: a footnote reference was dropped (no footnotes part yet).
 * - `field-target-missing`: a REF field points at a block id that has no bookmark in the document.
 * - `unknown-numbering`: a paragraph references a numbering instance that is not defined.
 * - `empty-table`: a table had no rows and was omitted.
 * - `inline-degraded`: a custom inline node was written as its plain-text fallback (info level).
 * - `unknown-block`: an unregistered block type was written as its text only; its props were not exported (info level).
 */
export type ExportLossCode =
  | 'image-remote'
  | 'image-invalid'
  | 'image-unsupported'
  | 'passthrough-invalid'
  | 'footnote-unsupported'
  | 'field-target-missing'
  | 'inline-degraded'
  | 'unknown-numbering'
  | 'unknown-block'
  | 'empty-table';

/** One thing the export could not represent exactly. */
export interface ExportLoss {
  code: ExportLossCode;
  message: string;
  blockId?: string;
  /** `info` for a degraded but present rendering; absent means a warning. */
  severity?: 'info' | 'warning';
}

/** Result of {@link exportDocxWithReport}. */
export interface ExportReport {
  losses: ExportLoss[];
}

/** Options for the DOCX writer. */
export interface ExportDocxOptions {
  /**
   * Font name replacements applied to every font reference. Merged over
   * {@link DEFAULT_FONT_MAP}; pass `{}` to keep the bundled names.
   */
  fontMap?: Record<string, string>;
  /**
   * ISO 8601 timestamp written to `dcterms:created` and `dcterms:modified`.
   * Defaults to a fixed epoch so that exports are byte-for-byte reproducible.
   */
  created?: string;
}

/** Metric-compatible font names mapped to their Office equivalents (ADR-6). */
export const DEFAULT_FONT_MAP: Readonly<Record<string, string>> = {
  Carlito: 'Calibri',
  Caladea: 'Cambria',
  'Liberation Sans': 'Arial',
  'Liberation Serif': 'Times New Roman',
  'Liberation Mono': 'Courier New',
};

/** MIME type of a `.docx` file. */
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
