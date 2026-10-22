/**
 * @amusendame/beakblock-ai
 *
 * Typed, policy-aware AI command layer. Every result is a tracked-change proposal, attributed and
 * marked AI-generated. Nothing is accepted automatically. Advisory commands return findings and
 * never change the document.
 *
 * @example
 * ```typescript
 * import { createAICommandLayer, createFetchProvider } from '@amusendame/beakblock-ai';
 *
 * const layer = createAICommandLayer({
 *   provider: createFetchProvider({ url: '/api/ai' }),
 *   editor,
 *   registry,
 *   author: { id: 'u1', name: 'Ada' },
 * });
 * await layer.run('ai.summarizeSection');
 * ```
 *
 * @module
 */

export { AI_COMMAND_IDS, AI_DISCLAIMER, AICommandError } from './types';
export type {
  AIAuditEntry,
  AIAuthor,
  AICommandErrorCode,
  AICommandId,
  AICommandLayer,
  AICommandLayerOptions,
  AIFinding,
  AIFindingOrigin,
  AIFindingSeverity,
  AIOutcomeKind,
  AIProvider,
  AIRequest,
  AIRequestContext,
  AIRequestMetadata,
  AIResponse,
  AIResponseFormat,
  AIResult,
  AIUsage,
  AIValidationOptions,
} from './types';

export { createAICommandLayer } from './layer';
export { createFetchProvider, createMockProvider, defaultParseResponse } from './providers';
export type { FetchProviderOptions, MockProvider, MockReply } from './providers';

export { AI_COMMAND_SPECS } from './commands';
export type { AICommandSpec } from './commands';

export { AI_SYSTEM_PROMPT, COMMAND_TASKS, buildAIPrompt, buildInstruction } from './prompts';
export { validateAgainstLists } from './validation';
