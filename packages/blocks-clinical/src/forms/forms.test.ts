/**
 * Tests for form controls: formula evaluation, value collection, validation,
 * node view write-back, read-only and editable state, and round-trips.
 */

import { describe, expect, it } from 'vitest';
import type { Block } from '@amusendame/beakblock-core';
import { formsExtension } from './extension';
import { collectFormValues, validateForm } from './validation';
import { evaluateFormula, FormulaError, formulaReferences, FORMULA_MAX_DEPTH, FORMULA_MAX_LENGTH } from './formula';
import { block, createEditor, findBlock, flush } from '../testHelpers';

const codes = (issues: Array<{ code: string }>) => issues.map((issue) => issue.code);

describe('formula evaluator', () => {
  it('evaluates arithmetic with precedence, parentheses and unary signs', () => {
    expect(evaluateFormula('2 + 3 * 4', {})).toBe(14);
    expect(evaluateFormula('(2 + 3) * 4', {})).toBe(20);
    expect(evaluateFormula('-x + 1', { x: 3 })).toBe(-2);
    expect(evaluateFormula('10 / 4', {})).toBe(2.5);
    expect(evaluateFormula('.5 * 2', {})).toBe(1);
    expect(evaluateFormula('dose * 2', { dose: '4' })).toBe(8);
  });

  it('lists the field references of an expression', () => {
    expect(formulaReferences('a * b + a / (c - 1)')).toEqual(['a', 'b', 'c']);
  });

  it.each([
    ['alert(1)', /Function calls are not allowed/],
    ['constructor.constructor("x")', /Unexpected character "\."/],
    ['process.exit()', /Unexpected character "\."/],
    ['x; y', /Unexpected character ";"/],
    ['x = 1', /Unexpected character "="/],
    ['"a"', /Unexpected character """/],
    ['[0]', /Unexpected character "\["/],
    ['`x`', /Unexpected character/],
    ['', /empty/],
    ['1 +', /Unexpected end/],
    ['(1 + 2', /Missing closing parenthesis/],
    ['1 2', /Unexpected token/],
    ['1e5', /Unexpected token/],
  ])('rejects %s', (source, message) => {
    expect(() => evaluateFormula(source, { x: 1 })).toThrow(FormulaError);
    expect(() => evaluateFormula(source, { x: 1 })).toThrow(message);
  });

  it('does not resolve prototype properties as fields', () => {
    expect(() => evaluateFormula('toString', {})).toThrow(/Unknown field "toString"/);
    expect(() => evaluateFormula('__proto__', {})).toThrow(/Unknown field "__proto__"/);
  });

  it('rejects non-numeric references, division by zero and oversized input', () => {
    expect(() => evaluateFormula('a', { a: 'abc' })).toThrow(/no numeric value/);
    expect(() => evaluateFormula('a', { a: null })).toThrow(/no numeric value/);
    expect(() => evaluateFormula('1 / (x - x)', { x: 2 })).toThrow(/Division by zero/);
    expect(() => evaluateFormula('1+'.repeat(FORMULA_MAX_LENGTH), {})).toThrow(/longer than/);
    expect(() => evaluateFormula(`${'('.repeat(FORMULA_MAX_DEPTH + 1)}1${')'.repeat(FORMULA_MAX_DEPTH + 1)}`, {})).toThrow(
      /nested too deeply/
    );
  });
});

describe('collectFormValues', () => {
  it('collects values by name and evaluates calculated fields', () => {
    const blocks: Block[] = [
      block('formNumber', { name: 'dose', value: 4 }),
      block('formCalculated', { name: 'double', expression: 'dose * 2' }),
      block('formCalculated', { name: 'quad', expression: 'double * 2' }),
      block('formText', { name: 'note', value: '' }),
    ];
    expect(collectFormValues(blocks)).toEqual({ dose: 4, double: 8, quad: 16, note: '' });
  });

  it('collects named repeatable rows into arrays of row objects', () => {
    const row = (lot: string, qty: number) =>
      block('formRepeatableRow', { name: 'lots' }, {
        children: [block('formText', { name: 'lot', value: lot }), block('formNumber', { name: 'qty', value: qty })],
      });
    expect(collectFormValues([row('L1', 2), row('L2', 3)])).toEqual({
      lots: [
        { lot: 'L1', qty: 2 },
        { lot: 'L2', qty: 3 },
      ],
    });
  });

  it('gives null for a calculation that cannot be evaluated', () => {
    expect(collectFormValues([block('formNumber', { name: 'a', value: null }), block('formCalculated', { name: 'b', expression: 'a + 1' })])).toEqual({
      a: null,
      b: null,
    });
  });
});

describe('validateForm', () => {
  it('reports required, numeric range, unit, date range and option rules', () => {
    const issues = validateForm([
      block('formText', { name: 'title', label: 'Title', required: true, value: null }),
      block('formNumber', { name: 'conc', label: 'Conc', min: 0, max: 10, value: 12, unit: 'ppm', allowedUnits: ['mg/mL'] }),
      block('formDate', { name: 'expiry', label: 'Expiry', min: '2026-01-01', max: '2027-12-31', value: '2025-06-01' }),
      block('formDropdown', { name: 'method', label: 'Method', options: ['A', 'B'], value: 'C' }),
    ]);
    expect(codes(issues)).toEqual(['required-missing', 'out-of-range', 'unit-not-allowed', 'date-out-of-range', 'invalid-option']);
  });

  it('accepts a valid form and reports ticked-required checkboxes', () => {
    expect(
      validateForm([
        block('formNumber', { name: 'conc', label: 'Conc', min: 0, max: 10, value: 5, unit: 'mg/mL', allowedUnits: ['mg/mL'] }),
        block('formDate', { name: 'd', label: 'Date', value: '2026-03-01' }),
        block('formRadio', { name: 'r', label: 'R', options: ['yes', 'no'], value: 'no' }),
      ])
    ).toEqual([]);
    expect(codes(validateForm([block('formCheckbox', { name: 'ack', label: 'Ack', required: true, value: false })]))).toEqual([
      'required-missing',
    ]);
  });

  it('flags malformed dates and non-numeric numbers', () => {
    expect(codes(validateForm([block('formDate', { name: 'd', label: 'D', value: '31/12/2026' })]))).toEqual(['invalid-date']);
    expect(codes(validateForm([block('formNumber', { name: 'n', label: 'N', value: 'abc' })]))).toEqual(['not-a-number']);
  });

  it('rejects malicious and unknown-reference formulas', () => {
    expect(codes(validateForm([block('formCalculated', { name: 'c', label: 'C', expression: 'alert(1)' })]))).toEqual(['invalid-formula']);
    expect(codes(validateForm([block('formCalculated', { name: 'c', label: 'C', expression: 'missing * 2' })]))).toEqual([
      'unknown-reference',
    ]);
  });

  it('warns on an empty validated section', () => {
    const issues = validateForm([block('validatedFormSection', { title: 'Empty' }, { children: [] })]);
    expect(codes(issues)).toEqual(['empty-section']);
    expect(issues[0]!.path).toBe('0');
  });
});

describe('form controls in the editor', () => {
  it('writes number input values back into the document and recalculates', async () => {
    const editor = createEditor([formsExtension()], [
      block('formNumber', { name: 'dose', label: 'Dose', value: null, min: 0 }),
      block('formCalculated', { name: 'double', label: 'Double', expression: 'dose * 2' }),
    ]);
    await flush();
    const input = editor.pm.dom.querySelector<HTMLInputElement>('input[type="number"]')!;
    input.value = '5';
    input.dispatchEvent(new Event('input'));
    await flush();
    const doc = editor.getDocument();
    expect(findBlock(doc, 'formNumber')?.props.value).toBe(5);
    expect(findBlock(doc, 'formCalculated')?.props.value).toBe(10);
    expect(editor.pm.dom.querySelector('.beakblock-form-calculated-value')?.textContent).toBe('10');
  });

  it('writes text, dropdown, checkbox and radio values', async () => {
    const editor = createEditor([formsExtension()], [
      block('formText', { name: 'title', label: 'Title', value: '' }),
      block('formDropdown', { name: 'unit', label: 'Unit', options: ['mg', 'g'], value: null }),
      block('formCheckbox', { name: 'ack', label: 'Ack', value: false }),
      block('formRadio', { name: 'pick', label: 'Pick', options: ['yes', 'no'], value: null }),
    ]);
    await flush();
    const text = editor.pm.dom.querySelector<HTMLInputElement>('input[type="text"]')!;
    text.value = 'SOP title';
    text.dispatchEvent(new Event('input'));

    const select = editor.pm.dom.querySelector<HTMLSelectElement>('select')!;
    select.value = 'g';
    select.dispatchEvent(new Event('change'));

    const checkbox = editor.pm.dom.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    const radio = editor.pm.dom.querySelector<HTMLInputElement>('input[type="radio"][value="no"]')!;
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
    await flush();

    const doc = editor.getDocument();
    expect(findBlock(doc, 'formText')?.props.value).toBe('SOP title');
    expect(findBlock(doc, 'formDropdown')?.props.value).toBe('g');
    expect(findBlock(doc, 'formCheckbox')?.props.value).toBe(true);
    expect(findBlock(doc, 'formRadio')?.props.value).toBe('no');
  });

  it('disables read-only fields and ignores writes to them', async () => {
    const editor = createEditor([formsExtension()], [block('formText', { name: 'sop', label: 'SOP', value: 'SOP-001', readOnly: true })]);
    await flush();
    const input = editor.pm.dom.querySelector<HTMLInputElement>('input')!;
    expect(input.disabled).toBe(true);
    input.value = 'changed';
    input.dispatchEvent(new Event('input'));
    expect(findBlock(editor.getDocument(), 'formText')?.props.value).toBe('SOP-001');
  });

  it('disables controls when the editor is not editable and re-enables them after', async () => {
    const editor = createEditor([formsExtension()], [block('formText', { name: 'title', label: 'Title', value: '' })]);
    await flush();
    const input = editor.pm.dom.querySelector<HTMLInputElement>('input')!;
    expect(input.disabled).toBe(false);

    editor.setEditable(false);
    await flush();
    expect(input.disabled).toBe(true);
    input.value = 'blocked';
    input.dispatchEvent(new Event('input'));
    expect(findBlock(editor.getDocument(), 'formText')?.props.value).toBe('');

    editor.setEditable(true);
    await flush();
    expect(input.disabled).toBe(false);
  });

  it('keeps every field type and container through the document API', async () => {
    const editor = createEditor([formsExtension()]);
    const seed = editor.getDocument()[0]!;
    const fields: Block[] = [
      block('formText', { name: 'title', label: 'Title', required: true, value: 'x', placeholder: 'Enter' }),
      block('formNumber', { name: 'conc', label: 'Conc', min: 0, max: 10, unit: 'mg/mL', allowedUnits: ['mg/mL'], decimals: 2, value: 1.5 }),
      block('formDate', { name: 'date', label: 'Date', min: '2026-01-01', value: '2026-02-01' }),
      block('formDropdown', { name: 'dd', label: 'DD', options: ['a', 'b'], value: 'b' }),
      block('formCheckbox', { name: 'cb', label: 'CB', value: true }),
      block('formRadio', { name: 'rd', label: 'RD', options: ['y', 'n'], value: 'n' }),
      block('formCalculated', { name: 'calc', label: 'Calc', expression: 'conc * 2', decimals: 1 }),
      block('validatedFormSection', { title: 'Section' }, { children: [block('formText', { name: 'inner', label: 'Inner', value: 'i' })] }),
      block('formRepeatableRow', { name: 'lots', label: 'Lots' }, { children: [block('formText', { name: 'lot', label: 'Lot', value: 'L1' })] }),
    ];
    editor.insertBlocks(fields, seed, 'after');
    await flush();
    const doc = editor.getDocument();
    expect(findBlock(doc, 'formText')?.props).toMatchObject({ name: 'title', required: true, value: 'x', placeholder: 'Enter' });
    expect(findBlock(doc, 'formNumber')?.props).toMatchObject({ min: 0, max: 10, unit: 'mg/mL', value: 1.5 });
    expect(findBlock(doc, 'formDropdown')?.props).toMatchObject({ options: ['a', 'b'], value: 'b' });
    expect(findBlock(doc, 'formRadio')?.props).toMatchObject({ options: ['y', 'n'], value: 'n' });
    expect(findBlock(doc, 'formCheckbox')?.props.value).toBe(true);
    expect(findBlock(doc, 'formCalculated')?.props.value).toBe(3);
    expect(findBlock(doc, 'validatedFormSection')?.children?.[0]?.props.name).toBe('inner');
    expect(findBlock(doc, 'formRepeatableRow')?.children?.[0]?.props.name).toBe('lot');
    expect(collectFormValues(doc)).toMatchObject({ title: 'x', conc: 1.5, calc: 3, inner: 'i', lots: [{ lot: 'L1' }] });
  });

  it('round-trips nested clinical and form containers through setDocument and getDocument', () => {
    const editor = createEditor([formsExtension()]);
    const input: Block[] = [
      block('validatedFormSection', { title: 'Sec' }, {
        children: [block('formNumber', { name: 'n', label: 'N', value: 2, unit: 'mg/mL', allowedUnits: ['mg/mL'] })],
      }),
      block('formRepeatableRow', { name: 'rows' }, { children: [block('formText', { name: 't', value: 'a' })] }),
    ];
    editor.setDocument(input);
    const doc = editor.getDocument();
    expect(doc[0]!.children?.[0]?.props).toMatchObject({ name: 'n', value: 2 });
    expect(doc[1]!.children?.[0]?.props).toMatchObject({ name: 't', value: 'a' });
    expect(collectFormValues(doc)).toMatchObject({ n: 2, rows: [{ t: 'a' }] });
  });
});
