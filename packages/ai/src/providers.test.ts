/**
 * @module
 */

import { describe, expect, it, vi } from 'vitest';
import { createFetchProvider, defaultParseResponse } from './providers';
import type { AIRequest } from './types';
import { AICommandError } from './types';

const request: AIRequest = {
  command: 'ai.explainTechnicalTerm',
  instruction: 'Term: pH',
  context: {},
  responseFormat: 'json',
  metadata: { requestId: 'r1', userId: 'u1', sectionId: null },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('createFetchProvider', () => {
  it('POSTs the request as JSON and reads the output field', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ output: '{"findings":[]}', model: 'gpt-test' }));
    const provider = createFetchProvider({ url: '/api/ai', headers: { Authorization: 'Bearer t' }, fetch: fetchMock as unknown as typeof fetch });

    const response = await provider(request);

    expect(response).toEqual({ text: '{"findings":[]}', model: 'gpt-test' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ai');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({ command: 'ai.explainTechnicalTerm' });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t');
  });

  it('adapts the body and reply with toBody and parseResponse', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ result: { json: { findings: [] } } }));
    const provider = createFetchProvider({
      url: '/x',
      fetch: fetchMock as unknown as typeof fetch,
      toBody: (r) => ({ prompt: r.instruction }),
      parseResponse: (data) => ({ json: (data as { result: { json: unknown } }).result.json }),
    });
    const response = await provider(request);
    expect(response.json).toEqual({ findings: [] });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ prompt: 'Term: pH' });
  });

  it('turns a non-ok status into a provider-error', async () => {
    const provider = createFetchProvider({
      url: '/x',
      fetch: (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch,
    });
    await expect(provider(request)).rejects.toMatchObject({ code: 'provider-error' });
  });
});

describe('defaultParseResponse', () => {
  it('accepts the AIResponse fields directly', () => {
    expect(defaultParseResponse({ blocks: [], model: 'm' })).toEqual({ blocks: [], model: 'm' });
  });

  it('rejects a reply with no usable field', () => {
    expect(() => defaultParseResponse({ nothing: true })).toThrow(AICommandError);
  });
});
