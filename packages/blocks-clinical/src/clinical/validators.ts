/**
 * Validators for clinical and lab blocks.
 *
 * Each validator takes block JSON and returns {@link ValidationIssue}s. They are
 * used by the block registry and can be called directly.
 *
 * @module
 */

import type { Block, ValidationIssue } from '@amusendame/beakblock-core';
import { blockText, isIsoDate, stringArray, toFiniteNumber } from '../util';
import {
  DEFAULT_ALLOWED_UNITS,
  DEFAULT_METHOD_CODE_PATTERN,
  DEFAULT_REAGENT_COLUMNS,
  GHS_HAZARD_CODE_PATTERN,
  SAFETY_LEVELS,
  WESTGARD_RULES,
} from './constants';

/** Options accepted by the clinical validators. */
export interface ClinicalValidationOptions {
  /** Units accepted in reagent table `Unit` cells. */
  allowedUnits?: readonly string[];
  /** Pattern a test method code must match. */
  methodCodePattern?: RegExp;
}

function issue(block: Block, severity: ValidationIssue['severity'], code: string, message: string): ValidationIssue {
  return { severity, code, message, blockId: block.id };
}

/**
 * Validates a `sopStep`: the step should contain text, and `stepNumber` and
 * `timeMinutes` must be positive or non-negative numbers when set.
 */
export function validateSopStep(block: Block): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (blockText(block) === '') {
    issues.push(issue(block, 'warning', 'empty-step', 'Procedure step has no text'));
  }
  const { stepNumber, timeMinutes } = block.props;
  if (stepNumber != null && !(Number.isInteger(stepNumber) && (stepNumber as number) > 0)) {
    issues.push(issue(block, 'error', 'invalid-step-number', 'Step number must be a positive integer'));
  }
  if (timeMinutes != null) {
    const minutes = toFiniteNumber(timeMinutes);
    if (minutes === null || minutes < 0) {
      issues.push(issue(block, 'error', 'invalid-time', 'Step time must be a non-negative number of minutes'));
    }
  }
  return issues;
}

/**
 * Validates a `safetyWarning`: non-empty text, a known severity level, and
 * GHS hazard codes in the `H2xx`/`H3xx`/`H4xx` format.
 */
export function validateSafetyWarning(block: Block): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (blockText(block) === '') {
    issues.push(issue(block, 'error', 'empty-safety-text', 'Safety warning text is required'));
  }
  const level = block.props.level;
  if (!(SAFETY_LEVELS as readonly unknown[]).includes(level)) {
    issues.push(issue(block, 'error', 'invalid-level', `Safety level must be one of ${SAFETY_LEVELS.join(', ')}`));
  }
  for (const code of stringArray(block.props.hazardCodes)) {
    if (!GHS_HAZARD_CODE_PATTERN.test(code)) {
      issues.push(issue(block, 'error', 'invalid-hazard-code', `"${code}" is not a GHS hazard code (expected e.g. H314)`));
    }
  }
  if (level === 'danger' && stringArray(block.props.hazardCodes).length === 0) {
    issues.push(issue(block, 'warning', 'missing-hazard-codes', 'Danger warnings should list GHS hazard codes'));
  }
  return issues;
}

/** Normalises a header name for case-insensitive comparison. */
function normaliseHeader(text: string): string {
  return text.trim().toLowerCase();
}

/** Plain text of a table cell. */
function cellText(cell: Block | undefined): string {
  return cell ? blockText(cell).trim() : '';
}

/**
 * Validates a `reagentTable`: the wrapped table's header row must contain the
 * required columns, `Unit` cells must be in the allowed units list, and
 * `Expiry` cells must be ISO dates (`YYYY-MM-DD`).
 */
export function validateReagentTable(block: Block, options: ClinicalValidationOptions = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allowedUnits = options.allowedUnits ?? DEFAULT_ALLOWED_UNITS;
  const requiredColumns = stringArray(block.props.requiredColumns);
  const columns = requiredColumns.length > 0 ? requiredColumns : [...DEFAULT_REAGENT_COLUMNS];

  const table = block.children?.find((child) => child.type === 'table');
  if (!table) {
    issues.push(issue(block, 'error', 'missing-table', 'Reagent table must contain a table'));
    return issues;
  }
  const rows = (table.children ?? []).filter((child) => child.type === 'tableRow');
  const headerRow = rows.find((row) => row.props.isHeader === true) ?? rows[0];
  if (!headerRow) {
    issues.push(issue(block, 'error', 'missing-header', 'Reagent table has no header row'));
    return issues;
  }
  const headers = (headerRow.children ?? []).map((cell) => normaliseHeader(cellText(cell)));
  const indexOf = (name: string) => headers.indexOf(normaliseHeader(name));

  for (const column of columns) {
    if (indexOf(column) === -1) {
      issues.push(issue(block, 'error', 'missing-required-column', `Reagent table is missing the "${column}" column`));
    }
  }

  const unitIndex = indexOf('Unit');
  const expiryIndex = indexOf('Expiry');
  const dataRows = rows.filter((row) => row !== headerRow);
  dataRows.forEach((row, rowIndex) => {
    const cells = row.children ?? [];
    if (unitIndex !== -1) {
      const unit = cellText(cells[unitIndex]);
      if (!allowedUnits.includes(unit)) {
        issues.push(
          issue(
            block,
            'error',
            'invalid-unit',
            `Row ${rowIndex + 1}: unit "${unit}" is not allowed (allowed: ${allowedUnits.join(', ')})`
          )
        );
      }
    }
    if (expiryIndex !== -1) {
      const expiry = cellText(cells[expiryIndex]);
      if (!isIsoDate(expiry)) {
        issues.push(
          issue(block, 'error', 'invalid-expiry-date', `Row ${rowIndex + 1}: expiry "${expiry}" must be an ISO date (YYYY-MM-DD)`)
        );
      }
    }
  });
  return issues;
}

/**
 * Validates a `testMethodSpec`: `methodCode` is required and must match the pattern.
 */
export function validateTestMethodSpec(block: Block, options: ClinicalValidationOptions = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const pattern = options.methodCodePattern ?? DEFAULT_METHOD_CODE_PATTERN;
  const code = typeof block.props.methodCode === 'string' ? block.props.methodCode.trim() : '';
  if (code === '') {
    issues.push(issue(block, 'error', 'missing-method-code', 'Test method code is required'));
  } else if (!pattern.test(code)) {
    issues.push(issue(block, 'error', 'invalid-method-code', `Method code "${code}" does not match the required pattern`));
  }
  if (!block.props.version) {
    issues.push(issue(block, 'warning', 'missing-method-version', 'Test method version is recommended'));
  }
  return issues;
}

/**
 * Validates a `specimenRequirements` block: volumes must be non-negative numbers,
 * the minimum volume must not exceed the volume, and a specimen type is required.
 */
export function validateSpecimenRequirements(block: Block): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!block.props.specimenType) {
    issues.push(issue(block, 'error', 'missing-specimen-type', 'Specimen type is required'));
  }
  const volume = toFiniteNumber(block.props.volumeMl);
  const minVolume = toFiniteNumber(block.props.minVolumeMl);
  if (block.props.volumeMl != null && (volume === null || volume < 0)) {
    issues.push(issue(block, 'error', 'invalid-volume', 'Volume must be a non-negative number of millilitres'));
  }
  if (block.props.minVolumeMl != null && (minVolume === null || minVolume < 0)) {
    issues.push(issue(block, 'error', 'invalid-volume', 'Minimum volume must be a non-negative number of millilitres'));
  }
  if (volume !== null && minVolume !== null && minVolume > volume) {
    issues.push(issue(block, 'error', 'min-volume-exceeds-volume', 'Minimum volume cannot exceed the required volume'));
  }
  return issues;
}

/**
 * Validates a `qcCriteria` block: analyte and numeric target are required, the
 * standard deviation must be positive, and Westgard rules must be known.
 */
export function validateQcCriteria(block: Block): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!block.props.analyte) {
    issues.push(issue(block, 'error', 'missing-analyte', 'QC analyte is required'));
  }
  if (toFiniteNumber(block.props.target) === null) {
    issues.push(issue(block, 'error', 'invalid-target', 'QC target must be a number'));
  }
  if (block.props.sd != null) {
    const sd = toFiniteNumber(block.props.sd);
    if (sd === null || sd <= 0) {
      issues.push(issue(block, 'error', 'invalid-sd', 'QC standard deviation must be a positive number'));
    }
  } else {
    issues.push(issue(block, 'warning', 'missing-sd', 'QC standard deviation is recommended'));
  }
  for (const rule of stringArray(block.props.westgardRules)) {
    if (!(WESTGARD_RULES as readonly string[]).includes(rule)) {
      issues.push(issue(block, 'error', 'invalid-westgard-rule', `"${rule}" is not a Westgard rule (${WESTGARD_RULES.join(', ')})`));
    }
  }
  return issues;
}
