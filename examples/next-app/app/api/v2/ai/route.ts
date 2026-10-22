/**
 * AI provider endpoint for the BeakBlock 2.0 AI command layer.
 *
 * Takes the `AIRequest` posted by `createFetchProvider` and returns `{ text }`, `{ blocks }` or
 * `{ json }` as `defaultParseResponse` expects. Without `OPENAI_API_KEY` it answers 503, and the
 * client falls back to a mock provider and shows a badge saying so. The server never trusts the
 * request's section permissions: the client layer checks policy before calling this route, and the
 * output only ever becomes a tracked proposal.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AIRequestBody {
  command: string;
  instruction?: string;
  context: { selectionText?: string; sectionBlocks?: unknown[]; documentProperties?: Record<string, unknown> };
  responseFormat: 'text' | 'blocks' | 'json';
  metadata: { requestId: string; userId: string; sectionId: string | null };
}

const SYSTEM_PROMPT = [
  'You assist authors of controlled laboratory documents (SOPs).',
  'Return only the requested output, with no preamble.',
  'Never state that content is verified or approved. Your output is a draft that a human will review.',
  'Keep to the scope of the section you are given and do not invent equipment IDs, approvals or references.',
].join(' ');

function describeBlocks(blocks: unknown[] | undefined): string {
  if (!blocks) return '';
  return JSON.stringify(blocks).slice(0, 8000);
}

export async function GET(): Promise<Response> {
  const configured = Boolean(process.env.OPENAI_API_KEY);
  return NextResponse.json({ configured, model: configured ? process.env.BEAKBLOCK_AI_MODEL || 'gpt-4.1-mini' : null });
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI is not configured on this server' }, { status: 503 });

  let body: AIRequestBody;
  try {
    body = (await request.json()) as AIRequestBody;
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }

  const model = process.env.BEAKBLOCK_AI_MODEL || 'gpt-4.1-mini';
  const baseUrl = (process.env.BEAKBLOCK_AI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '');
  const userPrompt = [
    `Command: ${body.command}`,
    body.instruction ? `Instruction: ${body.instruction}` : '',
    body.context.selectionText ? `Selected text:\n${body.context.selectionText}` : '',
    body.context.sectionBlocks ? `Section content (JSON blocks):\n${describeBlocks(body.context.sectionBlocks)}` : '',
    body.responseFormat === 'blocks' ? 'Respond with a JSON array of BeakBlock blocks only.' : '',
    body.responseFormat === 'json' ? 'Respond with a single JSON object only.' : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return NextResponse.json({ error: `Upstream AI request failed (${upstream.status}) ${detail.slice(0, 200)}` }, { status: 502 });
  }
  const data = (await upstream.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  const content = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) return NextResponse.json({ error: 'AI returned no content' }, { status: 502 });

  if (body.responseFormat === 'blocks') {
    try {
      return NextResponse.json({ blocks: JSON.parse(content), model });
    } catch {
      return NextResponse.json({ text: content, model });
    }
  }
  if (body.responseFormat === 'json') {
    try {
      return NextResponse.json({ json: JSON.parse(content), model });
    } catch {
      return NextResponse.json({ text: content, model });
    }
  }
  return NextResponse.json({ text: content, model });
}
