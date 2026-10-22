/**
 * Canonical BeakDocument v2 types.
 *
 * Units: points (pt) and twips internally (1pt = 20 twips, 1in = 1440 twips).
 * Blocks are the core `Block` JSON, stored verbatim inside sections.
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';

export type { Block };

/* -------------------------------------------------------------------------- */
/* Paragraph and run properties                                               */
/* -------------------------------------------------------------------------- */

/** Horizontal paragraph alignment. */
export type Alignment = 'left' | 'center' | 'right' | 'justify';

/** Line spacing rule (OOXML `w:lineRule`). */
export type LineRule = 'auto' | 'exact' | 'atLeast';

/** Tab stop alignment. */
export type TabKind = 'left' | 'center' | 'right' | 'decimal';

/** Paragraph spacing. `line` is OOXML 240ths of a line for `auto` (240 = single), twips for `exact`/`atLeast`. */
export interface SpacingProps {
  beforePt: number;
  afterPt: number;
  line: number;
  lineRule: LineRule;
}

/** Paragraph indentation in points. */
export interface IndentProps {
  leftPt: number;
  hangingPt?: number;
  firstLinePt?: number;
}

/** A tab stop. */
export interface TabStop {
  posPt: number;
  kind: TabKind;
  leader?: 'dot' | 'none';
}

/** Reference to a numbering instance and a level within its abstract definition. */
export interface NumberingRef {
  numId: string;
  level: number;
}

/**
 * Paragraph properties (roadmap section 5A, contract section 1.1).
 *
 * Keys mirror the core paragraph/heading attrs; `align` is the IR name of the
 * core `textAlign` attr.
 */
export interface ParaProps {
  styleId?: string;
  numbering?: NumberingRef | null;
  spacing?: SpacingProps | null;
  indent?: IndentProps | null;
  align?: Alignment;
  keepNext?: boolean;
  keepLines?: boolean;
  pageBreakBefore?: boolean;
  widowControl?: boolean;
  tabs?: TabStop[] | null;
}

/** Vertical position of a run (superscript / subscript). */
export type VertAlign = 'superscript' | 'subscript' | 'baseline';

/**
 * Character (run) properties.
 *
 * `styleId` and `shading` are extensions beyond the contract's minimal list:
 * `styleId` names a character style (e.g. `Code`), `shading` is the hex
 * background used for `TextStyles.backgroundColor`.
 */
export interface RunProps {
  font?: string;
  sizePt?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  vertAlign?: VertAlign;
  color?: string;
  highlight?: string;
  /** Character style id (extension). */
  styleId?: string;
  /** Run background shading, hex (extension). */
  shading?: string;
}

/* -------------------------------------------------------------------------- */
/* Page setup                                                                 */
/* -------------------------------------------------------------------------- */

/** Named paper sizes. */
export type PageSizeName = 'A4' | 'Letter' | 'Legal' | 'A3';

/** Page dimensions in twips. */
export interface PageSize {
  widthTwips: number;
  heightTwips: number;
}

/** Page margins in twips. */
export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
  header: number;
  footer: number;
  gutter: number;
}

/** Column layout for a section. */
export interface PageColumns {
  count: number;
  spaceTwips: number;
}

/** Page setup for a section. */
export interface PageSetup {
  size: PageSize;
  orientation: 'portrait' | 'landscape';
  margins: PageMargins;
  columns?: PageColumns;
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

/** Border definition for table styles. */
export interface BorderSpec {
  style: 'single' | 'double' | 'dashed' | 'dotted' | 'none';
  sizePt: number;
  color: string;
}

/** A paragraph style, optionally inheriting from another paragraph style. */
export interface ParagraphStyle {
  id: string;
  name: string;
  basedOn?: string | null;
  /** Style applied to the next paragraph when Enter is pressed. */
  next?: string;
  paraProps?: ParaProps;
  runProps?: RunProps;
  /** 0-based outline level (0 = Heading 1 equivalent). */
  outlineLevel?: number;
}

/** A character style. */
export interface CharacterStyle {
  id: string;
  name: string;
  basedOn?: string | null;
  runProps?: RunProps;
}

/** Table cell edges. */
export type TableEdge = 'top' | 'right' | 'bottom' | 'left' | 'insideH' | 'insideV';

/** Conditional table formatting parts. */
export type TableConditionalPart = 'firstRow' | 'lastRow' | 'firstColumn' | 'band1Horz';

/** A table style. */
export interface TableStyle {
  id: string;
  name: string;
  basedOn?: string | null;
  borders?: Partial<Record<TableEdge, BorderSpec | null>>;
  cellPaddingPt?: { top?: number; right?: number; bottom?: number; left?: number };
  paraProps?: ParaProps;
  runProps?: RunProps;
  conditional?: Partial<Record<TableConditionalPart, { shading?: string; runProps?: RunProps }>>;
}

/** Document style sheet. */
export interface StyleSheet {
  paragraph: Record<string, ParagraphStyle>;
  character: Record<string, CharacterStyle>;
  table: Record<string, TableStyle>;
}

/* -------------------------------------------------------------------------- */
/* Numbering                                                                  */
/* -------------------------------------------------------------------------- */

/** Number format of a numbering level. */
export type NumberFormat =
  | 'decimal'
  | 'lowerLetter'
  | 'upperLetter'
  | 'lowerRoman'
  | 'upperRoman'
  | 'bullet'
  | 'none';

/**
 * One level of an abstract numbering definition.
 *
 * `text` is a level text pattern such as `"%1.%2."`: `%n` is replaced by the
 * current counter of level n-1 (0-based level n-1). For bullets it is the glyph.
 */
export interface NumberingLevel {
  level: number;
  format: NumberFormat;
  text: string;
  start: number;
  indent?: { leftPt: number; hangingPt?: number };
  /** Paragraph style linked to this level (e.g. `Heading2`). */
  paraStyleId?: string;
  runProps?: RunProps;
}

/** Abstract (multilevel) numbering definition. */
export interface AbstractNumbering {
  id: string;
  name?: string;
  multiLevelType: 'singleLevel' | 'multilevel' | 'hybridMultilevel';
  levels: NumberingLevel[];
}

/** Concrete numbering instance (`numId`) referring to an abstract definition. */
export interface NumberingInstance {
  abstractId: string;
  overrides?: Record<number, { startOverride?: number }>;
}

/** All numbering definitions of a document. */
export interface NumberingDefinitions {
  abstract: Record<string, AbstractNumbering>;
  instances: Record<string, NumberingInstance>;
}

/* -------------------------------------------------------------------------- */
/* Document                                                                   */
/* -------------------------------------------------------------------------- */

/** Document-level metadata, surfaced by DOCPROPERTY fields. */
export interface DocumentProperties {
  title?: string;
  docNumber?: string;
  revision?: string;
  effectiveDate?: string;
  owner?: string;
  lab?: string;
  language?: string;
  custom?: Record<string, string>;
}

/** Header or footer block sets by page kind. */
export interface HeaderFooterSet {
  default?: Block[];
  first?: Block[];
  even?: Block[];
}

/** A section: a run of blocks sharing one page setup. */
export interface DocumentSection {
  id: string;
  pageSetup: PageSetup;
  headers?: HeaderFooterSet;
  footers?: HeaderFooterSet;
  titlePage?: boolean;
  /** Core block JSON. Controlled sections are `controlledSection` blocks. */
  blocks: Block[];
}

/** The canonical document (schema version 2). */
export interface BeakDocument {
  schemaVersion: 2;
  id: string;
  properties: DocumentProperties;
  styles: StyleSheet;
  numbering: NumberingDefinitions;
  sections: DocumentSection[];
}

/** Field types supported by the `field` inline node. */
export type FieldType = 'PAGE' | 'NUMPAGES' | 'DOCPROPERTY' | 'REF' | 'SEQ' | 'LIMS' | 'DATE';

/** A structural problem found by {@link validateDocumentStructure}. */
export interface DocumentIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  sectionId?: string;
  blockId?: string;
  path?: string;
}
