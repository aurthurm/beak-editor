/**
 * Injects the Office shell stylesheet once per document.
 *
 * The CSS itself lives in `officeShellCss.ts` as a framework-neutral string, so the Vue
 * bindings can ship the same look.
 *
 * @module
 */

import { officeShellCSS } from './officeShellCss';

/** Id of the `<style>` element holding the Office shell CSS. */
export const OFFICE_SHELL_STYLE_ID = 'bb-office-shell-styles';

/**
 * Add the Office shell stylesheet to the document head if it is not already there.
 * Returns true when a stylesheet was added. Safe to call during server rendering (no-op).
 */
export function injectOfficeShellStyles(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.getElementById(OFFICE_SHELL_STYLE_ID)) return false;
  const style = document.createElement('style');
  style.id = OFFICE_SHELL_STYLE_ID;
  style.textContent = officeShellCSS;
  document.head.appendChild(style);
  return true;
}
