import type { AIRequest } from '@aurthurm/beakblock-core';

export type AICompletionEnv = {
  OPENAI_API_KEY?: string;
  BEAKBLOCK_AI_MODEL?: string;
  BEAKBLOCK_AI_BASE_URL?: string;
};

function compactMarkdown(markdown: string, maxLength = 1400): string {
  const normalized = markdown.trim().replace(/\n{3,}/g, '\n\n');
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

export function buildAIMessages(request: AIRequest): Array<{ role: 'system' | 'user'; content: string }> {
  const selection = request.context.selection;
  const documentMarkdown = compactMarkdown(request.context.document.markdown);
  const selectionMarkdown = selection ? compactMarkdown(selection.markdown, 900) : '';
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
          'Return only the rewritten text. Do not explain your changes.',
          'Preserve meaning unless the prompt explicitly asks otherwise.',
          'Keep the response compatible with direct insertion into the document.',
        ].join(' ')
      : [
          'You are BeakBlock AI continuing or restructuring a document.',
          'Return only the text to insert into the document. Do not explain your changes.',
          'Preserve the current tone, list structure, and editorial style unless the prompt asks otherwise.',
          'Prefer concise, well-formed prose or lists that fit the existing document.',
        ].join(' ');

  const user = [
    `Entry mode: ${request.mode}`,
    presetBlock,
    `Instruction: ${request.instruction}`,
    selection ? ['Selected text:', selection.text || '(empty)', 'Selected markdown:', selectionMarkdown || '(empty)'].join('\n') : 'Selected text: (none)',
    'Document markdown:',
    documentMarkdown || '(empty)',
    'Document blocks JSON:',
    JSON.stringify(request.context.document.blocks, null, 2),
  ].join('\n\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export async function runOpenAICompletion(request: AIRequest, env: AICompletionEnv = process.env): Promise<string> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const model = env.BEAKBLOCK_AI_MODEL || 'gpt-4.1-mini';
  const baseUrl = (env.BEAKBLOCK_AI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: buildAIMessages(request),
      temperature: request.mode === 'bubble' ? 0.2 : 0.5,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`AI request failed (${response.status}): ${errorText || response.statusText}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('AI response was empty');
  }

  return content;
}

export async function sendAIRequest(request: AIRequest, endpoint = '/api/ai'): Promise<string> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `AI request failed (${response.status})`);
  }

  const data = (await response.json()) as { output?: string; text?: string };
  const output = (data.output || data.text || '').trim();
  if (!output) throw new Error('AI endpoint returned no output');
  return output;
}
