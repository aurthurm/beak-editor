/**
 * Shared helpers for the clinical and forms block packages.
 *
 * @module
 */

import type {
  Block,
  FieldContent,
  IconContent,
  InlineContent,
  LinkContent,
  StyledText,
} from '@amusendame/beakblock-core';

/** Escapes text for safe inclusion in HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain text of an inline content array. Extension inline nodes contribute their inline children. */
export function inlineText(content: InlineContent[] | undefined): string {
  if (!content) return '';
  return content
    .map((item) => {
      switch (item.type) {
        case 'text':
          return (item as StyledText).text;
        case 'link':
          return ((item as LinkContent).content ?? []).map((text) => text.text).join('');
        case 'icon':
          return (item as IconContent).symbol;
        case 'hardBreak':
          return '\n';
        case 'field':
          return (item as FieldContent).fallback ?? '';
        default:
          return inlineText((item as { content?: InlineContent[] }).content);
      }
    })
    .join('');
}

/** Plain text of a block and its descendants, trimmed. */
export function blockText(block: Block): string {
  const own = inlineText(block.content);
  const children = (block.children ?? []).map(blockText).filter(Boolean).join(' ');
  return [own, children].filter(Boolean).join(' ').trim();
}

/** Returns the finite number held by a number or numeric string, otherwise `null`. */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Keeps only string entries of an unknown array-valued attribute. */
export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * Whether `value` is a calendar-valid ISO date (`YYYY-MM-DD`).
 */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Calls `visit` for every block in a tree, depth first, with its index path. */
export function walkBlocks(
  blocks: Block[],
  visit: (block: Block, path: string, parent: Block | null) => void,
  parent: Block | null = null,
  parentPath: string[] = []
): void {
  blocks.forEach((block, index) => {
    const segments = [...parentPath, String(index)];
    visit(block, segments.join('/'), parent);
    if (block.children?.length) {
      walkBlocks(block.children, visit, block, [...segments, 'children']);
    }
  });
}
