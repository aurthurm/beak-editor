import { describe, it, expect } from 'vitest';

import {
  ExpressionError,
  evaluateExpression,
  tryEvaluateExpression,
  validateExpression,
  MAX_EXPRESSION_LENGTH,
} from './expression';

describe('expression evaluator', () => {
  it('respects arithmetic precedence and parentheses', () => {
    expect(evaluateExpression('2 + 3 * 4')).toBe(14);
    expect(evaluateExpression('(2 + 3) * 4')).toBe(20);
    expect(evaluateExpression('10 % 4')).toBe(2);
    expect(evaluateExpression('-3 + 5')).toBe(2);
    expect(evaluateExpression('2.5 * 4')).toBe(10);
  });

  it('resolves identifiers and dotted paths against the scope', () => {
    const scope = { qty: 3, unitPrice: 2.5, patient: { age: 40, name: 'Ada' } };
    expect(evaluateExpression('qty * unitPrice', scope)).toBe(7.5);
    expect(evaluateExpression('patient.age >= 18', scope)).toBe(true);
    expect(evaluateExpression('patient.name', scope)).toBe('Ada');
  });

  it('evaluates string equality and logic', () => {
    const scope = { procedureType: 'micro', count: 3 };
    expect(evaluateExpression("procedureType == 'micro'", scope)).toBe(true);
    expect(evaluateExpression('procedureType != "chem"', scope)).toBe(true);
    expect(evaluateExpression("procedureType == 'micro' && count > 2", scope)).toBe(true);
    expect(evaluateExpression("procedureType == 'chem' || count < 2", scope)).toBe(false);
    expect(evaluateExpression('!(count < 2)', scope)).toBe(true);
    expect(evaluateExpression('true && false', scope)).toBe(false);
  });

  it('coerces numeric strings for equality and comparison', () => {
    expect(evaluateExpression("'3' == 3")).toBe(true);
    expect(evaluateExpression("'abc' == 3")).toBe(false);
    expect(evaluateExpression('missing == null')).toBe(true);
    expect(evaluateExpression("'b' > 'a'")).toBe(true);
  });

  it('concatenates strings with +', () => {
    expect(evaluateExpression("'a' + 1")).toBe('a1');
  });

  it('treats unknown and inherited names as undefined', () => {
    expect(evaluateExpression('missingVar == null')).toBe(true);
    expect(evaluateExpression('valueOf == null', {})).toBe(true);
    expect(evaluateExpression('toString == null', {})).toBe(true);
  });

  it('rejects malicious input', () => {
    const attacks = [
      "constructor.constructor('x')()",
      "x.constructor.constructor('return process')()",
      '__proto__.polluted',
      'alert(1)',
      'x = 1',
      'a[0]',
      'new Function',
      'items.length.constructor',
      "'unterminated",
      '1 / 0',
    ];
    for (const source of attacks) {
      const result = tryEvaluateExpression(source, { x: {}, items: [] });
      expect(result.ok, source).toBe(false);
    }
  });

  it('throws ExpressionError from evaluateExpression', () => {
    expect(() => evaluateExpression("constructor.constructor('x')()")).toThrow(ExpressionError);
    expect(() => evaluateExpression('1 / 0')).toThrow('Division by zero');
  });

  it('rejects overly long and deeply nested expressions', () => {
    expect(validateExpression('1'.repeat(MAX_EXPRESSION_LENGTH + 1))).toMatch(/longer than/);
    const deep = '('.repeat(40) + '1' + ')'.repeat(40);
    expect(validateExpression(deep)).toMatch(/nested too deeply/);
  });

  it('validates syntax without resolving identifiers', () => {
    expect(validateExpression('a == 1 && b')).toBeNull();
    expect(validateExpression('')).toBe('Expression is empty');
    expect(validateExpression('a ==')).toMatch(/Unexpected end/);
    expect(validateExpression('(a')).toMatch(/Expected "\)"/);
  });
});
