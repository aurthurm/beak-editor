/**
 * The QMS extension: bundles nodes, plugin, node views and block definitions.
 *
 * @module
 */

import type { BeakExtension } from '@amusendame/beakblock-core';

import { createControlledSectionPlugin } from './plugin';
import { qmsNodeViews } from './nodeViews';
import { qmsBlockDefinitions } from './blockDefinitions';
import { QMS_NODE_SPECS } from './nodes';
import { injectQmsStyles } from './styles';
import type { QmsExtensionOptions } from './types';

/**
 * Creates the QMS extension for `new BeakBlockEditor({ extensions: [qmsExtension()] })`.
 *
 * @example
 * ```typescript
 * const editor = new BeakBlockEditor({
 *   element,
 *   mode: 'controlled',
 *   extensions: [qmsExtension({ getPolicyContext: (state) => policyFor(state) })],
 * });
 * ```
 */
export function qmsExtension(options: QmsExtensionOptions = {}): BeakExtension {
  // Controlled-section tabs and states are styled by the QMS stylesheet, so inject it unless disabled.
  if (options.injectStyles !== false) injectQmsStyles();
  return {
    name: 'beakblock-qms',
    nodes: { ...QMS_NODE_SPECS },
    plugins: () => [createControlledSectionPlugin(options)],
    nodeViews: { ...qmsNodeViews },
    blocks: [...qmsBlockDefinitions],
  };
}
