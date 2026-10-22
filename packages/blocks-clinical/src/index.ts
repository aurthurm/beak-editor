/**
 * @amusendame/beakblock-blocks-clinical
 *
 * Clinical and lab semantic blocks (SOP steps, safety warnings, reagent tables,
 * method, specimen and QC specifications, equipment references) and form controls
 * (text, number, date, dropdown, checkbox, radio, repeatable rows, calculated fields
 * and validated sections), with validators, print HTML, and document-level rules.
 *
 * @module
 */

export { clinicalExtension } from './clinical/extension';
export { formsExtension } from './forms/extension';
export type { FormsExtensionOptions } from './forms/extension';
export type { ClinicalExtensionOptions } from './clinical/types';

export {
  CLINICAL_NODES,
  sopStepNode,
  safetyWarningNode,
  reagentTableNode,
  testMethodSpecNode,
  specimenRequirementsNode,
  qcCriteriaNode,
  equipmentReferenceNode,
} from './clinical/nodes';

export {
  DEFAULT_ALLOWED_UNITS,
  DEFAULT_METHOD_CODE_PATTERN,
  DEFAULT_REAGENT_COLUMNS,
  GHS_HAZARD_CODE_PATTERN,
  SAFETY_LEVELS,
  WESTGARD_RULES,
} from './clinical/constants';
export type { SafetyLevel, WestgardRule } from './clinical/constants';

export {
  validateSopStep,
  validateSafetyWarning,
  validateReagentTable,
  validateTestMethodSpec,
  validateSpecimenRequirements,
  validateQcCriteria,
} from './clinical/validators';
export type { ClinicalValidationOptions } from './clinical/validators';

export {
  EquipmentReferenceView,
  equipmentIssues,
  validateEquipmentReferences,
} from './clinical/equipment';
export type { EquipmentProvider, EquipmentRecord, EquipmentCache } from './clinical/equipment';

export {
  STEP_NUMBERING_PLUGIN_KEY,
  computeStepNumberTransaction,
  createStepNumberingPlugin,
} from './clinical/stepNumbering';

export { FORM_FIELD_TYPES, FORM_NODES, FORM_CONTAINER_TYPES } from './forms/nodes';
export {
  collectFormValues,
  validateForm,
  validateFormBlock,
  isEmptyValue,
  safeEvaluate,
} from './forms/validation';
export {
  evaluateFormula,
  parseFormula,
  formulaReferences,
  FormulaError,
  FORMULA_MAX_LENGTH,
  FORMULA_MAX_DEPTH,
} from './forms/formula';
export type { FormulaNode } from './forms/formula';
export {
  calculationTransaction,
  createFormCalculationPlugin,
  FORM_CALCULATION_PLUGIN_KEY,
} from './forms/calculation';
export { FormControlView, createFormControlView, formatCalculated } from './forms/nodeViews';

export {
  validateClinicalDocument,
  EXAMPLE_PLACEHOLDER_RULES,
} from './document';
export type { ClinicalDocumentOptions, PlaceholderRule, PlaceholderRules } from './document';

export { CLINICAL_STYLES, injectClinicalStyles } from './styles';
