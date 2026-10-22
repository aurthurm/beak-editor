/**
 * Provider factories. {@link createFetchProvider} talks to an application endpoint.
 * {@link createMockProvider} returns scripted replies for tests and demos.
 *
 * @module
 */

import type { AICommandId, AIProvider, AIRequest, AIResponse } from './types';
import { AICommandError } from './types';
import { isRecord } from './text';

/** Options for {@link createFetchProvider}. */
export interface FetchProviderOptions {
  /** Endpoint that accepts a JSON POST. */
  url: string;
  /** Extra headers, such as an auth token. */
  headers?: Record<string, string>;
  /**
   * Maps the request to the body the endpoint expects. Defaults to the request itself. The
   * `examples/` routes expect the core `AIRequest` shape, so adapt the body with this option.
   */
  toBody?: (request: AIRequest) => unknown;
  /** Maps the endpoint's JSON reply to an {@link AIResponse}. Defaults to {@link defaultParseResponse}. */
  parseResponse?: (data: unknown, request: AIRequest) => AIResponse;
  /** Fetch implementation. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

/**
 * Reads an {@link AIResponse} from a reply. Accepts the AIResponse fields directly, or an
 * `{ output }` / `{ text }` string as the examples' routes return.
 */
export function defaultParseResponse(data: unknown): AIResponse {
  if (!isRecord(data)) throw new AICommandError('provider-error', 'The endpoint returned a non-object reply');
  const response: AIResponse = {};
  if (typeof data.text === 'string') response.text = data.text;
  else if (typeof data.output === 'string') response.text = data.output;
  if (Array.isArray(data.blocks)) response.blocks = data.blocks as AIResponse['blocks'];
  if (data.json !== undefined) response.json = data.json;
  if (typeof data.model === 'string') response.model = data.model;
  if (isRecord(data.usage)) response.usage = data.usage as AIResponse['usage'];
  if (response.text === undefined && response.blocks === undefined && response.json === undefined) {
    throw new AICommandError('provider-error', 'The endpoint reply has no text, blocks, json or output field');
  }
  return response;
}

/**
 * A provider that POSTs the request as JSON to an application endpoint.
 *
 * @example
 * ```typescript
 * const provider = createFetchProvider({ url: '/api/ai', headers: { Authorization: `Bearer ${token}` } });
 * ```
 */
export function createFetchProvider(options: FetchProviderOptions): AIProvider {
  return async (request, signal) => {
    const doFetch = options.fetch ?? globalThis.fetch;
    const response = await doFetch(options.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: JSON.stringify(options.toBody ? options.toBody(request) : request),
      signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new AICommandError('provider-error', `AI endpoint responded ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new AICommandError('provider-error', 'The AI endpoint returned invalid JSON');
    }
    return (options.parseResponse ?? defaultParseResponse)(data, request);
  };
}

/** A scripted reply, or a function that produces one. */
export type MockReply = AIResponse | ((request: AIRequest, signal?: AbortSignal) => AIResponse | Promise<AIResponse>);

/** A mock provider. `calls` records every request it received. */
export type MockProvider = AIProvider & { readonly calls: AIRequest[] };

/**
 * A provider with scripted replies per command. A command without a reply throws, which makes an
 * unexpected provider call visible in tests.
 *
 * @example
 * ```typescript
 * const provider = createMockProvider({ 'ai.rewriteSelection': { text: 'Shorter text.' } });
 * ```
 */
export function createMockProvider(handlers: Partial<Record<AICommandId, MockReply>>): MockProvider {
  const calls: AIRequest[] = [];
  const provider = (async (request: AIRequest, signal?: AbortSignal) => {
    calls.push(request);
    const handler = handlers[request.command];
    if (handler === undefined) throw new Error(`No mock reply for ${request.command}`);
    return typeof handler === 'function' ? handler(request, signal) : handler;
  }) as MockProvider;
  Object.defineProperty(provider, 'calls', { get: () => calls, enumerable: true });
  return provider;
}
