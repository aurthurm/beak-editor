/**
 * Page sizes, margins and page setup factories.
 *
 * @module
 */

import type { PageMargins, PageSetup, PageSizeName, PageSize } from './types';

/** Paper sizes in twips, portrait orientation (width x height). */
export const PAGE_SIZES: Readonly<Record<PageSizeName, Readonly<PageSize>>> = {
  A4: { widthTwips: 11906, heightTwips: 16838 },
  Letter: { widthTwips: 12240, heightTwips: 15840 },
  Legal: { widthTwips: 12240, heightTwips: 20160 },
  A3: { widthTwips: 16838, heightTwips: 23811 },
};

/** Default margins: 1 inch sides and top/bottom, 0.5 inch header and footer. */
export const DEFAULT_MARGINS_TWIPS: Readonly<PageMargins> = {
  top: 1440,
  right: 1440,
  bottom: 1440,
  left: 1440,
  header: 720,
  footer: 720,
  gutter: 0,
};

/** Options for {@link createPageSetup}. */
export interface PageSetupOptions {
  size?: PageSizeName;
  orientation?: 'portrait' | 'landscape';
  margins?: Partial<PageMargins>;
  columns?: { count: number; spaceTwips: number };
}

/**
 * Creates a page setup. Landscape swaps width and height.
 *
 * @example
 * ```typescript
 * const appendix = createPageSetup({ size: 'A4', orientation: 'landscape' });
 * ```
 */
export function createPageSetup(options: PageSetupOptions = {}): PageSetup {
  const base = PAGE_SIZES[options.size ?? 'A4'];
  const orientation = options.orientation ?? 'portrait';
  const size: PageSize =
    orientation === 'landscape'
      ? { widthTwips: base.heightTwips, heightTwips: base.widthTwips }
      : { widthTwips: base.widthTwips, heightTwips: base.heightTwips };
  const setup: PageSetup = {
    size,
    orientation,
    margins: { ...DEFAULT_MARGINS_TWIPS, ...(options.margins ?? {}) },
  };
  if (options.columns) {
    setup.columns = { count: options.columns.count, spaceTwips: options.columns.spaceTwips };
  }
  return setup;
}

/** Default page setup: A4 portrait with default margins. */
export function createDefaultPageSetup(): PageSetup {
  return createPageSetup({ size: 'A4', orientation: 'portrait' });
}
