/**
 * Form block definitions: validation and print HTML.
 *
 * @module
 */

import type { BeakBlockDefinition, Block, BlockCapabilities } from '@amusendame/beakblock-core';
import { blockText, escapeHtml } from '../util';
import { FORM_CONTAINER_TYPES, FORM_FIELD_TYPES } from './nodes';
import { validateFormBlock } from './validation';

const FIELD: BlockCapabilities = { editable: true, nested: false, printable: true, splittable: false, collaborative: true };
const CONTAINER: BlockCapabilities = { ...FIELD, nested: true, splittable: true };

/** Print HTML for a single field: label and current value. */
function fieldPrint(block: Block): string {
  const label = String(block.props.label || block.props.name || block.type);
  const value = block.props.value;
  const shown =
    typeof value === 'boolean' ? (value ? '[x]' : '[ ]') : value === null || value === undefined || value === '' ? '' : String(value);
  const unit = typeof block.props.unit === 'string' && block.props.unit ? ` ${block.props.unit}` : '';
  return `<div class="beakblock-form-field beakblock-form-${escapeHtml(block.type)}"><span class="beakblock-form-label">${escapeHtml(label)}</span> <span class="beakblock-form-value">${escapeHtml(shown)}${escapeHtml(unit)}</span></div>`;
}

/**
 * Builds form block definitions for every field and container type.
 */
export function createFormDefinitions(): BeakBlockDefinition[] {
  const fieldTypes = [...FORM_FIELD_TYPES];
  const fields: BeakBlockDefinition[] = fieldTypes.map((type) => ({
    type,
    version: 1,
    family: 'forms',
    capabilities: FIELD,
    validate: (block, ctx) => validateFormBlock(block, ctx),
    renderPrint: (block) => fieldPrint(block),
  }));

  const containers: BeakBlockDefinition[] = [...FORM_CONTAINER_TYPES].map((type) => ({
    type,
    version: 1,
    family: 'forms',
    capabilities: CONTAINER,
    validate: (block, ctx) => validateFormBlock(block, ctx),
    renderPrint: (block) => {
      const heading = String(block.props.title || block.props.label || '');
      const body = (block.children ?? []).map((child) =>
        child.type === 'paragraph' ? `<p>${escapeHtml(blockText(child))}</p>` : fieldPrint(child)
      );
      return `<section class="beakblock-form-container beakblock-form-${escapeHtml(type)}">${heading ? `<h4>${escapeHtml(heading)}</h4>` : ''}${body.join('')}</section>`;
    },
  }));

  return [...fields, ...containers];
}
