/**
 * Path data for the built-in command icons.
 *
 * Shared by the React and Vue Office shells so both render the same glyphs. Every
 * icon name used by {@link createBuiltInCommands} has an entry (see `icons.test.ts`).
 * Paths are drawn on a 24 x 24 grid and stroked with `currentColor`.
 *
 * @module
 */

/** SVG path data (`d` attribute) per built-in icon name. */
export const BUILTIN_ICON_PATHS: Readonly<Record<string, string>> = {
  bold: 'M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z',
  italic: 'M19 4h-9M14 20H5M15 4 9 20',
  underline: 'M6 4v6a6 6 0 0 0 12 0V4M4 20h16',
  strikethrough: 'M4 12h16M7.5 7.5A4 4 0 0 1 12 5c2.5 0 4 1.3 4 3M8 17c1 2 2.5 3 4 3 2.8 0 4.5-1.6 4.5-3.5',
  code: 'm16 18 6-6-6-6M8 6l-6 6 6 6',
  palette: 'M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-2 0-1.5 1-2 2-2h2a3 3 0 0 0 3-3c0-4.9-4-11-9-11zM7.5 12h.01M10 7.5h.01M15 7.5h.01',
  highlighter: 'M9 11 3 17v3h9l3-3M21 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4',
  'remove-formatting': 'M4 7V4h16v3M5 20h6M13 4 8 20M15 15l6 6M21 15l-6 6',
  'undo-2': 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  'redo-2': 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  'list-ordered': 'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M3 18h2l-2 3h2',
  'list-checks': 'm3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8',
  'list-tree': 'M8 6h13M8 12h13M8 18h13M3 6h2M5 6v12h3',
  indent: 'M21 6H11M21 12H11M21 18H11M3 8l4 4-4 4',
  outdent: 'M21 6H11M21 12H11M21 18H11M7 8l-4 4 4 4',
  pilcrow: 'M13 4v16M17 4v16M19 4H9.5a4.5 4.5 0 0 0 0 9H13',
  heading: 'M6 12h12M6 20V4M18 20V4',
  'heading-1': 'M4 12h8M4 18V6M12 18V6M17 12l3-2v8',
  'heading-2': 'M4 12h8M4 18V6M12 18V6M21 18h-4c0-4 4-3 4-6 0-1.5-2-2-4-1',
  'heading-3': 'M4 12h8M4 18V6M12 18V6M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2',
  'heading-4': 'M4 12h8M4 18V6M12 18V6M17 10v4h4M21 10v8',
  'heading-5': 'M4 12h8M4 18V6M12 18V6M21 10h-5v4c1-.5 4-.6 4 2.5 0 2-1.5 3-4 3-1 0-2-.3-2.5-.8',
  'heading-6': 'M4 12h8M4 18V6M12 18V6M20.5 10h-3.5v8h3a2 2 0 0 0 0-4h-3',
  quote: 'M3 21c3 0 7-1 7-8V5H3v8h4M14 21c3 0 7-1 7-8V5h-7v8h4',
  table: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  'table-x': 'M3 3h18v18H3zM3 9h18M9 3v18M14 13l4 4M18 13l-4 4',
  image: 'M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M21 15l-5-5L5 21',
  minus: 'M5 12h14',
  'file-break': 'M14 3H6v18h12V7zM8 13h8M8 17h8',
  'file-check': 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v4a2 2 0 0 0 2 2h4M9 15l2 2 4-4',
  'file-text': 'M14 3H6v18h12V7zM14 3v4h4M8 13h8M8 17h8',
  'columns-2': 'M3 3h18v18H3zM12 3v18',
  'square-code': 'M3 3h18v18H3zM10 9l-2 3 2 3M14 9l2 3-2 3',
  'arrow-down-to-line': 'M12 17V3M6 11l6 6 6-6M19 21H5',
  'arrow-up-from-line': 'm18 9-6-6-6 6M12 3v14M5 21h14',
  'arrow-left-from-line': 'm9 6-6 6 6 6M3 12h14M21 19V5',
  'arrow-right-from-line': 'm15 6 6 6-6 6M21 12H7M3 19V5',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 16v-4M12 8h.01',
  hash: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
  'pen-line': 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  'shield-check': 'M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.7 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4-4',
  'trash-2': 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
  'align-left': 'M17 10H3M21 6H3M21 14H3M17 18H3',
  'align-center': 'M18 10H6M21 6H3M21 14H3M18 18H6',
  'align-right': 'M21 10H7M21 6H3M21 14H3M21 18H7',
  'align-justify': 'M21 10H3M21 6H3M21 14H3M21 18H3',
  sparkles: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-up': 'm18 15-6-6-6 6',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  'message-square': 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  'panel-left': 'M3 3h18v18H3zM9 3v18',
  'zoom-in': 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3M11 8v6M8 11h6',
  'zoom-out': 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3M8 11h6',
  maximize: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  layout: 'M3 3h18v18H3zM3 9h18M9 9v12',
  type: 'M4 7V4h16v3M9 20h6M12 4v16',
  save: 'M5 3h11l3 3v15H5zM8 3v6h8V3M8 21v-7h8v7',
};

/** True when a built-in icon name has path data. */
export function hasBuiltinIcon(name: string | null | undefined): boolean {
  return !!name && Object.prototype.hasOwnProperty.call(BUILTIN_ICON_PATHS, name);
}
