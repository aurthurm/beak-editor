/**
 * Default block definitions for the built-in BeakBlock block types.
 *
 * Every node in {@link DEFAULT_NODES} has a definition here, plus the
 * inline `field` content type. Extension packages add their own via
 * `BeakExtension.blocks`.
 *
 * @module
 */

import type { Block, InlineContent } from '../blocks/types';
import { FIELD_TYPES } from '../schema/nodes/field';
import { BlockRegistry } from './BlockRegistry';
import { isBuiltinInline } from '../blocks/inlineGuards';
import type {
  BeakBlockDefinition,
  BlockCapabilities,
  BlockFamily,
  ValidationIssue,
} from './types';

function caps(partial: Partial<BlockCapabilities> = {}): BlockCapabilities {
  return {
    editable: true,
    nested: false,
    printable: true,
    splittable: true,
    collaborative: true,
    ...partial,
  };
}

function def(
  type: string,
  family: BlockFamily,
  capabilities: BlockCapabilities,
  validate?: BeakBlockDefinition['validate']
): BeakBlockDefinition {
  return { type, version: 1, family, capabilities, ...(validate ? { validate } : {}) };
}

/** Validates `field` inline items inside a block's content. */
function validateInlineFields(block: Block): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const content: InlineContent[] = block.content ?? [];
  for (const item of content) {
    if (!isBuiltinInline(item) || item.type !== 'field') continue;
    if (!FIELD_TYPES.includes(item.fieldType as (typeof FIELD_TYPES)[number])) {
      issues.push({
        severity: 'error',
        code: 'invalid-field-type',
        message: `Unknown field type "${item.fieldType}"`,
        blockId: block.id,
      });
    }
  }
  return issues;
}

function validateHeading(block: Block): ValidationIssue[] {
  const level = Number(block.props.level ?? 1);
  const issues = validateInlineFields(block);
  if (!Number.isInteger(level) || level < 1 || level > 6) {
    issues.push({
      severity: 'error',
      code: 'invalid-heading-level',
      message: `Heading level must be an integer from 1 to 6 (got ${String(block.props.level)})`,
      blockId: block.id,
    });
  }
  return issues;
}

function validateSectionBreak(block: Block): ValidationIssue[] {
  const setup = block.props.pageSetup as
    | { size?: { widthTwips?: number; heightTwips?: number } }
    | null
    | undefined;
  if (!setup) return [];
  const w = setup.size?.widthTwips ?? 0;
  const h = setup.size?.heightTwips ?? 0;
  if (!(w > 0) || !(h > 0)) {
    return [
      {
        severity: 'error',
        code: 'invalid-page-setup',
        message: 'Section page size must have positive widthTwips and heightTwips',
        blockId: block.id,
      },
    ];
  }
  return [];
}

/**
 * Creates a registry populated with definitions for all built-in block types.
 *
 * @returns A new BlockRegistry instance
 */
export function createDefaultBlockRegistry(): BlockRegistry {
  const registry = new BlockRegistry();

  const definitions: BeakBlockDefinition[] = [
    // Document root
    def('doc', 'text', caps({ editable: false, nested: true, collaborative: false })),

    // Text and structure
    def('paragraph', 'text', caps({ nested: false }), validateInlineFields),
    def('heading', 'text', caps({ nested: false }), validateHeading),
    def('blockquote', 'text', caps({ nested: true })),
    def('callout', 'text', caps({ nested: true })),
    def('codeBlock', 'text', caps({ splittable: false })),
    def('divider', 'text', caps({ editable: false, nested: false, splittable: false })),
    def('bulletList', 'text', caps({ nested: true })),
    def('orderedList', 'text', caps({ nested: true })),
    def('listItem', 'text', caps({ nested: true })),
    def('checkList', 'text', caps({ nested: true })),
    def('checkListItem', 'text', caps({ nested: false })),
    def('columnList', 'text', caps({ nested: true, splittable: false })),
    def('column', 'text', caps({ nested: true })),

    // Page layout
    def('pageBreak', 'office', caps({ editable: false, nested: false, splittable: false })),
    def('sectionBreak', 'office', caps({ editable: true, nested: false, splittable: false }), validateSectionBreak),

    // Office and layout
    def('table', 'office', caps({ nested: true })),
    def('tableRow', 'office', caps({ nested: true, splittable: false })),
    def('tableCell', 'office', caps({ nested: true })),
    def('tableHeader', 'office', caps({ nested: true })),
    def('image', 'office', caps({ nested: false, splittable: false })),
    def('embed', 'office', caps({ nested: false, printable: false, splittable: false })),
    def('tableOfContents', 'office', caps({ editable: false, nested: false, splittable: false })),

    // Inline content types
    def('text', 'text', caps({ nested: false, splittable: false })),
    def('hardBreak', 'text', caps({ editable: false, nested: false, splittable: false })),
    def('icon', 'text', caps({ editable: false, nested: false, splittable: false })),
    def('field', 'smart', caps({ editable: false, nested: false, splittable: false })),
  ];

  for (const definition of definitions) {
    registry.register(definition);
  }

  return registry;
}
