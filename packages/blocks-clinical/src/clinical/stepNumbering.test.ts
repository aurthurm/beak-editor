/**
 * Tests for automatic `sopStep` numbering, including steps with no content.
 *
 * @module
 */

import { describe, expect, it } from 'vitest';
import { clinicalExtension } from './extension';
import { computeStepNumberTransaction } from './stepNumbering';
import type { Block } from '@amusendame/beakblock-core';
import { block, createEditor, flush, step, warning } from '../testHelpers';

const stepNumbers = (blocks: Block[]) => blocks.filter((item) => item.type === 'sopStep').map((item) => item.props.stepNumber);

describe('step numbering', () => {
  it('numbers steps from the demo shape without throwing', async () => {
    const editor = createEditor(
      [clinicalExtension()],
      [step('Fix the smear', { critical: true }), step('Flood the smear'), step('Rinse')]
    );
    await flush();
    expect(stepNumbers(editor.getDocument())).toEqual([1, 2, 3]);
  });

  it('numbers steps around an empty step (no children) instead of throwing', async () => {
    const editor = createEditor(
      [clinicalExtension()],
      [step('Fix the smear'), block('sopStep', {}, { children: [] }), step('Rinse')]
    );
    await flush();
    expect(stepNumbers(editor.getDocument())).toEqual([1, 2, 3]);
  });

  it('keeps numbering across a safety warning between steps', async () => {
    const editor = createEditor(
      [clinicalExtension()],
      [step('Fix'), warning('Corrosive'), block('sopStep', {}, { children: [] })]
    );
    await flush();
    expect(stepNumbers(editor.getDocument())).toEqual([1, 2]);
  });

  it('computeStepNumberTransaction does not throw on an empty step', () => {
    const editor = createEditor([clinicalExtension()], [block('sopStep', {}, { children: [] })]);
    const state = editor.pm.view.state;
    expect(() => computeStepNumberTransaction(state)).not.toThrow();
  });
});
