/**
 * Option types for the clinical extension.
 *
 * @module
 */

import type { ClinicalValidationOptions } from './validators';
import type { EquipmentCache, EquipmentProvider } from './equipment';

/** Options for {@link clinicalExtension}. */
export interface ClinicalExtensionOptions extends ClinicalValidationOptions {
  /**
   * Injects the clinical stylesheet (step numbers, safety warnings, reagent tables) into the
   * document head once. Default `true`. Set `false` to supply your own CSS.
   */
  injectStyles?: boolean;
  /** Source of authorised equipment (typically a LIMS adapter). */
  equipmentProvider?: EquipmentProvider;
  /** Lookup cache shared with validation. A new cache is created when omitted. */
  equipmentCache?: EquipmentCache;
}
