/**
 * Type guards for inline content. Extension inline nodes (`CustomInlineContent`)
 * share the `type: string` shape, so consumers that switch on built-in kinds
 * narrow with these guards first.
 *
 * @module
 */

import type { BuiltinInlineContent, InlineContent, StyledText } from './types';

const BUILTIN_INLINE_TYPES = new Set(['text', 'link', 'icon', 'hardBreak', 'field']);

/** True for built-in inline content (text, link, icon, hardBreak, field). */
export function isBuiltinInline(item: InlineContent): item is BuiltinInlineContent {
  return BUILTIN_INLINE_TYPES.has(item.type);
}

/** True for styled text runs. */
export function isStyledText(item: InlineContent): item is StyledText {
  return item.type === 'text';
}
