/**
 * Synthetic laboratory SOPs. Content is invented for testing; it is not a real procedure.
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';

import { docBuilder } from './builders';

/** SOP-LAB-0012: Gram stain. Office paragraph props, clinical blocks, fields, controlled sections. */
export function gramStainSop(): Block[] {
  const b = docBuilder('gram');
  return [
    b.p([b.text('Gram Stain Procedure', { bold: true })], { styleId: 'Title', textAlign: 'center' }),
    b.p([b.field('DOCPROPERTY', 'docNumber', { fallback: 'SOP-LAB-0012' }), b.text('  Revision '), b.field('DOCPROPERTY', 'revision', { fallback: '4' })], {
      styleId: 'Normal',
      textAlign: 'center',
    }),
    b.h(1, 'Purpose', { styleId: 'Heading1', numbering: { numId: '3', level: 0 } }),
    b.controlledSection('gram-purpose', 'Purpose', [
      b.p('This procedure describes the Gram stain used to classify bacteria from clinical smears and positive blood culture subcultures.', {
        styleId: 'Normal',
        spacing: { beforePt: 0, afterPt: 6, line: 276, lineRule: 'auto' },
      }),
    ], { workflowState: 'approved', required: true }),
    b.h(1, 'Scope', { styleId: 'Heading1', numbering: { numId: '3', level: 0 } }),
    b.p('Applies to Microbiology bench staff in the Bacteriology section. Excludes acid-fast staining (see SOP-LAB-0019).'),
    b.h(2, 'Definitions', { styleId: 'Heading2', numbering: { numId: '3', level: 1 } }),
    b.ul([
      { text: [b.text('Smear: ', { bold: true }), b.text('a thin film of specimen fixed to a slide.')] },
      { text: [b.text('Decolouriser: ', { bold: true }), b.text('acetone-alcohol mixture used to remove the crystal violet from Gram-negative cells.')] },
    ]),
    b.h(1, 'Safety', { styleId: 'Heading1', numbering: { numId: '3', level: 0 } }),
    b.block('safetyWarning', { level: 'warning', hazardCodes: ['H225', 'H336'], ppe: ['nitrile gloves', 'safety glasses', 'lab coat'] }, undefined, [b.p([b.text('Acetone-alcohol is highly flammable. Keep away from the flame and work under the extraction hood.')])]),
    b.h(1, 'Procedure', { styleId: 'Heading1', numbering: { numId: '3', level: 0 } }),
    b.block('specimenRequirements', { specimenType: 'Positive blood culture subculture', container: 'Glass slide', volumeMl: 0.01, minVolumeMl: 0.005, stability: '1 h at room temperature', rejectionCriteria: 'Unlabelled slide' }),
    b.block('sopStep', { stepNumber: 1, timeMinutes: 2, critical: false }, undefined, [b.p([b.text('Label the slide with the specimen identifier and date.')])]),
    b.block('sopStep', { stepNumber: 2, timeMinutes: 5, critical: true }, undefined, [b.p([b.text('Air-dry the smear, then heat-fix by passing the slide three times through a flame.')])]),
    b.block('sopStep', { stepNumber: 3, timeMinutes: 1, critical: false }, undefined, [b.p([b.text('Flood the smear with crystal violet for 60 seconds, then rinse with water.')])]),
    b.block('sopStep', { stepNumber: 4, timeMinutes: 1, critical: false }, undefined, [b.p([b.text('Flood with Gram iodine for 60 seconds, then rinse.')])]),
    b.block('sopStep', { stepNumber: 5, timeMinutes: 0.5, critical: true }, undefined, [b.p([b.text('Decolourise for no more than 5 seconds, then rinse immediately.')])]),
    b.block('sopStep', { stepNumber: 6, timeMinutes: 1, critical: false }, undefined, [b.p([b.text('Counterstain with safranin for 60 seconds, rinse and air-dry.')])]),
    b.p([b.text('Examine under oil immersion at 1000x. Record cell shape and arrangement, then the Gram reaction. See figure '), b.field('SEQ', 'Figure', { format: 'ARABIC' }), b.text('.')], {
      styleId: 'Normal',
      numbering: { numId: '2', level: 0 },
    }),
    b.h(1, 'Quality control', { styleId: 'Heading1', numbering: { numId: '3', level: 0 } }),
    b.block('qcCriteria', { analyte: 'Gram-positive control (S. aureus)', level: 'L1', target: 1, sd: 0.1, westgardRules: ['1_2s', '1_3s'] }),
    b.block('testMethodSpec', { methodCode: 'LAB-GS01', version: '4', analyte: 'Bacterial morphology', principle: 'Differential staining by crystal violet and safranin' }),
    b.h(1, 'Records', { styleId: 'Heading1', numbering: { numId: '3', level: 0 } }),
    b.p([b.text('Record the result in the LIMS worksheet with reader initials and the date. Owner: '), b.field('DOCPROPERTY', 'owner', { fallback: 'Bacteriology lead' }), b.text('.')]),
  ];
}

/** SOP-LAB-0031: blood culture collection and processing, with a reagent table and a specimen table. */
export function bloodCultureSop(): Block[] {
  const b = docBuilder('bc');
  return [
    b.h(1, 'Blood Culture Collection and Processing', { styleId: 'Heading1' }),
    b.p('Defines collection, labelling, transport and bench processing of blood cultures for aerobic and anaerobic bottles.'),
    b.block('safetyWarning', { level: 'danger', hazardCodes: ['H314'], ppe: ['gloves', 'face shield'] }, undefined, [b.p([b.text('Blood is a biohazard. Use a sharps container for all needles. Discard bottles after the exposure protocol is followed.')])]),
    b.h(2, 'Specimen requirements', { styleId: 'Heading2' }),
    b.block('specimenRequirements', {
      specimenType: 'Whole blood',
      container: 'Aerobic and anaerobic bottle pair',
      volumeMl: 8,
      minVolumeMl: 4,
      stability: '2 h at room temperature',
      rejectionCriteria: 'Volume below 4 mL per bottle; bottle past expiry; no patient label',
    }),
    b.h(2, 'Reagents', { styleId: 'Heading2' }),
    b.block('reagentTable', { requiredColumns: ['Reagent', 'Concentration', 'Unit', 'Lot', 'Expiry'] }, undefined, [
      b.table([
        [{ text: 'Reagent', header: true }, { text: 'Concentration', header: true }, { text: 'Unit', header: true }, { text: 'Lot', header: true }, { text: 'Expiry', header: true }],
        [{ text: 'Chlorhexidine' }, { text: '2' }, { text: '%' }, { text: 'CHX-2291' }, { text: '2027-03-31' }],
        [{ text: 'Isopropyl alcohol' }, { text: '70' }, { text: '%' }, { text: 'IPA-7710' }, { text: '2027-01-15' }],
      ]),
    ]),
    b.h(2, 'Procedure', { styleId: 'Heading2' }),
    b.ol([
      'Perform hand hygiene and don gloves.',
      {
        text: 'Disinfect the bottle septum with chlorhexidine and allow it to dry for 30 seconds.',
        children: [b.ul(['Do not touch the disinfected septum.', 'Use a single-use wipe for each bottle.'])],
      },
      'Draw the aerobic bottle first, then the anaerobic bottle, using the same venepuncture.',
      'Mix each bottle gently by inversion eight to ten times.',
    ], { start: 1 }),
    b.block('sopStep', { stepNumber: 1, timeMinutes: 1, critical: true }, undefined, [b.p([b.text('Label both bottles with two patient identifiers before leaving the bedside.')])]),
    b.h(2, 'Transport', { styleId: 'Heading2' }),
    b.p('Transport at room temperature. Deliver to the Bacteriology receiving bench within 2 hours of collection.'),
    b.checklist([
      { text: 'Two identifiers on each bottle', checked: true },
      { text: 'Collection time recorded', checked: true },
      { text: 'Volume verified', checked: false },
    ]),
  ];
}

/** SOP-LAB-0044: PCR master-mix setup with a reagent table, thermocycler method and equipment references. */
export function pcrSetupSop(): Block[] {
  const b = docBuilder('pcr');
  return [
    b.h(1, 'PCR Master-Mix Setup', { styleId: 'Heading1' }),
    b.block('testMethodSpec', { methodCode: 'MOL-PCR02', version: '3', analyte: 'Targets: 16S rRNA', principle: 'Real-time PCR with hydrolysis probes' }),
    b.h(2, 'Master-mix composition', { styleId: 'Heading2' }),
    b.block('reagentTable', { requiredColumns: ['Reagent', 'Concentration', 'Unit', 'Lot', 'Expiry'] }, undefined, [
      b.table([
        [{ text: 'Reagent', header: true }, { text: 'Concentration', header: true }, { text: 'Unit', header: true }, { text: 'Lot', header: true }, { text: 'Expiry', header: true }],
        [{ text: 'Forward primer' }, { text: '10' }, { text: 'mg/mL' }, { text: 'PRM-0412' }, { text: '2027-06-30' }],
        [{ text: 'Reverse primer' }, { text: '10' }, { text: 'mg/mL' }, { text: 'PRM-0413' }, { text: '2027-06-30' }],
        [{ text: 'Probe' }, { text: '5' }, { text: 'µg/mL' }, { text: 'PRB-0097' }, { text: '2027-02-28' }],
      ]),
    ]),
    b.h(2, 'Setup', { styleId: 'Heading2' }),
    b.block('sopStep', { stepNumber: 1, timeMinutes: 10, critical: false }, undefined, [b.p([b.text('Thaw all reagents on ice and vortex the master mix briefly.')])]),
    b.block('sopStep', { stepNumber: 2, timeMinutes: 5, critical: true }, undefined, [b.p([b.text('Work in the PCR hood. Run a no-template control in every batch.')])]),
    b.block('sopStep', { stepNumber: 3, timeMinutes: 15, critical: false }, undefined, [b.p([b.text('Dispense 18 µL master mix per well, then add 2 µL template.')])]),
    b.p([b.text('Cycling profile: 95 °C for 10 min, then 40 cycles of 95 °C for 15 s and 60 °C for 60 s.')], {
      styleId: 'CalloutInfo',
      indent: { leftPt: 18 },
    }),
    b.block('qcCriteria', { analyte: 'Internal amplification control', level: 'L2', target: 28.5, sd: 0.6, westgardRules: ['2_2s', 'R_4s'] }),
    b.h(2, 'Equipment', { styleId: 'Heading2' }),
    b.p('Real-time thermocycler, biosafety cabinet class II, micropipettes calibrated within the last 6 months.'),
    b.divider(),
    b.p([b.text('Document reference: '), b.field('DOCPROPERTY', 'docNumber', { fallback: 'SOP-LAB-0044' })]),
  ];
}

/** SOP-LAB-0058: centrifuge maintenance, with a checklist, a code block of a log format and warnings. */
export function centrifugeMaintenanceSop(): Block[] {
  const b = docBuilder('cfg');
  return [
    b.h(1, 'Centrifuge Preventive Maintenance', { styleId: 'Heading1' }),
    b.block('safetyWarning', { level: 'caution', hazardCodes: [], ppe: ['gloves'] }, undefined, [b.p([b.text('Switch off and unplug the instrument before opening the chamber.')])]),
    b.h(2, 'Daily checks', { styleId: 'Heading2' }),
    b.checklist([
      { text: 'Chamber free of spilt material', checked: true },
      { text: 'Rotor inspected for cracks', checked: true },
      { text: 'Lid gasket intact', checked: true },
      { text: 'Imbalance alarm tested', checked: false },
    ]),
    b.h(2, 'Monthly checks', { styleId: 'Heading2' }),
    b.ul([
      'Verify speed with a calibrated tachometer; tolerance ±2 % of set speed.',
      { text: 'Check temperature control at 4 °C.', children: [b.p('Record the actual reading on the calibration sheet.')] },
    ]),
    b.h(2, 'Log entry format', { styleId: 'Heading2' }),
    b.block('codeBlock', { language: 'text' }, [b.text('CFG-07 | 2026-04-02 | rpm=14000 | temp=4.1 C | tech=JM | result=PASS')]),
    b.p([b.text('Record keeping: entries are kept for '), b.text('five years', { bold: true, underline: true }), b.text(' in accordance with the retention schedule.')], {
      spacing: { beforePt: 6, afterPt: 6, line: 276, lineRule: 'auto' },
      keepNext: true,
    }),
  ];
}

/** SOP-LAB-0066: specimen rejection criteria as a decision table with a callout and sub-steps. */
export function specimenRejectionSop(): Block[] {
  const b = docBuilder('rej');
  return [
    b.h(1, 'Specimen Rejection Criteria', { styleId: 'Heading1' }),
    b.p('Specimens that fail any criterion below are rejected and the requesting clinician is notified through the LIMS.'),
    b.table([
      [{ text: 'Specimen', header: true }, { text: 'Criterion', header: true }, { text: 'Action', header: true }],
      [{ text: 'Serum', rowspan: 2 }, { text: 'Haemolysis index above 100' }, { text: 'Reject; request recollection' }],
      [{ text: 'Visibly lipaemic' }, { text: 'Hold and request recollection after a 12 h fast' }],
      [{ text: 'Urine' }, { text: 'Container older than 2 h at room temperature' }, { text: 'Reject' }],
      [{ text: 'Stool' }, { text: 'Not in the transport medium' }, { text: 'Reject; notify the ward' }],
    ]),
    b.block('callout', { calloutType: 'warning' }, [b.text('Rejections must never be corrected by relabelling. Always request recollection.')]),
    b.h(2, 'Notification steps', { styleId: 'Heading2' }),
    b.ol([
      { text: 'Record the rejection reason code in the LIMS.', children: [b.ol(['Choose the code from the approved list.', 'Add free text only when no code fits.'], { start: 1 })] },
      'Call the ward and document the name of the person informed.',
      'Print the rejection notice and file it with the request.',
    ]),
    b.block('blockquote', {}, [b.text('Reject first, explain second: a result on a bad specimen is worse than no result.')]),
  ];
}
