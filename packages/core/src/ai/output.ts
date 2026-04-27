import { Slice } from 'prosemirror-model';
import { v4 as uuid } from 'uuid';

import { blocksToDoc, type Block } from '../blocks';
import { markdownToBlocks } from '../markdown';
import { looksLikeMarkdown } from '../markdown/heuristic';
import type { BeakBlockEditor } from '../editor';
import type { AIRequest } from './types';

export type AIBlockOutputStrategy = 'replace_selection' | 'insert_after_selection';

export type AIBlockOutput = {
  version?: 1;
  strategy?: AIBlockOutputStrategy;
  blocks: Block[];
};

const INLINE_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'callout',
  'checkListItem',
  'listItem',
  'codeBlock',
  'divider',
  'image',
  'embed',
  'tableOfContents',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isBlockLike(value: unknown): value is { type: string } {
  return isPlainObject(value) && typeof value.type === 'string' && value.type.length > 0;
}

function isInlineContentLike(value: unknown): boolean {
  return isPlainObject(value) && typeof value.type === 'string' && ['text', 'link', 'icon', 'hardBreak'].includes(value.type);
}

function looksLikeBlockChildren(value: unknown): value is Block[] {
  return Array.isArray(value) && value.some((item) => isBlockLike(item) && !isInlineContentLike(item));
}

function normalizeAIBlock(block: Block): Block {
  const normalized: Block = {
    id: block.id || uuid(),
    type: block.type,
    props: isPlainObject(block.props) ? { ...block.props } : {},
  };

  const attrs = isPlainObject((block as { attrs?: unknown }).attrs) ? ((block as { attrs?: Record<string, unknown> }).attrs ?? {}) : null;
  if (attrs && Object.keys(normalized.props).length === 0) {
    normalized.props = { ...attrs };
  }

  if (Array.isArray(block.children) && block.children.length > 0) {
    normalized.children = block.children.map((child) => normalizeAIBlock(child));
  }

  if (Array.isArray(block.content) && block.content.length > 0) {
    if (looksLikeBlockChildren(block.content)) {
      normalized.children = block.content.map((child) => normalizeAIBlock(child as Block));
    } else {
      normalized.content = block.content;
    }
  }

  if (block.type === 'tableOfContents') {
    normalized.props = {
      ...normalized.props,
      items: Array.isArray((normalized.props as { items?: unknown }).items) ? (normalized.props as { items?: unknown }).items : [],
    };
  }

  return normalized;
}

function normalizeAIBlocks(blocks: Block[]): Block[] {
  return blocks.map((block) => normalizeAIBlock(block));
}

function isInlineOnlyBlock(block: Block): boolean {
  return INLINE_BLOCK_TYPES.has(block.type) && !block.children?.length;
}

function findTopLevelBlockRange(editor: BeakBlockEditor): { from: number; to: number } {
  const { selection } = editor.pm.state;
  const depth = selection.$from.depth > 0 ? 1 : 0;
  if (depth === 0) {
    return { from: 0, to: editor.pm.state.doc.content.size };
  }
  return {
    from: selection.$from.before(depth),
    to: selection.$from.after(depth),
  };
}

function unwrapCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;

  const firstBreak = trimmed.indexOf('\n');
  if (firstBreak < 0) return trimmed;
  const tail = trimmed.lastIndexOf('```');
  if (tail <= firstBreak) return trimmed;
  return trimmed.slice(firstBreak + 1, tail).trim();
}

function parseJsonPayload(text: string): AIBlockOutput | Block[] | null {
  try {
    return JSON.parse(text) as AIBlockOutput | Block[];
  } catch {
    return null;
  }
}

export function parseAIBlockOutput(output: string): AIBlockOutput | null {
  const candidate = unwrapCodeFence(output);
  const parsed = parseJsonPayload(candidate);
  if (Array.isArray(parsed)) {
    return parsed.length > 0 ? { version: 1, blocks: normalizeAIBlocks(parsed) } : null;
  }
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.blocks)) {
    return parsed.blocks.length > 0
      ? {
          version: parsed.version === 1 ? 1 : 1,
          strategy: parsed.strategy === 'replace_selection' || parsed.strategy === 'insert_after_selection' ? parsed.strategy : undefined,
          blocks: normalizeAIBlocks(parsed.blocks),
        }
      : null;
  }

  if (looksLikeMarkdown(candidate)) {
    const blocks = markdownToBlocks(candidate);
    return blocks.length > 0 ? { version: 1, blocks: normalizeAIBlocks(blocks) } : null;
  }

  return null;
}

function findCursorInsertionPos(editor: BeakBlockEditor, request: AIRequest): number {
  const cursor = request.context.cursor;
  if (cursor && Number.isFinite(cursor.blockEnd)) {
    return cursor.blockEnd;
  }
  return findTopLevelBlockRange(editor).to;
}

export function applyAIBlockOutput(
  editor: BeakBlockEditor,
  request: AIRequest,
  output: string | AIBlockOutput | Block[]
): boolean {
  if (editor.isDestroyed) return false;

  const parsed: AIBlockOutput | null =
    typeof output === 'string'
      ? parseAIBlockOutput(output)
      : Array.isArray(output)
        ? { version: 1, blocks: output }
        : output;

  const blocks = parsed?.blocks ?? [];
  if (blocks.length === 0) return false;

  const fragment = blocksToDoc(editor.pm.state.schema, blocks).content;
  const slice = new Slice(fragment, 0, 0);
  const tr = editor.pm.createTransaction();
  const selection = request.context.selection;
  const strategy = parsed?.strategy ?? (request.mode === 'bubble' ? 'replace_selection' : 'insert_after_selection');

  const cursorRange = findTopLevelBlockRange(editor);

  if (strategy === 'replace_selection' && selection && selection.from !== selection.to && blocks.length === 1 && isInlineOnlyBlock(blocks[0]!)) {
    tr.replace(selection.from, selection.to, slice);
  } else if (strategy === 'replace_selection') {
    tr.replace(cursorRange.from, cursorRange.to, slice);
  } else {
    const insertPos = findCursorInsertionPos(editor, request);
    tr.replace(insertPos, insertPos, slice);
  }

  editor.pm.dispatch(tr);
  return true;
}
