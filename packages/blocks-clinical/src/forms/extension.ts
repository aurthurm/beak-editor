/**
 * The forms extension: form control nodes, interactive node views, calculated
 * fields and form block definitions.
 *
 * @module
 */

import type { BeakExtension } from '@amusendame/beakblock-core';
import { createFormCalculationPlugin } from './calculation';
import { createFormDefinitions } from './definitions';
import { createFormEditablePlugin } from './editablePlugin';
import { FORM_NODES } from './nodes';
import { createFormControlView } from './nodeViews';

/** Options for {@link formsExtension}. */
export interface FormsExtensionOptions {
  /** Decimal places for calculated results when a field does not set `decimals`. @default 2 */
  defaultDecimals?: number;
}

/**
 * Creates the forms extension.
 *
 * @example
 * ```typescript
 * const editor = new BeakBlockEditor({ extensions: [formsExtension()] });
 * ```
 */
export function formsExtension(options: FormsExtensionOptions = {}): BeakExtension {
  const defaultDecimals = options.defaultDecimals ?? 2;
  const control = createFormControlView();
  const nodeViews = Object.fromEntries(
    Object.keys(FORM_NODES)
      .filter((type) => type !== 'validatedFormSection' && type !== 'formRepeatableRow')
      .map((type) => [type, control])
  );
  return {
    name: 'beakblock-forms',
    nodes: FORM_NODES,
    nodeViews,
    plugins: () => [createFormCalculationPlugin(defaultDecimals), createFormEditablePlugin()],
    blocks: createFormDefinitions(),
  };
}
