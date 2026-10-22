export { useCommandRegistry } from './useCommandRegistry';
export type { UseCommandRegistryOptions } from './useCommandRegistry';

export { OfficeShell } from './OfficeShell';
export type { OfficeShellProps, OfficeViewOptions } from './OfficeShell';

export { Ribbon, RIBBON_COLOR_SWATCHES } from './Ribbon';
export type { RibbonProps } from './Ribbon';

export { QuickAccessToolbar } from './QuickAccessToolbar';
export type { QuickAccessToolbarProps } from './QuickAccessToolbar';

export { CommandSearch } from './CommandSearch';
export type { CommandSearchProps } from './CommandSearch';

export { NavigationPane } from './NavigationPane';
export type {
  NavigationPaneProps,
  NavigationTabId,
  NavigationComment,
  NavigationPage,
} from './NavigationPane';

export { Ruler, DEFAULT_RULER_PAGE_SETUP } from './Ruler';
export type { RulerProps, RulerPageSetup } from './Ruler';

export { StylesGallery, StylesPane, DEFAULT_OFFICE_STYLES, applyOfficeStyle } from './StylesGallery';
export type { StylesProps, OfficeStyleDefinition } from './StylesGallery';

export { FormatPainter, captureFormat, applyFormat } from './FormatPainter';
export type { FormatPainterProps, FormatPainterMode, FormatSnapshot } from './FormatPainter';

export { FindReplace, createFindHighlightPlugin, FIND_HIGHLIGHT_KEY } from './FindReplace';
export type { FindReplaceProps, FindHighlightState } from './FindReplace';

export { findMatches, buildSearchRegExp, expandReplacement, getRegexError, collectTextRuns } from './findEngine';
export type { SearchOptions, SearchMatch, SearchableDoc, SearchableNode, TextRun } from './findEngine';

export { ZoomControl, ViewModeControl, OFFICE_VIEW_MODES, ZOOM_PRESETS } from './ZoomControl';
export type { ZoomControlProps, ViewModeControlProps, OfficeViewMode } from './ZoomControl';

export { StatusBar } from './StatusBar';
export type { StatusBarProps, PresenceUser, StatusSectionInfo } from './StatusBar';

export { OfficeIcon, hasOfficeIcon } from './icons';
export type { OfficeIconProps } from './icons';

export { officeShellCSS } from './officeShellCss';
export { injectOfficeShellStyles, OFFICE_SHELL_STYLE_ID } from './officeStyles';

export {
  ptToPx,
  pxToPt,
  PX_PER_PT,
  applyIndentDrag,
  addTabStop,
  moveTabStop,
  resizeColumn,
  firstLinePosition,
} from './rulerMath';
export type { IndentValues, TabStopValues, IndentMarker } from './rulerMath';

export { getParagraphContext, getSectionContext, getHeadings, countWords, selectRange } from './editorUtils';
