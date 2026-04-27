import { blocksToMarkdown } from '../markdown';
import { nodeToBlock } from '../blocks';
import type { BeakBlockEditor } from '../editor';
import type { AIContext, AIEntryMode, AICursorContext, AISchemaContext, AISchemaNodeSummary } from './types';

function summarizeSchema(editor: BeakBlockEditor): AISchemaContext {
  const entries = Object.entries(editor.pm.state.schema.nodes)
    .filter(([name]) => name !== 'doc' && name !== 'text' && name !== 'hardBreak')
    .map(([name, node]) => {
      const spec = node.spec;
      const attrs = Object.keys(spec.attrs ?? {});
      const group = spec.group ?? null;
      const summary: AISchemaNodeSummary = {
        name,
        group,
        content: spec.content ?? null,
        attrs,
        atom: Boolean(spec.atom),
        inline: group?.includes('inline') ?? false,
      };
      return summary;
    });

  return {
    blockNodes: entries.filter((entry) => entry.group?.includes('block') ?? false),
    inlineNodes: entries.filter((entry) => entry.inline && !(entry.group?.includes('block') ?? false)),
  };
}

function summarizeCursor(editor: BeakBlockEditor): AICursorContext {
  const selection = editor.pm.state.selection;
  const { $from } = selection;
  const blockDepth = $from.depth > 0 ? 1 : 0;
  const blockNode = blockDepth > 0 ? $from.node(blockDepth) : null;
  const blockStart = blockDepth > 0 ? $from.before(blockDepth) : 0;
  const blockEnd = blockDepth > 0 ? $from.after(blockDepth) : editor.pm.state.doc.content.size;
  const block = blockNode ? nodeToBlock(blockNode) : null;
  const markdown = block ? blocksToMarkdown([block]) : '';

  return {
    from: selection.from,
    to: selection.to,
    blockStart,
    blockEnd,
    blockId: block?.id ?? null,
    blockType: blockNode?.type.name ?? 'doc',
    block,
    markdown,
  };
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
        markdown: blocksToMarkdown(selectedBlocks.length > 0 ? selectedBlocks : documentBlocks),
      }
    : null;

  return {
    mode,
    preset: preset ?? null,
    instruction,
    selection,
    cursor: summarizeCursor(editor),
    document: {
      blocks: documentBlocks,
      markdown: blocksToMarkdown(documentBlocks),
    },
    schema: summarizeSchema(editor),
  };
}
