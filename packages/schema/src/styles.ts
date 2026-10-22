/**
 * Default style sheet and style resolution.
 *
 * Fonts follow ADR-6: metric-compatible Carlito, Caladea and Liberation fonts,
 * with fallbacks to the Office fonts they mirror.
 *
 * @module
 */

import type {
  ParaProps,
  ParagraphStyle,
  RunProps,
  StyleSheet,
  TableStyle,
  CharacterStyle,
} from './types';
import { normalizeLineSpacing } from './spacing';

/** Bundled metric-compatible font families (ADR-6). */
export const FONTS = {
  sans: 'Carlito',
  serif: 'Caladea',
  arial: 'Liberation Sans',
  times: 'Liberation Serif',
  mono: 'Liberation Mono',
} as const;

/** Office fallbacks for each bundled font, in preference order. */
export const FONT_FALLBACKS: Readonly<Record<string, readonly string[]>> = {
  Carlito: ['Calibri', 'Arial', 'Helvetica'],
  Caladea: ['Cambria', 'Georgia', 'Times New Roman'],
  'Liberation Sans': ['Arial', 'Helvetica'],
  'Liberation Serif': ['Times New Roman', 'Times'],
  'Liberation Mono': ['Courier New', 'Courier'],
};

const GENERIC_FAMILY: Readonly<Record<string, string>> = {
  Carlito: 'sans-serif',
  Caladea: 'serif',
  'Liberation Sans': 'sans-serif',
  'Liberation Serif': 'serif',
  'Liberation Mono': 'monospace',
};

/**
 * Returns a CSS `font-family` stack for a font name, with fallbacks.
 *
 * @example
 * ```typescript
 * fontStack('Carlito'); // '"Carlito", "Calibri", "Arial", "Helvetica", sans-serif'
 * ```
 */
export function fontStack(font: string): string {
  const fallbacks = FONT_FALLBACKS[font] ?? [];
  const generic = GENERIC_FAMILY[font] ?? 'sans-serif';
  return [font, ...fallbacks]
    .map((name) => `"${name}"`)
    .concat(generic)
    .join(', ');
}

/** Heading font sizes in points, H1 to H6. */
const HEADING_SIZES_PT = [16, 14, 12, 11, 11, 11] as const;

/** Callout variants and their accent colours. */
const CALLOUT_VARIANTS: ReadonlyArray<readonly [string, string]> = [
  ['Info', '1F4E79'],
  ['Warning', '9C5700'],
  ['Success', '375623'],
  ['Error', '9C0006'],
  ['Note', '404040'],
];

function paragraphStyle(
  id: string,
  name: string,
  options: { basedOn?: string | null; paraProps?: ParaProps; runProps?: RunProps; outlineLevel?: number; next?: string } = {}
): ParagraphStyle {
  const style: ParagraphStyle = { id, name, basedOn: options.basedOn === undefined ? 'Normal' : options.basedOn };
  if (options.paraProps) style.paraProps = options.paraProps;
  if (options.runProps) style.runProps = options.runProps;
  if (options.outlineLevel !== undefined) style.outlineLevel = options.outlineLevel;
  if (options.next) style.next = options.next;
  return style;
}

/**
 * Creates the default style sheet: Normal, Heading1-6, Title, Caption,
 * ListParagraph, TOC1-3, Quote, Callout variants, Code, Divider, a Code
 * character style and the TableGrid table style.
 *
 * @example
 * ```typescript
 * const styles = createDefaultStyleSheet();
 * styles.paragraph.Heading1.runProps?.sizePt; // 16
 * ```
 */
export function createDefaultStyleSheet(): StyleSheet {
  const paragraph: Record<string, ParagraphStyle> = {};
  const add = (style: ParagraphStyle) => {
    paragraph[style.id] = style;
  };

  add(
    paragraphStyle('Normal', 'Normal', {
      basedOn: null,
      paraProps: { spacing: { beforePt: 0, afterPt: 8, line: 276, lineRule: 'auto' } },
      runProps: { font: FONTS.sans, sizePt: 11 },
    })
  );

  HEADING_SIZES_PT.forEach((sizePt, index) => {
    const level = index + 1;
    add(
      paragraphStyle(`Heading${level}`, `Heading ${level}`, {
        next: 'Normal',
        outlineLevel: index,
        paraProps: {
          keepNext: true,
          keepLines: true,
          spacing: { beforePt: index === 0 ? 18 : 12, afterPt: 4, line: 240, lineRule: 'auto' },
        },
        runProps: {
          font: FONTS.sans,
          sizePt,
          ...(index < 3 ? { bold: true } : {}),
          ...(index === 5 ? { italic: true } : {}),
          color: '1F3864',
        },
      })
    );
  });

  add(
    paragraphStyle('Title', 'Title', {
      paraProps: { spacing: { beforePt: 0, afterPt: 12, line: 240, lineRule: 'auto' } },
      runProps: { font: FONTS.sans, sizePt: 26, color: '1F3864' },
    })
  );

  add(
    paragraphStyle('Caption', 'Caption', {
      paraProps: { spacing: { beforePt: 0, afterPt: 10, line: 240, lineRule: 'auto' } },
      runProps: { sizePt: 9, italic: true, color: '44546A' },
    })
  );

  add(
    paragraphStyle('ListParagraph', 'List Paragraph', {
      paraProps: { indent: { leftPt: 36 }, spacing: { beforePt: 0, afterPt: 4, line: 276, lineRule: 'auto' } },
    })
  );

  const tocTabs = [{ posPt: 451, kind: 'right' as const, leader: 'dot' as const }];
  [0, 1, 2].forEach((index) => {
    add(
      paragraphStyle(`TOC${index + 1}`, `TOC ${index + 1}`, {
        paraProps: {
          indent: { leftPt: index * 11 },
          spacing: { beforePt: 0, afterPt: 5, line: 240, lineRule: 'auto' },
          tabs: tocTabs,
        },
      })
    );
  });

  add(
    paragraphStyle('Quote', 'Quote', {
      paraProps: { indent: { leftPt: 36, firstLinePt: 0 } },
      runProps: { italic: true, color: '404040' },
    })
  );

  add(
    paragraphStyle('Callout', 'Callout', {
      paraProps: { indent: { leftPt: 8 }, spacing: { beforePt: 6, afterPt: 6, line: 276, lineRule: 'auto' } },
    })
  );
  CALLOUT_VARIANTS.forEach(([suffix, color]) => {
    add(
      paragraphStyle(`Callout${suffix}`, `Callout ${suffix}`, {
        basedOn: 'Callout',
        runProps: { color },
      })
    );
  });

  add(
    paragraphStyle('Code', 'Code', {
      basedOn: null,
      paraProps: { spacing: { beforePt: 6, afterPt: 6, line: 240, lineRule: 'auto' } },
      runProps: { font: FONTS.mono, sizePt: 9 },
    })
  );

  add(
    paragraphStyle('Divider', 'Divider', {
      paraProps: { spacing: { beforePt: 6, afterPt: 6, line: 20, lineRule: 'exact' } },
    })
  );

  const character: Record<string, CharacterStyle> = {
    Code: { id: 'Code', name: 'Code', basedOn: null, runProps: { font: FONTS.mono } },
  };

  const tableGrid: TableStyle = {
    id: 'TableGrid',
    name: 'Table Grid',
    basedOn: null,
    borders: {
      top: { style: 'single', sizePt: 0.5, color: '000000' },
      right: { style: 'single', sizePt: 0.5, color: '000000' },
      bottom: { style: 'single', sizePt: 0.5, color: '000000' },
      left: { style: 'single', sizePt: 0.5, color: '000000' },
      insideH: { style: 'single', sizePt: 0.5, color: '000000' },
      insideV: { style: 'single', sizePt: 0.5, color: '000000' },
    },
    cellPaddingPt: { top: 0, right: 5.4, bottom: 0, left: 5.4 },
    conditional: {
      firstRow: { shading: 'D9E2F3', runProps: { bold: true } },
    },
  };

  return {
    paragraph,
    character,
    table: { TableGrid: tableGrid },
  };
}

/** A paragraph style with its `basedOn` chain flattened. */
export interface ResolvedParagraphStyle {
  id: string;
  name: string;
  /** Style ids from the requested style up to the root, nearest first. */
  chain: string[];
  paraProps: ParaProps;
  runProps: RunProps;
}

function hasOwn(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

/**
 * Resolves a paragraph style by flattening its `basedOn` chain.
 *
 * Properties of derived styles override their bases. Cycles and dangling
 * `basedOn` references terminate the walk instead of looping.
 *
 * @returns The resolved style, or `null` when `styleId` is unknown or empty.
 *
 * @example
 * ```typescript
 * const heading = resolveParagraphStyle(styles, 'Heading2');
 * heading?.runProps.font; // 'Carlito', inherited from Normal
 * ```
 */
export function resolveParagraphStyle(
  styles: StyleSheet,
  styleId: string | null | undefined
): ResolvedParagraphStyle | null {
  if (!styleId || !hasOwn(styles.paragraph, styleId)) return null;

  const chain: string[] = [];
  const visited = new Set<string>();
  let current: string | null | undefined = styleId;

  while (current && !visited.has(current) && hasOwn(styles.paragraph, current)) {
    visited.add(current);
    chain.push(current);
    current = styles.paragraph[current].basedOn ?? null;
  }

  let paraProps: ParaProps = {};
  let runProps: RunProps = {};
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const style = styles.paragraph[chain[index]];
    paraProps = { ...paraProps, ...(style.paraProps ?? {}) };
    runProps = { ...runProps, ...(style.runProps ?? {}) };
  }

  if (paraProps.spacing) paraProps = { ...paraProps, spacing: normalizeLineSpacing(paraProps.spacing) };
  const leaf = styles.paragraph[styleId];
  return { id: styleId, name: leaf.name, chain, paraProps, runProps };
}
