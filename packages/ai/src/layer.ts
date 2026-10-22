/**
 * The AI command layer. It runs typed commands against an editor and applies every result as a
 * tracked proposal that a human must accept. The flow is:
 *
 * 1. Validate args and resolve the target (section and exact range).
 * 2. Ask the policy engine whether the user may make the would-be operation. Deny without calling
 *    the provider when they may not.
 * 3. Call the provider. Honour cancellation.
 * 4. Validate the reply. Malformed output is an error and the document is left unchanged.
 * 5. Advisory commands return findings and stop here.
 * 6. Proposal commands re-check the target is unchanged, build the tracked change, classify it,
 *    run the policy engine again, and only then dispatch it. Nothing is accepted automatically.
 *
 * @module
 */

import { Fragment, Slice } from 'prosemirror-model';
import type { Transaction } from 'prosemirror-state';
import type { Block } from '@amusendame/beakblock-core';

import type { CommandContext, CommandDefinition } from '@amusendame/beakblock-commands';
import {
  classifyTransaction,
  createPolicyEngine,
  type PolicyContext,
  type PolicyEngine,
  type TypedOperation,
} from '@amusendame/beakblock-permissions';
import { applyTrackedChange, getReviewState, REVIEW_META_INTERNAL } from '@amusendame/beakblock-review';

import { AI_COMMAND_SPECS, blocksToFragmentChecked, type AICommandSpec, type ParsedOutput, type PreparedRun } from './commands';
import { sameTarget, targetOperation, type AITarget } from './targets';
import { validateAgainstLists } from './validation';
import { flattenBlocks, newId, ownText } from './text';
import { wordDiff } from './diff';
import {
  AI_DISCLAIMER,
  AICommandError,
  type AIAuditEntry,
  type AICommandId,
  type AICommandLayer,
  type AICommandLayerOptions,
  type AIFinding,
  type AIRequest,
  type AIResponse,
  type AIResult,
} from './types';

/** Upper bound on findings returned by one advisory run. */
const MAX_ADVISORY_FINDINGS = 300;

/** Thrown when the policy engine refuses an operation. Converted to a `denied` result. */
class PolicyDenial extends Error {}

/** Reason reported when a document plugin refuses a proposal that the policy allowed. */
const REJECTED_MESSAGE = 'The document rules did not accept this change. The rule that refused it is logged to the console.';

function toCommandError(error: unknown): AICommandError {
  if (error instanceof AICommandError) return error;
  return new AICommandError('invalid-target', error instanceof Error ? error.message : String(error));
}

interface Outcome {
  result: AIResult;
  sectionId: string | null;
  userId: string;
}

/**
 * Creates the AI command layer for an editor.
 *
 * @example
 * ```typescript
 * const layer = createAICommandLayer({
 *   provider: createFetchProvider({ url: '/api/ai' }),
 *   editor,
 *   registry,
 *   getPolicyContext: () => currentPolicy,
 *   author: { id: 'u1', name: 'Ada' },
 *   onProposal: (r) => showReviewBanner(r),
 * });
 * const result = await layer.run('ai.rewriteSelection', { instruction: 'Plain English' });
 * ```
 */
export function createAICommandLayer(options: AICommandLayerOptions): AICommandLayer {
  const { provider, editor, registry, getPolicyContext, author, onProposal, onAdvisory, onError, onAudit } = options;
  const engine: PolicyEngine = options.engine ?? createPolicyEngine();
  const lists = options.options ?? {};
  const inFlight = new Set<AbortController>();
  const reviewAuthor = { id: author.id, name: `${author.name} (AI)` };

  function currentContext(): PolicyContext {
    if (getPolicyContext) return getPolicyContext();
    return { userId: author.id, roles: [], sectionGrants: {}, defaultGrants: ['document.editUncontrolled'] };
  }

  function assertAllowed(ops: TypedOperation[], ctx: PolicyContext): void {
    if (ops.length === 0) return;
    const denied = engine.decide(ops, ctx).find((decision) => !decision.allowed);
    if (denied) throw new PolicyDenial(denied.reason ?? `${denied.operation.kind} is not permitted`);
  }

  /** Classifies a transaction and runs the policy engine on it. Throws PolicyDenial. */
  function guardTransaction(tr: Transaction, ctx: PolicyContext): void {
    const ops = classifyTransaction(tr);
    if (ops.length === 0 && tr.docChanged) throw new PolicyDenial('the change could not be classified');
    assertAllowed(ops, ctx);
  }

  /**
   * Dispatches a transaction and reports whether the document changed. A plugin filter can refuse a
   * transaction, and then the state is returned unchanged. Callers must not record a proposal that
   * the document did not take.
   */
  function dispatchApplied(tr: Transaction): boolean {
    const before = editor.pm.state;
    editor.pm.dispatch(tr);
    return editor.pm.state !== before;
  }

  /**
   * Proposes a replacement of `[from, to)` with `text`, word by word. Only the tokens that change are
   * marked deleted and inserted, so a reviewer sees "procedure" replaced by "protocol" and never a
   * fragment of a word. All the changes go in one transaction and share one group.
   */
  function applyTextProposal(target: AITarget, text: string, ctx: PolicyContext): { revisionIds: string[]; groupId: string | null } {
    const { schema, doc } = editor.pm.state;
    const { from, to } = target;
    const oldText = doc.textBetween(from, to, '', '');
    // Offsets in the text map to document positions only when the range holds plain text.
    const plain = oldText.length === to - from;
    const changes = plain ? wordDiff(oldText, text) : [{ start: 0, end: to - from, text }];
    if (changes.length === 0) throw new AICommandError('malformed-output', 'The proposal does not change the text');

    const groupId = newId('grp');
    const records: Array<{ id: string; kind: 'insert' | 'delete'; text: string }> = [];
    let tr = editor.pm.state.tr;
    // Right to left: each change lands before the ones already placed, so earlier offsets stay valid.
    for (const change of [...changes].reverse()) {
      const result = applyTrackedChange(tr, {
        from: from + change.start,
        to: from + change.end,
        insertion: change.text ? new Slice(Fragment.from(schema.text(change.text)), 0, 0) : null,
        author: reviewAuthor,
        aiGenerated: true,
        groupId,
      });
      if (result.failed) throw new AICommandError('invalid-target', 'The proposal does not fit at this position');
      tr = result.tr;
      for (const id of result.deletionIds) records.push({ id, kind: 'delete', text: oldText.slice(change.start, change.end) });
      for (const id of result.insertionIds) records.push({ id, kind: 'insert', text: change.text });
    }
    tr.setMeta(REVIEW_META_INTERNAL, true);
    guardTransaction(tr, ctx);
    if (!dispatchApplied(tr)) throw new PolicyDenial(REJECTED_MESSAGE);

    const store = getReviewState(editor.pm.state)?.store;
    if (store) {
      const at = new Date().toISOString();
      for (const record of records) {
        store.upsert({
          id: record.id,
          kind: record.kind,
          authorId: author.id,
          authorName: reviewAuthor.name,
          at,
          status: 'pending',
          aiGenerated: true,
          sectionId: target.sectionId,
          text: record.text,
          groupId,
          note: AI_DISCLAIMER,
        });
      }
    }
    return { revisionIds: records.map((record) => record.id), groupId };
  }

  function applyBlockProposal(target: AITarget, blocks: Block[], ctx: PolicyContext): { revisionIds: string[]; groupId: null } {
    const fragment = blocksToFragmentChecked(editor, blocks);
    const result = applyTrackedChange(editor.pm.state.tr, {
      from: target.from,
      to: target.to,
      insertion: new Slice(fragment, 0, 0),
      author: reviewAuthor,
      aiGenerated: true,
      groupId: null,
    });
    if (result.failed) throw new AICommandError('invalid-target', 'The proposal does not fit at this position');
    result.tr.setMeta(REVIEW_META_INTERNAL, true);
    guardTransaction(result.tr, ctx);
    if (!dispatchApplied(result.tr)) throw new PolicyDenial(REJECTED_MESSAGE);

    // Block insertions bypass proposeChange, so their records are written here.
    const store = getReviewState(editor.pm.state)?.store;
    if (store) {
      const text = flattenBlocks(blocks).map(ownText).filter(Boolean).join('\n').slice(0, 2000);
      const at = new Date().toISOString();
      for (const id of result.insertionIds) {
        store.upsert({
          id,
          kind: 'insert',
          authorId: author.id,
          authorName: reviewAuthor.name,
          at,
          status: 'pending',
          aiGenerated: true,
          sectionId: target.sectionId,
          text,
          note: AI_DISCLAIMER,
        });
      }
    }
    return { revisionIds: result.insertionIds, groupId: null };
  }

  function validationItems(blocks: readonly Block[]): Array<{ blockId?: string; text: string }> {
    return flattenBlocks(blocks)
      .map((block) => ({ blockId: block.id, text: ownText(block) }))
      .filter((item) => item.text.length > 0);
  }

  async function execute(spec: AICommandSpec, args: unknown): Promise<Outcome> {
    const commandId = spec.id;
    const fail = (error: AICommandError, sectionId: string | null, userId: string): Outcome => {
      onError?.(error, commandId);
      return { result: { status: 'error', commandId, error }, sectionId, userId };
    };
    const denied = (reason: string, sectionId: string | null, userId: string): Outcome => ({
      result: { status: 'denied', commandId, reason },
      sectionId,
      userId,
    });

    const userId = currentContext().userId;
    if (editor.isDestroyed) return fail(new AICommandError('editor-destroyed', 'The editor has been destroyed'), null, userId);

    let prepared: PreparedRun;
    try {
      prepared = spec.prepare(editor, args);
    } catch (error) {
      return fail(toCommandError(error), null, userId);
    }
    const target = prepared.target;

    // Policy before the provider: the would-be operation must be allowed for this user.
    const operation = targetOperation(target);
    if (operation) {
      try {
        assertAllowed([operation], currentContext());
      } catch (error) {
        if (error instanceof PolicyDenial) return denied(error.message, target.sectionId, userId);
        throw error;
      }
    }

    const request: AIRequest = {
      command: commandId,
      instruction: prepared.instruction,
      context: prepared.context,
      responseFormat: spec.responseFormat,
      metadata: { requestId: newId('req'), userId, sectionId: target.sectionId, ...prepared.metadata },
    };
    const controller = new AbortController();
    inFlight.add(controller);
    let response: AIResponse;
    try {
      response = await provider(request, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) return { result: { status: 'cancelled', commandId }, sectionId: target.sectionId, userId };
      return fail(toCommandError(error), target.sectionId, userId);
    } finally {
      inFlight.delete(controller);
    }
    if (controller.signal.aborted) return { result: { status: 'cancelled', commandId }, sectionId: target.sectionId, userId };

    let parsed: ParsedOutput;
    try {
      parsed = prepared.parse(response);
    } catch (error) {
      return fail(toCommandError(error), target.sectionId, userId);
    }

    if (spec.outcome === 'advisory') {
      const modelFindings: AIFinding[] = parsed.kind === 'findings' ? parsed.findings : [];
      const scope = prepared.context.sectionBlocks ?? prepared.context.documentBlocks ?? [];
      const findings = [...modelFindings, ...validateAgainstLists(validationItems(scope), lists)].slice(0, MAX_ADVISORY_FINDINGS);
      const result: AIResult = {
        status: 'advisory',
        commandId,
        kind: 'advisory',
        findings,
        sectionId: target.sectionId,
        model: response.model,
      };
      onAdvisory?.(result as Extract<AIResult, { status: 'advisory' }>);
      return { result, sectionId: target.sectionId, userId };
    }

    if (parsed.kind === 'findings') {
      return fail(new AICommandError('malformed-output', 'A proposal command returned findings'), target.sectionId, userId);
    }

    let applied: { revisionIds: string[]; groupId: string | null };
    try {
      // The target must still be the one the user saw when the request was made.
      const fresh = spec.prepare(editor, args).target;
      if (!sameTarget(fresh, target)) {
        throw new AICommandError('stale-target', 'The document changed while the request was running. Run the command again.');
      }
      const ctx = currentContext();
      applied =
        parsed.kind === 'text'
          ? applyTextProposal(target, parsed.text, ctx)
          : applyBlockProposal(target, parsed.blocks, ctx);
    } catch (error) {
      if (error instanceof PolicyDenial) return denied(error.message, target.sectionId, userId);
      return fail(toCommandError(error), target.sectionId, userId);
    }

    const scopedItems =
      parsed.kind === 'text' ? [{ text: parsed.text }] : validationItems(parsed.blocks);
    const result: AIResult = {
      status: 'proposed',
      commandId,
      kind: 'proposal',
      revisionIds: applied.revisionIds,
      groupId: applied.groupId,
      sectionId: target.sectionId,
      model: response.model,
      validation: validateAgainstLists(scopedItems, lists),
    };
    onProposal?.(result as Extract<AIResult, { status: 'proposed' }>);
    return { result, sectionId: target.sectionId, userId };
  }

  async function run(commandId: AICommandId, args?: unknown): Promise<AIResult> {
    const spec = AI_COMMAND_SPECS.find((candidate) => candidate.id === commandId);
    if (!spec) {
      return { status: 'error', commandId, error: new AICommandError('unknown-command', `Unknown AI command "${String(commandId)}"`) };
    }
    let outcome: Outcome;
    try {
      outcome = await execute(spec, args);
    } catch (error) {
      const err = toCommandError(error);
      onError?.(err, commandId);
      outcome = { result: { status: 'error', commandId, error: err }, sectionId: null, userId: author.id };
    }
    const { result } = outcome;
    const entry: AIAuditEntry = {
      command: commandId,
      userId: outcome.userId,
      sectionId: outcome.sectionId,
      at: new Date().toISOString(),
      status: result.status,
      model: 'model' in result ? result.model : undefined,
      revisionIds: result.status === 'proposed' ? result.revisionIds : [],
    };
    onAudit?.(entry);
    return result;
  }

  if (registry) {
    const definitions: CommandDefinition[] = AI_COMMAND_SPECS.map((spec) => ({
      id: spec.id,
      label: spec.label,
      description: spec.description,
      group: 'AI',
      operation: spec.operation ?? undefined,
      repeatable: false,
      isEnabled: () => !editor.isDestroyed,
      run: (ctx: CommandContext) => {
        // Registry execution is synchronous. The outcome is reported through the callbacks.
        void run(spec.id, ctx.args);
        return true;
      },
    }));
    registry.register(definitions);
  }

  return {
    run,
    cancel() {
      for (const controller of inFlight) controller.abort();
      inFlight.clear();
    },
    dispose() {
      if (!registry) return;
      for (const spec of AI_COMMAND_SPECS) registry.unregister(spec.id);
    },
  };
}
