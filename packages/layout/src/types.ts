/**
 * Public layout types: the layout tree produced from BeakDoc IR (contract section 7).
 *
 * Units are points (pt). Coordinates are measured from the top-left corner of the
 * page, so `yPt` of a body fragment is absolute and can be used directly for print.
 *
 * @module
 */

import type { IRRun } from '@amusendame/beakblock-ir';

/** Run properties used for measurement. */
export type MeasureRun = Pick<IRRun['props'], 'font' | 'bold' | 'italic'>;

/** Spacing as read by the measurer (IR `SpacingProps`, without the paragraph spacing). */
export interface MeasureSpacing {
  /** `auto`: 240ths of a line (240 = single). `exact`/`atLeast`: twips. */
  line: number;
  lineRule: 'auto' | 'exact' | 'atLeast';
}

/**
 * Text measurement strategy. The layout engine calls only these two methods, so a
 * browser canvas, a server font metric table, or the built-in heuristic can be used.
 */
export interface Measurer {
  /** Width in points of `text` set in `run` at `sizePt`. */
  measureText(text: string, run: MeasureRun, sizePt: number): number;
  /**
   * Height in points of one line. `spacing` follows the canonical convention:
   * `auto` is OOXML 240ths (240 = single, 276 = 1.15), `exact` and `atLeast` are
   * twips (20 twips = 1pt). Values of 10 or less with the `auto` rule are legacy
   * multipliers and are used as-is.
   */
  lineHeightPt(fontSizePt: number, spacing?: MeasureSpacing | null, font?: string): number;
}

/** A broken line of paragraph text. */
export interface LayoutLine {
  text: string;
  widthPt: number;
}

/** What a body or header fragment shows. */
export type FragmentKind =
  | 'paragraph'
  | 'tableRows'
  | 'image'
  | 'sdtStart'
  | 'sdtEnd'
  | 'passthrough';

/** A piece of a block placed on a page. */
export interface LayoutFragment {
  kind: FragmentKind;
  /**
   * Ordinal of the IR leaf block (paragraph, table, image, passthrough) in document
   * order, counting paragraphs nested in controlled sections. `-1` for markers and
   * header/footer fragments.
   */
  blockIndex: number;
  /**
   * IR path of the block, for example `s0/3` (section 0, body block 3), `s0/3/1`
   * (child 1 of an sdt), or `s0/3/r2c0.1` (block 1 inside row 2, cell 0 of a table).
   */
  path: string;
  sourceBlockId?: string;
  /** Top of the fragment, from the top of the page. */
  yPt: number;
  /** Height of the fragment, including spacing before and after when they apply. */
  heightPt: number;
  /** Broken lines of this fragment (paragraphs only). */
  lines?: LayoutLine[];
  /** Half-open range `[from, to)` of line indices of the paragraph. */
  lineRange?: [number, number];
  /** Half-open range `[from, to)` of row indices of the table. */
  rowRange?: [number, number];
  /** Number of leading header rows repeated at the top of this continuation. */
  repeatedHeaderRows?: number;
  /** True when this fragment continues content from the previous page. */
  continued: boolean;
  /** True when content continues on the next page. */
  continues: boolean;
}

/** Page variant used to pick the header and footer set. */
export type PageVariant = 'first' | 'even' | 'default';

/** One page of the layout. */
export interface LayoutPage {
  /** 0-based index across the whole document. */
  index: number;
  /** Display page number (1-based, not restarted per section). */
  number: number;
  sectionId: string;
  /** Extension: 0-based index of the section on this page. */
  sectionIndex: number;
  sizePt: { w: number; h: number };
  marginsPt: { top: number; right: number; bottom: number; left: number; header: number; footer: number; gutter: number };
  header: LayoutFragment[];
  footer: LayoutFragment[];
  body: LayoutFragment[];
  /** Footnote allocation is simplified: always empty (see README gaps). */
  footnotes: LayoutFragment[];
  variant: PageVariant;
  /** Extension: resolved header text, one entry per top-level header paragraph. */
  headerText: string[];
  /** Extension: resolved footer text, one entry per top-level footer paragraph. */
  footerText: string[];
}

/** A table of contents entry for a Heading1 to Heading3 paragraph. */
export interface TocEntry {
  blockId?: string;
  text: string;
  level: number;
  /** Display page number where the heading starts. */
  page: number;
}

/** Summary of one section in the layout. */
export interface LayoutSectionSummary {
  id: string;
  index: number;
  /** 0-based index of the first page of the section. */
  firstPage: number;
  pageCount: number;
}

/**
 * Pagination state at the start of a page. Used by {@link relayout} to resume
 * from a page without re-running the earlier ones.
 */
export interface ResumePoint {
  /** Index into the internal flat unit list where the page starts. */
  unitIndex: number;
  /** Line offset into the paragraph at `unitIndex` (0 unless the paragraph was split). */
  lineOffset: number;
  /** Row offset into the table at `unitIndex` (0 unless the table was split). */
  rowOffset: number;
  sectionIndex: number;
  /** 0-based index of the page within its section. */
  sectionPageIndex: number;
}

/** The result of a layout pass. */
export interface LayoutResult {
  pages: LayoutPage[];
  pageCount: number;
  /**
   * Resolved field values keyed by `${path}:${inlineIndex}`, where `inlineIndex` is the
   * index into the paragraph's `runs`. Only body fields are keyed here; header and
   * footer fields are resolved into `headerText` and `footerText` per page.
   */
  fieldValues: Record<string, string>;
  toc: TocEntry[];
  sections: LayoutSectionSummary[];
  /** Pagination state at the start of every page (used by {@link relayout}). */
  resumePoints: ResumePoint[];
}

/** Options shared by {@link layoutDocument} and {@link relayout}. */
export interface LayoutOptions {
  /** Text measurer. Defaults to {@link createHeuristicMeasurer}. */
  measurer?: Measurer;
  /** Date used by DATE fields. Defaults to the current time. */
  now?: Date;
}
