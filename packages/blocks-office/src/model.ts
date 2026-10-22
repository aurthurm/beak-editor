/**
 * Document model helpers for office blocks.
 *
 * Collects office items (notes, captions, references, smart content) from
 * either a ProseMirror document or a Block tree, then numbers and resolves
 * them. The same logic drives editor decorations and print/layout output.
 *
 * @module
 */

import type { Block, InlineContent } from '@amusendame/beakblock-core';
import type { Node as PMNode } from 'prosemirror-model';

import { ExpressionError, isTruthy, tryEvaluateExpression } from './expression';
import type {
  CaptionNumber,
  ComputedFormat,
  CrossReferenceDisplay,
  CrossReferenceResolver,
  CrossReferenceTarget,
  OfficeNote,
  OfficeVariables,
} from './types';

/** Kinds of items the model tracks. */
export type OfficeItemKind =
  | 'footnote'
  | 'endnote'
  | 'caption'
  | 'heading'
  | 'crossReference'
  | 'variable'
  | 'computedValue'
  | 'conditional'
  | 'repeatingSection';

/** A single office item in document order. */
export interface OfficeItem {
  kind: OfficeItemKind;
  /** Block or node id, when present. */
  id: string | null;
  /** Attributes (ProseMirror attrs, or JSON fields for inline items). */
  attrs: Record<string, unknown>;
  /** Plain text: caption and heading text, or footnote text. */
  text: string;
  /** Document position (ProseMirror documents only). */
  pos?: number;
  /** Node size (ProseMirror documents only). */
  nodeSize?: number;
}

/** An item after numbering and resolution. */
export interface ResolvedOfficeItem {
  item: OfficeItem;
  /** Footnote, endnote or caption number. */
  number?: number;
  /** Caption label. */
  label?: string;
  /** Display text for inline atoms (cross-references, variables, computed values). */
  display?: string;
  /** Conditional visibility. */
  visible?: boolean;
  /** Repeating section item count. */
  count?: number;
}

/** Result of {@link resolveOfficeItems}. */
export interface OfficeResolution {
  items: ResolvedOfficeItem[];
  captions: Map<string, CaptionNumber>;
  targets: Map<string, CrossReferenceTarget>;
  notes: OfficeNote[];
}

const ITEM_KINDS = new Set<string>([
  'footnote',
  'endnote',
  'caption',
  'heading',
  'crossReference',
  'variable',
  'computedValue',
  'conditional',
  'repeatingSection',
]);

/** Stringifies an attribute value, using `fallback` for null or undefined. */
function stringOr(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value);
}

/** Plain text of inline JSON content (used for captions, headings, previews). */
export function inlinePlainText(items: readonly InlineContent[] | undefined): string {
  if (!items) return '';
  return items
    .map((raw) => {
      const item = raw as { type: string } & Partial<Record<'text' | 'content' | 'fallback', unknown>>;
      switch (item.type) {
        case 'text':
          return String(item.text ?? '');
        case 'link':
          return ((item.content ?? []) as Array<{ text: string }>).map((c) => c.text).join('');
        case 'field':
          return item.fallback == null ? '' : String(item.fallback);
        case 'hardBreak':
          return '\n';
        default:
          return '';
      }
    })
    .join('');
}

/** Plain text of a block and its children, one paragraph per line. */
export function blockPlainText(block: Block): string {
  const own = inlinePlainText(block.content);
  const children = (block.children ?? []).map((child) => blockPlainText(child));
  return [own, ...children].filter((part) => part !== '').join('\n');
}

/**
 * Collects office items from a ProseMirror document, in document order.
 *
 * @param doc - Document node
 */
export function collectItemsFromDoc(doc: PMNode): OfficeItem[] {
  const items: OfficeItem[] = [];
  doc.descendants((node, pos) => {
    const name = node.type.name;
    if (!ITEM_KINDS.has(name)) return true;
    const attrs = node.attrs as Record<string, unknown>;
    const base = {
      id: attrs.id == null ? null : String(attrs.id),
      attrs,
      pos,
      nodeSize: node.nodeSize,
    };
    const kind = name as OfficeItemKind;
    const text =
      kind === 'footnote' || kind === 'endnote'
        ? stringOr(attrs.text)
        : kind === 'caption' || kind === 'heading'
          ? node.textContent
          : '';
    items.push({ kind, ...base, text });
    // Descend so that notes and references inside captions and headings are found.
    return true;
  });
  return items;
}

/**
 * Collects office items from a Block tree, in document order.
 *
 * @param blocks - Top-level blocks
 */
export function collectItemsFromBlocks(blocks: Block[]): OfficeItem[] {
  const items: OfficeItem[] = [];
  const visit = (list: Block[]): void => {
    for (const block of list) {
      const props = block.props ?? {};
      const id = block.id ?? null;
      if (block.type === 'caption') {
        items.push({ kind: 'caption', id, attrs: props, text: inlinePlainText(block.content) });
      } else if (block.type === 'heading') {
        items.push({ kind: 'heading', id, attrs: props, text: inlinePlainText(block.content) });
      } else if (block.type === 'conditional') {
        items.push({ kind: 'conditional', id, attrs: props, text: '' });
      } else if (block.type === 'repeatingSection') {
        items.push({ kind: 'repeatingSection', id, attrs: props, text: '' });
      }
      for (const item of (block.content ?? []) as unknown as Array<{ type: string; props?: Record<string, unknown> }>) {
        const inline = inlineItemToOffice(item);
        if (inline) items.push(inline);
      }
      if (block.children) visit(block.children);
    }
  };
  visit(blocks);
  return items;
}

/**
 * Reads an inline office atom from core's `{ type, props }` form.
 * Attributes live under `props`.
 */
function inlineItemToOffice(
  item: { type: string; props?: Record<string, unknown> }
): OfficeItem | null {
  const attrs = item.props ?? {};
  const id = attrs.id == null ? null : String(attrs.id);
  const kind = item.type as OfficeItemKind;
  if (kind === 'footnote' || kind === 'endnote') {
    return { kind, id, attrs, text: stringOr(attrs.text) };
  }
  if (kind === 'crossReference' || kind === 'variable' || kind === 'computedValue') {
    return { kind, id, attrs, text: '' };
  }
  return null;
}

/**
 * Reads a variable by name, supporting dotted paths. Only own properties are
 * read, and prototype keys are ignored.
 */
export function readVariable(variables: OfficeVariables, name: string): unknown {
  let current: unknown = variables;
  for (const segment of name.split('.')) {
    if (segment === '' || segment === '__proto__' || segment === 'constructor' || segment === 'prototype') {
      return undefined;
    }
    if (current === null || typeof current !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Formats a computed value for display.
 *
 * - `number`: fixed decimals with grouping, unit appended
 * - `currency`: unit (default `$`) as prefix
 * - `percent`: value times 100, with `%`
 * - `text`: string form
 *
 * @throws {ExpressionError} When a numeric format receives a non-number
 */
export function formatComputedValue(
  value: unknown,
  format: ComputedFormat = 'number',
  decimals = 2,
  unit: string | null = null
): string {
  if (format === 'text') return String(value);
  const numeric = typeof value === 'number' ? value : Number(value);
  if (typeof value === 'boolean' || value === '' || value == null || !Number.isFinite(numeric)) {
    throw new ExpressionError('Computed value is not a number');
  }
  const digits = Math.min(10, Math.max(0, Math.trunc(decimals)));
  const options = { minimumFractionDigits: digits, maximumFractionDigits: digits };
  if (format === 'percent') return `${(numeric * 100).toLocaleString('en-US', options)}%`;
  const formatted = numeric.toLocaleString('en-US', options);
  if (format === 'currency') return `${unit ?? '$'}${formatted}`;
  return unit ? `${formatted} ${unit}` : formatted;
}

/** Built-in cross-reference text for a target. Returns `null` when not available. */
export function defaultCrossReferenceText(
  target: CrossReferenceTarget,
  display: CrossReferenceDisplay
): string | null {
  if (display === 'page') return null;
  if (target.kind === 'caption') {
    if (display === 'label') return target.label ?? null;
    if (display === 'number') return target.number != null ? String(target.number) : null;
    return target.text;
  }
  return display === 'text' ? target.text : null;
}

/**
 * Resolves cross-reference text. The custom resolver runs first; the
 * built-in rules are used when it returns nothing. Unresolved references show `?`.
 */
export function resolveCrossReferenceText(
  targetId: string,
  display: CrossReferenceDisplay,
  targets: Map<string, CrossReferenceTarget>,
  resolver?: CrossReferenceResolver
): string {
  const target = targets.get(targetId);
  let custom: string | null | undefined = null;
  if (resolver) {
    try {
      custom = resolver(targetId, display, target);
    } catch {
      custom = null;
    }
  }
  if (custom != null && custom !== '') return String(custom);
  if (!target) return '?';
  return defaultCrossReferenceText(target, display) ?? '?';
}

/**
 * Numbers and resolves office items.
 *
 * - footnotes and endnotes are numbered separately from 1 in document order
 * - captions are numbered per label (`Figure`, `Table`, `Equation`)
 * - cross-references, variables and computed values get display text
 * - conditionals get visibility; repeating sections get an item count
 *
 * @param items - Items in document order
 * @param options - Variables and cross-reference resolver
 */
export function resolveOfficeItems(
  items: OfficeItem[],
  options: { variables?: OfficeVariables; crossReferenceResolver?: CrossReferenceResolver } = {}
): OfficeResolution {
  const variables = options.variables ?? {};
  const captions = new Map<string, CaptionNumber>();
  const targets = new Map<string, CrossReferenceTarget>();
  const notes: OfficeNote[] = [];
  const counters: Record<string, number> = {};
  const resolved: ResolvedOfficeItem[] = [];

  // Pass 1: sequence numbers and targets.
  for (const item of items) {
    if (item.kind === 'footnote' || item.kind === 'endnote') {
      counters[item.kind] = (counters[item.kind] ?? 0) + 1;
      const number = counters[item.kind] as number;
      notes.push({ kind: item.kind, id: item.id, number, text: item.text });
      resolved.push({ item, number });
    } else if (item.kind === 'caption') {
      const label = stringOr(item.attrs.label, 'Figure');
      counters[label] = (counters[label] ?? 0) + 1;
      const number = counters[label] as number;
      resolved.push({ item, number, label });
      if (item.id) {
        captions.set(item.id, { label, number });
        targets.set(item.id, {
          id: item.id,
          kind: 'caption',
          blockType: 'caption',
          label,
          number,
          text: item.text ? `${label} ${number}: ${item.text}` : `${label} ${number}`,
        });
      }
    } else {
      resolved.push({ item });
      if (item.kind === 'heading' && item.id) {
        targets.set(item.id, {
          id: item.id,
          kind: 'heading',
          blockType: 'heading',
          text: item.text,
        });
      }
    }
  }

  // Pass 2: displays and smart content.
  for (const entry of resolved) {
    const { item } = entry;
    switch (item.kind) {
      case 'crossReference': {
        const targetId = stringOr(item.attrs.targetId);
        const display = (stringOr(item.attrs.display, 'number') as CrossReferenceDisplay);
        entry.display = resolveCrossReferenceText(targetId, display, targets, options.crossReferenceResolver);
        break;
      }
      case 'variable': {
        const name = stringOr(item.attrs.name);
        const value = readVariable(variables, name);
        entry.display = value == null ? `[${name}]` : String(value);
        break;
      }
      case 'computedValue': {
        entry.display = computeDisplay(item.attrs, variables);
        break;
      }
      case 'conditional': {
        const result = tryEvaluateExpression(stringOr(item.attrs.expression, 'true'), variables);
        entry.visible = result.ok ? isTruthy(result.value) : true;
        break;
      }
      case 'repeatingSection': {
        const list = readVariable(variables, stringOr(item.attrs.itemsKey));
        entry.count = Array.isArray(list) ? list.length : 0;
        break;
      }
      default:
        break;
    }
  }

  return { items: resolved, captions, targets, notes };
}

function computeDisplay(attrs: Record<string, unknown>, variables: OfficeVariables): string {
  const result = tryEvaluateExpression(stringOr(attrs.expression), variables);
  if (!result.ok) return '#ERROR';
  try {
    const decimals = attrs.decimals == null ? 2 : Number(attrs.decimals);
    return formatComputedValue(
      result.value,
      (stringOr(attrs.format, 'number') as ComputedFormat),
      decimals,
      attrs.unit == null || attrs.unit === '' ? null : String(attrs.unit)
    );
  } catch {
    return '#VALUE';
  }
}

/**
 * Computes caption sequence numbers keyed by caption id.
 *
 * @param blocks - Blocks (children included)
 * @returns Map from caption id to label and number
 *
 * @example
 * ```typescript
 * const numbers = computeCaptionNumbers(editor.getDocument());
 * numbers.get(captionId); // { label: 'Figure', number: 2 }
 * ```
 */
export function computeCaptionNumbers(blocks: Block[]): Map<string, CaptionNumber> {
  return resolveOfficeItems(collectItemsFromBlocks(blocks)).captions;
}

/**
 * Lists footnotes and endnotes in document order with their numbers.
 *
 * Layout and print use this to place notes; each kind is numbered independently.
 *
 * @param blocks - Blocks (children included)
 */
export function collectNotes(blocks: Block[]): OfficeNote[] {
  return resolveOfficeItems(collectItemsFromBlocks(blocks)).notes;
}

/**
 * Evaluates whether a conditional expression is visible.
 *
 * An expression that fails to evaluate is treated as visible, and the
 * validator reports it as an error.
 *
 * @param expression - Condition, e.g. `procedureType == 'micro'`
 * @param variables - Scope
 */
export function isConditionVisible(expression: string, variables: OfficeVariables = {}): boolean {
  const result = tryEvaluateExpression(expression, variables);
  return result.ok ? isTruthy(result.value) : true;
}
