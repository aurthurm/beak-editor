/**
 * Input rules for markdown-style shortcuts.
 *
 * Input rules automatically transform text as the user types,
 * enabling markdown-like shortcuts for formatting and block conversion.
 *
 * @module
 */

import { Schema, NodeType, MarkType } from 'prosemirror-model';
import {
  inputRules,
  wrappingInputRule,
  textblockTypeInputRule,
  InputRule,
} from 'prosemirror-inputrules';
import { Plugin } from 'prosemirror-state';

/**
 * Creates an input rule for converting text to a heading.
 *
 * Matches: "# ", "## ", "### ", etc. at the start of a line.
 *
 * @example
 * ```typescript
 * // User types "## Hello" → becomes Heading level 2
 * const rule = headingRule(schema.nodes.heading, 6);
 * ```
 *
 * @param nodeType - The heading node type
 * @param maxLevel - Maximum heading level (default 6)
 * @returns Input rule for headings
 */
export function headingRule(nodeType: NodeType, maxLevel: number = 6): InputRule {
  // Match 1-6 # characters followed by a space at the start of a line
  return textblockTypeInputRule(
    new RegExp(`^(#{1,${maxLevel}})\\s$`),
    nodeType,
    (match) => ({ level: match[1].length })
  );
}

/**
 * Creates an input rule for bullet lists.
 *
 * Matches: "- ", "* ", "+ " at the start of a line.
 *
 * @example
 * ```typescript
 * // User types "- item" → wraps in bullet list
 * const rule = bulletListRule(schema.nodes.bulletList);
 * ```
 *
 * @param listType - The bullet list node type
 * @returns Input rule for bullet lists
 */
export function bulletListRule(listType: NodeType): InputRule {
  return wrappingInputRule(
    /^\s*([-+*])\s$/,
    listType,
    undefined,
    // Join function: join with previous list if types match
    (_match, node) => node.type === listType
  );
}

/**
 * Creates an input rule for ordered lists.
 *
 * Matches: "1. ", "2. ", etc. at the start of a line.
 *
 * @example
 * ```typescript
 * // User types "1. first" → wraps in ordered list
 * const rule = orderedListRule(schema.nodes.orderedList);
 * ```
 *
 * @param listType - The ordered list node type
 * @returns Input rule for ordered lists
 */
export function orderedListRule(listType: NodeType): InputRule {
  return wrappingInputRule(
    /^\s*(\d+)\.\s$/,
    listType,
    (match) => ({ start: parseInt(match[1], 10) }),
    // Join with previous list if types match
    (_match, node) => node.type === listType
  );
}

/**
 * Creates an input rule for blockquotes.
 *
 * Matches: "> " at the start of a line.
 *
 * @example
 * ```typescript
 * // User types "> quote" → wraps in blockquote
 * const rule = blockquoteRule(schema.nodes.blockquote);
 * ```
 *
 * @param nodeType - The blockquote node type
 * @returns Input rule for blockquotes
 */
export function blockquoteRule(nodeType: NodeType): InputRule {
  return wrappingInputRule(
    /^\s*>\s$/,
    nodeType
  );
}

/**
 * Creates an input rule for code blocks.
 *
 * Matches: "```" or "```language" at the start of a line.
 *
 * @example
 * ```typescript
 * // User types "```js" + Enter → becomes code block with language "js"
 * const rule = codeBlockRule(schema.nodes.codeBlock);
 * ```
 *
 * @param nodeType - The code block node type
 * @returns Input rule for code blocks
 */
export function codeBlockRule(nodeType: NodeType): InputRule {
  // Match triple backticks with optional language identifier
  return textblockTypeInputRule(
    /^```([a-zA-Z0-9]*)\s$/,
    nodeType,
    (match) => ({ language: match[1] || '' })
  );
}

/**
 * Creates an input rule for horizontal dividers.
 *
 * Matches: "---" or "***" or "___" (3+ chars) at the start of a line.
 *
 * @example
 * ```typescript
 * // User types "---" → inserts horizontal rule
 * const rule = dividerRule(schema.nodes.divider);
 * ```
 *
 * @param nodeType - The divider node type
 * @returns Input rule for dividers
 */
export function dividerRule(nodeType: NodeType): InputRule {
  return new InputRule(
    /^([-*_]){3,}\s$/,
    (state, _match, start, end) => {
      const tr = state.tr;
      // Replace the matched text with a divider node
      tr.replaceWith(start, end, nodeType.create());
      return tr;
    }
  );
}

// =============================================================================
// INLINE FORMATTING RULES
// =============================================================================

/**
 * Creates an input rule for bold text.
 *
 * Matches: `**text**` or `__text__`
 *
 * @example
 * ```typescript
 * // User types "**hello**" → "hello" with bold mark
 * const rule = boldRule(schema.marks.bold);
 * ```
 *
 * @param markType - The bold mark type
 * @returns Input rule for bold
 */
export function boldRule(markType: MarkType): InputRule {
  // Match **text** or __text__ (non-greedy, at least 1 char inside)
  return new InputRule(
    /(?:\*\*|__)([^*_]+)(?:\*\*|__)$/,
    (state, match, start, end) => {
      const text = match[1];
      if (!text) return null;

      const tr = state.tr;
      // Delete the markdown syntax and insert marked text
      tr.delete(start, end);
      tr.insertText(text, start);
      tr.addMark(start, start + text.length, markType.create());
      return tr;
    }
  );
}

/**
 * Creates an input rule for italic text.
 *
 * Matches: `*text*` or `_text_` (but not `**` or `__`)
 *
 * @example
 * ```typescript
 * // User types "*hello*" → "hello" with italic mark
 * const rule = italicRule(schema.marks.italic);
 * ```
 *
 * @param markType - The italic mark type
 * @returns Input rule for italic
 */
export function italicRule(markType: MarkType): InputRule {
  // Match *text* or _text_ (single delimiter, non-greedy)
  // Negative lookbehind ensures we don't match ** or __
  return new InputRule(
    /(?:^|[^*_])(\*|_)([^*_]+)\1$/,
    (state, match, start, end) => {
      const text = match[2];
      if (!text) return null;

      const tr = state.tr;
      // Adjust start if there's a preceding character
      const actualStart = match[0].length > match[1].length + text.length + match[1].length
        ? start + 1
        : start;

      tr.delete(actualStart, end);
      tr.insertText(text, actualStart);
      tr.addMark(actualStart, actualStart + text.length, markType.create());
      return tr;
    }
  );
}

/**
 * Creates an input rule for inline code.
 *
 * Matches: `` `text` ``
 *
 * @example
 * ```typescript
 * // User types "`code`" → "code" with code mark
 * const rule = inlineCodeRule(schema.marks.code);
 * ```
 *
 * @param markType - The code mark type
 * @returns Input rule for inline code
 */
export function inlineCodeRule(markType: MarkType): InputRule {
  return new InputRule(
    /`([^`]+)`$/,
    (state, match, start, end) => {
      const text = match[1];
      if (!text) return null;

      const tr = state.tr;
      tr.delete(start, end);
      tr.insertText(text, start);
      tr.addMark(start, start + text.length, markType.create());
      return tr;
    }
  );
}

/**
 * Creates an input rule for strikethrough text.
 *
 * Matches: `~~text~~`
 *
 * @example
 * ```typescript
 * // User types "~~deleted~~" → "deleted" with strikethrough mark
 * const rule = strikethroughRule(schema.marks.strikethrough);
 * ```
 *
 * @param markType - The strikethrough mark type
 * @returns Input rule for strikethrough
 */
export function strikethroughRule(markType: MarkType): InputRule {
  return new InputRule(
    /~~([^~]+)~~$/,
    (state, match, start, end) => {
      const text = match[1];
      if (!text) return null;

      const tr = state.tr;
      tr.delete(start, end);
      tr.insertText(text, start);
      tr.addMark(start, start + text.length, markType.create());
      return tr;
    }
  );
}

/**
 * Configuration for creating input rules.
 */
export interface InputRulesConfig {
  // === Block rules ===

  /**
   * Enable heading shortcuts (# Heading).
   * @default true
   */
  headings?: boolean;

  /**
   * Enable bullet list shortcuts (- item).
   * @default true
   */
  bulletLists?: boolean;

  /**
   * Enable ordered list shortcuts (1. item).
   * @default true
   */
  orderedLists?: boolean;

  /**
   * Enable blockquote shortcuts (> quote).
   * @default true
   */
  blockquotes?: boolean;

  /**
   * Enable code block shortcuts (```).
   * @default true
   */
  codeBlocks?: boolean;

  /**
   * Enable divider shortcuts (---).
   * @default true
   */
  dividers?: boolean;

  // === Inline formatting rules ===

  /**
   * Enable bold shortcuts (**text** or __text__).
   * @default true
   */
  bold?: boolean;

  /**
   * Enable italic shortcuts (*text* or _text_).
   * @default true
   */
  italic?: boolean;

  /**
   * Enable inline code shortcuts (`code`).
   * @default true
   */
  inlineCode?: boolean;

  /**
   * Enable strikethrough shortcuts (~~text~~).
   * @default true
   */
  strikethrough?: boolean;
}

/**
 * Creates an input rules plugin with markdown-style shortcuts.
 *
 * This plugin enables automatic text transformations as the user types:
 *
 * **Block rules:**
 * - `# ` → Heading 1, `## ` → Heading 2, etc.
 * - `- `, `* `, `+ ` → Bullet list
 * - `1. `, `2. ` → Ordered list
 * - `> ` → Blockquote
 * - ``` → Code block
 * - `---`, `***`, `___` → Divider
 *
 * **Inline formatting:**
 * - `**text**` or `__text__` → Bold
 * - `*text*` or `_text_` → Italic
 * - `` `code` `` → Inline code
 * - `~~text~~` → Strikethrough
 *
 * @example
 * ```typescript
 * import { createInputRulesPlugin } from '@beakblock/core';
 *
 * const plugin = createInputRulesPlugin(schema, {
 *   headings: true,
 *   bold: true,
 *   italic: true,
 * });
 * ```
 *
 * @param schema - The ProseMirror schema
 * @param config - Configuration to enable/disable specific rules
 * @returns A ProseMirror plugin with input rules
 */
export function createInputRulesPlugin(
  schema: Schema,
  config: InputRulesConfig = {}
): Plugin {
  const {
    // Block rules
    headings = true,
    bulletLists = true,
    orderedLists = true,
    blockquotes = true,
    codeBlocks = true,
    dividers = true,
    // Inline rules
    bold = true,
    italic = true,
    inlineCode = true,
    strikethrough = true,
  } = config;

  const rules: InputRule[] = [];

  // === Block rules ===

  // Heading rules: # → h1, ## → h2, etc.
  if (headings && schema.nodes.heading) {
    rules.push(headingRule(schema.nodes.heading));
  }

  // Bullet list: - or * or +
  if (bulletLists && schema.nodes.bulletList && schema.nodes.listItem) {
    rules.push(bulletListRule(schema.nodes.bulletList));
  }

  // Ordered list: 1. 2. etc.
  if (orderedLists && schema.nodes.orderedList && schema.nodes.listItem) {
    rules.push(orderedListRule(schema.nodes.orderedList));
  }

  // Blockquote: >
  if (blockquotes && schema.nodes.blockquote) {
    rules.push(blockquoteRule(schema.nodes.blockquote));
  }

  // Code block: ```
  if (codeBlocks && schema.nodes.codeBlock) {
    rules.push(codeBlockRule(schema.nodes.codeBlock));
  }

  // Divider: --- or *** or ___
  if (dividers && schema.nodes.divider) {
    rules.push(dividerRule(schema.nodes.divider));
  }

  // === Inline formatting rules ===
  // Note: Bold must come before italic to avoid conflicts with ** vs *

  // Bold: **text** or __text__
  if (bold && schema.marks.bold) {
    rules.push(boldRule(schema.marks.bold));
  }

  // Italic: *text* or _text_
  if (italic && schema.marks.italic) {
    rules.push(italicRule(schema.marks.italic));
  }

  // Inline code: `code`
  if (inlineCode && schema.marks.code) {
    rules.push(inlineCodeRule(schema.marks.code));
  }

  // Strikethrough: ~~text~~
  if (strikethrough && schema.marks.strikethrough) {
    rules.push(strikethroughRule(schema.marks.strikethrough));
  }

  return inputRules({ rules });
}
