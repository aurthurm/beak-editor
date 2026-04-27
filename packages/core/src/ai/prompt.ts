import type { AIRequest } from './types';

function compactText(text: string, maxLength: number): string {
  const normalized = text.trim().replace(/\n{3,}/g, '\n\n');
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

function compactJson(value: unknown, maxLength: number): string {
  const serialized = JSON.stringify(value, null, 2);
  return compactText(serialized, maxLength);
}

function outputInstructions(request: AIRequest): string {
  const mode = request.mode === 'bubble' ? 'rewrite the current selection' : 'continue or restructure the document';
  return [
    `You are BeakBlock AI and must ${mode} using BeakBlock block JSON, not plain text.`,
    'Return strict JSON only. Do not wrap the output in markdown fences or add commentary.',
    'The response shape must be:',
    '{ "version": 1, "blocks": [ /* BeakBlock blocks that can be applied directly */ ] }',
    'Use only block types that exist in the editor schema summary.',
    'Preserve existing block ids when you are editing or extending a known block; generate new ids for new blocks if needed.',
    'Keep nested children and block props valid for the application schema.',
    'Use `children` for nested block structures such as columns, lists, tables, and checklist containers.',
    'Use `content` for inline text content inside text blocks such as paragraphs, headings, callouts, list items, and checklist items.',
    'If the instruction asks for a list, heading, callout, table, or custom block, emit the matching block types directly.',
  ].join(' ');
}

export function buildAIMessages(request: AIRequest): Array<{ role: 'system' | 'user'; content: string }> {
  const selection = request.context.selection;
  const documentMarkdown = compactText(request.context.document.markdown, 1800);
  const selectionMarkdown = selection ? compactText(selection.markdown, 1200) : '';
  const cursor = request.context.cursor;
  const presetBlock = request.preset
    ? [
        `Preset title: ${request.preset.title}`,
        `Preset description: ${request.preset.description}`,
        `Preset prompt: ${request.preset.prompt}`,
      ].join('\n')
    : 'Preset: custom prompt';

  const system =
    request.mode === 'bubble'
      ? [
          'You are BeakBlock AI editing selected content in a rich text document.',
          outputInstructions(request),
          'Prefer the smallest valid block tree that preserves meaning and renders cleanly in the editor.',
        ].join(' ')
      : [
          'You are BeakBlock AI continuing or restructuring a document.',
          outputInstructions(request),
          'Prefer concise, well-formed block output that fits the surrounding document structure.',
        ].join(' ');

  const user = [
    `Entry mode: ${request.mode}`,
    presetBlock,
    `Instruction: ${request.instruction}`,
    selection ? ['Selected text:', selection.text || '(empty)', 'Selected markdown:', selectionMarkdown || '(empty)'].join('\n') : 'Selected text: (none)',
    'Editor schema block nodes:',
    compactJson(request.context.schema.blockNodes, 2200) || '[]',
    'Editor schema inline nodes:',
    compactJson(request.context.schema.inlineNodes, 1600) || '[]',
    'Cursor block:',
    [
      `Cursor range: ${cursor.from}..${cursor.to}`,
      `Cursor block range: ${cursor.blockStart}..${cursor.blockEnd}`,
      `Cursor block type: ${cursor.blockType}`,
      `Cursor block id: ${cursor.blockId ?? '(none)'}`,
      'Cursor block markdown:',
      cursor.markdown || '(empty)',
      'Cursor block JSON:',
      compactJson(cursor.block, 1600) || 'null',
    ].join('\n'),
    'Document markdown:',
    documentMarkdown || '(empty)',
    'Document blocks JSON:',
    compactJson(request.context.document.blocks, 2600) || '[]',
    selection ? 'Selection blocks JSON:\n' + compactJson(selection.blocks, 1600) : 'Selection blocks JSON: (none)',
  ].join('\n\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
