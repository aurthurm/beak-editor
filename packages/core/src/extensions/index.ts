/**
 * Editor modes and extension types.
 *
 * @module
 */

import type { Plugin } from 'prosemirror-state';
import type { MarkSpec, NodeSpec, Schema } from 'prosemirror-model';
import type { NodeViewConstructor } from 'prosemirror-view';
import type { BeakBlockDefinition } from '../registry/types';
import type { BeakBlockEditor } from '../editor/Editor';

/**
 * Editor projection.
 *
 * - `block`: drag handles and slash menu (default)
 * - `office`: Office shell; block chrome is disabled
 * - `controlled`: Office behaviour plus enforced governance; block chrome is disabled
 */
export type EditorMode = 'block' | 'office' | 'controlled';

/** Modes that disable block chrome (drag handles, slash menu). */
export const CHROME_DISABLED_MODES: readonly EditorMode[] = ['office', 'controlled'];

/** Context passed to an extension's `plugins` factory. */
export interface BeakExtensionContext {
  schema: Schema;
  editor: BeakBlockEditor;
}

/**
 * An editor extension. Extensions contribute schema nodes and marks,
 * ProseMirror plugins and node views, and block definitions.
 *
 * @example
 * ```typescript
 * const highlight: BeakExtension = {
 *   name: 'highlight',
 *   marks: { highlight: { parseDOM: [{ tag: 'mark' }], toDOM: () => ['mark', 0] } },
 * };
 * const editor = new BeakBlockEditor({ extensions: [highlight] });
 * ```
 */
export interface BeakExtension {
  name: string;
  nodes?: Record<string, NodeSpec>;
  marks?: Record<string, MarkSpec>;
  plugins?: (ctx: BeakExtensionContext) => Plugin[];
  nodeViews?: Record<string, NodeViewConstructor>;
  /** Registered into `editor.blockRegistry` (replacing built-ins of the same type). */
  blocks?: BeakBlockDefinition[];
}
