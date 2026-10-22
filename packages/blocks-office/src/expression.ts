/**
 * Safe expression evaluator for office smart content.
 *
 * Used by conditional blocks, computed values and repeating sections. The
 * grammar is intentionally small:
 *
 * - literals: numbers, `'single'` or `"double"` strings, `true`, `false`, `null`
 * - identifiers and dotted paths (`patient.age`), resolved against a scope object
 * - `== != < <= > >=`, `&& || !`, `+ - * / %`, unary `-`, parentheses
 *
 * Function calls, indexing, assignment and inherited properties (for example
 * `constructor`, `__proto__`) are rejected. Nothing is passed to `eval` or
 * `new Function`.
 *
 * @example
 * ```typescript
 * evaluateExpression("procedureType == 'micro' && count > 2", { procedureType: 'micro', count: 3 });
 * // true
 * tryEvaluateExpression("constructor.constructor('x')()", {});
 * // { ok: false, error: '...' }
 * ```
 *
 * @module
 */

/** Maximum accepted source length in characters. */
export const MAX_EXPRESSION_LENGTH = 500;

/** Maximum nesting depth of unary operators and parentheses. */
const MAX_DEPTH = 32;

/** Property names that are never readable from an expression. */
const BLOCKED_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/** Binary operators grouped by precedence, lowest first. */
type BinaryOperator = '||' | '&&' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '+' | '-' | '*' | '/' | '%';
const PRECEDENCE: BinaryOperator[][] = [
  ['||'],
  ['&&'],
  ['==', '!='],
  ['<', '<=', '>', '>='],
  ['+', '-'],
  ['*', '/', '%'],
];

/** Error raised for malformed, unsafe or non-evaluable expressions. */
export class ExpressionError extends Error {
  /** Character offset in the source where the problem was detected. */
  readonly position: number;

  constructor(message: string, position = 0) {
    super(message);
    this.name = 'ExpressionError';
    this.position = position;
  }
}

/** Parsed expression tree. */
export type ExpressionNode =
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'path'; segments: string[] }
  | { kind: 'unary'; op: '!' | '-'; arg: ExpressionNode }
  | { kind: 'binary'; op: BinaryOperator; left: ExpressionNode; right: ExpressionNode };

type Token =
  | { type: 'num'; value: number; pos: number }
  | { type: 'str'; value: string; pos: number }
  | { type: 'ident'; value: string; pos: number }
  | { type: 'op'; value: string; pos: number }
  | { type: 'eof'; value: ''; pos: number };

const TWO_CHAR_OPS = ['==', '!=', '<=', '>=', '&&', '||'];
const ONE_CHAR_OPS = ['<', '>', '+', '-', '*', '/', '%', '!', '(', ')', '.'];

function tokenize(source: string): Token[] {
  if (source.length > MAX_EXPRESSION_LENGTH) {
    throw new ExpressionError(`Expression is longer than ${MAX_EXPRESSION_LENGTH} characters`);
  }
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source.charAt(i);
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      const re = /[0-9]+(?:\.[0-9]+)?/y;
      re.lastIndex = i;
      const match = re.exec(source);
      const text = match ? match[0] : ch;
      tokens.push({ type: 'num', value: Number(text), pos: i });
      i += text.length;
      continue;
    }
    if (ch === "'" || ch === '"') {
      let value = '';
      let j = i + 1;
      let closed = false;
      while (j < source.length) {
        const c = source.charAt(j);
        if (c === '\\' && j + 1 < source.length) {
          const next = source.charAt(j + 1);
          value += next === 'n' ? '\n' : next;
          j += 2;
          continue;
        }
        if (c === ch) {
          closed = true;
          break;
        }
        value += c;
        j++;
      }
      if (!closed) throw new ExpressionError('Unterminated string literal', i);
      tokens.push({ type: 'str', value, pos: i });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const re = /[A-Za-z_][A-Za-z0-9_]*/y;
      re.lastIndex = i;
      const match = re.exec(source);
      const text = match ? match[0] : ch;
      tokens.push({ type: 'ident', value: text, pos: i });
      i += text.length;
      continue;
    }
    const two = source.slice(i, i + 2);
    if (TWO_CHAR_OPS.includes(two)) {
      tokens.push({ type: 'op', value: two, pos: i });
      i += 2;
      continue;
    }
    if (ONE_CHAR_OPS.includes(ch)) {
      tokens.push({ type: 'op', value: ch, pos: i });
      i++;
      continue;
    }
    throw new ExpressionError(`Unexpected character "${ch}"`, i);
  }
  tokens.push({ type: 'eof', value: '', pos: source.length });
  return tokens;
}

class Parser {
  private index = 0;
  private depth = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): ExpressionNode {
    const node = this.parseLevel(0);
    const next = this.peek();
    if (next.type !== 'eof') {
      throw new ExpressionError(`Unexpected token "${String(next.value)}"`, next.pos);
    }
    return node;
  }

  private peek(): Token {
    return this.tokens[this.index] as Token;
  }

  private advance(): Token {
    const token = this.peek();
    this.index++;
    return token;
  }

  private isOp(token: Token, values: readonly string[]): boolean {
    return token.type === 'op' && values.includes(token.value);
  }

  private parseLevel(level: number): ExpressionNode {
    if (level >= PRECEDENCE.length) return this.parseUnary();
    const ops = PRECEDENCE[level] as BinaryOperator[];
    let left = this.parseLevel(level + 1);
    while (this.isOp(this.peek(), ops)) {
      const op = this.advance().value as BinaryOperator;
      const right = this.parseLevel(level + 1);
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  private enter(pos: number): void {
    this.depth++;
    if (this.depth > MAX_DEPTH) throw new ExpressionError('Expression is nested too deeply', pos);
  }

  private parseUnary(): ExpressionNode {
    const token = this.peek();
    if (this.isOp(token, ['!', '-'])) {
      this.advance();
      this.enter(token.pos);
      const arg = this.parseUnary();
      this.depth--;
      return { kind: 'unary', op: token.value as '!' | '-', arg };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const token = this.advance();
    switch (token.type) {
      case 'num':
        return { kind: 'literal', value: token.value };
      case 'str':
        return { kind: 'literal', value: token.value };
      case 'ident':
        return this.parsePath(token);
      case 'op':
        if (token.value === '(') {
          this.enter(token.pos);
          const inner = this.parseLevel(0);
          const close = this.advance();
          if (!this.isOp(close, [')'])) {
            throw new ExpressionError('Expected ")"', close.pos);
          }
          this.depth--;
          return inner;
        }
        throw new ExpressionError(`Unexpected token "${token.value}"`, token.pos);
      default:
        throw new ExpressionError('Unexpected end of expression', token.pos);
    }
  }

  private parsePath(first: Token & { type: 'ident' }): ExpressionNode {
    if (first.value === 'true') return { kind: 'literal', value: true };
    if (first.value === 'false') return { kind: 'literal', value: false };
    if (first.value === 'null') return { kind: 'literal', value: null };

    const segments = [first.value];
    while (this.isOp(this.peek(), ['.'])) {
      this.advance();
      const next = this.advance();
      if (next.type !== 'ident') {
        throw new ExpressionError('Expected a property name after "."', next.pos);
      }
      segments.push(next.value);
    }

    const after = this.peek();
    if (this.isOp(after, ['('])) {
      throw new ExpressionError('Function calls are not allowed in expressions', after.pos);
    }
    for (const segment of segments) {
      if (BLOCKED_SEGMENTS.has(segment)) {
        throw new ExpressionError(`Property "${segment}" is not allowed in expressions`, first.pos);
      }
    }
    return { kind: 'path', segments };
  }
}

const parseCache = new Map<string, ExpressionNode>();
const PARSE_CACHE_LIMIT = 256;

/**
 * Parses an expression into a tree.
 *
 * @param source - Expression text
 * @returns The parsed tree
 * @throws {ExpressionError} If the source is malformed or uses disallowed syntax
 */
export function parseExpression(source: string): ExpressionNode {
  const cached = parseCache.get(source);
  if (cached) return cached;
  const node = new Parser(tokenize(source)).parse();
  if (parseCache.size >= PARSE_CACHE_LIMIT) {
    const oldest = parseCache.keys().next().value;
    if (oldest !== undefined) parseCache.delete(oldest);
  }
  parseCache.set(source, node);
  return node;
}

/**
 * JavaScript-style truthiness used by conditions.
 *
 * @param value - Any value
 */
export function isTruthy(value: unknown): boolean {
  return Boolean(value);
}

function resolvePath(segments: string[], scope: Record<string, unknown>): unknown {
  let current: unknown = scope;
  for (const segment of segments) {
    if (BLOCKED_SEGMENTS.has(segment)) {
      throw new ExpressionError(`Property "${segment}" is not allowed in expressions`);
    }
    if (current === null || typeof current !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  throw new ExpressionError('Expected a number');
}

function looseEquals(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === typeof b) return a === b;
  if (typeof a === 'number' || typeof b === 'number') {
    const na = Number(a);
    const nb = Number(b);
    return !Number.isNaN(na) && !Number.isNaN(nb) && na === nb;
  }
  return String(a) === String(b);
}

function compare(op: string, a: unknown, b: unknown): boolean {
  if (typeof a === 'string' && typeof b === 'string') {
    switch (op) {
      case '<': return a < b;
      case '<=': return a <= b;
      case '>': return a > b;
      default: return a >= b;
    }
  }
  const na = toNumber(a);
  const nb = toNumber(b);
  switch (op) {
    case '<': return na < nb;
    case '<=': return na <= nb;
    case '>': return na > nb;
    default: return na >= nb;
  }
}

function checkFinite(value: number): number {
  if (!Number.isFinite(value)) throw new ExpressionError('Result is not a finite number');
  return value;
}

/**
 * Evaluates a parsed expression tree against a scope.
 *
 * @param node - Tree from {@link parseExpression}
 * @param scope - Values for identifiers; only own properties are read
 * @throws {ExpressionError} On type errors, division by zero or blocked access
 */
export function evaluateNode(node: ExpressionNode, scope: Record<string, unknown>): unknown {
  switch (node.kind) {
    case 'literal':
      return node.value;
    case 'path':
      return resolvePath(node.segments, scope);
    case 'unary': {
      const value = evaluateNode(node.arg, scope);
      return node.op === '!' ? !isTruthy(value) : -toNumber(value);
    }
    case 'binary':
      return evaluateBinary(node.op, node.left, node.right, scope);
  }
}

function evaluateBinary(
  op: BinaryOperator,
  leftNode: ExpressionNode,
  rightNode: ExpressionNode,
  scope: Record<string, unknown>
): unknown {
  if (op === '&&') {
    return isTruthy(evaluateNode(leftNode, scope)) && isTruthy(evaluateNode(rightNode, scope));
  }
  if (op === '||') {
    return isTruthy(evaluateNode(leftNode, scope)) || isTruthy(evaluateNode(rightNode, scope));
  }
  const left = evaluateNode(leftNode, scope);
  const right = evaluateNode(rightNode, scope);
  switch (op) {
    case '==':
      return looseEquals(left, right);
    case '!=':
      return !looseEquals(left, right);
    case '<':
    case '<=':
    case '>':
    case '>=':
      return compare(op, left, right);
    case '+':
      if (typeof left === 'string' || typeof right === 'string') return String(left) + String(right);
      return checkFinite(toNumber(left) + toNumber(right));
    case '-':
      return checkFinite(toNumber(left) - toNumber(right));
    case '*':
      return checkFinite(toNumber(left) * toNumber(right));
    case '/': {
      const divisor = toNumber(right);
      if (divisor === 0) throw new ExpressionError('Division by zero');
      return checkFinite(toNumber(left) / divisor);
    }
    case '%': {
      const divisor = toNumber(right);
      if (divisor === 0) throw new ExpressionError('Division by zero');
      return checkFinite(toNumber(left) % divisor);
    }
  }
}

/**
 * Parses and evaluates an expression.
 *
 * @param source - Expression text
 * @param scope - Values for identifiers
 * @returns The computed value
 * @throws {ExpressionError} If the expression is invalid or cannot be evaluated
 *
 * @example
 * ```typescript
 * evaluateExpression('qty * unitPrice', { qty: 3, unitPrice: 2.5 }); // 7.5
 * ```
 */
export function evaluateExpression(source: string, scope: Record<string, unknown> = {}): unknown {
  return evaluateNode(parseExpression(source), scope);
}

/**
 * Evaluates an expression without throwing.
 *
 * @param source - Expression text
 * @param scope - Values for identifiers
 * @returns `{ ok: true, value }` or `{ ok: false, error }`
 */
export function tryEvaluateExpression(
  source: string,
  scope: Record<string, unknown> = {}
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: evaluateExpression(source, scope) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Checks syntax only (identifiers are not resolved).
 *
 * @param source - Expression text
 * @returns An error message, or `null` when the expression parses
 */
export function validateExpression(source: string): string | null {
  if (source.trim() === '') return 'Expression is empty';
  try {
    parseExpression(source);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
