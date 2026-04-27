import { buildAIMessages } from '../../../packages/core/src/ai/prompt';
import type { AIRequest } from '../../../packages/core/src/ai/types';

export type AICompletionEnv = {
  OPENAI_API_KEY?: string;
  BEAKBLOCK_AI_MODEL?: string;
  BEAKBLOCK_AI_BASE_URL?: string;
};

export async function runOpenAICompletion(request: AIRequest, env: AICompletionEnv = process.env as AICompletionEnv): Promise<string> {
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

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('AI response was empty');
  }

  return content;
}
