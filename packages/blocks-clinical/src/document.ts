/**
 * Document-level validation for controlled clinical and lab documents.
 *
 * Runs block validators for every clinical and form block, then document rules:
 * at least one procedure step, a mandatory safety warning for configured procedure
 * types, and configurable placeholder rules (the roadmap section 5F table).
 *
 * @module
 */

import { createDefaultBlockRegistry, type Block, type ValidationIssue } from '@amusendame/beakblock-core';
import { createClinicalDefinitions } from './clinical/definitions';
import { equipmentIssues } from './clinical/equipment';
import type { ClinicalExtensionOptions } from './clinical/types';
import { DEFAULT_ALLOWED_UNITS } from './clinical/constants';
import { createFormDefinitions } from './forms/definitions';
import { FORM_FIELD_TYPES } from './forms/nodes';
import { isEmptyValue } from './forms/validation';
import { toFiniteNumber, walkBlocks } from './util';

/** A rule applied to form fields with a matching `name`. */
export interface PlaceholderRule {
  /** The field must be read-only (for example, generated or set by a workflow). */
  readOnly?: boolean;
  /** The field must have a value. */
  required?: boolean;
  /** Maximum length of the value, in characters. */
  maxLength?: number;
  /** The value must be numeric. */
  numeric?: boolean;
  /** The field's `unit` must be one of these. */
  allowedUnits?: readonly string[];
}

/** Placeholder rules keyed by field name. */
export type PlaceholderRules = Record<string, PlaceholderRule>;

/**
 * Example placeholder rules from roadmap section 5F. Adapt the field names and
 * values to the template in use.
 *
 * | Field | Rule |
 * | --- | --- |
 * | `sopNumber` | generated, read-only |
 * | `title` | required, max length |
 * | `effectiveDate` | set by the approval workflow (read-only here) |
 * | `concentration` | numeric, allowed units |
 */
export const EXAMPLE_PLACEHOLDER_RULES: PlaceholderRules = {
  sopNumber: { readOnly: true, required: true },
  title: { required: true, maxLength: 200 },
  effectiveDate: { readOnly: true },
  concentration: { numeric: true, allowedUnits: DEFAULT_ALLOWED_UNITS },
};

/** Options for {@link validateClinicalDocument}. */
export interface ClinicalDocumentOptions extends ClinicalExtensionOptions {
  /** The procedure type of this document, e.g. `'hazardous-reagent'`. */
  procedureType?: string | null;
  /** Procedure types that must contain a `safetyWarning`. */
  safetyRequiredFor?: readonly string[];
  /** Placeholder rules applied to form fields by name. */
  placeholderRules?: PlaceholderRules;
  /**
   * Every block type the document may contain, including types from other extensions. When given,
   * a block whose type is neither clinical, form nor listed here is reported as
   * `unregistered-block-type`. When omitted, types owned by other extensions are not judged.
   */
  knownBlockTypes?: readonly string[];
}

function applyPlaceholderRule(block: Block, name: string, rule: PlaceholderRule, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (code: string, message: string) =>
    issues.push({ severity: 'error', code, message, blockId: block.id, path });
  const value = block.props.value;

  if (rule.readOnly && block.props.readOnly !== true) {
    push('placeholder-not-readonly', `"${name}" must be read-only`);
  }
  if (isEmptyValue(block.type, value)) {
    if (rule.required) push('placeholder-required', `"${name}" is required`);
    return issues;
  }
  if (rule.maxLength !== undefined && String(value).length > rule.maxLength) {
    push('placeholder-too-long', `"${name}" must be at most ${rule.maxLength} characters`);
  }
  if (rule.numeric && toFiniteNumber(value) === null) {
    push('placeholder-not-numeric', `"${name}" must be numeric`);
  }
  if (rule.allowedUnits) {
    const unit = typeof block.props.unit === 'string' ? block.props.unit : '';
    if (!rule.allowedUnits.includes(unit)) {
      push('placeholder-unit-not-allowed', `"${name}" unit "${unit}" is not allowed`);
    }
  }
  return issues;
}

/**
 * Validates a controlled clinical or lab document.
 *
 * @example
 * ```typescript
 * const issues = validateClinicalDocument(editor.getDocument(), {
 *   procedureType: 'hazardous-reagent',
 *   safetyRequiredFor: ['hazardous-reagent'],
 *   placeholderRules: EXAMPLE_PLACEHOLDER_RULES,
 * });
 * ```
 *
 * @param blocks - Top-level blocks, as returned by `editor.getDocument()`
 * @returns All findings in document order, block findings first
 */
export function validateClinicalDocument(blocks: Block[], options: ClinicalDocumentOptions = {}): ValidationIssue[] {
  const cache = options.equipmentCache ?? new Map();
  const registry = createDefaultBlockRegistry();
  for (const definition of [...createClinicalDefinitions(options, cache), ...createFormDefinitions()]) {
    registry.register(definition, { replace: true });
  }
  // This validator owns clinical and form blocks only. Unregistered types belong to other
  // extensions (conditional, caption, equation, ...) and are not judged unless the caller lists them.
  const issues = registry
    .validate(blocks)
    .filter((issue) => issue.code !== 'unregistered-block-type');

  const all: Array<{ block: Block; path: string }> = [];
  walkBlocks(blocks, (block, path) => all.push({ block, path }));

  if (options.knownBlockTypes) {
    const known = new Set(options.knownBlockTypes);
    for (const { block, path } of all) {
      if (registry.has(block.type) || known.has(block.type)) continue;
      issues.push({
        severity: 'warning',
        code: 'unregistered-block-type',
        message: `Block type "${block.type}" is not registered`,
        blockId: block.id,
        path,
      });
    }
  }

  if (!all.some(({ block }) => block.type === 'sopStep')) {
    issues.push({ severity: 'error', code: 'no-procedure-steps', message: 'At least one procedure step is required' });
  }

  const procedureType = options.procedureType ?? null;
  const safetyRequired = procedureType !== null && (options.safetyRequiredFor ?? []).includes(procedureType);
  if (safetyRequired && !all.some(({ block }) => block.type === 'safetyWarning')) {
    issues.push({
      severity: 'error',
      code: 'safety-warning-required',
      message: `Procedure type "${procedureType}" requires a safety warning`,
    });
  }

  // Inline equipment references are checked against the cache when one is supplied.
  if (options.equipmentCache) {
    for (const { block, path } of all) {
      for (const item of block.content ?? []) {
        if (item.type === 'equipmentReference') {
          issues.push(...equipmentIssues(item.props, options.equipmentCache, path));
        }
      }
    }
  }

  const rules = options.placeholderRules ?? {};
  for (const { block, path } of all) {
    const name = block.props.name;
    if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(rules, name)) continue;
    if (!FORM_FIELD_TYPES.has(block.type)) continue;
    issues.push(...applyPlaceholderRule(block, name, rules[name] as PlaceholderRule, path));
  }
  return issues;
}
