/**
 * OfficeShell - composes the Office chrome around the editor surface.
 *
 * Layout: title bar (quick access, command search, navigation toggle), ribbon, then a body with
 * an optional navigation pane on the left and the page canvas on the right. Rulers surround a
 * white A4-style page on a grey canvas. The status bar and view controls sit at the bottom.
 *
 * The shell calls `editor.setMode(mode)` (default `office`), which hides block chrome in core.
 *
 * @example
 * ```tsx
 * const editor = useBeakBlock({ initialContent: [] });
 * return (
 *   <OfficeShell editor={editor} pages={pages} comments={comments}>
 *     <BeakBlockView editor={editor} />
 *   </OfficeShell>
 * );
 * ```
 *
 * @module
 */

import React, { useEffect, useState } from 'react';
import type { BeakBlockEditor, EditorMode } from '@amusendame/beakblock-core';
import type { CommandDefinition, CommandRegistry, RibbonDefinition } from '@amusendame/beakblock-commands';
import { CommandSearch } from './CommandSearch';
import { FindReplace } from './FindReplace';
import { NavigationPane } from './NavigationPane';
import type { NavigationComment, NavigationPage, NavigationPaneProps } from './NavigationPane';
import { QuickAccessToolbar } from './QuickAccessToolbar';
import { Ribbon } from './Ribbon';
import { Ruler, DEFAULT_RULER_PAGE_SETUP } from './Ruler';
import type { RulerPageSetup } from './Ruler';
import { StatusBar } from './StatusBar';
import type { PresenceUser, StatusBarProps } from './StatusBar';
import { OfficeIcon } from './icons';
import { ViewModeControl, ZoomControl } from './ZoomControl';
import type { OfficeViewMode } from './ZoomControl';
import { useCommandRegistry } from './useCommandRegistry';
import { ptToPx } from './rulerMath';
import { injectOfficeShellStyles } from './officeStyles';
import { joinClass } from './shared';

/** Layout options the user can change from the view controls. */
export interface OfficeViewOptions {
  /** Pages stacked in a column (true) or one page at a time (false). Default false. */
  multiPage: boolean;
  /** Page fills the canvas width instead of the page size. Default false. */
  fitWidth: boolean;
  /** Hides the ribbon, rulers and status bar. Default false. */
  focusMode: boolean;
}

/** Props for {@link OfficeShell}. */
export interface OfficeShellProps {
  editor: BeakBlockEditor | null;
  /** Registry to use. Omit to let the shell create one from `extraCommands`. */
  registry?: CommandRegistry | null;
  /** Extra commands registered on the shell's own registry. Ignored when `registry` is passed. */
  extraCommands?: CommandDefinition[];
  /** Ribbon layout. Default: `createDefaultRibbon()`. */
  ribbon?: RibbonDefinition;
  /** Hide the ribbon entirely. Default true. */
  showRibbon?: boolean;
  /** Command ids for the quick access toolbar. */
  quickAccess?: string[];
  /** Editor mode the shell switches to. Default `office`. */
  mode?: EditorMode;
  /** Navigation pane. `true` shows all tabs, an object customises them, `false` hides it. Default true. */
  navigation?: boolean | Omit<NavigationPaneProps, 'editor' | 'onClose'>;
  /** Status bar. `false` hides it, an object passes props through. Default true. */
  statusBar?: boolean | Omit<StatusBarProps, 'editor'>;
  /** Show rulers around the page. Default true. Rulers are always hidden in draft and preview. */
  rulers?: boolean;
  /** Page geometry used by the rulers and the page. Default A4 with 1 inch margins. */
  pageSetup?: RulerPageSetup;
  /** Zoom factor (1 = 100%). Controlled when provided. */
  zoom?: number;
  defaultZoom?: number;
  onZoomChange?: (zoom: number) => void;
  /** View mode. Controlled when provided. */
  viewMode?: OfficeViewMode;
  defaultViewMode?: OfficeViewMode;
  onViewModeChange?: (mode: OfficeViewMode) => void;
  /** Called when multi-page, fit-width or focus options change. */
  onViewOptionsChange?: (options: OfficeViewOptions) => void;
  /** Rendered instead of the page in print preview. The app supplies the server rendition here. */
  renderPrintPreview?: () => React.ReactNode;
  /** Comments shown in the navigation pane. */
  comments?: NavigationComment[];
  /** Pages shown as thumbnails in the navigation pane. */
  pages?: NavigationPage[];
  onCommentSelect?: NavigationPaneProps['onCommentSelect'];
  onPageSelect?: NavigationPaneProps['onPageSelect'];
  /** Collaborators shown in the status bar. */
  presence?: PresenceUser[];
  /** Language label shown in the status bar. */
  language?: string;
  /** Current page indicator for the status bar. */
  pageInfo?: StatusBarProps['pageInfo'];
  /** Enable Ctrl/Cmd+F and Ctrl+H find and replace. Default true. */
  findReplace?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** The editor surface, usually `<BeakBlockView editor={editor} />`. */
  children?: React.ReactNode;
}

const DEFAULT_QUICK_ACCESS = ['history.undo', 'history.redo'];
const RULER_WIDTH = 22;

/**
 * Office-style shell around the editor. See the module docs for the layout.
 */
export function OfficeShell({
  editor,
  registry: registryProp,
  extraCommands,
  ribbon,
  showRibbon = true,
  quickAccess = DEFAULT_QUICK_ACCESS,
  mode = 'office',
  navigation = true,
  statusBar = true,
  rulers = true,
  pageSetup = DEFAULT_RULER_PAGE_SETUP,
  zoom: zoomProp,
  defaultZoom = 1,
  onZoomChange,
  viewMode: viewModeProp,
  defaultViewMode = 'print',
  onViewModeChange,
  onViewOptionsChange,
  renderPrintPreview,
  comments,
  pages,
  onCommentSelect,
  onPageSelect,
  presence,
  language,
  pageInfo,
  findReplace = true,
  className,
  style,
  children,
}: OfficeShellProps): React.ReactElement {
  const internalRegistry = useCommandRegistry(registryProp ? null : editor, { extraCommands });
  const registry = registryProp ?? internalRegistry;

  const [internalZoom, setInternalZoom] = useState(defaultZoom);
  const zoom = zoomProp ?? internalZoom;
  const [internalView, setInternalView] = useState<OfficeViewMode>(defaultViewMode);
  const viewMode = viewModeProp ?? internalView;
  const [viewOptions, setViewOptions] = useState<OfficeViewOptions>({ multiPage: false, fitWidth: false, focusMode: false });
  const [navOpen, setNavOpen] = useState(navigation !== false);
  const [findOpen, setFindOpen] = useState(false);
  const [findInitial, setFindInitial] = useState('');

  useEffect(() => {
    injectOfficeShellStyles();
  }, []);

  // Office shell runs in office mode unless the app asks otherwise.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (editor.getMode() !== mode) editor.setMode(mode);
  }, [editor, mode]);

  const setZoom = (next: number) => {
    if (zoomProp === undefined) setInternalZoom(next);
    onZoomChange?.(next);
  };

  const setView = (next: OfficeViewMode) => {
    if (viewModeProp === undefined) setInternalView(next);
    onViewModeChange?.(next);
    if (next === 'outline') setNavOpen(true);
  };

  const updateOptions = (patch: Partial<OfficeViewOptions>) => {
    const next = { ...viewOptions, ...patch };
    setViewOptions(next);
    onViewOptionsChange?.(next);
  };

  const showRulers = rulers && viewMode === 'print' && !viewOptions.focusMode;
  const isDraft = viewMode === 'draft';
  const isPreview = viewMode === 'preview';
  const showChrome = !viewOptions.focusMode;
  const navigationEnabled = navigation !== false;
  const navigationProps: Partial<NavigationPaneProps> = typeof navigation === 'object' ? navigation : {};
  const statusProps: Partial<StatusBarProps> | null =
    statusBar === false ? null : typeof statusBar === 'object' ? statusBar : {};

  const pageWidthPx = ptToPx(pageSetup.widthPt, zoom);
  const pageHeightPx = ptToPx(pageSetup.heightPt, zoom);
  const padding = {
    top: ptToPx(pageSetup.margins.topPt, zoom),
    right: ptToPx(pageSetup.margins.rightPt, zoom),
    bottom: ptToPx(pageSetup.margins.bottomPt, zoom),
    left: ptToPx(pageSetup.margins.leftPt, zoom),
  };

  const pageStyle: React.CSSProperties = isDraft
    ? { padding: 24 }
    : {
        width: viewOptions.fitWidth ? '100%' : pageWidthPx,
        maxWidth: viewOptions.fitWidth ? pageWidthPx : undefined,
        minHeight: pageHeightPx,
        paddingTop: padding.top,
        paddingRight: padding.right,
        paddingBottom: padding.bottom,
        paddingLeft: padding.left,
      };

  const openFind = () => {
    if (!findReplace || !editor || editor.isDestroyed) return;
    setFindInitial(editor.pm.getSelectedText());
    setFindOpen(true);
  };

  const onShellKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!findReplace) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && (event.key === 'f' || event.key === 'h')) {
      event.preventDefault();
      openFind();
    }
  };

  const ribbonVisible = showRibbon && showChrome;

  return (
    <div
      className={joinClass('bb-office-shell', viewOptions.focusMode && 'is-focus', className)}
      data-view={viewMode}
      data-mode={mode}
      style={style}
      onKeyDown={onShellKeyDown}
    >
      {showChrome && (
        <div className="bb-office-titlebar">
          {navigationEnabled && (
            <button
              type="button"
              className={joinClass('bb-office-button', 'bb-office-button-small', navOpen && 'is-pressed')}
              aria-pressed={navOpen}
              aria-label="Navigation pane"
              title="Navigation pane"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setNavOpen((open) => !open)}
            >
              <OfficeIcon name="panel-left" size={16} />
            </button>
          )}
          <QuickAccessToolbar registry={registry} commands={quickAccess} editor={editor} />
          <div className="bb-office-titlebar-spacer" />
          <CommandSearch registry={registry} editor={editor} />
        </div>
      )}

      {ribbonVisible && <Ribbon registry={registry} editor={editor} ribbon={ribbon} />}

      <div className="bb-office-body">
        {navigationEnabled && navOpen && showChrome && (
          <div className="bb-office-nav">
            <NavigationPane
              {...navigationProps}
              editor={editor}
              comments={navigationProps.comments ?? comments}
              pages={navigationProps.pages ?? pages}
              onCommentSelect={navigationProps.onCommentSelect ?? onCommentSelect}
              onPageSelect={navigationProps.onPageSelect ?? onPageSelect}
              onClose={() => setNavOpen(false)}
            />
          </div>
        )}

        <div className="bb-office-main">
          {findOpen && findReplace && (
            <FindReplace
              key={findInitial}
              editor={editor}
              initialQuery={findInitial}
              onClose={() => setFindOpen(false)}
            />
          )}

          <div className="bb-office-scroll">
            {isPreview && renderPrintPreview ? (
              <div className="bb-office-preview">{renderPrintPreview()}</div>
            ) : null}
            <div className="bb-office-sheet" style={{ display: isPreview ? 'none' : undefined }}>
              {showRulers && (
                <div className="bb-office-ruler-row" style={{ width: pageWidthPx + RULER_WIDTH }}>
                  <div className="bb-office-ruler-corner" style={{ width: RULER_WIDTH }} />
                  <Ruler editor={editor} orientation="horizontal" pageSetup={pageSetup} zoom={zoom} />
                </div>
              )}
              <div className={joinClass('bb-office-page-frame', viewOptions.multiPage && 'is-multi-page')}>
                {showRulers && (
                  <Ruler editor={editor} orientation="vertical" pageSetup={pageSetup} zoom={zoom} />
                )}
                <div
                  className={joinClass('bb-office-page', isDraft && 'is-draft', viewOptions.fitWidth && 'is-fit-width')}
                  style={pageStyle}
                  data-zoom={zoom}
                >
                  {children}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showChrome && (
        <div className="bb-office-footer">
          {statusProps && (
            <StatusBar
              {...statusProps}
              editor={editor}
              presence={statusProps.presence ?? presence}
              language={statusProps.language ?? language}
              pageInfo={statusProps.pageInfo ?? pageInfo}
            />
          )}
          <div className="bb-office-footer-controls">
            <ViewModeControl
              viewMode={viewMode}
              onViewModeChange={setView}
              multiPage={viewOptions.multiPage}
              onMultiPageChange={(value) => updateOptions({ multiPage: value })}
              fitWidth={viewOptions.fitWidth}
              onFitWidthChange={(value) => updateOptions({ fitWidth: value })}
              focusMode={viewOptions.focusMode}
              onFocusModeChange={(value) => updateOptions({ focusMode: value })}
            />
            <ZoomControl value={zoom} onChange={setZoom} />
          </div>
        </div>
      )}

      {viewOptions.focusMode && (
        <button
          type="button"
          className="bb-office-focus-exit"
          onClick={() => updateOptions({ focusMode: false })}
        >
          Exit focus mode
        </button>
      )}
    </div>
  );
}
