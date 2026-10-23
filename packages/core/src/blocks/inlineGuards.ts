/**
 * Type guards for inline content.
 *
 * `InlineContent` narrows with plain `item.type === '...'` checks, so these
 * guards are optional for typed code. They remain useful for untyped runtime
 * data (for example JSON from storage) and for filtering out extension nodes.
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
