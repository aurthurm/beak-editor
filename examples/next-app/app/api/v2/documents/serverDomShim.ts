/**
 * Server-only DOM stub. `@amusendame/beakblock-core` (and the permissions and templates packages that
 * import it) touch `document` and `documentElement.style` when the module loads: prosemirror-view feature
 * detection and a markdown entity decoder. Node has neither, so importing the packages throws.
 *
 * This module must be the first import of the route, and the route must call `restoreServerGlobals()` after its
 * imports. It is a no-op in the browser, where the real DOM exists.
 * Entity decoding through the stub returns empty strings, so the server must not rely on HTML entity
 * decoding of block text. Remove this file once the core package no longer touches the DOM at import time.
 */

const installedHere = typeof document === 'undefined';

if (installedHere) {
  const makeElement = (): Record<string, unknown> => ({
    style: {},
    innerHTML: '',
    textContent: '',
    className: '',
    setAttribute() {},
    removeAttribute() {},
    appendChild() {},
    addEventListener() {},
    removeEventListener() {},
    classList: { add() {}, remove() {}, contains: () => false },
  });
  const stub = {
    createElement: makeElement,
    documentElement: makeElement(),
    body: makeElement(),
    activeElement: null,
    addEventListener() {},
    removeEventListener() {},
  };
  (globalThis as unknown as { document: unknown }).document = stub;
}

/**
 * Remove the stub again. Call after the packages have loaded (the route does this at module level, after its
 * imports). Leaving `document` defined in the server process makes Next's SSR of other routes call into it.
 */
export function restoreServerGlobals(): void {
  if (installedHere) {
    delete (globalThis as { document?: unknown }).document;
  }
}
