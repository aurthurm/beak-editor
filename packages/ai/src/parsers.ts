/**
 * Output readers and validators. Every reader either returns a typed value or throws a typed
 * {@link AICommandError}. A malformed reply never reaches the document.
 *
 * @module
 */

import type { AIFinding, AIFindingSeverity, AIResponse } from './types';
import { AICommandError } from './types';
import { isRecord, malformed, stripCodeFence } from './text';

/** Limits applied to model output. */
export const LIMITS = {
  maxFindings: 100,
  maxMessageChars: 2000,
  maxCellChars: 300,
  maxSteps: 50,
  maxStepChars: 500,
  maxTableColumns: 12,
  maxTableRows: 100,
  maxSummaryParagraphs: 20,
} as const;

const SEVERITIES: readonly AIFindingSeverity[] = ['info', 'warning', 'error'];

function isSeverity(value: unknown): value is AIFindingSeverity {
  return typeof value === 'string' && (SEVERITIES as readonly string[]).includes(value);
}

/** Reads the reply as text. Throws when it is empty. */
export function readText(response: AIResponse): string {
  const text = typeof response.text === 'string' ? stripCodeFence(response.text) : '';
  if (!text) throw new AICommandError('empty-output', 'The provider returned no text');
  return text;
}

/** Reads the reply as JSON, from `json` or by parsing `text`. */
export function readJson(response: AIResponse): unknown {
  if (response.json !== undefined && response.json !== null) return response.json;
  if (typeof response.text !== 'string' || !response.text.trim()) {
    throw new AICommandError('empty-output', 'The provider returned no output');
  }
  try {
    return JSON.parse(stripCodeFence(response.text)) as unknown;
  } catch {
    return malformed('The output is not valid JSON');
  }
}

/** Validates `{ findings: [...] }`. Unknown block ids are dropped rather than rejected. */
export function parseFindings(value: unknown, knownBlockIds: ReadonlySet<string>): AIFinding[] {
  if (!isRecord(value) || !Array.isArray(value.findings)) {
    return malformed('Expected an object with a "findings" array');
  }
  if (value.findings.length > LIMITS.maxFindings) {
    return malformed(`Too many findings (limit ${LIMITS.maxFindings})`);
  }
  return value.findings.map((item, index) => {
    if (!isRecord(item)) return malformed(`Finding ${index} is not an object`);
    if (!isSeverity(item.severity)) return malformed(`Finding ${index} has an unknown severity`);
    const message = typeof item.message === 'string' ? item.message.trim() : '';
    if (!message) return malformed(`Finding ${index} has no message`);
    if (message.length > LIMITS.maxMessageChars) return malformed(`Finding ${index} message is too long`);
    const finding: AIFinding = { severity: item.severity, message, origin: 'model' };
    if (typeof item.blockId === 'string' && knownBlockIds.has(item.blockId)) finding.blockId = item.blockId;
    if (typeof item.suggestion === 'string' && item.suggestion.trim()) {
      finding.suggestion = item.suggestion.trim().slice(0, LIMITS.maxMessageChars);
    }
    return finding;
  });
}

/** Validates `{ steps: string[] }`. */
export function parseSteps(value: unknown, maxSteps: number): string[] {
  if (!isRecord(value) || !Array.isArray(value.steps)) return malformed('Expected an object with a "steps" array');
  if (value.steps.length === 0) return malformed('No steps were proposed');
  if (value.steps.length > maxSteps) return malformed(`More than ${maxSteps} steps were proposed`);
  return value.steps.map((step, index) => {
    if (typeof step !== 'string' || !step.trim()) return malformed(`Step ${index + 1} is empty`);
    if (step.length > LIMITS.maxStepChars) return malformed(`Step ${index + 1} is too long`);
    return step.trim();
  });
}

/** Validates `{ headers: string[], rows: string[][] }`. Rows must match the header count. */
export function parseTable(value: unknown, maxRows: number): { headers: string[]; rows: string[][] } {
  if (!isRecord(value) || !Array.isArray(value.headers) || !Array.isArray(value.rows)) {
    return malformed('Expected an object with "headers" and "rows" arrays');
  }
  const headers = value.headers;
  if (headers.length === 0 || headers.length > LIMITS.maxTableColumns) {
    return malformed(`A table needs 1 to ${LIMITS.maxTableColumns} columns`);
  }
  if (value.rows.length > maxRows) return malformed(`More than ${maxRows} rows were proposed`);
  const cell = (raw: unknown, where: string): string => {
    if (typeof raw !== 'string') return malformed(`${where} is not text`);
    if (raw.length > LIMITS.maxCellChars) return malformed(`${where} is too long`);
    return raw;
  };
  const headerCells = headers.map((h, i) => cell(h, `Header ${i + 1}`));
  const rows = value.rows.map((row, r) => {
    if (!Array.isArray(row) || row.length !== headerCells.length) {
      return malformed(`Row ${r + 1} must have ${headerCells.length} cells`);
    }
    return row.map((c, i) => cell(c, `Row ${r + 1} cell ${i + 1}`));
  });
  return { headers: headerCells, rows };
}
