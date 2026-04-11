import { blocksToMarkdown } from '../markdown';
import type { BeakBlockEditor } from '../editor';
import type { AIContext, AIEntryMode } from './types';

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
    document: {
      blocks: documentBlocks,
      markdown: blocksToMarkdown(documentBlocks),
    },
  };
}
