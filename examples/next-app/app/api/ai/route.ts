import { NextResponse } from 'next/server';
import { runOpenAICompletion } from '../../ai.server';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as Parameters<typeof runOpenAICompletion>[0];
    const output = await runOpenAICompletion(body);
    return NextResponse.json({ output });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
