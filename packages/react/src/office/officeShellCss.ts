/**
 * Office shell stylesheet, as a framework-neutral string.
 *
 * The React bindings inject it with `injectOfficeShellStyles()`. The Vue bindings copy it
 * verbatim, so keep this file free of framework code. All classes use the `bb-office-` prefix.
 *
 * Look: neutral greys, 1px borders, a blue accent (#2b579a) for tabs, a red accent (#a4373a)
 * for contextual tabs, and a compact 12-13px system font stack.
 *
 * @module
 */

export const officeShellCSS = `
.bb-office-shell {
  --bb-office-accent: #2b579a;
  --bb-office-contextual: #a4373a;
  --bb-office-border: #c8c6c4;
  --bb-office-surface: #f3f2f1;
  --bb-office-surface-strong: #e1dfdd;
  --bb-office-text: #201f1e;
  --bb-office-muted: #605e5c;
  --bb-office-canvas: #e7e6e6;
  --bb-office-page: #ffffff;
  --bb-office-font: "Segoe UI", Carlito, "Calibri", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 420px;
  font-family: var(--bb-office-font);
  font-size: 12px;
  line-height: 1.35;
  color: var(--bb-office-text);
  background: var(--bb-office-canvas);
  border: 1px solid var(--bb-office-border);
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
}
.bb-office-shell *, .bb-office-shell *::before, .bb-office-shell *::after { box-sizing: border-box; }
.bb-office-sr-only {
  position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
.bb-office-icon { display: block; flex: none; }
.bb-office-icon-letter {
  display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600;
}

/* Title bar */
.bb-office-titlebar {
  display: flex; align-items: center; gap: 6px; padding: 4px 8px;
  background: var(--bb-office-surface); border-bottom: 1px solid var(--bb-office-border);
}
.bb-office-titlebar-spacer { flex: 1 1 auto; }

/* Buttons */
.bb-office-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  min-width: 26px; height: 26px; padding: 2px 6px; font: inherit; color: inherit;
  background: transparent; border: 1px solid transparent; border-radius: 2px; cursor: pointer;
}
.bb-office-button:hover:not(:disabled) { background: var(--bb-office-surface-strong); border-color: var(--bb-office-border); }
.bb-office-button:focus-visible, .bb-office-qat-button:focus-visible, .bb-office-search-input:focus-visible,
.bb-office-ribbon-tab:focus-visible, .bb-office-nav-tab:focus-visible, .bb-office-nav-item:focus-visible,
.bb-office-style-tile:focus-visible, .bb-office-style-item:focus-visible, .bb-office-find-button:focus-visible,
.bb-office-find-toggle:focus-visible, .bb-office-view-switch-button:focus-visible, .bb-office-indent:focus-visible,
.bb-office-swatch:focus-visible, .bb-office-nav-thumb:focus-visible, .bb-office-search-result:focus-visible {
  outline: 2px solid var(--bb-office-accent); outline-offset: 1px;
}
.bb-office-button:disabled, .bb-office-qat-button:disabled, .bb-office-find-button:disabled { opacity: 0.4; cursor: default; }
.bb-office-button.is-pressed, .bb-office-qat-button.is-pressed, .bb-office-find-toggle[aria-pressed="true"] {
  background: #d2e3f7; border-color: #9cc0ea; color: #0b3a6b;
}
.bb-office-button-large { flex-direction: column; min-width: 56px; height: 70px; padding: 4px 6px; }
.bb-office-button-large .bb-office-button-label { font-size: 12px; text-align: center; line-height: 1.2; }
.bb-office-button-small .bb-office-button-label { font-size: 12px; white-space: nowrap; }
.bb-office-button-color { position: relative; }

/* Quick access */
.bb-office-qat { display: flex; align-items: center; gap: 2px; }
.bb-office-qat-button {
  display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px;
  padding: 0; background: transparent; border: 1px solid transparent; border-radius: 2px; color: inherit; cursor: pointer;
}
.bb-office-qat-button:hover:not(:disabled) { background: var(--bb-office-surface-strong); }
.bb-office-qat-button:disabled { opacity: 0.4; cursor: default; }

/* Command search */
.bb-office-search { position: relative; width: 300px; max-width: 45%; }
.bb-office-search-field {
  display: flex; align-items: center; gap: 6px; padding: 0 8px; height: 26px;
  background: #fff; border: 1px solid var(--bb-office-border); border-radius: 2px; color: var(--bb-office-muted);
}
.bb-office-search-input {
  flex: 1 1 auto; min-width: 0; height: 100%; border: 0; background: transparent; font: inherit; color: inherit; outline: none;
}
.bb-office-search-results {
  position: absolute; top: 30px; left: 0; right: 0; z-index: 20; margin: 0; padding: 4px 0; list-style: none;
  background: #fff; border: 1px solid var(--bb-office-border); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.14);
  max-height: 340px; overflow: auto;
}
.bb-office-search-result {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px; cursor: pointer;
}
.bb-office-search-result.is-active { background: #deecf9; }
.bb-office-search-result.is-disabled { color: var(--bb-office-muted); cursor: default; }
.bb-office-search-result-label { flex: 1 1 auto; }
.bb-office-search-result-group { color: var(--bb-office-muted); font-size: 11px; }
.bb-office-search-result-shortcut {
  font: 11px ui-monospace, Consolas, monospace; padding: 0 4px; border: 1px solid var(--bb-office-border); border-radius: 2px; background: var(--bb-office-surface);
}
.bb-office-search-empty { padding: 6px 10px; color: var(--bb-office-muted); }

/* Ribbon */
.bb-office-ribbon { display: flex; flex-direction: column; background: #fff; border-bottom: 1px solid var(--bb-office-border); }
.bb-office-ribbon-tabs { display: flex; align-items: flex-end; gap: 0; padding: 0 6px; background: var(--bb-office-surface); border-bottom: 1px solid var(--bb-office-border); }
.bb-office-ribbon-tab {
  padding: 6px 12px; font: inherit; color: var(--bb-office-text); background: transparent; border: 1px solid transparent;
  border-bottom: 0; cursor: pointer; margin-bottom: -1px;
}
.bb-office-ribbon-tab:hover { background: var(--bb-office-surface-strong); }
.bb-office-ribbon-tab.is-active {
  background: #fff; border-color: var(--bb-office-border); border-top: 2px solid var(--bb-office-accent); color: var(--bb-office-accent); font-weight: 600;
}
.bb-office-ribbon-tab-contextual { color: var(--bb-office-contextual); font-weight: 600; background: #f8e9ea; }
.bb-office-ribbon-tab-contextual.is-active { border-top-color: var(--bb-office-contextual); color: var(--bb-office-contextual); background: #fff; }
.bb-office-ribbon-panel { display: flex; flex-wrap: wrap; align-items: stretch; gap: 0; padding: 4px 6px; min-height: 84px; }
.bb-office-ribbon-panel-contextual { border-top: 2px solid var(--bb-office-contextual); }
.bb-office-ribbon-group {
  display: flex; flex-direction: column; justify-content: space-between; padding: 0 8px 2px; border-right: 1px solid #e5e5e5;
}
.bb-office-ribbon-items { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 2px; padding-top: 2px; max-width: 360px; }
.bb-office-ribbon-group-label { text-align: center; font-size: 11px; color: var(--bb-office-muted); padding-top: 2px; white-space: nowrap; }
.bb-office-color-wrap { position: relative; display: inline-flex; }
.bb-office-color-popover {
  position: absolute; top: 100%; left: 0; z-index: 15; display: grid; grid-template-columns: repeat(3, 24px); gap: 4px;
  padding: 6px; margin-top: 2px; background: #fff; border: 1px solid var(--bb-office-border); box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}
.bb-office-swatch {
  width: 24px; height: 24px; padding: 0; border: 1px solid var(--bb-office-border); border-radius: 2px; cursor: pointer;
  font: 11px var(--bb-office-font); color: var(--bb-office-muted);
}

/* Body and navigation */
.bb-office-body { display: flex; flex: 1 1 auto; min-height: 0; }
.bb-office-nav {
  width: 240px; flex: none; display: flex; flex-direction: column; background: #fff; border-right: 1px solid var(--bb-office-border);
}
.bb-office-nav-pane { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
.bb-office-nav-header { display: flex; align-items: center; border-bottom: 1px solid var(--bb-office-border); }
.bb-office-nav-tabs { display: flex; flex: 1 1 auto; overflow-x: auto; }
.bb-office-nav-tab {
  padding: 8px 8px; font: inherit; background: transparent; border: 0; border-bottom: 2px solid transparent; color: var(--bb-office-muted); cursor: pointer; white-space: nowrap;
}
.bb-office-nav-tab.is-active { color: var(--bb-office-accent); border-bottom-color: var(--bb-office-accent); font-weight: 600; }
.bb-office-nav-close { border: 0; background: transparent; font-size: 16px; padding: 0 8px; cursor: pointer; color: var(--bb-office-muted); }
.bb-office-nav-panel { flex: 1 1 auto; overflow: auto; padding: 6px; }
.bb-office-nav-list { list-style: none; margin: 0; padding: 0; }
.bb-office-nav-item {
  display: flex; flex-direction: column; align-items: stretch; width: 100%; padding: 5px 8px; text-align: left; font: inherit; color: inherit;
  background: transparent; border: 1px solid transparent; border-radius: 2px; cursor: pointer;
}
.bb-office-nav-item:hover { background: var(--bb-office-surface); }
.bb-office-nav-item-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bb-office-nav-item-meta { font-size: 11px; color: var(--bb-office-muted); }
.bb-office-nav-comment.is-resolved { opacity: 0.6; }
.bb-office-nav-quote { font-style: italic; color: var(--bb-office-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bb-office-nav-empty { padding: 8px; color: var(--bb-office-muted); }
.bb-office-nav-search { display: flex; flex-direction: column; gap: 6px; }
.bb-office-nav-search-input { padding: 4px 6px; font: inherit; border: 1px solid var(--bb-office-border); border-radius: 2px; }
.bb-office-nav-search-option { display: flex; align-items: center; gap: 6px; color: var(--bb-office-muted); }
.bb-office-nav-pages { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.bb-office-nav-thumb {
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px; background: transparent; border: 1px solid transparent; cursor: pointer; font: inherit;
}
.bb-office-nav-thumb:hover { border-color: var(--bb-office-border); background: var(--bb-office-surface); }
.bb-office-nav-thumb-page {
  display: flex; align-items: center; justify-content: center; width: 100%; aspect-ratio: 1 / 1.414; background: #fff;
  border: 1px solid #b5b5b5; box-shadow: 0 1px 3px rgba(0,0,0,0.12); color: var(--bb-office-muted);
}
.bb-office-nav-thumb-label { font-size: 11px; color: var(--bb-office-muted); }

/* Main canvas */
.bb-office-main { position: relative; flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.bb-office-scroll { flex: 1 1 auto; overflow: auto; background: var(--bb-office-canvas); padding: 16px 0; }
.bb-office-sheet { position: relative; margin: 0 auto; display: flex; flex-direction: column; align-items: stretch; }
.bb-office-ruler-row { position: sticky; top: 0; z-index: 3; display: flex; align-items: stretch; }
.bb-office-ruler-corner { flex: none; background: var(--bb-office-surface); border-bottom: 1px solid #b5b5b5; }
.bb-office-page-frame { display: flex; align-items: stretch; margin: 0 auto; }
.bb-office-page {
  position: relative; background: var(--bb-office-page); box-shadow: 0 1px 4px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.04);
  color: #000; min-width: 0;
}
.bb-office-page.is-draft { width: 100%; background: #fff; box-shadow: none; min-height: 320px; }
.bb-office-page.is-fit-width { max-width: 100%; }
.bb-office-preview { margin: 0 auto; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
.bb-office-shell.is-focus .bb-office-scroll { padding: 24px 0; }

/* Rulers */
.bb-office-ruler { position: relative; background: #fff; color: var(--bb-office-muted); font-size: 9px; user-select: none; flex: none; }
.bb-office-ruler-horizontal { border-bottom: 1px solid #b5b5b5; }
.bb-office-ruler-vertical { border-right: 1px solid #b5b5b5; }
.bb-office-ruler-margin { position: absolute; background: var(--bb-office-surface-strong); }
.bb-office-ruler-horizontal .bb-office-ruler-margin { top: 0; bottom: 0; }
.bb-office-ruler-vertical .bb-office-ruler-margin { left: 0; right: 0; }
.bb-office-ruler-tick { position: absolute; background: #8a8886; }
.bb-office-ruler-horizontal .bb-office-ruler-tick { bottom: 0; width: 1px; height: 5px; }
.bb-office-ruler-horizontal .bb-office-ruler-tick.is-major { height: 9px; }
.bb-office-ruler-vertical .bb-office-ruler-tick { right: 0; height: 1px; width: 5px; }
.bb-office-ruler-vertical .bb-office-ruler-tick.is-major { width: 9px; }
.bb-office-ruler-number { position: absolute; transform: translateX(-50%); top: 1px; }
.bb-office-ruler-vertical .bb-office-ruler-number { transform: translateY(-50%) rotate(-90deg); left: 1px; top: auto; }
.bb-office-ruler-track { position: absolute; top: 0; bottom: 0; cursor: pointer; }
.bb-office-ruler-vertical .bb-office-ruler-track { display: none; }
.bb-office-indent { position: absolute; top: 0; width: 10px; height: 10px; cursor: ew-resize; background: #5a5a5a; z-index: 2; }
.bb-office-indent-first { top: 1px; height: 9px; clip-path: polygon(0 0, 100% 0, 50% 100%); }
.bb-office-indent-left { top: 12px; clip-path: polygon(50% 0, 100% 40%, 100% 100%, 0 100%, 0 40%); height: 10px; }
.bb-office-tab-stop {
  position: absolute; bottom: 0; width: 10px; height: 12px; font: 700 9px/12px var(--bb-office-font); text-align: center;
  color: var(--bb-office-accent); cursor: grab; z-index: 2;
}
.bb-office-col-marker {
  position: absolute; top: 0; bottom: 0; width: 6px; cursor: col-resize; z-index: 2; border-left: 1px dashed transparent;
}
.bb-office-col-marker:hover { border-left-color: var(--bb-office-accent); }

/* Styles */
.bb-office-styles-gallery { display: flex; flex-wrap: wrap; gap: 4px; }
.bb-office-style-tile {
  display: flex; flex-direction: column; align-items: center; width: 92px; padding: 6px 4px; background: #fff; border: 1px solid var(--bb-office-border); cursor: pointer; font: inherit;
}
.bb-office-style-tile:hover:not(:disabled) { border-color: var(--bb-office-accent); }
.bb-office-style-tile.is-active { border-color: var(--bb-office-accent); box-shadow: inset 0 0 0 1px var(--bb-office-accent); }
.bb-office-style-tile-preview { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.bb-office-style-tile-label { font-size: 11px; color: var(--bb-office-muted); }
.bb-office-styles-pane { display: flex; flex-direction: column; gap: 6px; }
.bb-office-pane-title { margin: 0; font-size: 13px; font-weight: 600; }
.bb-office-styles-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.bb-office-style-item {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 6px 8px; font: inherit; text-align: left;
  background: transparent; border: 1px solid transparent; cursor: pointer; color: inherit;
}
.bb-office-style-item:hover:not(:disabled) { background: var(--bb-office-surface); }
.bb-office-style-item.is-active { background: #deecf9; border-color: #9cc0ea; }
.bb-office-style-item-id { font-size: 11px; color: var(--bb-office-muted); }

/* Find and replace */
.bb-office-find {
  display: flex; flex-direction: column; gap: 4px; padding: 6px 8px; background: #fff; border-bottom: 1px solid var(--bb-office-border); position: relative; z-index: 4;
}
.bb-office-find-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.bb-office-find-label { width: 56px; color: var(--bb-office-muted); }
.bb-office-find-input {
  width: 240px; max-width: 100%; height: 26px; padding: 2px 6px; font: inherit; border: 1px solid var(--bb-office-border); border-radius: 2px;
}
.bb-office-find-input.is-invalid { border-color: var(--bb-office-contextual); }
.bb-office-find-count { min-width: 90px; color: var(--bb-office-muted); }
.bb-office-find-count.is-error { color: var(--bb-office-contextual); }
.bb-office-find-button {
  height: 26px; padding: 0 8px; font: inherit; background: var(--bb-office-surface); border: 1px solid var(--bb-office-border); border-radius: 2px; cursor: pointer;
}
.bb-office-find-button:hover:not(:disabled) { background: var(--bb-office-surface-strong); }
.bb-office-find-options { display: inline-flex; gap: 2px; }
.bb-office-find-toggle {
  height: 26px; min-width: 28px; padding: 0 6px; font: inherit; background: transparent; border: 1px solid var(--bb-office-border); border-radius: 2px; cursor: pointer;
}
.bb-office-find-close { border: 0; background: transparent; font-size: 16px; cursor: pointer; color: var(--bb-office-muted); margin-left: auto; }
.bb-office-find-match { background: #fff1a8; }
.bb-office-find-current { background: #f2a33c; color: #000; }

/* View and zoom controls */
.bb-office-footer { display: flex; align-items: center; gap: 8px; padding: 2px 8px; background: var(--bb-office-surface); border-top: 1px solid var(--bb-office-border); }
.bb-office-footer-controls { display: flex; align-items: center; gap: 12px; margin-left: auto; flex-wrap: wrap; }
.bb-office-view-controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.bb-office-view-switch { display: inline-flex; border: 1px solid var(--bb-office-border); border-radius: 2px; overflow: hidden; }
.bb-office-view-switch-button {
  height: 24px; padding: 0 8px; font: inherit; background: #fff; border: 0; border-right: 1px solid var(--bb-office-border); cursor: pointer;
}
.bb-office-view-switch-button:last-child { border-right: 0; }
.bb-office-view-switch-button.is-active { background: #d2e3f7; color: #0b3a6b; font-weight: 600; }
.bb-office-zoom { display: inline-flex; align-items: center; gap: 4px; }
.bb-office-zoom-select { height: 24px; font: inherit; border: 1px solid var(--bb-office-border); background: #fff; border-radius: 2px; }
.bb-office-focus-exit {
  position: absolute; right: 12px; bottom: 36px; z-index: 10; padding: 4px 10px; font: inherit; background: #fff; border: 1px solid var(--bb-office-border); cursor: pointer;
}

/* Status bar */
.bb-office-statusbar { display: flex; align-items: center; gap: 12px; flex: 1 1 auto; min-width: 0; color: var(--bb-office-muted); white-space: nowrap; overflow: hidden; }
.bb-office-status-item { display: inline-flex; align-items: center; gap: 6px; }
.bb-office-status-label { color: var(--bb-office-text); font-weight: 600; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
.bb-office-status-separator { opacity: 0.6; }
.bb-office-status-state { padding: 0 6px; border-radius: 9px; background: var(--bb-office-surface-strong); color: var(--bb-office-text); text-transform: capitalize; }
.bb-office-status-spacer { flex: 1 1 auto; }
.bb-office-presence { display: inline-flex; align-items: center; }
.bb-office-presence-avatar {
  display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; margin-left: -4px; border-radius: 50%;
  color: #fff; font-size: 10px; font-weight: 600; border: 2px solid #fff;
}
`;
