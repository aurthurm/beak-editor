/**
 * Tests for clinical and lab blocks: validators, step numbering, editor round-trips,
 * and equipment provider resolution.
 */

import { describe, expect, it } from 'vitest';
import type { Block, InlineContent } from '@amusendame/beakblock-core';
import { clinicalExtension } from './extension';
import { validateEquipmentReferences, type EquipmentProvider, type EquipmentRecord } from './equipment';
import {
  validateQcCriteria,
  validateReagentTable,
  validateSafetyWarning,
  validateSopStep,
  validateSpecimenRequirements,
  validateTestMethodSpec,
} from './validators';
import { computeStepNumberTransaction } from './stepNumbering';
import { block, createEditor, findBlock, flush, reagentTable, step, warning } from '../testHelpers';

/** Inline equipment reference as it appears in block JSON. */
const equipmentRef = (props: Record<string, unknown>): InlineContent =>
  ({ type: 'equipmentReference', props } as unknown as InlineContent);

const codes = (issues: Array<{ code: string }>) => issues.map((issue) => issue.code);

const VALID_ROWS = [
  ['Reagent', 'Concentration', 'Unit', 'Lot', 'Expiry'],
  ['NaCl', '0.9', '%', 'L-100', '2027-01-31'],
];

describe('validateSopStep', () => {
  it('warns on an empty step and accepts a step with text', () => {
    expect(codes(validateSopStep(block('sopStep', {}, { children: [] })))).toEqual(['empty-step']);
    expect(validateSopStep(step('Mix', { stepNumber: 1 }))).toEqual([]);
  });

  it('rejects invalid step numbers and times', () => {
    expect(codes(validateSopStep(step('Mix', { stepNumber: 0 })))).toEqual(['invalid-step-number']);
    expect(codes(validateSopStep(step('Mix', { timeMinutes: -5 })))).toEqual(['invalid-time']);
  });
});

describe('validateSafetyWarning', () => {
  it('accepts a warning with text, a level and GHS codes', () => {
    expect(validateSafetyWarning(warning('Corrosive', { level: 'danger', hazardCodes: ['H314'] }))).toEqual([]);
  });

  it('requires text, a known level and GHS-format codes', () => {
    expect(codes(validateSafetyWarning(block('safetyWarning', { level: 'warning' }, { children: [] })))).toContain('empty-safety-text');
    expect(codes(validateSafetyWarning(warning('Corrosive', { level: 'extreme' })))).toContain('invalid-level');
    expect(codes(validateSafetyWarning(warning('Corrosive', { level: 'warning', hazardCodes: ['X99'] })))).toEqual([
      'invalid-hazard-code',
    ]);
  });

  it('warns when a danger warning lists no hazard codes', () => {
    expect(codes(validateSafetyWarning(warning('Corrosive', { level: 'danger', hazardCodes: [] })))).toEqual([
      'missing-hazard-codes',
    ]);
  });
});

describe('validateReagentTable', () => {
  it('accepts a table with the required columns, allowed units and ISO expiry dates', () => {
    expect(validateReagentTable(reagentTable(VALID_ROWS))).toEqual([]);
  });

  it('reports missing required columns', () => {
    const issues = validateReagentTable(reagentTable([['Reagent', 'Unit'], ['NaCl', '%']]));
    expect(issues.filter((issue) => issue.code === 'missing-required-column').map((issue) => issue.message).join(' ')).toMatch(/Lot/);
  });

  it('honours a custom requiredColumns attr', () => {
    const table = reagentTable([['Reagent', 'Unit'], ['NaCl', '%']], { requiredColumns: ['Reagent', 'Unit'] });
    expect(validateReagentTable(table)).toEqual([]);
  });

  it('rejects units outside the allowed list and uses a custom list when given', () => {
    const rows = [VALID_ROWS[0]!, ['NaCl', '0.9', 'ppm', 'L-100', '2027-01-31']];
    expect(codes(validateReagentTable(reagentTable(rows)))).toEqual(['invalid-unit']);
    expect(validateReagentTable(reagentTable(rows), { allowedUnits: ['ppm'] })).toEqual([]);
  });

  it('rejects expiry values that are not real ISO dates', () => {
    const bad = [VALID_ROWS[0]!, ['NaCl', '0.9', '%', 'L-100', '31/01/2027']];
    expect(codes(validateReagentTable(reagentTable(bad)))).toEqual(['invalid-expiry-date']);
    const impossible = [VALID_ROWS[0]!, ['NaCl', '0.9', '%', 'L-100', '2027-02-30']];
    expect(codes(validateReagentTable(reagentTable(impossible)))).toEqual(['invalid-expiry-date']);
  });

  it('reports a wrapper without a table', () => {
    expect(codes(validateReagentTable(block('reagentTable', {}, { children: [] })))).toEqual(['missing-table']);
  });
});

describe('validateTestMethodSpec', () => {
  it('requires a method code that matches the pattern', () => {
    expect(codes(validateTestMethodSpec(block('testMethodSpec', { version: '1' })))).toContain('missing-method-code');
    expect(codes(validateTestMethodSpec(block('testMethodSpec', { methodCode: 'bad code', version: '1' })))).toEqual([
      'invalid-method-code',
    ]);
    expect(validateTestMethodSpec(block('testMethodSpec', { methodCode: 'ASSAY-GLU01', version: '2' }))).toEqual([]);
  });

  it('accepts a custom method code pattern', () => {
    const spec = block('testMethodSpec', { methodCode: 'lc_01', version: '1' });
    expect(codes(validateTestMethodSpec(spec))).toEqual(['invalid-method-code']);
    expect(validateTestMethodSpec(spec, { methodCodePattern: /^lc_\d+$/ })).toEqual([]);
  });
});

describe('validateSpecimenRequirements', () => {
  it('checks that volumes are numeric and minimum does not exceed volume', () => {
    expect(validateSpecimenRequirements(block('specimenRequirements', { specimenType: 'serum', volumeMl: 2, minVolumeMl: 0.5 }))).toEqual([]);
    expect(codes(validateSpecimenRequirements(block('specimenRequirements', { specimenType: 'serum', volumeMl: 1, minVolumeMl: 2 })))).toEqual([
      'min-volume-exceeds-volume',
    ]);
    expect(codes(validateSpecimenRequirements(block('specimenRequirements', { specimenType: 'serum', volumeMl: 'lots' })))).toEqual([
      'invalid-volume',
    ]);
    expect(codes(validateSpecimenRequirements(block('specimenRequirements', { volumeMl: 1 })))).toEqual(['missing-specimen-type']);
  });
});

describe('validateQcCriteria', () => {
  it('accepts known Westgard rules and a positive SD', () => {
    expect(
      validateQcCriteria(block('qcCriteria', { analyte: 'Glucose', target: 5.5, sd: 0.1, westgardRules: ['1_2s', '10_x'] }))
    ).toEqual([]);
  });

  it('rejects unknown rules, non-positive SD and missing analyte', () => {
    const issues = validateQcCriteria(block('qcCriteria', { target: 5, sd: 0, westgardRules: ['3_1s'] }));
    expect(codes(issues)).toEqual(expect.arrayContaining(['missing-analyte', 'invalid-sd', 'invalid-westgard-rule']));
  });
});

describe('step numbering', () => {
  it('numbers steps consecutively within a container and skips non-step blocks', async () => {
    const steps = [step('One'), warning('Careful'), step('Two')];
    const editor = createEditor([clinicalExtension()], steps);
    await flush();
    const numbers = editor.getDocument().filter((item) => item.type === 'sopStep').map((item) => item.props.stepNumber);
    expect(numbers).toEqual([1, 2]);
  });

  it('renumbers after an insertion in the middle', async () => {
    const editor = createEditor([clinicalExtension()], [step('One'), step('Two')]);
    await flush();
    const first = editor.getDocument()[0]!;
    editor.insertBlocks([step('New')], first, 'after');
    await flush();
    const doc = editor.getDocument();
    expect(doc.map((item) => item.props.stepNumber)).toEqual([1, 2, 3]);
    expect(doc[1]!.children?.[0]?.content?.[0]).toMatchObject({ text: 'New' });
  });

  it('does not create a transaction when numbering is already correct', () => {
    const editor = createEditor([clinicalExtension()], [step('One', { stepNumber: 1 })]);
    expect(computeStepNumberTransaction(editor.pm.state)).toBeNull();
  });
});

describe('editor round-trip for clinical blocks', () => {
  it('keeps the props of every atom and text block through the document API', async () => {
    const editor = createEditor([clinicalExtension()]);
    const seed = editor.getDocument()[0]!;
    const inputs: Block[] = [
      step('Centrifuge', { critical: true, timeMinutes: 15 }),
      warning('Corrosive', { level: 'danger', hazardCodes: ['H314'], ppe: ['gloves'] }),
      block('testMethodSpec', { methodCode: 'ASSAY-GLU01', version: '2', analyte: 'Glucose', principle: 'Enzymatic' }),
      block('specimenRequirements', { specimenType: 'serum', container: 'SST', volumeMl: 2, minVolumeMl: 0.5, rejectionCriteria: ['hemolysed'] }),
      block('qcCriteria', { analyte: 'Glucose', level: 'L2', target: 5.5, sd: 0.1, westgardRules: ['1_3s'] }),
    ];
    editor.insertBlocks(inputs, seed, 'after');
    await flush();
    const doc = editor.getDocument();
    expect(findBlock(doc, 'sopStep')?.props).toMatchObject({ critical: true, timeMinutes: 15, stepNumber: 1 });
    expect(findBlock(doc, 'safetyWarning')?.props).toMatchObject({ level: 'danger', hazardCodes: ['H314'], ppe: ['gloves'] });
    expect(findBlock(doc, 'testMethodSpec')?.props).toMatchObject({ methodCode: 'ASSAY-GLU01', version: '2' });
    expect(findBlock(doc, 'specimenRequirements')?.props).toMatchObject({ specimenType: 'serum', volumeMl: 2, rejectionCriteria: ['hemolysed'] });
    expect(findBlock(doc, 'qcCriteria')?.props).toMatchObject({ analyte: 'Glucose', westgardRules: ['1_3s'] });
    expect(findBlock(doc, 'sopStep')?.children?.[0]?.content?.[0]).toMatchObject({ type: 'text', text: 'Centrifuge' });
  });

  it('keeps the text of safety warnings through setDocument and getDocument', () => {
    const editor = createEditor([clinicalExtension()]);
    editor.setDocument([warning('Hot', { level: 'warning' })]);
    expect(editor.getDocument()[0]!.children?.[0]?.content).toEqual([{ type: 'text', text: 'Hot', styles: {} }]);
  });

  it('keeps reagent table cell text on the rendered table', async () => {
    const editor = createEditor([clinicalExtension()]);
    editor.setDocument([reagentTable(VALID_ROWS)]);
    await flush();
    const cells = editor.pm.dom.querySelectorAll('.beakblock-reagent-table td, .beakblock-reagent-table th');
    expect(Array.from(cells).map((element) => element.textContent)).toEqual(expect.arrayContaining(['Reagent', 'NaCl', '2027-01-31']));
  });

  it('keeps the wrapped table when reading the document back', () => {
    const editor = createEditor([clinicalExtension()]);
    editor.setDocument([reagentTable(VALID_ROWS)]);
    expect(findBlock(editor.getDocument(), 'table')).toBeDefined();
    expect(findBlock(editor.getDocument(), 'reagentTable')?.children?.[0]?.type).toBe('table');
  });
});

describe('equipment references', () => {
  const records: EquipmentRecord[] = [
    { id: 'eq-1', code: 'CNT-01', name: 'Centrifuge', status: 'active' },
    { id: 'eq-2', code: 'BAL-02', name: 'Balance', status: 'maintenance' },
  ];
  const provider: EquipmentProvider = {
    search: async (query) => records.filter((record) => `${record.code} ${record.name}`.toLowerCase().includes(query.toLowerCase())),
    get: async (id) => records.find((record) => record.id === id) ?? null,
  };

  it('resolves references through the provider and shows status', async () => {
    const editor = createEditor(
      [clinicalExtension({ equipmentProvider: provider })],
      [block('paragraph', {}, { content: [equipmentRef({ equipmentId: 'eq-2' })] })]
    );
    await flush();
    const chip = editor.pm.dom.querySelector<HTMLElement>('.beakblock-equipment');
    expect(chip?.textContent).toBe('BAL-02 Balance');
    expect(chip?.getAttribute('data-status')).toBe('maintenance');
    expect(chip?.classList.contains('beakblock-equipment--inactive')).toBe(true);
  });

  it('reports unknown and inactive equipment from the document', async () => {
    const editor = createEditor([clinicalExtension({ equipmentProvider: provider })], [
      block('paragraph', {}, {
        content: [
          equipmentRef({ equipmentId: 'eq-2', code: 'BAL-02', name: 'Balance' }),
          equipmentRef({ equipmentId: 'eq-missing' }),
          equipmentRef({ equipmentId: 'eq-1', code: 'CNT-01', name: 'Centrifuge' }),
        ],
      }),
    ]);
    await flush();
    const issues = await validateEquipmentReferences(editor.pm.doc, provider);
    expect(codes(issues)).toEqual(['equipment-inactive', 'equipment-not-authorised']);
  });

  it('flags equipment references that have no id', async () => {
    const editor = createEditor([clinicalExtension()], [
      block('paragraph', {}, { content: [equipmentRef({ code: 'X' })] }),
    ]);
    await flush();
    const issues = await validateEquipmentReferences(editor.pm.doc, provider);
    expect(codes(issues)).toEqual(['missing-equipment-id']);
  });
});
