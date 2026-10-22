export { useCommandRegistry } from './useCommandRegistry';
export type { UseCommandRegistryOptions, CommandRegistryHandle } from './useCommandRegistry';

export { Ribbon } from './Ribbon';
export { QuickAccessToolbar, DEFAULT_QUICK_ACCESS_COMMANDS } from './QuickAccessToolbar';
export { CommandSearch, isCommandSearchShortcut } from './CommandSearch';
export { NavigationPane, NAVIGATION_TABS, collectHeadings, collectSections } from './NavigationPane';
export type {
  NavigationTab,
  NavigationHeading,
  NavigationSection,
  NavigationComment,
  NavigationPage,
} from './NavigationPane';
export { Ruler, indentFromPositions, firstLinePositionPt, setParagraphIndent, withMarginsPt } from './Ruler';
export { StylesGallery, StylesPane, DEFAULT_STYLE_COMMAND_IDS } from './StylesGallery';
export { FormatPainter, captureFormat, applyFormat } from './FormatPainter';
export type { FormatSnapshot } from './FormatPainter';
export { FindReplace } from './FindReplace';
export {
  findMatches,
  compileFindPattern,
  expandReplacement,
  replaceMatches,
  selectMatch,
  createFindHighlightPlugin,
  FIND_HIGHLIGHT_KEY,
} from './findEngine';
export type { FindMatch, FindOptions, FindPattern, FindHighlightState, FindHighlightMeta } from './findEngine';
export { ZoomControl, OFFICE_VIEW_MODES, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, clampZoom } from './ZoomControl';
export type { OfficeViewMode } from './ZoomControl';
export { StatusBar } from './StatusBar';
export type { StatusPageInfo, StatusSectionInfo, StatusPresence } from './StatusBar';
export { OfficeShell } from './OfficeShell';
export { officeShellCSS } from './officeShellCss';
export { OFFICE_SHELL_STYLE_ID, injectOfficeShellStyles, removeOfficeShellStyles } from './officeStyles';
export { DEFAULT_PAGE_SETUP, pageGeometryPt, countWords, documentWordCount } from './editorState';
export type { PageGeometryPt } from './editorState';
export { renderIcon } from './controls';
