/**
 * Safe formula evaluator for `formCalculated` fields.
 *
 * Supports numbers, field names as identifiers, `+ - * /`, unary `+`/`-` and
 * parentheses. There is no `eval`, no `Function`, no property access and no
 * function calls: anything outside that grammar is rejected with a
 * {@link FormulaError}.
 *
 * @module
 */

/** Raised for any expression that cannot be parsed or evaluated. */
export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaError';
  }
}

/** Maximum accepted expression length. */
export const FORMULA_MAX_LENGTH = 500;
/** Maximum parenthesis nesting depth. */
export const FORMULA_MAX_DEPTH = 32;

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'id'; name: string }
  | { kind: 'op'; op: '+' | '-' | '*' | '/' }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

/** Syntax tree of a parsed expression. */
export type FormulaNode =
  | { t: 'num'; value: number }
  | { t: 'ref'; name: string }
  | { t: 'neg'; operand: FormulaNode }
  | { t: 'bin'; op: '+' | '-' | '*' | '/'; left: FormulaNode; right: FormulaNode };

function tokenize(source: string): Token[] {
  if (source.length > FORMULA_MAX_LENGTH) {
    throw new FormulaError(`Expression is longer than ${FORMULA_MAX_LENGTH} characters`);
  }
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source.charAt(i);
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    const rest = source.slice(i);
    const number = /^(?:\d+(?:\.\d+)?|\.\d+)/.exec(rest);
    if (number) {
      tokens.push({ kind: 'num', value: Number(number[0]) });
      i += number[0].length;
      continue;
    }
    const identifier = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (identifier) {
      tokens.push({ kind: 'id', name: identifier[0] });
      i += identifier[0].length;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ kind: 'op', op: ch });
    } else if (ch === '(') {
      tokens.push({ kind: 'lparen' });
    } else if (ch === ')') {
      tokens.push({ kind: 'rparen' });
    } else {
      throw new FormulaError(`Unexpected character "${ch}" at position ${i}`);
    }
    i += 1;
  }
  return tokens;
}

class Parser {
  private pos = 0;
  private depth = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): FormulaNode {
    if (this.tokens.length === 0) throw new FormulaError('Expression is empty');
    const expression = this.expression();
    if (this.pos < this.tokens.length) throw new FormulaError('Unexpected token after expression');
    return expression;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private expression(): FormulaNode {
    let left = this.term();
    for (let token = this.peek(); token?.kind === 'op' && (token.op === '+' || token.op === '-'); token = this.peek()) {
      this.pos += 1;
      left = { t: 'bin', op: token.op, left, right: this.term() };
    }
    return left;
  }

  private term(): FormulaNode {
    let left = this.unary();
    for (let token = this.peek(); token?.kind === 'op' && (token.op === '*' || token.op === '/'); token = this.peek()) {
      this.pos += 1;
      left = { t: 'bin', op: token.op, left, right: this.unary() };
    }
    return left;
  }

  private unary(): FormulaNode {
    const token = this.peek();
    if (token?.kind === 'op' && (token.op === '+' || token.op === '-')) {
      this.pos += 1;
      const operand = this.unary();
      return token.op === '-' ? { t: 'neg', operand } : operand;
    }
    return this.primary();
  }

  private primary(): FormulaNode {
    const token = this.peek();
    if (!token) throw new FormulaError('Unexpected end of expression');
    this.pos += 1;
    if (token.kind === 'num') return { t: 'num', value: token.value };
    if (token.kind === 'id') {
      if (this.peek()?.kind === 'lparen') {
        throw new FormulaError(`Function calls are not allowed ("${token.name}(")`);
      }
      return { t: 'ref', name: token.name };
    }
    if (token.kind === 'lparen') {
      this.depth += 1;
      if (this.depth > FORMULA_MAX_DEPTH) throw new FormulaError('Expression is nested too deeply');
      const inner = this.expression();
      if (this.peek()?.kind !== 'rparen') throw new FormulaError('Missing closing parenthesis');
      this.pos += 1;
      this.depth -= 1;
      return inner;
    }
    throw new FormulaError('Unexpected token in expression');
  }
}

/**
 * Parses an expression into a syntax tree without evaluating it.
 *
 * @throws {@link FormulaError} when the expression is outside the allowed grammar
 */
export function parseFormula(source: string): FormulaNode {
  return new Parser(tokenize(source)).parse();
}

/** Field names referenced by an expression, in first-use order. */
export function formulaReferences(source: string): string[] {
  const names: string[] = [];
  const visit = (node: FormulaNode): void => {
    if (node.t === 'ref') {
      if (!names.includes(node.name)) names.push(node.name);
    } else if (node.t === 'neg') {
      visit(node.operand);
    } else if (node.t === 'bin') {
      visit(node.left);
      visit(node.right);
    }
  };
  visit(parseFormula(source));
  return names;
}

/**
 * Evaluates an expression against field values.
 *
 * Identifiers resolve only to own properties of `values` whose value is a finite
 * number or numeric string. Missing or non-numeric references are errors.
 *
 * @param source - Expression, e.g. `(dose * 2) / volume`
 * @param values - Field name to value
 * @throws {@link FormulaError} on bad syntax, unknown references or division by zero
 */
export function evaluateFormula(source: string, values: Record<string, unknown>): number {
  const tree = parseFormula(source);
  const evaluate = (node: FormulaNode): number => {
    switch (node.t) {
      case 'num':
        return node.value;
      case 'ref': {
        if (!Object.prototype.hasOwnProperty.call(values, node.name)) {
          throw new FormulaError(`Unknown field "${node.name}"`);
        }
        const value = toNumeric(values[node.name]);
        if (value === null) throw new FormulaError(`Field "${node.name}" has no numeric value`);
        return value;
      }
      case 'neg':
        return -evaluate(node.operand);
      case 'bin': {
        const left = evaluate(node.left);
        const right = evaluate(node.right);
        switch (node.op) {
          case '+':
            return left + right;
          case '-':
            return left - right;
          case '*':
            return left * right;
          case '/':
            if (right === 0) throw new FormulaError('Division by zero');
            return left / right;
        }
      }
    }
  };
  const result = evaluate(tree);
  if (!Number.isFinite(result)) throw new FormulaError('Result is not a finite number');
  return result;
}

function toNumeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
