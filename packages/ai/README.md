# @amusendame/beakblock-ai

A typed, policy-aware AI command layer for BeakBlock. Every AI result is a **tracked-change proposal**, attributed to the user and marked as AI-generated. Nothing is accepted automatically. Advisory commands return findings and never change the document.

## Install and wire up

```typescript
import { BeakBlockEditor } from '@amusendame/beakblock-core';
import { CommandRegistry, createBuiltInCommands } from '@amusendame/beakblock-commands';
import { createRevisionTrackingPlugin, InMemoryRevisionStore } from '@amusendame/beakblock-review';
import { createAICommandLayer, createFetchProvider } from '@amusendame/beakblock-ai';

const editor = new BeakBlockEditor({ element });
const store = new InMemoryRevisionStore();
editor.pm.addPlugin(createRevisionTrackingPlugin({ author: { id: 'u1', name: 'Ada' }, store }));

const registry = new CommandRegistry();
registry.register(createBuiltInCommands());
registry.bind(editor);

const ai = createAICommandLayer({
  provider: createFetchProvider({ url: '/api/ai' }),
  editor,
  registry,                                   // registers the nine ai.* commands
  author: { id: 'u1', name: 'Ada' },
  getPolicyContext: () => currentPolicy(),    // principal and section grants
  options: { terminology: ['Calibration'], approvedReferences: ['SOP-004'] },
  onProposal: (result) => showReviewBanner(result),
  onAdvisory: (result) => showFindings(result.findings),
  onError: (error, commandId) => console.warn(commandId, error.code, error.message),
  onAudit: (entry) => auditLog.write(entry),
});

const result = await ai.run('ai.rewriteSelection', { instruction: 'Plain English' });
ai.cancel(); // aborts every in-flight provider call
```

## Commands

| Command | Outcome | Target | Args |
|---|---|---|---|
| `ai.rewriteSelection` | proposal (text) | selected text | `instruction?` |
| `ai.summarizeSection` | proposal (paragraphs) | end of section or document | `sectionId?`, `maxWords?` |
| `ai.proposeProcedureSteps` | proposal (numbered list) | after cursor or in section | `goal`, `sectionId?`, `maxSteps?` |
| `ai.generateTable` | proposal (table) | after cursor or in section | `description`, `sectionId?`, `maxRows?` |
| `ai.compareRevisions` | advisory | section or document | `baseline: Block[]`, `sectionId?` |
| `ai.detectMissingReferences` | advisory | section or document | `sectionId?`, `expectedReferences?` |
| `ai.reviewDocumentConsistency` | advisory | whole document | none |
| `ai.explainTechnicalTerm` | advisory | section at cursor | `term`, `sectionId?` |
| `ai.suggestControlledTemplate` | advisory | section or document | `purpose?`, `sectionId?` |

`layer.run(commandId, args)` resolves with an `AIResult`:

- `proposed`: `revisionIds`, `groupId`, `validation` findings for the proposed text
- `advisory`: `findings: { severity, message, blockId?, suggestion?, origin? }[]`
- `denied`: `reason`
- `error`: `error.code` is one of `unknown-command`, `invalid-args`, `invalid-target`, `stale-target`, `provider-error`, `malformed-output`, `empty-output`, `editor-destroyed`
- `cancelled`

Registry execution (`registry.execute('ai.…', args)`) returns `true` once the run has started. The outcome arrives through the callbacks, because the registry API is synchronous.

## Provider protocol

```typescript
type AIProvider = (request: AIRequest, signal?: AbortSignal) => Promise<AIResponse>;

interface AIRequest {
  command: AICommandId;
  instruction?: string;                     // task, output contract, user instruction
  context: { selectionText?, sectionId?, sectionBlocks?, documentBlocks?, documentProperties? };
  responseFormat: 'text' | 'blocks' | 'json';
  metadata: { requestId, userId, sectionId, ...analysis };
}

interface AIResponse { text?; blocks?; json?; model?; usage? }
```

- Supply the field that matches `responseFormat`. A `text` reply to a `json` request is parsed as JSON.
- The provider sees document data as content to analyse, not as instructions. The shared system prompt is exported as `AI_SYSTEM_PROMPT`, and `buildAIPrompt(request)` renders a system and user message pair for chat models.
- `createFetchProvider({ url, headers?, toBody?, parseResponse?, fetch? })` POSTs the request as JSON. The default reply reader accepts an `AIResponse`, or `{ output }` as the `examples/` routes return. The `examples/` routes expect the core `AIRequest` shape, so adapt them with `toBody` and `parseResponse`.
- `createMockProvider({ 'ai.rewriteSelection': { text: '…' } })` returns scripted replies and records `calls`. A reply can also be a function.

## Policy flow

```
run(command, args)
  │
  ├─ 1. parse args ──────────────── invalid ──▶ error: invalid-args
  ├─ 2. resolve target ──────────── none ─────▶ error: invalid-target
  │      (section, exact range or insertion point, expected text)
  │
  ├─ 3. policy engine on the would-be operation
  │      replaceText / insertBlock in the target section
  │      not allowed ─────────────────────────▶ denied   (provider NOT called)
  │      (advisory commands have no operation and skip this step)
  │
  ├─ 4. provider(request, signal) ── abort ───▶ cancelled (nothing applied)
  │                               └─ throws ──▶ error: provider-error
  │
  ├─ 5. parse and validate reply ── bad ──────▶ error: malformed-output | empty-output
  │      (document untouched)
  │
  ├─ advisory? ── findings + terminology/reference checks ──▶ advisory (no doc change)
  │
  └─ proposal:
       a. target unchanged since step 2? ── no ─▶ error: stale-target
       b. build tracked change (insertion + deletion marks, aiGenerated, author "Name (AI)")
       c. classifyTransaction(tr) + policy engine again
          denied ───────────────────────────▶ denied (no revision recorded, no dispatch)
       d. dispatch; revision note = "AI-generated — not verified clinical guidance"
       ▶ proposed (pending; a human accepts or rejects)

every run that reaches a known command ──▶ onAudit({ command, userId, sectionId, at, status, model, revisionIds })
```

Policy context: `getPolicyContext()` is read at steps 3 and 4c. When it is not supplied, the layer allows uncontrolled content only (`defaultGrants: ['document.editUncontrolled']`).

## Safety stance

- **Proposals only.** Every text or block output enters the document as pending `insertion` and `deletion` marks. The layer never accepts a revision.
- **Attributed and flagged.** Proposals carry `authorId` of the requesting user, `authorName` `"<name> (AI)"`, and `aiGenerated: true`. Revision records carry the same flag and the disclaimer note `AI-generated — not verified clinical guidance`.
- **Policy twice.** The engine runs before the provider is called and again on the exact transaction before dispatch. Either denial stops the run atomically.
- **Malformed output never reaches the document.** Replies are validated (structure, schema, row widths, length limits, single-paragraph rewrites). A failed check returns a typed error and leaves the document unchanged.
- **Advisory, not authoritative.** Findings are suggestions for a reviewer. Terminology and approved-reference checks are heuristic warnings. They do not block anything and are not verified clinical guidance.
- **Stale results are refused.** If the target range or section moved while the provider was running, the result is discarded with `stale-target`.
- **Audit everything.** `onAudit` runs once per run, including denials, errors and cancellations.

## Known gaps

- Advisory commands skip the policy check because they have no would-be operation. Any user who can open a document can request advisory output on its content.
- Replacement text from `ai.rewriteSelection` is plain. Inline marks inside the selection are not carried over.
- Block-insertion revision records are written by the layer, because the review package does not export its record sync. Text-replacement records come from `proposeChange`.
- `onAudit` errors propagate out of `run()`.
- The terminology check is edit-distance based and will produce some false positives. Use it as a prompt for review.
