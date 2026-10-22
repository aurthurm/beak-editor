/**
 * Constants for clinical and lab blocks.
 *
 * @module
 */

/** Safety warning severity levels. */
export const SAFETY_LEVELS = ['caution', 'warning', 'danger'] as const;
/** A safety warning severity level. */
export type SafetyLevel = (typeof SAFETY_LEVELS)[number];

/**
 * GHS hazard statement code pattern: `H2xx` (physical), `H3xx` (health), `H4xx` (environmental).
 */
export const GHS_HAZARD_CODE_PATTERN = /^H[234]\d{2}$/;

/** Westgard QC rules accepted by `qcCriteria`. */
export const WESTGARD_RULES = ['1_2s', '1_3s', '2_2s', 'R_4s', '4_1s', '10_x'] as const;
/** A Westgard QC rule name. */
export type WestgardRule = (typeof WESTGARD_RULES)[number];

/** Default units accepted in reagent table `Unit` cells. */
export const DEFAULT_ALLOWED_UNITS: readonly string[] = [
  'mg/mL',
  'µg/mL',
  'mol/L',
  'mmol/L',
  '%',
  'g/L',
  'U/mL',
];

/** Default header names required in a reagent table. */
export const DEFAULT_REAGENT_COLUMNS: readonly string[] = [
  'Reagent',
  'Concentration',
  'Unit',
  'Lot',
  'Expiry',
];

/**
 * Default method code pattern: an uppercase prefix, a hyphen and an alphanumeric suffix,
 * e.g. `ASSAY-GLU01` or `LC-MS.2`.
 */
export const DEFAULT_METHOD_CODE_PATTERN = /^[A-Z]{2,6}-[A-Z0-9][A-Z0-9.-]{0,19}$/;
