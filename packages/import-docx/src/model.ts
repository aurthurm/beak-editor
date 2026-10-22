/**
 * Model types used by the importer.
 *
 * Derived from `@amusendame/beakblock-ir` so that this package does not need a
 * direct dependency on `@amusendame/beakblock-schema`.
 *
 * @module
 */

import type { IRDocument, IRInline, IRParagraph, IRSection, IRTable } from '@amusendame/beakblock-ir';

/** Paragraph properties (IR `ParaProps`). */
export type ParaProps = IRParagraph['props'];
/** Character properties (IR `RunProps`). */
export type RunProps = Extract<IRInline, { type: 'run' }>['props'];
/** Page setup of a section. */
export type PageSetup = IRSection['pageSetup'];
/** Document style sheet. */
export type StyleSheet = IRDocument['styles'];
/** Numbering definitions. */
export type NumberingDefinitions = IRDocument['numbering'];
/** Document properties. */
export type DocumentProperties = IRDocument['properties'];
/** Paragraph style entry. */
export type ParagraphStyle = StyleSheet['paragraph'][string];
/** Character style entry. */
export type CharacterStyle = StyleSheet['character'][string];
/** Table style entry. */
export type TableStyle = StyleSheet['table'][string];
/** Abstract numbering definition. */
export type AbstractNumbering = NumberingDefinitions['abstract'][string];
/** Numbering level. */
export type NumberingLevel = AbstractNumbering['levels'][number];
/** Tab stop. */
export type TabStop = NonNullable<ParaProps['tabs']>[number];
/** Numbering reference of a paragraph. */
export type NumberingRef = NonNullable<ParaProps['numbering']>;

/** Table edge names used by table style borders. */
export type TableEdge = 'top' | 'right' | 'bottom' | 'left' | 'insideH' | 'insideV';

/** Border spec used by table styles and cell borders. */
export type BorderSpec = NonNullable<NonNullable<TableStyle['borders']>['top']>;
/** Cell border set. */
export type CellBorders = { top: BorderSpec | null; right: BorderSpec | null; bottom: BorderSpec | null; left: BorderSpec | null };
/** Table properties. */
export type TableProps = IRTable['props'];
/** Table look flags. */
export type TableLook = NonNullable<TableProps['look']>;
/** Block-level IR element (union). */
export type IRBlockOf = IRDocument['sections'][number]['body'][number];
