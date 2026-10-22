/**
 * Public protocol types for the BeakBlock AI command layer.
 *
 * The protocol is provider-agnostic: a provider receives a typed {@link AIRequest} and returns an
 * {@link AIResponse}. The command layer owns policy checks, tracked-change proposals and audit.
 *
 * @module
 */

import type { Block, BeakBlockEditor } from '@amusendame/beakblock-core';
import type { CommandRegistry } from '@amusendame/beakblock-commands';
import type { PolicyContext, PolicyEngine } from '@amusendame/beakblock-permissions';

/** Every AI command id. Stable, dotted, and used as the registry id. */
export const AI_COMMAND_IDS = [
  'ai.rewriteSelection',
  'ai.summarizeSection',
  'ai.proposeProcedureSteps',
  'ai.compareRevisions',
  'ai.detectMissingReferences',
  'ai.reviewDocumentConsistency',
  'ai.generateTable',
  'ai.explainTechnicalTerm',
  'ai.suggestControlledTemplate',
] as const;

/** Identifier of an AI command. */
export type AICommandId = (typeof AI_COMMAND_IDS)[number];

/**
 * Note attached to every AI proposal. AI output is never presented as verified clinical guidance.
 */
export const AI_DISCLAIMER = 'AI-generated — not verified clinical guidance';

/** Shape the provider should return. */
export type AIResponseFormat = 'text' | 'blocks' | 'json';

/** Document data the provider may use. It is data to analyse, never instructions. */
export interface AIRequestContext {
  /** Selected text for `ai.rewriteSelection`. */
  selectionText?: string;
  /** Controlled section the request is scoped to, or null for uncontrolled content. */
  sectionId?: string | null;
  /** Blocks of the scoped section. */
  sectionBlocks?: Block[];
  /** Blocks of the whole document. */
  documentBlocks?: Block[];
  /** Document properties (title, docNumber, revision, ...) when known. */
  documentProperties?: Record<string, unknown>;
}

/** Metadata attached to every request. */
export interface AIRequestMetadata {
  requestId: string;
  userId: string;
  sectionId: string | null;
  /** Command-specific analysis data, such as a revision comparison summary. */
  [key: string]: unknown;
}

/** A typed request sent to an {@link AIProvider}. */
export interface AIRequest {
  command: AICommandId;
  /** Task description for the model, including the output contract and any user instruction. */
  instruction?: string;
  context: AIRequestContext;
  responseFormat: AIResponseFormat;
  metadata: AIRequestMetadata;
}

/** Token usage reported by a provider. */
export interface AIUsage {
  inputTokens?: number;
  outputTokens?: number;
}

/** A provider's reply. Supply the field that matches `responseFormat`. */
export interface AIResponse {
  /** Plain text (for `text`), or a JSON or markdown string. */
  text?: string;
  /** Parsed block tree (for `blocks`). */
  blocks?: Block[];
  /** Parsed JSON value (for `json`). */
  json?: unknown;
  model?: string;
  usage?: AIUsage;
}

/** Any function that turns an {@link AIRequest} into an {@link AIResponse}. */
export type AIProvider = (request: AIRequest, signal?: AbortSignal) => Promise<AIResponse>;

/** Severity of an advisory finding. */
export type AIFindingSeverity = 'info' | 'warning' | 'error';

/** Where a finding came from. */
export type AIFindingOrigin = 'model' | 'terminology' | 'reference';

/** An advisory finding. It never changes the document. */
export interface AIFinding {
  severity: AIFindingSeverity;
  message: string;
  blockId?: string;
  suggestion?: string;
  origin?: AIFindingOrigin;
}

/** Outcome kind of a command. */
export type AIOutcomeKind = 'proposal' | 'advisory';

/** Error codes produced by the command layer. */
export type AICommandErrorCode =
  | 'unknown-command'
  | 'invalid-args'
  | 'invalid-target'
  | 'stale-target'
  | 'provider-error'
  | 'malformed-output'
  | 'empty-output'
  | 'editor-destroyed';

/** Typed error for a failed AI command. Thrown internally and reported in {@link AIResult}. */
export class AICommandError extends Error {
  readonly code: AICommandErrorCode;

  constructor(code: AICommandErrorCode, message: string) {
    super(message);
    this.name = 'AICommandError';
    this.code = code;
  }
}

/** Result of a run. */
export type AIResult =
  | {
      status: 'proposed';
      commandId: AICommandId;
      kind: 'proposal';
      /** Ids of the pending insertion and deletion revisions created. */
      revisionIds: string[];
      groupId: string | null;
      sectionId: string | null;
      model?: string;
      /** Advisory validation findings for the proposed text. */
      validation: AIFinding[];
    }
  | {
      status: 'advisory';
      commandId: AICommandId;
      kind: 'advisory';
      findings: AIFinding[];
      sectionId: string | null;
      model?: string;
    }
  | { status: 'denied'; commandId: AICommandId; reason: string }
  | { status: 'error'; commandId: AICommandId; error: AICommandError }
  | { status: 'cancelled'; commandId: AICommandId };

/** Audit record written once per run that reached a known command. */
export interface AIAuditEntry {
  command: AICommandId;
  userId: string;
  sectionId: string | null;
  /** ISO timestamp. */
  at: string;
  status: AIResult['status'];
  model?: string;
  revisionIds: string[];
}

/** Optional reference lists used for advisory validation. */
export interface AIValidationOptions {
  /** Approved terminology. Near-miss spellings in the target text are flagged. */
  terminology?: string[];
  /** Approved references (for example `SOP-004`). Unlisted references in the target text are flagged. */
  approvedReferences?: string[];
}

/** Author that proposals are attributed to. */
export interface AIAuthor {
  id: string;
  name: string;
}

/** Options for {@link createAICommandLayer}. */
export interface AICommandLayerOptions {
  provider: AIProvider;
  /** The editor the commands operate on. */
  editor: BeakBlockEditor;
  /** When given, the ai.* commands are registered here. */
  registry?: CommandRegistry;
  /** Current principal and grants. Defaults to uncontrolled-content editing only. */
  getPolicyContext?: () => PolicyContext;
  /** Policy engine. Defaults to `createPolicyEngine()`. */
  engine?: PolicyEngine;
  /** Author for proposals. Proposals are attributed as `${name} (AI)` and flagged `aiGenerated`. */
  author: AIAuthor;
  /** Advisory validation lists. */
  options?: AIValidationOptions;
  onProposal?: (result: Extract<AIResult, { status: 'proposed' }>) => void;
  onAdvisory?: (result: Extract<AIResult, { status: 'advisory' }>) => void;
  onError?: (error: AICommandError, commandId: AICommandId) => void;
  onAudit?: (entry: AIAuditEntry) => void;
}

/** The command layer returned by {@link createAICommandLayer}. */
export interface AICommandLayer {
  /** Runs a command. Resolves with the outcome. Never throws. */
  run(commandId: AICommandId, args?: unknown): Promise<AIResult>;
  /** Aborts every in-flight provider call. Their runs resolve as `cancelled` and nothing is applied. */
  cancel(): void;
  /** Unregisters the ai.* commands from the registry. */
  dispose(): void;
}
