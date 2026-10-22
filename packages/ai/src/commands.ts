/**
 * The nine typed AI commands. Each command validates its arguments, resolves its target, builds
 * the instruction and context, and parses the reply into a typed output.
 *
 * Proposal commands produce text or blocks that become tracked changes. Advisory commands produce
 * findings and never change the document.
 *
 * @module
 */

import type { Node as PMNode } from 'prosemirror-model';
import type { BeakBlockEditor, Block } from '@amusendame/beakblock-core';
import { blocksToDoc } from '@amusendame/beakblock-core';
import { compareRevisions } from '@amusendame/beakblock-review';

import { buildInstruction } from './prompts';
import {
  LIMITS,
  parseFindings,
  parseSteps,
  parseTable,
  readJson,
  readText,
} from './parsers';
import {
  blockIdSet,

  invalidArgs,
  isRecord,
  malformed,
  newId,
  optionalInt,
  optionalString,
  paragraphBlock,
  requiredString,
} from './text';
import {
  findSectionAt,
  resolveInsertion,
  resolveSection,
  sectionBlocks,
  type AITarget,
  type SectionRef,
} from './targets';
import { AICommandError, type AICommandId, type AIFinding, type AIOutcomeKind, type AIRequestContext, type AIResponse, type AIResponseFormat } from './types';

/** Output of a command, ready for the layer to apply or report. */
export type ParsedOutput =
  | { kind: 'text'; text: string }
  | { kind: 'blocks'; blocks: Block[] }
  | { kind: 'findings'; findings: AIFinding[] };

/** A command prepared against the current editor state, before the provider is called. */
export interface PreparedRun {
  target: AITarget;
  instruction: string;
  context: AIRequestContext;
  metadata: Record<string, unknown>;
  /** Reads and validates the provider reply. Throws AICommandError on malformed output. */
  parse(response: AIResponse): ParsedOutput;
}

/** A command definition. */
export interface AICommandSpec {
  id: AICommandId;
  label: string;
  description: string;
  outcome: AIOutcomeKind;
  responseFormat: AIResponseFormat;
  /** Document operation the command's proposal performs, or null for advisory commands. */
  operation: 'replaceText' | 'insertBlock' | null;
  /** Validates `args`, resolves the target, and returns a prepared run. Throws AICommandError. */
  prepare(editor: BeakBlockEditor, args: unknown): PreparedRun;
}

const MAX_BASELINE_BLOCKS = 5000;

function argsObject(commandId: AICommandId, raw: unknown): Record<string, unknown> {
  if (raw === undefined || raw === null) return {};
  if (!isRecord(raw)) invalidArgs(`${commandId} expects an object of arguments`);
  return raw;
}

function docBlocks(editor: BeakBlockEditor): Block[] {
  return editor.getDocument();
}

/** Context scoped to a section when there is one, otherwise the whole document. */
function scopedContext(editor: BeakBlockEditor, section: SectionRef | null): AIRequestContext {
  if (section) return { sectionId: section.sectionId, sectionBlocks: sectionBlocks(section) };
  return { sectionId: null, documentBlocks: docBlocks(editor) };
}

/** Context blocks used to validate finding block ids. */
function contextBlocks(context: AIRequestContext): Block[] {
  return context.sectionBlocks ?? context.documentBlocks ?? [];
}

function insertionTarget(editor: BeakBlockEditor, sectionId: string | undefined, placement: 'cursor' | 'end') {
  const { pos, section } = resolveInsertion(editor, sectionId, placement);
  const target: AITarget = { sectionId: section?.sectionId ?? null, operation: 'insertBlock', from: pos, to: pos };
  return { target, section };
}

function advisoryParse(context: AIRequestContext): (response: AIResponse) => ParsedOutput {
  const known = blockIdSet(contextBlocks(context));
  return (response) => ({ kind: 'findings', findings: parseFindings(readJson(response), known) });
}

function stepsBlock(steps: string[]): Block {
  return {
    id: newId('ol'),
    type: 'orderedList',
    props: {},
    children: steps.map((step) => ({ id: newId('li'), type: 'listItem', props: {}, children: [paragraphBlock(step)] })),
  };
}

function tableBlock(headers: string[], rows: string[][]): Block {
  const cell = (type: 'tableHeader' | 'tableCell', text: string): Block => ({
    id: newId('tc'),
    type,
    props: {},
    children: [paragraphBlock(text)],
  });
  return {
    id: newId('tbl'),
    type: 'table',
    props: {},
    children: [
      { id: newId('tr'), type: 'tableRow', props: {}, children: headers.map((h) => cell('tableHeader', h)) },
      ...rows.map((row) => ({
        id: newId('tr'),
        type: 'tableRow',
        props: {},
        children: row.map((c) => cell('tableCell', c)),
      })),
    ],
  };
}

function isBlockLike(value: unknown): value is Block {
  return isRecord(value) && typeof value.id === 'string' && typeof value.type === 'string';
}

const rewriteSelection: AICommandSpec = {
  id: 'ai.rewriteSelection',
  label: 'Rewrite selection',
  description: 'Rewrite the selected text as a tracked change for review.',
  outcome: 'proposal',
  responseFormat: 'text',
  operation: 'replaceText',
  prepare(editor, raw) {
    const args = argsObject('ai.rewriteSelection', raw);
    const instruction = optionalString(args, 'instruction', 500);
    const { doc, selection } = editor.pm.state;
    if (selection.empty) throw new AICommandError('invalid-target', 'Select the text to rewrite');
    const { $from, $to, from, to } = selection;
    if (!$from.sameParent($to) || !$from.parent.isTextblock) {
      throw new AICommandError('invalid-target', 'The selection must be within a single paragraph or heading');
    }
    const selectionText = doc.textBetween(from, to);
    if (!selectionText.trim()) throw new AICommandError('invalid-target', 'The selection contains no text');
    const section = findSectionAt($from);
    const target: AITarget = {
      sectionId: section?.sectionId ?? null,
      operation: 'replaceText',
      from,
      to,
      expectedText: selectionText,
    };
    return {
      target,
      instruction: buildInstruction('ai.rewriteSelection', instruction),
      context: { ...scopedContext(editor, section), selectionText },
      metadata: {},
      parse(response) {
        const text = readText(response);
        if (text.includes('\n')) malformed('A rewrite must be a single paragraph');
        if (text === selectionText) malformed('The rewrite returned the original text');
        return { kind: 'text', text };
      },
    };
  },
};

const summarizeSection: AICommandSpec = {
  id: 'ai.summarizeSection',
  label: 'Summarise section',
  description: 'Insert a tracked summary of the section.',
  outcome: 'proposal',
  responseFormat: 'text',
  operation: 'insertBlock',
  prepare(editor, raw) {
    const args = argsObject('ai.summarizeSection', raw);
    const sectionId = optionalString(args, 'sectionId', 200);
    const maxWords = optionalInt(args, 'maxWords', 150, 20, 1000);
    const section = resolveSection(editor, sectionId);
    const { target } = insertionTarget(editor, sectionId, 'end');
    return {
      target,
      instruction: buildInstruction('ai.summarizeSection', `Use at most ${maxWords} words.`),
      context: scopedContext(editor, section),
      metadata: { maxWords },
      parse(response) {
        const paragraphs = readText(response)
          .split(/\n\s*\n/)
          .map((p) => p.replace(/\s+/g, ' ').trim())
          .filter(Boolean);
        if (paragraphs.length === 0) malformed('The summary is empty');
        if (paragraphs.length > LIMITS.maxSummaryParagraphs) malformed('The summary has too many paragraphs');
        const words = paragraphs.join(' ').split(' ').length;
        if (words > maxWords * 1.5) malformed(`The summary has ${words} words; the limit is ${maxWords}`);
        return { kind: 'blocks', blocks: paragraphs.map((p) => paragraphBlock(p)) };
      },
    };
  },
};

const proposeProcedureSteps: AICommandSpec = {
  id: 'ai.proposeProcedureSteps',
  label: 'Propose procedure steps',
  description: 'Insert tracked, numbered procedure steps for a goal.',
  outcome: 'proposal',
  responseFormat: 'json',
  operation: 'insertBlock',
  prepare(editor, raw) {
    const args = argsObject('ai.proposeProcedureSteps', raw);
    const goal = requiredString(args, 'goal', 500);
    const maxSteps = optionalInt(args, 'maxSteps', 12, 1, LIMITS.maxSteps);
    const { target, section } = insertionTarget(editor, optionalString(args, 'sectionId', 200), 'cursor');
    return {
      target,
      instruction: buildInstruction('ai.proposeProcedureSteps', `Goal: ${goal}. Propose at most ${maxSteps} steps.`),
      context: scopedContext(editor, section),
      metadata: { goal, maxSteps },
      parse(response) {
        const steps = parseSteps(readJson(response), maxSteps);
        return { kind: 'blocks', blocks: [stepsBlock(steps)] };
      },
    };
  },
};

const compareRevisionsSpec: AICommandSpec = {
  id: 'ai.compareRevisions',
  label: 'Compare revisions',
  description: 'Compare a baseline with the current content and flag material changes.',
  outcome: 'advisory',
  responseFormat: 'json',
  operation: null,
  prepare(editor, raw) {
    const args = argsObject('ai.compareRevisions', raw);
    const baseline = args.baseline;
    if (!Array.isArray(baseline) || baseline.length > MAX_BASELINE_BLOCKS || !baseline.every(isBlockLike)) {
      invalidArgs('"baseline" must be an array of blocks with id and type');
    }
    const section = resolveSection(editor, optionalString(args, 'sectionId', 200));
    const context = scopedContext(editor, section);
    const current = context.sectionBlocks ?? context.documentBlocks ?? [];
    const comparison = compareRevisions(baseline as Block[], current);
    return {
      target: { sectionId: section?.sectionId ?? null, operation: null, from: 0, to: 0 },
      instruction: buildInstruction('ai.compareRevisions'),
      context,
      metadata: {
        comparison: { summary: comparison.summary, diffs: comparison.diffs.slice(0, 200) },
      },
      parse: advisoryParse(context),
    };
  },
};

const detectMissingReferences: AICommandSpec = {
  id: 'ai.detectMissingReferences',
  label: 'Detect missing references',
  description: 'List claims that need a reference and references that are not defined.',
  outcome: 'advisory',
  responseFormat: 'json',
  operation: null,
  prepare(editor, raw) {
    const args = argsObject('ai.detectMissingReferences', raw);
    const section = resolveSection(editor, optionalString(args, 'sectionId', 200));
    const expected = args.expectedReferences;
    if (expected !== undefined && (!Array.isArray(expected) || expected.length > 200 || !expected.every((e) => typeof e === 'string'))) {
      invalidArgs('"expectedReferences" must be an array of up to 200 strings');
    }
    const extra = Array.isArray(expected) && expected.length > 0 ? `Expected references: ${(expected as string[]).join(', ')}.` : undefined;
    const context = scopedContext(editor, section);
    return {
      target: { sectionId: section?.sectionId ?? null, operation: null, from: 0, to: 0 },
      instruction: buildInstruction('ai.detectMissingReferences', extra),
      context,
      metadata: {},
      parse: advisoryParse(context),
    };
  },
};

const reviewDocumentConsistency: AICommandSpec = {
  id: 'ai.reviewDocumentConsistency',
  label: 'Review consistency',
  description: 'Check the whole document for internal inconsistencies.',
  outcome: 'advisory',
  responseFormat: 'json',
  operation: null,
  prepare(editor, raw) {
    argsObject('ai.reviewDocumentConsistency', raw);
    const context: AIRequestContext = { sectionId: null, documentBlocks: docBlocks(editor) };
    return {
      target: { sectionId: null, operation: null, from: 0, to: 0 },
      instruction: buildInstruction('ai.reviewDocumentConsistency'),
      context,
      metadata: {},
      parse: advisoryParse(context),
    };
  },
};

const generateTable: AICommandSpec = {
  id: 'ai.generateTable',
  label: 'Generate table',
  description: 'Insert a tracked table for a description.',
  outcome: 'proposal',
  responseFormat: 'json',
  operation: 'insertBlock',
  prepare(editor, raw) {
    const args = argsObject('ai.generateTable', raw);
    const description = requiredString(args, 'description', 500);
    const maxRows = optionalInt(args, 'maxRows', 20, 1, LIMITS.maxTableRows);
    const { target, section } = insertionTarget(editor, optionalString(args, 'sectionId', 200), 'cursor');
    return {
      target,
      instruction: buildInstruction('ai.generateTable', `Table: ${description}. At most ${maxRows} data rows.`),
      context: scopedContext(editor, section),
      metadata: { description, maxRows },
      parse(response) {
        const { headers, rows } = parseTable(readJson(response), maxRows);
        return { kind: 'blocks', blocks: [tableBlock(headers, rows)] };
      },
    };
  },
};

const explainTechnicalTerm: AICommandSpec = {
  id: 'ai.explainTechnicalTerm',
  label: 'Explain term',
  description: 'Explain a technical term as an advisory finding.',
  outcome: 'advisory',
  responseFormat: 'json',
  operation: null,
  prepare(editor, raw) {
    const args = argsObject('ai.explainTechnicalTerm', raw);
    const term = requiredString(args, 'term', 120);
    const section = resolveSection(editor, optionalString(args, 'sectionId', 200));
    const context = scopedContext(editor, section);
    return {
      target: { sectionId: section?.sectionId ?? null, operation: null, from: 0, to: 0 },
      instruction: buildInstruction('ai.explainTechnicalTerm', `Term: ${term}`),
      context,
      metadata: { term },
      parse: advisoryParse(context),
    };
  },
};

const suggestControlledTemplate: AICommandSpec = {
  id: 'ai.suggestControlledTemplate',
  label: 'Suggest template',
  description: 'Suggest the sections a controlled document should contain.',
  outcome: 'advisory',
  responseFormat: 'json',
  operation: null,
  prepare(editor, raw) {
    const args = argsObject('ai.suggestControlledTemplate', raw);
    const purpose = optionalString(args, 'purpose', 300);
    const section = resolveSection(editor, optionalString(args, 'sectionId', 200));
    const context = scopedContext(editor, section);
    return {
      target: { sectionId: section?.sectionId ?? null, operation: null, from: 0, to: 0 },
      instruction: buildInstruction('ai.suggestControlledTemplate', purpose ? `Document purpose: ${purpose}` : undefined),
      context,
      metadata: {},
      parse: advisoryParse(context),
    };
  },
};

/** All AI command specs, in registration order. */
export const AI_COMMAND_SPECS: readonly AICommandSpec[] = [
  rewriteSelection,
  summarizeSection,
  proposeProcedureSteps,
  compareRevisionsSpec,
  detectMissingReferences,
  reviewDocumentConsistency,
  generateTable,
  explainTechnicalTerm,
  suggestControlledTemplate,
];

/** Builds the document fragment for block output, checking it against the editor schema. */
export function blocksToFragmentChecked(editor: BeakBlockEditor, blocks: Block[]) {
  let doc: PMNode;
  try {
    doc = blocksToDoc(editor.pm.state.schema, blocks);
    doc.check();
  } catch (error) {
    malformed(`The output does not fit the document schema: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (doc.childCount !== blocks.length) malformed('The output contains block types the document does not support');
  return doc.content;
}

