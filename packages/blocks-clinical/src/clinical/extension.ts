/**
 * The clinical extension: block nodes, the equipment node view, step numbering and
 * clinical block definitions.
 *
 * @module
 */

import type { BeakExtension } from '@amusendame/beakblock-core';
import { EquipmentReferenceView, type EquipmentCache } from './equipment';
import { createClinicalDefinitions } from './definitions';
import { CLINICAL_NODES } from './nodes';
import { createStepNumberingPlugin } from './stepNumbering';
import type { ClinicalExtensionOptions } from './types';
import { injectClinicalStyles } from '../styles';

/**
 * Creates the clinical and lab extension.
 *
 * @example
 * ```typescript
 * const editor = new BeakBlockEditor({
 *   extensions: [
 *     clinicalExtension({ equipmentProvider: limsEquipment, allowedUnits: ['mg/mL', 'mmol/L'] }),
 *   ],
 * });
 * ```
 */
export function clinicalExtension(options: ClinicalExtensionOptions = {}): BeakExtension {
  // Step numbers are drawn with CSS (`::before`), so the stylesheet is injected here unless disabled.
  if (options.injectStyles !== false) injectClinicalStyles();
  const cache: EquipmentCache = options.equipmentCache ?? new Map();
  return {
    name: 'beakblock-clinical',
    nodes: CLINICAL_NODES,
    nodeViews: {
      equipmentReference: (node) => new EquipmentReferenceView(node, options.equipmentProvider, cache),
    },
    plugins: () => [createStepNumberingPlugin()],
    blocks: createClinicalDefinitions(options, cache),
  };
}
