import type { Block, InlineContent } from '../blocks';
import type { BeakBlockEditor } from '../editor';
import type { AIContext, AIEntryMode } from './types';

function renderInlineContent(content: InlineContent[] | undefined): string {
  if (!content || content.length === 0) return '';

  return content
    .map((item) => {
      if (item.type === 'text') {
        let text = item.text;
        if (item.styles.code) text = `\`${text}\``;
        if (item.styles.bold) text = `**${text}**`;
        if (item.styles.italic) text = `_${text}_`;
        if (item.styles.underline) text = `<u>${text}</u>`;
        if (item.styles.strikethrough) text = `~~${text}~~`;
        if (item.styles.textColor) text = `${text}`;
        if (item.styles.backgroundColor) text = `${text}`;
        return text;
      }

      if (item.type === 'link') {
        const linkText = item.content.map((child) => child.text).join('');
        return `[${linkText}](${item.href})`;
      }

      if (item.type === 'icon') {
        return item.symbol || item.icon;
      }

      return '';
    })
    .join('');
}

function renderBlock(block: Block, depth = 0): string {
  const prefix = depth > 0 ? `${'  '.repeat(depth)}` : '';
  const text = renderInlineContent(block.content);

  switch (block.type) {
    case 'heading': {
      const level = Number(block.props?.level || 1);
      return `${'#'.repeat(Math.min(Math.max(level, 1), 6))} ${text}`.trim();
    }
    case 'paragraph':
      return text || '';
    case 'blockquote':
      return text ? `> ${text}` : '>';
    case 'callout': {
      const variant = String(block.props?.calloutType || 'info');
      return `> [${variant}] ${text}`.trim();
    }
    case 'codeBlock':
      return ['```', text, '```'].join('\n');
    case 'divider':
      return '---';
    case 'bulletList':
      return (block.children || [])
        .map((child) => renderBlock(child, depth + 1))
        .map((line) => `${prefix}- ${line}`)
        .join('\n');
    case 'orderedList':
      return (block.children || [])
        .map((child, index) => `${prefix}${index + 1}. ${renderBlock(child, depth + 1)}`)
        .join('\n');
    case 'listItem':
      return [
        text,
        ...(block.children || []).map((child) => renderBlock(child, depth + 1)),
      ]
        .filter(Boolean)
        .join('\n');
    case 'checkList':
      return (block.children || []).map((child) => renderBlock(child, depth + 1)).join('\n');
    case 'checkListItem':
      return `[ ] ${text}`;
    case 'columnList':
      return (block.children || [])
        .map((child, index) => `[[Column ${index + 1}]]\n${renderBlock(child, depth + 1)}`)
        .join('\n\n');
    case 'table':
      return (block.children || []).map((child) => renderBlock(child, depth + 1)).join('\n');
    case 'tableRow':
      return (block.children || []).map((child) => renderBlock(child, depth + 1)).join(' | ');
    case 'tableCell':
    case 'tableHeader':
      return [
        text,
        ...(block.children || []).map((child) => renderBlock(child, depth + 1)),
      ]
        .filter(Boolean)
        .join('\n');
    case 'image':
      return `[Image: ${String(block.props?.alt || block.props?.src || 'image')}]`;
    case 'embed':
      return `[Embed: ${String(block.props?.provider || 'embed')}]`;
    default:
      if (block.children && block.children.length > 0) {
        return block.children.map((child) => renderBlock(child, depth + 1)).join('\n');
      }
      return text;
  }
}

function renderDocumentMarkdown(blocks: Block[]): string {
  return blocks.map((block) => renderBlock(block)).filter(Boolean).join('\n\n');
}

export function buildAIContext(
  editor: BeakBlockEditor,
  mode: AIEntryMode,
  preset?: { id: string; title: string; description: string; prompt: string } | null,
  instruction = ''
): AIContext {
  const documentBlocks = editor.getDocument();
  const selectedBlocks = editor.getSelectedBlocks();
  const selection = editor.pm.hasSelection()
    ? {
        from: editor.pm.selection.from,
        to: editor.pm.selection.to,
        text: editor.pm.getSelectedText(),
        blocks: selectedBlocks,
        markdown: renderDocumentMarkdown(selectedBlocks.length > 0 ? selectedBlocks : documentBlocks),
      }
    : null;

  return {
    mode,
    preset: preset ?? null,
    instruction,
    selection,
    document: {
      blocks: documentBlocks,
      markdown: renderDocumentMarkdown(documentBlocks),
    },
  };
}
