import type { AIRequest } from '@amusendame/beakblock-core';

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
