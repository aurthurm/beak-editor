/**
 * Review extension: registers the revision marks and the track changes plugin.
 *
 * The extension shape is defined locally, so this package does not depend on the core
 * `BeakExtension` type. It matches contract section 1.4.
 *
 * @module
 */

import type { MarkSpec, Schema } from 'prosemirror-model';
import type { Plugin } from 'prosemirror-state';

import { createRevisionTrackingPlugin, type RevisionTrackingOptions } from './trackChanges';
import { deletionMarkSpec, insertionMarkSpec } from './marks';

/** Context passed to an extension's `plugins` factory. */
export interface ReviewExtensionContext {
  schema: Schema;
  editor?: unknown;
}

/** Extension shape. Compatible with `BeakExtension` in contract section 1.4. */
export interface ReviewExtension {
  name: string;
  marks: Record<string, MarkSpec>;
  plugins: (ctx: ReviewExtensionContext) => Plugin[];
}

/**
 * Creates the review extension.
 *
 * @example
 * ```typescript
 * const editor = new BeakBlockEditor({ extensions: [reviewExtension({ author: { id: 'u1', name: 'Ada' }, store })] });
 * ```
 */
export function reviewExtension(options: RevisionTrackingOptions): ReviewExtension {
  return {
    name: 'review',
    marks: {
      insertion: insertionMarkSpec,
      deletion: deletionMarkSpec,
    },
    plugins: () => [createRevisionTrackingPlugin(options)],
  };
}
