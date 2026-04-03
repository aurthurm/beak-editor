/**
 * Code block node specification.
 *
 * A block for displaying preformatted code with optional language hint.
 *
 * @module
 */

import type { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

/**
 * Code block node spec.
 *
 * Renders as `<pre><code>` elements. The `language` prop can be used
 * for syntax highlighting integration.
 *
 * Note: Code blocks contain plain text only - marks are not applied inside.
 *
 * @example
 * ```typescript
 * // JSON block representation:
 * {
 *   id: 'code-1',
 *   type: 'codeBlock',
 *   props: { language: 'typescript' },
 *   content: [{ type: 'text', text: 'const x = 42;', styles: {} }]
 * }
 * ```
 */
export const codeBlockNode: NodeSpec = {
  content: 'text*',
  group: 'block',
  // Code blocks don't allow marks - code is plain text
  marks: '',
  // Treat as a single unit for cursor navigation
  code: true,
  // Preserve whitespace exactly as entered
  defining: true,
  attrs: {
    id: { default: null },
    language: { default: '' },
  },
  parseDOM: [
    {
      tag: 'pre',
      preserveWhitespace: 'full',
      getAttrs(node) {
        const pre = node as HTMLElement;
        const code = pre.querySelector('code');
        const lang = code?.getAttribute('data-language') || code?.className.match(/language-(\w+)/)?.[1] || '';
        return { language: lang };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const language = node.attrs.language || '';
    return [
      'pre',
      { class: 'beakblock-code-block', 'data-block-id': node.attrs.id },
      ['code', { 'data-language': language, class: language ? `language-${language}` : '' }, 0],
    ];
  },
};
