import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { AIRequest } from '@aurthurm/beakblock-core';
import { buildAIMessages } from '../../../shared/ai';

function openAiBaseUrl(url: string): string {
  const trimmed = url.replace(/\/$/, '');
  if (trimmed.endsWith('/v1')) return trimmed;
  return `${trimmed}/v1`;
}

function resolveOpenAiApiKey(config: ReturnType<typeof useRuntimeConfig>): string {
  return (
    process.env.NUXT_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    String(config.openaiApiKey || '')
  );
}

export default defineEventHandler(async (event) => {
  const request = (await readBody(event)) as AIRequest;
  const config = useRuntimeConfig();
  const apiKey = resolveOpenAiApiKey(config);
  if (!apiKey) {
    throw createError({
      statusCode: 503,
      statusMessage:
        'AI is not configured. Set OPENAI_API_KEY (or NUXT_OPENAI_API_KEY) in examples/nuxt-vue/.env or .env.local — see .env.example.',
    });
  }

  const openai = createOpenAI({
    apiKey,
    baseURL: openAiBaseUrl(config.beakblockAiBaseUrl || 'https://api.openai.com'),
  });

  const modelId = config.beakblockAiModel || 'gpt-4.1-mini';

  try {
    const { text } = await generateText({
      model: openai.chat(modelId),
      messages: buildAIMessages(request),
      temperature: request.mode === 'bubble' ? 0.2 : 0.5,
    });
    const output = text.trim();
    if (!output) {
      throw createError({
        statusCode: 500,
        statusMessage: 'AI response was empty',
      });
    }
    return { output };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'AI request failed',
    });
  }
});
