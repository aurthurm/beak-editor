/**
 * Synthetic form-heavy worksheet and an Office-extension document (footnotes, equations, text
 * boxes, shapes, conditionals, repeating sections, reusable content). Invented content.
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';

import { docBuilder } from './builders';

/** Equipment qualification worksheet: fillable placeholders, checklists, a repeating row set and conditionals. */
export function formWorksheet(): Block[] {
  const b = docBuilder('form');
  const placeholder = (text: string) => b.p([b.text(text, { italic: true, textColor: '#7F7F7F' })], { styleId: 'Normal' });
  return [
    b.p([b.text('Equipment Qualification Worksheet', { bold: true })], { styleId: 'Title', textAlign: 'center' }),
    b.table([
      [{ text: 'Field', header: true }, { text: 'Entry', header: true }],
      [{ text: 'Equipment ID' }, { text: 'Placeholder: enter ID from LIMS' }],
      [{ text: 'Serial number' }, { text: '' }],
      [{ text: 'Location' }, { text: 'Bench 4, Room 2.12' }],
      [{ text: 'Date of qualification' }, { text: '' }],
    ], { widthMode: 'pct', widthValue: 5000 }),
    b.h(1, 'Pre-checks', { styleId: 'Heading1' }),
    b.checklist([
      { text: 'Power supply verified (230 V, earth continuity checked)', checked: true },
      { text: 'Firmware version recorded', checked: false },
      { text: 'Calibration certificate in date', checked: false },
      { text: 'Spill tray in place', checked: true },
    ]),
    b.h(1, 'Measurements', { styleId: 'Heading1' }),
    b.block('repeatingSection', { itemsKey: 'channels', min: 2, max: 4 }, undefined, [
      b.p([b.text('Channel: '), b.variable('channelName')]),
      b.p([b.text('Reading (°C): '), b.variable('channelReading')]),
    ]),
    b.block('conditional', { expression: 'requiresCalibration == true' }, undefined, [
      b.h(2, 'Calibration follow-up', { styleId: 'Heading2' }),
      b.p('Calibrate the probe before the operational qualification and attach the certificate.'),
    ]),
    b.p([
      b.text('Acceptance: the measured temperature must be within '),
      b.field('LIMS', 'temperatureLimitPlusMinus', { fallback: '0.5' }),
      b.text(' °C of the setpoint.'),
      { type: 'footnote', props: { text: 'Limit from the manufacturer specification, revision C.' } },
    ]),
    placeholder('Comments: type here'),
    placeholder('Reviewer initials and date: ____'),
    b.block('reusableContent', { contentId: 'rc-standard-disclaimer', revision: 2 }),
    b.p('Form completed by the operator who performed the measurements.'),
  ];
}

/** Office extensions: equation, caption, text box, shape, footnote, cross reference and variables. */
export function officeExtensionsDoc(): Block[] {
  const b = docBuilder('office');
  const summary = b.h(1, 'Method Summary', { styleId: 'Heading1' });
  return [
    summary,
    b.p([
      b.text('The assay follows the calibration curve in '),
      { type: 'crossReference', props: { targetId: summary.id, display: 'Method Summary' } },
      b.text(' with a limit of '),
      { type: 'inlineEquation', props: { latex: 'LOD = 3.3\\,\\sigma / S' } },
      b.text('.'),
      { type: 'footnote', props: { text: 'Gleaned from the vendor application note AN-22.' } },
    ]),
    b.block('equation', { latex: 'y = mx + c' }),
    b.block('caption', { label: 'Figure' }, [b.text('Calibration curve, 0 to 100 mg/L.')]),
    b.block('textBox', { width: 240, float: 'right', borderPt: 0.75, fill: '#F2F2F2' }, undefined, [
      b.p([b.text('Note: ', { bold: true }), b.text('Read the reagent expiry before starting.')]),
    ]),
    b.block('shape', { kind: 'arrow', width: 160, height: 40, fill: null, stroke: '#334155', strokeWidth: 1.5 }),
    b.p([b.text('Operator '), { type: 'variable', props: { name: 'operatorName', format: null } }, b.text(' signed on ' ), { type: 'variable', props: { name: 'signDate', format: 'yyyy-MM-dd' } }]),
    b.block('conditional', { expression: 'reagentLot != null' }, undefined, [b.p('Record the reagent lot number.')]),
    b.block('repeatingSection', { itemsKey: 'calibrators', min: 1, max: 6 }, undefined, [b.p('Calibrator level and concentration.')]),
    b.block('reusableContent', { contentId: 'rc-units', revision: 1 }),
    b.block('caption', { label: 'Table' }, [b.text('Calibrator lot list.')]),
    b.table([
      [{ text: 'Level', header: true }, { text: 'Concentration', header: true }],
      [{ text: 'Cal 1' }, { text: '0' }],
      [{ text: 'Cal 2' }, { text: '25' }],
    ]),
  ];
}
