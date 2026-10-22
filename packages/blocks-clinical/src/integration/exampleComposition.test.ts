/**
 * Integration tests that mirror the clinical scenario in examples/next-app: the clinical,
 * forms and office extensions are combined in one BeakBlockEditor (office mode).
 */

import { describe, expect, it } from 'vitest';
import { BeakBlockEditor, type Block, type InlineContent } from '@amusendame/beakblock-core';
import { clinicalExtension } from '../clinical/extension';
import { formsExtension } from '../forms/extension';
import { officeBlocksExtension, refreshOfficeBlocks } from '@amusendame/beakblock-blocks-office';

const b = (value: Record<string, unknown>): Block => value as unknown as Block;
const plain = (text: string) => ({ type: 'text', text, styles: {} });
const P = (id: string, content: unknown[] | string, props: Record<string, unknown> = {}): Block =>
  b({ id, type: 'paragraph', props: { textAlign: 'left', ...props }, content: typeof content === 'string' ? [plain(content)] : content });
const H = (id: string, level: number, text: string): Block => b({ id, type: 'heading', props: { level }, content: [plain(text)] });

function demoBlocks(procedureType: string): Block[] {
  return [
    H('cl-h1', 1, 'Gram stain procedure (clinical)'),
    b({
      id: 'cl-warning',
      type: 'conditional',
      props: { id: 'cl-cond', expression: 'procedureType == "hazardous"' },
      children: [
        b({
          id: 'cl-safety',
          type: 'safetyWarning',
          props: { level: 'danger', hazardCodes: ['H314', 'H225'], ppe: 'Nitrile gloves' },
          children: [P('cl-safety-p', 'Acetone-alcohol is highly flammable.')],
        }),
      ],
    }),
    P('cl-intro', [plain('Equipment: '), { type: 'equipmentReference', props: { equipmentId: 'EQ-101' } } as unknown as InlineContent, plain('.')]),
    b({ id: 'cl-step-1', type: 'sopStep', props: { critical: true, timeMinutes: 3 }, children: [P('cl-step-1-p', 'Fix the smear.')] }),
    b({ id: 'cl-step-2', type: 'sopStep', props: { critical: false, timeMinutes: 1 }, children: [P('cl-step-2-p', 'Flood with crystal violet.')] }),
    b({ id: 'cl-step-3', type: 'sopStep', props: { critical: false, timeMinutes: 0.5 }, children: [P('cl-step-3-p', 'Rinse with water.')] }),
    b({ id: 'cl-f-operator', type: 'formText', props: { name: 'operator', label: 'Operator', required: true, value: '', placeholder: 'Full name' } }),
    b({ id: 'cl-f-dose', type: 'formNumber', props: { name: 'dose', label: 'Volume', value: 5, unit: 'mL', allowedUnits: ['mL'], min: 0, max: 20, decimals: 1 } }),
    b({ id: 'cl-f-calc', type: 'formCalculated', props: { name: 'totalMl', label: 'Total', expression: 'dose * 2', decimals: 2 } }),
    P('cl-note', [
      plain('Gram-positive cells retain crystal violet.'),
      { type: 'footnote', props: { id: 'fn-1', text: 'Adapted from the reference method.' } } as unknown as InlineContent,
      plain(' See '),
      { type: 'crossReference', props: { targetId: 'cl-cap-1', display: 'text' } } as unknown as InlineContent,
      plain(' for the reagent set.'),
    ]),
    b({ id: 'cl-cap-1', type: 'caption', props: { label: 'Table' }, content: [plain('Reagents and expiry dates')] }),
    b({ id: 'cl-eq', type: 'equation', props: { latex: 'C = V' } }),
    P('cl-proc', `Procedure type is ${procedureType}.`),
  ];
}

function mountExample(procedureType = 'routine'): { editor: BeakBlockEditor; variables: Record<string, unknown> } {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const variables: Record<string, unknown> = { procedureType };
  const editor = new BeakBlockEditor({
    element,
    mode: 'office',
    wordBehaviour: true,
    initialContent: demoBlocks(procedureType),
    extensions: [
      clinicalExtension({ allowedUnits: ['mg/mL', 'mL'] }),
      formsExtension(),
      officeBlocksExtension({ variables: () => variables }),
    ],
  });
  return { editor, variables };
}

const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('clinical scenario composition', () => {
  it('shows step numbers, footnote and cross-reference text, and hides the conditional', async () => {
    const { editor } = mountExample('routine');
    const dom = editor.pm.view.dom;
    await nextTurn();

    expect(Array.from(dom.querySelectorAll('[data-sop-step]')).map((el) => el.getAttribute('data-step-number'))).toEqual(['1', '2', '3']);
    expect(Array.from(dom.querySelectorAll('.beakblock-footnote')).map((el) => el.textContent)).toEqual(['1']);
    expect(Array.from(dom.querySelectorAll('.beakblock-xref')).map((el) => el.textContent)).toEqual(['Table 1: Reagents and expiry dates']);
    expect(Array.from(dom.querySelectorAll('[data-condition-result]')).map((el) => el.getAttribute('data-condition-result'))).toEqual(['false']);

    // The example never calls an inject function, so the extensions must inject their own styles.
    const css = Array.from(document.querySelectorAll('style'))
      .map((el) => el.textContent ?? '')
      .join('\n');
    expect(css).toContain('.beakblock-conditional[data-condition-result="false"]');
    expect(css).toContain('.beakblock-sop-step::before');
    editor.destroy();
  });

  it('shows the conditional when the variable matches', async () => {
    const { editor, variables } = mountExample('hazardous');
    await nextTurn();
    expect(editor.pm.view.dom.querySelector('[data-condition-result]')?.getAttribute('data-condition-result')).toBe('true');
    variables.procedureType = 'routine';
    refreshOfficeBlocks(editor);
    expect(editor.pm.view.dom.querySelector('[data-condition-result]')?.getAttribute('data-condition-result')).toBe('false');
    editor.destroy();
  });

  it('does not throw when the editor is destroyed before the numbering microtask runs', async () => {
    const { editor } = mountExample('routine');
    editor.destroy();
    await nextTurn();
    expect(editor.isDestroyed).toBe(true);
  });
});
