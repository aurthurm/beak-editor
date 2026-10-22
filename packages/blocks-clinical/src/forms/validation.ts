/**
 * Form value collection and validation.
 *
 * @module
 */

import type { Block, ValidationContext, ValidationIssue } from '@amusendame/beakblock-core';
import { isIsoDate, stringArray, toFiniteNumber, walkBlocks } from '../util';
import { FORM_FIELD_TYPES } from './nodes';
import { evaluateFormula, formulaReferences, FormulaError } from './formula';

/** Whether a field value counts as empty for the `required` rule. */
export function isEmptyValue(type: string, value: unknown): boolean {
  if (type === 'formCheckbox') return value !== true;
  return value === null || value === undefined || value === '';
}

/** Evaluates a calculated field against values, returning `null` when it cannot be computed. */
export function safeEvaluate(expression: unknown, values: Record<string, unknown>, decimals?: unknown): number | null {
  if (typeof expression !== 'string' || expression.trim() === '') return null;
  try {
    const result = evaluateFormula(expression, values);
    const places = toFiniteNumber(decimals);
    if (places === null) return result;
    const factor = 10 ** Math.max(0, Math.min(10, Math.trunc(places)));
    return Math.round(result * factor) / factor;
  } catch (error) {
    if (error instanceof FormulaError) return null;
    throw error;
  }
}

/**
 * Collects field values from blocks into a flat map keyed by field `name`.
 *
 * - Fields contribute `props.value` (or `null`).
 * - Rows with a `name` contribute an array of per-row objects; nameless rows
 *   contribute their fields to the top level.
 * - Calculated fields contribute their evaluated result.
 *
 * @param blocks - Top-level blocks
 */
export function collectFormValues(blocks: Block[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  const calcs: Array<{ target: Record<string, unknown>; block: Block }> = [];

  const gather = (list: Block[], target: Record<string, unknown>): void => {
    for (const block of list) {
      const name = typeof block.props.name === 'string' && block.props.name !== '' ? block.props.name : null;
      if (block.type === 'formRepeatableRow') {
        const row: Record<string, unknown> = {};
        gather(block.children ?? [], row);
        if (name) {
          const existing = target[name];
          target[name] = Array.isArray(existing) ? [...existing, row] : [row];
        } else {
          Object.assign(target, row);
        }
      } else if (block.type === 'formCalculated') {
        calcs.push({ target, block });
      } else if (FORM_FIELD_TYPES.has(block.type)) {
        if (name) target[name] = block.props.value ?? null;
      } else if (block.children?.length) {
        gather(block.children, target);
      }
    }
  };
  gather(blocks, values);

  // Evaluate calculations until they settle (calculations may reference other calculations).
  for (let pass = 0; pass <= calcs.length; pass++) {
    let changed = false;
    for (const { target, block } of calcs) {
      const name = typeof block.props.name === 'string' && block.props.name !== '' ? block.props.name : null;
      if (!name) continue;
      const result = safeEvaluate(block.props.expression, values, block.props.decimals ?? 2);
      if (target[name] !== result) {
        target[name] = result;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return values;
}

const valuesCache = new WeakMap<Block[], Record<string, unknown>>();

function valuesFor(blocks: Block[]): Record<string, unknown> {
  let values = valuesCache.get(blocks);
  if (!values) {
    values = collectFormValues(blocks);
    valuesCache.set(blocks, values);
  }
  return values;
}

/**
 * Validates one form block (field or container) against the rules:
 *
 * - `required-missing`: required field has no value (checkboxes must be ticked)
 * - `not-a-number`, `out-of-range`: number fields
 * - `unit-not-allowed`: a unit outside `allowedUnits`
 * - `invalid-date`, `date-out-of-range`: date fields
 * - `invalid-option`: dropdown or radio value not in `options`
 * - `invalid-formula`, `unknown-reference`: calculated fields
 * - `empty-section`: a validated section with no content (warning)
 *
 * Used by the block registry and by {@link validateForm}.
 */
export function validateFormBlock(block: Block, ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (severity: ValidationIssue['severity'], code: string, message: string) =>
    issues.push({ severity, code, message, blockId: block.id });

  if (block.type === 'validatedFormSection' && !(block.children?.length)) {
    push('warning', 'empty-section', 'Validated section has no fields');
    return issues;
  }
  if (!FORM_FIELD_TYPES.has(block.type)) return issues;

  const props = block.props;
  const label = String(props.label || props.name || block.type);
  const value = props.value;

  if (block.type === 'formCalculated') {
    try {
      const values = valuesFor(ctx.blocks);
      for (const reference of formulaReferences(String(props.expression ?? ''))) {
        if (!Object.prototype.hasOwnProperty.call(values, reference)) {
          push('error', 'unknown-reference', `"${label}" references unknown field "${reference}"`);
        }
      }
    } catch (error) {
      if (error instanceof FormulaError) push('error', 'invalid-formula', `"${label}": ${error.message}`);
      else throw error;
    }
    return issues;
  }

  if (isEmptyValue(block.type, value)) {
    if (props.required === true) push('error', 'required-missing', `${label} is required`);
    return issues;
  }

  switch (block.type) {
    case 'formNumber': {
      const number = toFiniteNumber(value);
      if (number === null) {
        push('error', 'not-a-number', `${label} must be a number`);
        break;
      }
      const min = toFiniteNumber(props.min);
      const max = toFiniteNumber(props.max);
      if (min !== null && number < min) push('error', 'out-of-range', `${label} must be at least ${min}`);
      if (max !== null && number > max) push('error', 'out-of-range', `${label} must be at most ${max}`);
      const allowed = stringArray(props.allowedUnits);
      if (typeof props.unit === 'string' && props.unit !== '' && allowed.length > 0 && !allowed.includes(props.unit)) {
        push('error', 'unit-not-allowed', `${label}: unit "${props.unit}" is not allowed (allowed: ${allowed.join(', ')})`);
      }
      break;
    }
    case 'formDate': {
      if (!isIsoDate(value)) {
        push('error', 'invalid-date', `${label} must be a date (YYYY-MM-DD)`);
        break;
      }
      if (typeof props.min === 'string' && value < props.min) push('error', 'date-out-of-range', `${label} must be on or after ${props.min}`);
      if (typeof props.max === 'string' && value > props.max) push('error', 'date-out-of-range', `${label} must be on or before ${props.max}`);
      break;
    }
    case 'formDropdown':
    case 'formRadio': {
      if (!stringArray(props.options).includes(String(value))) {
        push('error', 'invalid-option', `${label} must be one of the listed options`);
      }
      break;
    }
    default:
      break;
  }
  return issues;
}

/**
 * Validates every form field and container in a document.
 *
 * @param blocks - Top-level blocks
 * @returns Issues in document order, each with a `path`
 */
export function validateForm(blocks: Block[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ctx: ValidationContext = { blocks };
  walkBlocks(blocks, (block, path) => {
    for (const issue of validateFormBlock(block, ctx)) {
      issues.push({ ...issue, path: issue.path ?? path });
    }
  });
  return issues;
}
