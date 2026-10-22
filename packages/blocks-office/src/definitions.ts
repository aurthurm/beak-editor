/**
 * Block definitions, validation and print rendering for office blocks.
 *
 * Block-level definitions (equation, caption, textBox, shape, conditional,
 * repeatingSection, reusableContent) are registered in the block registry and
 * validated by it. Inline atoms are listed in the registry for discovery, but
 * their checks run in {@link validateOfficeContent}, because the registry walks
 * blocks and not inline content.
 *
 * @module
 */

import {
  BlockRegistry,
  type Block,
  type BeakBlockDefinition,
  type BlockCapabilities,
  type ValidationContext,
  type ValidationIssue,
} from '@amusendame/beakblock-core';

import { blockPlainText, isConditionVisible, readVariable, resolveOfficeItems, collectItemsFromBlocks } from './model';
import { validateExpression, tryEvaluateExpression } from './expression';
import { readOfficeVariables } from './plugin';
import { createOfficeNodeSpecs } from './nodes';
import {
  CAPTION_LABELS,
  CROSS_REFERENCE_DISPLAYS,
  SHAPE_KINDS,
  TEXT_BOX_FLOATS,
  COMPUTED_FORMATS,
  type OfficeBlocksOptions,
  type OfficeVariables,
} from './types';
import { equationSourceHtml, escapeHtml, numberOr, renderMathHtml, shapeSvgMarkup } from './render';

const BLOCK_CAPS: BlockCapabilities = {
  editable: true,
  nested: false,
  printable: true,
  splittable: false,
  collaborative: true,
};

const CONTAINER_CAPS: BlockCapabilities = { ...BLOCK_CAPS, nested: true, splittable: true };

const INLINE_CAPS: BlockCapabilities = { ...BLOCK_CAPS, splittable: false };

/** Props of a block as a plain record, tolerating missing props. */
function propsOf(block: Block): Record<string, unknown> {
  return (block.props ?? {}) as Record<string, unknown>;
}

function issue(
  severity: ValidationIssue['severity'],
  code: string,
  message: string,
  blockId?: string
): ValidationIssue {
  return { severity, code, message, ...(blockId ? { blockId } : {}) };
}

function isIntegerValue(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value);
}

/** Paragraph HTML for the plain text of child blocks (print fallback). */
function childParagraphs(children: Block[] | undefined): string {
  return (children ?? [])
    .map((child) => blockPlainText(child))
    .filter((text) => text !== '')
    .map((text) => `<p>${escapeHtml(text)}</p>`)
    .join('');
}

/**
 * Validates repeat bounds (and the item count when variables are known).
 * Exposed for tests and for apps that validate outside the registry.
 */
export function validateRepeatingSection(
  block: Block,
  variables?: OfficeVariables
): ValidationIssue[] {
  const props = propsOf(block);
  const issues: ValidationIssue[] = [];
  const itemsKey = String(props.itemsKey ?? '');
  const min = props.min ?? 0;
  const max = props.max ?? null;
  if (itemsKey.trim() === '') {
    issues.push(issue('error', 'missing-items-key', 'Repeating section needs an items variable', block.id));
  }
  if (!isIntegerValue(min) || (min as number) < 0) {
    issues.push(issue('error', 'invalid-min', 'Minimum must be a whole number of 0 or more', block.id));
  }
  if (max !== null && (!isIntegerValue(max) || (max as number) < 0)) {
    issues.push(issue('error', 'invalid-max', 'Maximum must be a whole number of 0 or more', block.id));
  } else if (max !== null && isIntegerValue(min) && (max as number) < (min as number)) {
    issues.push(issue('error', 'max-below-min', 'Maximum is smaller than minimum', block.id));
  }
  if (variables && itemsKey.trim() !== '' && isIntegerValue(min)) {
    const list = readVariable(variables, itemsKey);
    if (!Array.isArray(list)) {
      issues.push(issue('warning', 'items-not-found', `Variable "${itemsKey}" is not a list`, block.id));
    } else {
      if (list.length < (min as number)) {
        issues.push(
          issue('error', 'repeat-below-min', `${list.length} item(s), at least ${String(min)} required`, block.id)
        );
      }
      if (max !== null && isIntegerValue(max) && list.length > (max as number)) {
        issues.push(
          issue('error', 'repeat-above-max', `${list.length} item(s), at most ${String(max)} allowed`, block.id)
        );
      }
    }
  }
  return issues;
}

/**
 * Creates the block definitions for office blocks.
 *
 * @param options - Extension options (used by validators and print rendering)
 */
export function createOfficeBlockDefinitions(options: OfficeBlocksOptions = {}): BeakBlockDefinition[] {
  const specs = createOfficeNodeSpecs();
  const variablesOf = () => readOfficeVariables(options);

  const equation: BeakBlockDefinition = {
    type: 'equation',
    version: 1,
    family: 'office',
    schema: specs.equation,
    capabilities: BLOCK_CAPS,
    validate: (block) =>
      String(propsOf(block).latex ?? '').trim() === ''
        ? [issue('warning', 'empty-equation', 'Equation has no LaTeX source', block.id)]
        : [],
    renderPrint: (block) => {
      const latex = String(propsOf(block).latex ?? '');
      return `<div class="beakblock-equation">${renderMathHtml(latex, true, options.renderMath) ?? equationSourceHtml(latex)}</div>`;
    },
  };

  const caption: BeakBlockDefinition = {
    type: 'caption',
    version: 1,
    family: 'office',
    schema: specs.caption,
    capabilities: BLOCK_CAPS,
    validate: (block) => {
      const label = String(propsOf(block).label ?? '');
      const issues: ValidationIssue[] = [];
      if (!(CAPTION_LABELS as readonly string[]).includes(label)) {
        issues.push(issue('error', 'invalid-caption-label', `Caption label "${label}" is not supported`, block.id));
      }
      if (blockPlainText(block).trim() === '') {
        issues.push(issue('warning', 'empty-caption', 'Caption has no text', block.id));
      }
      return issues;
    },
    renderPrint: (block, context) => {
      const props = propsOf(block);
      const label = escapeHtml(String(props.label ?? 'Figure'));
      const computed = (context?.captionNumbers as Map<string, { number: number }> | undefined)?.get(block.id);
      const number = numberOr(computed?.number ?? props.number, Number.NaN);
      const prefix = Number.isFinite(number) ? `${label} ${number}` : label;
      const text = escapeHtml(blockPlainText(block));
      return `<p class="beakblock-caption"><span class="beakblock-caption-label">${prefix}:</span> ${text}</p>`;
    },
  };

  const textBox: BeakBlockDefinition = {
    type: 'textBox',
    version: 1,
    family: 'office',
    schema: specs.textBox,
    capabilities: CONTAINER_CAPS,
    validate: (block) => {
      const props = propsOf(block);
      const issues: ValidationIssue[] = [];
      if (!(numberOr(props.width, 0) > 0)) {
        issues.push(issue('error', 'invalid-width', 'Text box width must be positive', block.id));
      }
      if (!(TEXT_BOX_FLOATS as readonly string[]).includes(String(props.float ?? 'none'))) {
        issues.push(issue('error', 'invalid-float', 'Text box float must be none, left or right', block.id));
      }
      return issues;
    },
    renderPrint: (block) => {
      const props = propsOf(block);
      const width = numberOr(props.width, 200);
      const border = numberOr(props.borderPt, 0.75);
      const fill = props.fill ? `background:${escapeHtml(String(props.fill))};` : '';
      const float = String(props.float ?? 'none');
      const floatStyle = float === 'left' || float === 'right' ? `float:${float};` : '';
      return `<div class="beakblock-textbox" style="width:${width}pt;border-width:${border}pt;${floatStyle}${fill}">${childParagraphs(block.children)}</div>`;
    },
  };

  const shape: BeakBlockDefinition = {
    type: 'shape',
    version: 1,
    family: 'office',
    schema: specs.shape,
    capabilities: BLOCK_CAPS,
    validate: (block) => {
      const props = propsOf(block);
      const issues: ValidationIssue[] = [];
      if (!(SHAPE_KINDS as readonly string[]).includes(String(props.kind ?? 'rect'))) {
        issues.push(issue('error', 'invalid-shape-kind', `Shape kind "${String(props.kind)}" is not supported`, block.id));
      }
      if (!(numberOr(props.width, 0) > 0) || !(numberOr(props.height, 0) > 0)) {
        issues.push(issue('error', 'invalid-size', 'Shape width and height must be positive', block.id));
      }
      return issues;
    },
    renderPrint: (block) => {
      const props = propsOf(block);
      return `<div class="beakblock-shape">${shapeSvgMarkup({
        kind: String(props.kind ?? 'rect'),
        width: numberOr(props.width, 120),
        height: numberOr(props.height, 80),
        fill: props.fill ? String(props.fill) : null,
        stroke: String(props.stroke ?? '#334155'),
        strokeWidth: numberOr(props.strokeWidth, 1),
      })}</div>`;
    },
  };

  const conditional: BeakBlockDefinition = {
    type: 'conditional',
    version: 1,
    family: 'smart',
    schema: specs.conditional,
    capabilities: CONTAINER_CAPS,
    validate: (block) => {
      const expression = String(propsOf(block).expression ?? '');
      const message = validateExpression(expression);
      const issues: ValidationIssue[] = [];
      if (message) {
        issues.push(issue('error', 'invalid-expression', `Condition: ${message}`, block.id));
      }
      if (!block.children || block.children.length === 0) {
        issues.push(issue('warning', 'empty-conditional', 'Conditional section has no content', block.id));
      }
      return issues;
    },
    renderPrint: (block) => {
      const expression = String(propsOf(block).expression ?? 'true');
      if (!isConditionVisible(expression, variablesOf())) return '';
      return `<div class="beakblock-conditional">${childParagraphs(block.children)}</div>`;
    },
  };

  const repeatingSection: BeakBlockDefinition = {
    type: 'repeatingSection',
    version: 1,
    family: 'smart',
    schema: specs.repeatingSection,
    capabilities: CONTAINER_CAPS,
    validate: (block, ctx: ValidationContext) =>
      validateRepeatingSection(block, ctx.variables as OfficeVariables | undefined),
    renderPrint: (block) => {
      const props = propsOf(block);
      const variables = variablesOf();
      const list = readVariable(variables, String(props.itemsKey ?? ''));
      const count = Array.isArray(list) ? list.length : 0;
      const min = numberOr(props.min, 0);
      const max = props.max == null ? null : numberOr(props.max, count);
      let repeats = Math.max(min, count);
      if (max !== null) repeats = Math.min(repeats, max);
      const paragraphs = childParagraphs(block.children);
      return Array.from({ length: repeats }, (_, index) =>
        `<div class="beakblock-repeat-item" data-item-index="${index}">${paragraphs}</div>`
      ).join('');
    },
  };

  const reusableContent: BeakBlockDefinition = {
    type: 'reusableContent',
    version: 1,
    family: 'smart',
    schema: specs.reusableContent,
    capabilities: BLOCK_CAPS,
    validate: (block) => {
      const props = propsOf(block);
      const issues: ValidationIssue[] = [];
      const contentId = String(props.contentId ?? '');
      if (contentId.trim() === '') {
        issues.push(issue('error', 'missing-content-id', 'Reusable content needs a content id', block.id));
      }
      const revision = props.revision ?? null;
      if (revision === null) {
        issues.push(
          issue('warning', 'reusable-unpinned', 'Reusable content is not pinned to a revision and will float', block.id)
        );
      }
      if (contentId && options.resolveReusableContent) {
        let resolved: Block[] | null | undefined = null;
        try {
          resolved = options.resolveReusableContent(contentId, revision === null ? null : numberOr(revision, 0));
        } catch {
          resolved = null;
        }
        if (!resolved) {
          issues.push(issue('warning', 'reusable-unresolved', `Reusable content "${contentId}" was not found`, block.id));
        }
      }
      return issues;
    },
    renderPrint: (block) => {
      const props = propsOf(block);
      const contentId = String(props.contentId ?? '');
      const revision = props.revision == null ? null : numberOr(props.revision, 0);
      let resolved: Block[] | null | undefined = null;
      if (options.resolveReusableContent && contentId) {
        try {
          resolved = options.resolveReusableContent(contentId, revision);
        } catch {
          resolved = null;
        }
      }
      if (!resolved) {
        return `<div class="beakblock-reusable beakblock-reusable-missing">${escapeHtml(String(props.title || contentId))}</div>`;
      }
      return `<div class="beakblock-reusable">${childParagraphs(resolved)}</div>`;
    },
  };

  // Inline atoms: registered for discovery (`has`, `list`). Their checks run in validateOfficeContent.
  const inlineDefinition = (
    type: string,
    family: BeakBlockDefinition['family'] = 'office'
  ): BeakBlockDefinition => ({
    type,
    version: 1,
    family,
    schema: specs[type],
    capabilities: INLINE_CAPS,
  });

  const inlineDefinitions: BeakBlockDefinition[] = [
    inlineDefinition('footnote'),
    inlineDefinition('endnote'),
    inlineDefinition('inlineEquation'),
    inlineDefinition('crossReference'),
    inlineDefinition('variable', 'smart'),
    inlineDefinition('computedValue', 'smart'),
  ];

  return [equation, caption, textBox, shape, conditional, repeatingSection, reusableContent, ...inlineDefinitions];
}

/**
 * Validates office content: block validators from the registry, plus checks
 * for inline atoms (footnotes, cross-references, variables, computed values).
 *
 * Unregistered (non-office) block types are not reported.
 *
 * @param blocks - Document blocks
 * @param options - Variables and resolvers; `variables` enables unknown-variable checks
 *
 * @example
 * ```typescript
 * const issues = validateOfficeContent(editor.getDocument(), { variables: { procedureType: 'micro' } });
 * ```
 */
export function validateOfficeContent(blocks: Block[], options: OfficeBlocksOptions = {}): ValidationIssue[] {
  const registry = new BlockRegistry();
  for (const definition of createOfficeBlockDefinitions(options)) {
    registry.register(definition);
  }
  const hasVariables = options.variables !== undefined;
  const variables = readOfficeVariables(options);
  const issues: ValidationIssue[] = registry
    .validate(blocks, { variables: hasVariables ? variables : undefined })
    .filter((found) => found.code !== 'unregistered-block-type');

  const resolution = resolveOfficeItems(collectItemsFromBlocks(blocks), {
    variables,
    crossReferenceResolver: options.crossReferenceResolver,
  });

  for (const entry of resolution.items) {
    const { item } = entry;
    const attrs = item.attrs;
    const blockId = item.id ?? undefined;
    switch (item.kind) {
      case 'footnote':
      case 'endnote':
        if (item.text.trim() === '') {
          issues.push(issue('warning', 'empty-note', `${item.kind} has no text`, blockId));
        }
        break;
      case 'crossReference': {
        const display = String(attrs.display ?? 'number');
        if (String(attrs.targetId ?? '').trim() === '') {
          issues.push(issue('error', 'missing-reference-target', 'Cross-reference has no target', blockId));
        } else if (!(CROSS_REFERENCE_DISPLAYS as readonly string[]).includes(display)) {
          issues.push(issue('error', 'invalid-reference-display', `Unknown display "${display}"`, blockId));
        } else if (entry.display === '?') {
          issues.push(issue('warning', 'unresolved-reference', `Target "${String(attrs.targetId)}" was not found`, blockId));
        }
        break;
      }
      case 'variable': {
        const name = String(attrs.name ?? '');
        if (name.trim() === '') {
          issues.push(issue('error', 'missing-variable-name', 'Variable has no name', blockId));
        } else if (hasVariables && readVariable(variables, name) === undefined) {
          issues.push(issue('warning', 'unknown-variable', `Variable "${name}" has no value`, blockId));
        }
        break;
      }
      case 'computedValue': {
        const expression = String(attrs.expression ?? '');
        const syntax = validateExpression(expression);
        const format = String(attrs.format ?? 'number');
        if (syntax) {
          issues.push(issue('error', 'invalid-expression', `Computed value: ${syntax}`, blockId));
        } else if (!(COMPUTED_FORMATS as readonly string[]).includes(format)) {
          issues.push(issue('error', 'invalid-format', `Unknown format "${format}"`, blockId));
        } else if (hasVariables && !tryEvaluateExpression(expression, variables).ok) {
          issues.push(issue('warning', 'computed-value-error', 'Computed value cannot be evaluated', blockId));
        }
        break;
      }
      case 'caption':
      case 'heading':
      case 'conditional':
      case 'repeatingSection':
        break;
    }
  }
  return issues;
}
