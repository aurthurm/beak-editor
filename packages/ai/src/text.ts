/**
 * Small helpers shared by the command layer: block traversal, text extraction, ids and
 * validation of untyped JSON.
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';
import { AICommandError } from './types';

let idCounter = 0;

/** Returns a new unique id with the given prefix. */
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Whether a value is a non-null, non-array object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Flattens a block tree depth-first, including children. */
export function flattenBlocks(blocks: readonly Block[]): Block[] {
  const out: Block[] = [];
  const visit = (list: readonly Block[]) => {
    for (const block of list) {
      out.push(block);
      if (block.children?.length) visit(block.children);
    }
  };
  visit(blocks);
  return out;
}

/** The ids of every block in a tree. */
export function blockIdSet(blocks: readonly Block[]): Set<string> {
  return new Set(flattenBlocks(blocks).map((block) => block.id));
}

/** Text held directly by a block (its inline content, not its children). */
export function ownText(block: Block): string {
  const parts: string[] = [];
  for (const item of block.content ?? []) {
    const text = (item as { text?: unknown }).text;
    if (typeof text === 'string') parts.push(text);
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}

/** Removes an outer markdown code fence, if the whole reply is wrapped in one. */
export function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  const firstBreak = trimmed.indexOf('\n');
  const tail = trimmed.lastIndexOf('```');
  if (firstBreak < 0 || tail <= firstBreak) return trimmed;
  return trimmed.slice(firstBreak + 1, tail).trim();
}

/** A paragraph block with plain text. */
export function paragraphBlock(text: string): Block {
  const trimmed = text.trim();
  return {
    id: newId('p'),
    type: 'paragraph',
    props: {},
    content: trimmed ? [{ type: 'text', text: trimmed, styles: {} }] : [],
  };
}

/** Throws a malformed-output error. */
export function malformed(message: string): never {
  throw new AICommandError('malformed-output', message);
}

/** Throws an invalid-args error. */
export function invalidArgs(message: string): never {
  throw new AICommandError('invalid-args', message);
}

/** Reads an optional string argument, with a length limit. */
export function optionalString(raw: Record<string, unknown>, key: string, max = 500): string | undefined {
  const value = raw[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') invalidArgs(`"${key}" must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > max) invalidArgs(`"${key}" must be at most ${max} characters`);
  return trimmed || undefined;
}

/** Reads a required string argument, with a length limit. */
export function requiredString(raw: Record<string, unknown>, key: string, max = 500): string {
  const value = optionalString(raw, key, max);
  if (!value) invalidArgs(`"${key}" is required`);
  return value;
}

/** Reads an optional integer argument within a range. */
export function optionalInt(raw: Record<string, unknown>, key: string, fallback: number, min: number, max: number): number {
  const value = raw[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    invalidArgs(`"${key}" must be an integer between ${min} and ${max}`);
  }
  return value;
}
