/**
 * Serialize BeakBlock {@link Block} trees to mdast for Markdown output.
 *
 * @module
 */

import type {
  BlockContent,
  Blockquote,
  Code,
  Heading,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  Table,
  TableCell,
  TableRow,
  Text as MdText,
  ThematicBreak,
} from 'mdast';
import type { Block, InlineContent, TextStyles } from '../blocks/types';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function codePlain(content: InlineContent[] | undefined): string {
  if (!content?.length) return '';
  return content
    .filter((c): c is Extract<InlineContent, { type: 'text' }> => c.type === 'text')
    .map((c) => c.text)
    .join('');
}

function styledTextToPhrasing(text: string, styles: TextStyles): PhrasingContent[] {
  if (!text) return [];
  if (styles.code) {
    return [{ type: 'inlineCode', value: text }];
  }
  if (styles.underline && (styles.bold || styles.italic || styles.strikethrough)) {
    let inner = escapeHtml(text);
    if (styles.strikethrough) inner = `<del>${inner}</del>`;
    if (styles.bold) inner = `<strong>${inner}</strong>`;
    if (styles.italic) inner = `<em>${inner}</em>`;
    return [{ type: 'html', value: `<u>${inner}</u>` }];
  }
  if (styles.underline) {
    return [{ type: 'html', value: `<u>${escapeHtml(text)}</u>` }];
  }

  const textNode: MdText = { type: 'text', value: text };
  let node: PhrasingContent = textNode;
  if (styles.strikethrough) node = { type: 'delete', children: [textNode] };
  if (styles.bold) node = { type: 'strong', children: [node] };
  if (styles.italic) node = { type: 'emphasis', children: [node] };
  return [node];
}

function inlineToPhrasing(content: InlineContent[] | undefined): PhrasingContent[] {
  if (!content?.length) return [];
  const out: PhrasingContent[] = [];
  for (const item of content) {
    if (item.type === 'hardBreak') {
      out.push({ type: 'break' });
      continue;
    }
    if (item.type === 'icon') {
      out.push({ type: 'text', value: item.symbol || item.icon });
      continue;
    }
    if (item.type === 'link') {
      const inner = item.content.flatMap((t) => styledTextToPhrasing(t.text, t.styles));
      out.push({
        type: 'link',
        url: item.href,
        ...(item.title ? { title: item.title } : {}),
        children: inner,
      });
      continue;
    }
    if (item.type === 'text') {
      out.push(...styledTextToPhrasing(item.text, item.styles));
    }
  }
  return out;
}

function blockToMdast(block: Block): RootContent[] {
  switch (block.type) {
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(block.props?.level) || 1)) as Heading['depth'];
      const h: Heading = {
        type: 'heading',
        depth: level,
        children: inlineToPhrasing(block.content),
      };
      return [h];
    }
    case 'paragraph': {
      const p: Paragraph = { type: 'paragraph', children: inlineToPhrasing(block.content) };
      return [p];
    }
    case 'blockquote': {
      const ph = inlineToPhrasing(block.content);
      const bq: Blockquote = {
        type: 'blockquote',
        children: ph.length ? [{ type: 'paragraph', children: ph }] : [],
      };
      return [bq];
    }
    case 'callout': {
      const variant = String(block.props?.calloutType || 'info');
      const prefix: PhrasingContent[] = [{ type: 'text', value: `[${variant}] ` }];
      const bq: Blockquote = {
        type: 'blockquote',
        children: [
          {
            type: 'paragraph',
            children: [...prefix, ...inlineToPhrasing(block.content)],
          },
        ],
      };
      return [bq];
    }
    case 'codeBlock': {
      const c: Code = {
        type: 'code',
        lang: String(block.props?.language || '') || undefined,
        value: codePlain(block.content),
      };
      return [c];
    }
    case 'divider': {
      const hr: ThematicBreak = { type: 'thematicBreak' };
      return [hr];
    }
    case 'bulletList':
      return [listBlockToMdast(block, false)];
    case 'orderedList':
      return [listBlockToMdast(block, true)];
    case 'checkList':
      return [checkListBlockToMdast(block)];
    case 'table':
      return [tableBlockToMdast(block)];
    case 'columnList':
      return block.children?.flatMap((c) => blockToMdast(c)) ?? [];
    case 'column': {
      const inner = block.children?.flatMap((c) => blockToMdast(c)) ?? [];
      const label: Paragraph = {
        type: 'paragraph',
        children: [{ type: 'text', value: '—' }],
      };
      return [label, ...inner];
    }
    case 'image': {
      const src = String(block.props?.src || '');
      const alt = String(block.props?.alt || '');
      const cap = block.props?.caption != null ? String(block.props.caption) : undefined;
      return [
        {
          type: 'paragraph',
          children: [{ type: 'image', url: src, alt, ...(cap ? { title: cap } : {}) }],
        },
      ];
    }
    case 'embed': {
      const url = String(block.props?.url || '');
      return [
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              url: url || '#',
              children: [{ type: 'text', value: `Embed (${String(block.props?.provider || 'link')})` }],
            },
          ],
        },
      ];
    }
    case 'tableOfContents': {
      return [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '[Table of contents]' }],
        },
      ];
    }
    case 'listItem':
    case 'checkListItem':
    case 'tableRow':
    case 'tableCell':
    case 'tableHeader':
      return [];
    default:
      if (block.children?.length) {
        return block.children.flatMap((c) => blockToMdast(c));
      }
      return [
        {
          type: 'paragraph',
          children: inlineToPhrasing(block.content),
        },
      ];
  }
}

function listBlockToMdast(block: Block, ordered: boolean): List {
  const start = ordered ? Number(block.props?.start) || 1 : undefined;
  return {
    type: 'list',
    ordered,
    ...(ordered && start !== 1 ? { start } : {}),
    spread: false,
    children: (block.children || []).map(listItemBlockToMdast),
  };
}

function listItemBlockToMdast(block: Block): ListItem {
  const children: BlockContent[] = [];
  if (block.content?.length) {
    children.push({ type: 'paragraph', children: inlineToPhrasing(block.content) });
  }
  for (const ch of block.children || []) {
    if (ch.type === 'bulletList') {
      children.push(listBlockToMdast(ch, false));
    } else if (ch.type === 'orderedList') {
      children.push(listBlockToMdast(ch, true));
    } else if (ch.type === 'checkList') {
      children.push(checkListBlockToMdast(ch));
    } else {
      children.push(...(blockToMdast(ch) as BlockContent[]));
    }
  }
  if (children.length === 0) {
    children.push({ type: 'paragraph', children: [] });
  }
  return { type: 'listItem', spread: false, children };
}

function checkListBlockToMdast(block: Block): List {
  return {
    type: 'list',
    ordered: false,
    spread: false,
    children: (block.children || []).map((item) => {
      const li: ListItem = {
        type: 'listItem',
        spread: false,
        checked: Boolean(item.props?.checked),
        children: [
          {
            type: 'paragraph',
            children: inlineToPhrasing(item.content),
          },
        ],
      };
      return li;
    }),
  };
}

function tableBlockToMdast(block: Block): Table {
  const rows: TableRow[] = (block.children || [])
    .filter((r) => r.type === 'tableRow')
    .map((row) => {
      const cells: TableCell[] = (row.children || []).map((cell) => tableCellBlockToMdast(cell));
      return { type: 'tableRow', children: cells };
    });
  return { type: 'table', align: [], children: rows };
}

function tableCellBlockToMdast(cell: Block): TableCell {
  const parts: PhrasingContent[] = [];
  for (const child of cell.children || []) {
    if (child.type === 'paragraph') {
      parts.push(...inlineToPhrasing(child.content));
    } else {
      parts.push({ type: 'text', value: codePlain(child.content) });
    }
  }
  if (parts.length === 0) parts.push({ type: 'text', value: '' });
  return { type: 'tableCell', children: parts };
}

/**
 * Build an mdast root from top-level blocks (for custom serializers).
 */
export function blocksToMdastRoot(blocks: Block[]): Root {
  return { type: 'root', children: blocks.flatMap(blockToMdast) };
}
