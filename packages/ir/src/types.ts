/**
 * BeakDoc IR types (contract section 6).
 *
 * The IR is OOXML-shaped: lists are paragraphs with `numbering`, headings are
 * paragraphs with a `styleId`, tables carry a grid in twips, and controlled
 * sections are structured document tags (`sdt`). Every IR block carries an
 * {@link IRSource} so that {@link irToDocument} can rebuild the original block
 * JSON exactly.
 *
 * Extensions beyond the contract are marked `extension` in JSDoc. They are all
 * optional fields or additional inline variants, so contract consumers keep working.
 *
 * @module
 */

import type {
  BeakDocument,
  DocumentProperties,
  FieldType,
  NumberingDefinitions,
  PageSetup,
  ParaProps,
  RunProps,
  StyleSheet,
} from '@amusendame/beakblock-schema';

/** IR format version written by this package. */
export const IR_VERSION = 1 as const;

/** Highest numbering level defined by OOXML lists (levels 0 to 8, nine levels). */
export const MAX_NUMBERING_LEVEL = 8;

/** A non-fatal issue found while converting to the IR. */
export interface IRWarning {
  code: 'list-depth-clamped';
  message: string;
  /** Id of the list item block the warning concerns. */
  blockId: string;
  /** Nesting depth of the item (0 is top level). */
  depth: number;
  /** Numbering level written to the IR (clamped). */
  numberingLevel: number;
}

/** Membership of a block in a list, or of a block nested inside a list item. */
export interface IRListMembership {
  /** `item`: the block is a list item. `childBlock`: a non-list block inside a list item. */
  role: 'item' | 'childBlock';
  /** Id of the owning list container (items only). */
  containerId?: string;
  /** Type of the owning list container (items only). */
  containerType?: 'bulletList' | 'orderedList' | 'checkList';
  /** Props of the owning list container, restored on reconstruction (items only). */
  containerProps?: Record<string, unknown>;
  /** Nesting depth; 0 is top level. */
  level: number;
}

/**
 * Provenance of an IR block (contract section 6, `IRSource`).
 *
 * `props` is a full copy of the original block props. `list` and `raw` are
 * extensions: `list` records list membership, `raw` keeps the original content
 * and children of block types that have no IR representation (unknown types).
 */
export interface IRSource {
  blockType: string;
  blockId: string;
  props?: Record<string, unknown>;
  /** Extension: list membership of this block. */
  list?: IRListMembership;
  /** Extension: original content/children kept verbatim for opaque block types. */
  raw?: { content?: unknown[]; children?: unknown[] };
}

/** Table cell and row level look flags. */
export interface IRTableLook {
  headerRow?: boolean;
  bandedRows?: boolean;
  firstColumn?: boolean;
  lastRow?: boolean;
}

/** IR block types. */
export type IRBlock = IRParagraph | IRTable | IRSdt | IRPassthrough | IRImageBlock;

/** A paragraph (also used for list items, headings, quotes, code and other text blocks). */
export interface IRParagraph {
  type: 'paragraph';
  props: ParaProps;
  runs: IRInline[];
  source?: IRSource;
}

/** A table. Column widths are `grid` in twips. */
export interface IRTable {
  type: 'table';
  /**
   * Table properties. `widthMode` is optional here (contract: required) so that
   * absence round-trips; consumers treat a missing `widthMode` as `'auto'`.
   */
  props: {
    styleId?: string;
    widthMode?: 'auto' | 'fixed' | 'pct';
    widthValue?: number | null;
    look?: IRTableLook;
  };
  grid: number[];
  rows: IRTableRow[];
  source?: IRSource;
}

/** A table row. */
export interface IRTableRow {
  props: { isHeader?: boolean; cantSplit?: boolean; heightTwips?: number | null; id?: string };
  cells: IRTableCell[];
  source?: IRSource;
}

/**
 * A table cell. A cell with `vMerge: 'continue'` is a placeholder covering a
 * grid column already spanned by a restart cell above; it has no source.
 */
export interface IRTableCell {
  props: {
    gridSpan: number;
    vMerge?: 'restart' | 'continue';
    borders?: Record<string, unknown> | null;
    shading?: string;
    vAlign?: 'top' | 'center' | 'bottom';
    widthTwips?: number;
    id?: string;
  };
  blocks: IRBlock[];
  source?: IRSource;
}

/** A structured document tag, used for controlled sections. `tag` is the section id. */
export interface IRSdt {
  type: 'sdt';
  tag: string;
  alias?: string;
  lock?: 'sdtLocked' | 'contentLocked' | 'sdtContentLocked' | null;
  blocks: IRBlock[];
  source?: IRSource;
}

/** Opaque XML preserved verbatim (for example DOCX parts the editor cannot model). */
export interface IRPassthrough {
  type: 'passthrough';
  xml: string;
  preview?: string;
  source?: IRSource;
}

/** A block-level image. `widthPt` is derived from the core `width` in pixels. */
export interface IRImageBlock {
  type: 'image';
  src: string;
  widthPt?: number;
  heightPt?: number;
  alt?: string;
  source?: IRSource;
}

/** Revision mark on a run. */
export interface IRRevision {
  kind: 'insert' | 'delete';
  id: string;
  /** Display name of the author (core `authorName`). */
  author?: string;
  /** Extension: author id (core `authorId`). */
  authorId?: string;
  at: string;
  /** Extension: whether the change was proposed by AI. */
  aiGenerated?: boolean;
}

/** Hyperlink on a run. Consecutive runs with equal links form one core link. */
export interface IRLink {
  href: string;
  title?: string;
  target?: '_blank' | '_self';
}

/**
 * Extension: a custom inline node from a core extension (footnote, cross reference,
 * inline equation, variable, document identifier, or a type nobody registered).
 *
 * `props` and `content` are kept so the node is rebuilt exactly. `text` is a
 * plain-text fallback for exporters that cannot render `inlineType`.
 */
export interface IRCustomInline {
  type: 'custom';
  inlineType: string;
  props: Record<string, unknown>;
  text: string;
  /** Inline children, present when the node has inline content (absent for atoms). */
  content?: IRInline[];
}

/** Inline content of a paragraph. */
export type IRInline = IRRun | IRField | IRBreak | IRInlineImage | IRFootnoteRef | IRIcon | IRCustomInline;

/** A run of text with character properties. */
export interface IRRun {
  type: 'run';
  text: string;
  props: RunProps;
  revision?: IRRevision;
  /** Extension: hyperlink target. */
  link?: IRLink;
}

/**
 * A field. `instr` is the OOXML field instruction; `cachedText` is the value shown
 * until a layout or resolver pass recomputes it.
 */
export interface IRField {
  type: 'field';
  fieldType: FieldType | 'TOC';
  instr: string;
  name?: string | null;
  cachedText: string;
  /** Extension: format switch value. */
  format?: string | null;
  /** Extension: fallback text (core `fallback`). */
  fallback?: string | null;
}

/** A line, page, or column break. */
export interface IRBreak {
  type: 'break';
  kind: 'line' | 'page' | 'column';
}

/** An image inside a paragraph. */
export interface IRInlineImage {
  type: 'image';
  src: string;
  widthPt?: number;
  heightPt?: number;
  alt?: string;
}

/** A reference to a footnote. */
export interface IRFootnoteRef {
  type: 'footnoteRef';
  id: string;
}

/** Extension: a symbol inserted by the icon picker (core `icon` inline). */
export interface IRIcon {
  type: 'icon';
  icon: string;
  symbol: string;
  size?: number;
}

/** A section in the IR. */
export interface IRSection {
  id: string;
  pageSetup: PageSetup;
  titlePage?: boolean;
  headers?: IRHeaderFooterSet;
  footers?: IRHeaderFooterSet;
  body: IRBlock[];
}

/** Header or footer content by page kind. */
export interface IRHeaderFooterSet {
  default?: IRBlock[];
  first?: IRBlock[];
  even?: IRBlock[];
}

/** The whole IR document. */
export interface IRDocument {
  /** Extension: IR format version. */
  irVersion?: number;
  /** Extension: document id, kept for round trips. */
  id?: string;
  properties: DocumentProperties;
  styles: StyleSheet;
  numbering: NumberingDefinitions;
  sections: IRSection[];
}

/** An issue found by {@link validateIR}. */
export interface IRIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  path?: string;
}

/** Re-export so IR consumers can type documents without a schema import. */
export type { BeakDocument };
