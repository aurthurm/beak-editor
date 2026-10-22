/**
 * Tests for document-level clinical validation and placeholder rules.
 */

import { describe, expect, it } from 'vitest';
import type { Block } from '@amusendame/beakblock-core';
import { EXAMPLE_PLACEHOLDER_RULES, validateClinicalDocument } from './document';
import { block, paragraph, reagentTable, step, warning } from './testHelpers';

const codes = (issues: Array<{ code: string }>) => issues.map((issue) => issue.code);

const fields = (props: Record<string, unknown>[]): Block[] => props.map((p) => block('formText', p));

describe('validateClinicalDocument: block types it does not own', () => {
  const figure = block('caption', { label: 'Figure' }, { content: [{ type: 'text', text: 'Gram stain', styles: {} }] });
  const branch = block('conditional', { expression: 'biohazard' }, { children: [paragraph('Note')] });
  const formula = block('equation', { latex: 'x^2' });

  it('does not report block types from other extensions', () => {
    const issues = validateClinicalDocument([step('Mix'), figure, branch, formula]);
    expect(codes(issues)).not.toContain('unregistered-block-type');
    expect(issues).toEqual([]);
  });

  it('reports a type outside the clinical and form set only when knownBlockTypes names the document types', () => {
    const doc = [step('Mix'), figure, block('hologram', { depth: 2 })];
    expect(codes(validateClinicalDocument(doc))).not.toContain('unregistered-block-type');
    const issues = validateClinicalDocument(doc, { knownBlockTypes: ['caption'] });
    expect(issues.filter((issue) => issue.code === 'unregistered-block-type').map((issue) => issue.blockId)).toEqual([doc[2]!.id]);
  });
});

describe('validateClinicalDocument', () => {
  it('requires at least one procedure step', () => {
    expect(codes(validateClinicalDocument([paragraph('Intro')]))).toEqual(['no-procedure-steps']);
    expect(validateClinicalDocument([step('Mix')])).toEqual([]);
  });

  it('requires a safety warning for configured procedure types only', () => {
    const doc = [step('Mix')];
    const options = { procedureType: 'hazardous', safetyRequiredFor: ['hazardous'] };
    expect(codes(validateClinicalDocument(doc, options))).toEqual(['safety-warning-required']);
    expect(validateClinicalDocument([...doc, warning('Corrosive', { level: 'danger', hazardCodes: ['H314'] })], options)).toEqual([]);
    expect(validateClinicalDocument(doc, { procedureType: 'routine', safetyRequiredFor: ['hazardous'] })).toEqual([]);
  });

  it('includes block findings from clinical and form validators', () => {
    const issues = validateClinicalDocument([
      step('Mix'),
      reagentTable([
        ['Reagent', 'Concentration', 'Unit', 'Lot', 'Expiry'],
        ['NaCl', '0.9', 'ppm', 'L1', '2027-01-31'],
      ]),
    ]);
    expect(codes(issues)).toEqual(['invalid-unit']);
    expect(issues[0]!.blockId).toBeDefined();
  });

  it('applies placeholder rules to form fields by name', () => {
    const doc = [
      step('Mix'),
      ...fields([
        { name: 'sopNumber', label: 'SOP', value: 'SOP-1', readOnly: false },
        { name: 'title', label: 'Title', value: '' },
        { name: 'effectiveDate', label: 'Effective', value: '2026-01-01', readOnly: false },
      ]),
    ];
    const issues = validateClinicalDocument(doc, { placeholderRules: EXAMPLE_PLACEHOLDER_RULES });
    expect(codes(issues)).toEqual(
      expect.arrayContaining(['placeholder-not-readonly', 'placeholder-required', 'placeholder-not-readonly'])
    );
    expect(issues.filter((issue) => issue.code === 'placeholder-not-readonly')).toHaveLength(2);
  });

  it('checks maximum length, numeric values and allowed units for placeholders', () => {
    const doc = [
      step('Mix'),
      block('formText', { name: 'title', label: 'Title', value: 'x'.repeat(201) }),
      block('formNumber', { name: 'concentration', label: 'Conc', value: 'high', unit: 'ppm' }),
    ];
    expect(codes(validateClinicalDocument(doc, { placeholderRules: EXAMPLE_PLACEHOLDER_RULES }))).toEqual(
      expect.arrayContaining(['placeholder-too-long', 'placeholder-not-numeric', 'placeholder-unit-not-allowed'])
    );
  });

  it('accepts a compliant document with the example rules', () => {
    const doc = [
      step('Mix'),
      ...[
        block('formText', { name: 'sopNumber', label: 'SOP', value: 'SOP-1', readOnly: true }),
        block('formText', { name: 'title', label: 'Title', value: 'Preparation', readOnly: false }),
        block('formText', { name: 'effectiveDate', label: 'Effective', value: '2026-01-01', readOnly: true }),
        block('formNumber', { name: 'concentration', label: 'Conc', value: 2, unit: 'mg/mL' }),
      ],
    ];
    expect(validateClinicalDocument(doc, { placeholderRules: EXAMPLE_PLACEHOLDER_RULES })).toEqual([]);
  });
});
