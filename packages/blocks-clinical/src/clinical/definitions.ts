/**
 * Clinical block definitions: validation and print HTML for each block type.
 *
 * @module
 */

import type { BeakBlockDefinition, Block, BlockCapabilities, ValidationIssue } from '@amusendame/beakblock-core';
import { blockText, escapeHtml, stringArray } from '../util';
import { equipmentIssues, type EquipmentCache } from './equipment';
import type { ClinicalExtensionOptions } from './types';
import {
  validateQcCriteria,
  validateReagentTable,
  validateSafetyWarning,
  validateSopStep,
  validateSpecimenRequirements,
  validateTestMethodSpec,
} from './validators';

const EDITABLE_TEXT: BlockCapabilities = {
  editable: true,
  nested: false,
  printable: true,
  splittable: true,
  collaborative: true,
};
const NESTED_TABLE: BlockCapabilities = { ...EDITABLE_TEXT, nested: true };
const ATOM: BlockCapabilities = { ...EDITABLE_TEXT, splittable: false };

/** Renders a labelled definition list for atom blocks. */
function definitionList(rows: Array<[string, unknown]>): string {
  const items = rows
    .filter(([, value]) => value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0))
    .map(([label, value]) => {
      const text = Array.isArray(value) ? value.join(', ') : String(value);
      return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(text)}</dd>`;
    });
  return `<dl>${items.join('')}</dl>`;
}

/** Print HTML for a table block subtree (rows and cells), used by `reagentTable`. */
function tableToHtml(table: Block): string {
  const rows = (table.children ?? []).filter((row) => row.type === 'tableRow');
  const body = rows
    .map((row) => {
      const cells = (row.children ?? [])
        .map((cell) => {
          const tag = cell.type === 'tableHeader' || row.props.isHeader === true ? 'th' : 'td';
          return `<${tag}>${escapeHtml(blockText(cell))}</${tag}>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table class="beakblock-table">${body}</table>`;
}

/**
 * Builds the clinical block definitions for the given options.
 *
 * @param options - Extension options
 * @param cache - Equipment lookup cache shared with the node view
 */
export function createClinicalDefinitions(
  options: ClinicalExtensionOptions,
  cache: EquipmentCache
): BeakBlockDefinition[] {
  const validationOptions = {
    allowedUnits: options.allowedUnits,
    methodCodePattern: options.methodCodePattern,
  };

  return [
    {
      type: 'sopStep',
      version: 1,
      family: 'clinical',
      capabilities: EDITABLE_TEXT,
      validate: (block) => validateSopStep(block),
      renderPrint: (block) => {
        const number = block.props.stepNumber != null ? `${String(block.props.stepNumber)}.` : '';
        const critical = block.props.critical === true ? ' <strong>CRITICAL</strong>' : '';
        const time = block.props.timeMinutes != null ? ` <em>(${escapeHtml(block.props.timeMinutes)} min)</em>` : '';
        return `<div class="beakblock-sop-step"><span class="beakblock-sop-number">${escapeHtml(number)}</span> ${escapeHtml(blockText(block))}${time}${critical}</div>`;
      },
    },
    {
      type: 'safetyWarning',
      version: 1,
      family: 'clinical',
      capabilities: EDITABLE_TEXT,
      validate: (block) => validateSafetyWarning(block),
      renderPrint: (block) => {
        const level = String(block.props.level ?? 'caution');
        const codes = stringArray(block.props.hazardCodes);
        const ppe = stringArray(block.props.ppe);
        const meta = [
          codes.length ? `<div class="beakblock-safety-codes">${escapeHtml(codes.join(', '))}</div>` : '',
          ppe.length ? `<div class="beakblock-safety-ppe">PPE: ${escapeHtml(ppe.join(', '))}</div>` : '',
        ].join('');
        return `<div class="beakblock-safety beakblock-safety--${escapeHtml(level)}"><strong>${escapeHtml(level.toUpperCase())}</strong> ${escapeHtml(blockText(block))}${meta}</div>`;
      },
    },
    {
      type: 'reagentTable',
      version: 1,
      family: 'clinical',
      capabilities: NESTED_TABLE,
      validate: (block) => validateReagentTable(block, validationOptions),
      renderPrint: (block) => {
        const table = block.children?.find((child) => child.type === 'table');
        return `<div class="beakblock-reagent-table">${table ? tableToHtml(table) : ''}</div>`;
      },
    },
    {
      type: 'testMethodSpec',
      version: 1,
      family: 'clinical',
      capabilities: ATOM,
      validate: (block) => validateTestMethodSpec(block, validationOptions),
      renderPrint: (block) =>
        definitionList([
          ['Method', block.props.methodCode],
          ['Version', block.props.version],
          ['Analyte', block.props.analyte],
          ['Principle', block.props.principle],
        ]),
    },
    {
      type: 'specimenRequirements',
      version: 1,
      family: 'clinical',
      capabilities: ATOM,
      validate: (block) => validateSpecimenRequirements(block),
      renderPrint: (block) =>
        definitionList([
          ['Specimen', block.props.specimenType],
          ['Container', block.props.container],
          ['Volume (mL)', block.props.volumeMl],
          ['Minimum volume (mL)', block.props.minVolumeMl],
          ['Stability', block.props.stability],
          ['Rejection criteria', block.props.rejectionCriteria],
        ]),
    },
    {
      type: 'qcCriteria',
      version: 1,
      family: 'clinical',
      capabilities: ATOM,
      validate: (block) => validateQcCriteria(block),
      renderPrint: (block) =>
        definitionList([
          ['Analyte', block.props.analyte],
          ['QC level', block.props.level],
          ['Target', block.props.target],
          ['SD', block.props.sd],
          ['Westgard rules', block.props.westgardRules],
        ]),
    },
    {
      // Inline node: not walked by the block registry. Use `validateEquipmentReferences`
      // on the ProseMirror document; this definition checks the attrs against the cache.
      type: 'equipmentReference',
      version: 1,
      family: 'clinical',
      capabilities: ATOM,
      validate: (block): ValidationIssue[] => equipmentIssues(block.props, cache, undefined),
      renderPrint: (block) =>
        escapeHtml([block.props.code, block.props.name].filter(Boolean).join(' ') || String(block.props.equipmentId ?? '')),
    },
  ];
}
