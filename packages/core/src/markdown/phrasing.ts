/**
 * Convert mdast phrasing content to BeakBlock inline content.
 *
 * @module
 */

import type { PhrasingContent } from 'mdast';
import type { InlineContent, StyledText, TextStyles } from '../blocks/types';

function mergeStyles(base: TextStyles, extra: TextStyles): TextStyles {
  return { ...base, ...extra };
}

/**
 * Flatten mdast phrasing nodes into BeakBlock {@link InlineContent}.
 */
export function phrasingToInlineContent(nodes: PhrasingContent[], baseStyles: TextStyles = {}): InlineContent[] {
  const out: InlineContent[] = [];

  const walk = (list: PhrasingContent[], styles: TextStyles) => {
    for (const node of list) {
      switch (node.type) {
        case 'text':
          if (node.value) {
            out.push({ type: 'text', text: node.value, styles: { ...styles } });
          }
          break;
        case 'strong':
          walk(node.children, mergeStyles(styles, { bold: true }));
          break;
        case 'emphasis':
          walk(node.children, mergeStyles(styles, { italic: true }));
          break;
        case 'delete':
          walk(node.children, mergeStyles(styles, { strikethrough: true }));
          break;
        case 'inlineCode':
          if (node.value) {
            out.push({ type: 'text', text: node.value, styles: { ...styles, code: true } });
          }
          break;
        case 'break':
          out.push({ type: 'hardBreak' });
          break;
        case 'link': {
          const inner = phrasingToInlineContent(node.children, styles);
          const linkRuns: StyledText[] = [];
          for (const piece of inner) {
            if (piece.type === 'text') {
              linkRuns.push({ type: 'text', text: piece.text, styles: { ...piece.styles } });
            } else if (piece.type === 'link') {
              linkRuns.push(...piece.content.map((c) => ({ ...c, styles: { ...c.styles } })));
            }
          }
          if (linkRuns.length === 0) {
            linkRuns.push({ type: 'text', text: node.url || '', styles: {} });
          }
          out.push({
            type: 'link',
            href: node.url || '',
            ...(node.title ? { title: node.title } : {}),
            content: linkRuns,
          });
          break;
        }
        case 'image':
          out.push({
            type: 'text',
            text: `![${node.alt || ''}](${node.url || ''})`,
            styles: { ...styles },
          });
          break;
        case 'html':
          if (node.value) {
            out.push({ type: 'text', text: node.value, styles: { ...styles } });
          }
          break;
        default:
          break;
      }
    }
  };

  walk(nodes, baseStyles);
  return mergeAdjacentText(out);
}

function mergeAdjacentText(items: InlineContent[]): InlineContent[] {
  const merged: InlineContent[] = [];
  for (const item of items) {
    if (item.type !== 'text') {
      merged.push(item);
      continue;
    }
    const prev = merged[merged.length - 1];
    if (prev && prev.type === 'text' && stylesEqual(prev.styles, item.styles)) {
      prev.text += item.text;
    } else {
      merged.push({ ...item, styles: { ...item.styles } });
    }
  }
  return merged;
}

function stylesEqual(a: TextStyles, b: TextStyles): boolean {
  return (
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.underline === !!b.underline &&
    !!a.strikethrough === !!b.strikethrough &&
    !!a.code === !!b.code &&
    a.textColor === b.textColor &&
    a.backgroundColor === b.backgroundColor &&
    a.fontSize === b.fontSize
  );
}
