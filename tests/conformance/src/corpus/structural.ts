/**
 * Synthetic structural documents: a long generated SOP, complex tables, multilingual text and a
 * reviewed draft with tracked changes from several authors. Invented content.
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';
import { createPageSetup } from '@amusendame/beakblock-schema';

import { docBuilder } from './builders';

/** Tuned so that one generated page lays out to roughly one printed A4 page (heuristic measurer). */
const PARAGRAPHS_PER_PAGE = 8;

const SENTENCES = [
  'Verify that the specimen identifier on the container matches the requisition before any processing begins.',
  'Record the instrument serial number, the reagent lot, and the operator initials in the run log.',
  'If the control result falls outside the acceptance range, stop the run and follow the out-of-control procedure.',
  'Dispose of single-use consumables in the biohazard stream and decontaminate the bench with the approved disinfectant.',
  'Results are released only after the second-person verification described in the authorisation matrix.',
  'Store reagents at the temperature shown on the label and log every excursion in the monitoring system.',
];

/**
 * A generated SOP sized by page count. Each "page" is about eight paragraphs of about 60 words, a
 * heading every two pages, and a table every eight pages. Used by the corpus (50 pages) and by the
 * performance suite (200 pages). Deterministic for a given page count.
 */
export function longSop(pages: number, prefix = 'long'): Block[] {
  const b = docBuilder(prefix);
  const out: Block[] = [b.p([b.text(`Long-form SOP (${pages} pages)`, { bold: true })], { styleId: 'Title' })];
  for (let page = 1; page <= pages; page += 1) {
    if (page % 2 === 1) {
      out.push(b.h(1, `${Math.ceil(page / 2)}. Section ${Math.ceil(page / 2)}`, { styleId: 'Heading1', numbering: { numId: '3', level: 0 } }));
    }
    for (let para = 0; para < PARAGRAPHS_PER_PAGE; para += 1) {
      const start = (page * 7 + para * 3) % SENTENCES.length;
      const body = [0, 1, 2, 3].map((k) => SENTENCES[(start + k) % SENTENCES.length]).join(' ');
      out.push(
        b.p(
          page === 1 && para === 0 ? [b.text(body + ' '), b.field('PAGE', null), b.text(' of '), b.field('NUMPAGES', null)] : body,
          { spacing: { beforePt: 0, afterPt: 6, line: 276, lineRule: 'auto' } }
        )
      );
    }
    if (page % 8 === 0) {
      out.push(
        b.table([
          [{ text: 'Step', header: true }, { text: 'Owner', header: true }, { text: 'Frequency', header: true }],
          [{ text: `Check ${page}a` }, { text: 'Bench' }, { text: 'Each run' }],
          [{ text: `Check ${page}b` }, { text: 'Supervisor' }, { text: 'Daily' }],
        ])
      );
    }
    if (page % 10 === 0) {
      out.push(b.block('sectionBreak', { pageSetup: createPageSetup({ size: 'A4' }) }));
    }
  }
  return out;
}

/** Complex tables: vertical and horizontal merges, two header rows, nested lists and nested tables in cells, empty cells. */
export function complexTables(): Block[] {
  const b = docBuilder('ctbl');
  const nestedTable = b.table([
    [{ text: 'Sub', header: true }, { text: 'Value', header: true }],
    [{ text: 'a' }, { text: '1' }],
  ], { widthMode: 'auto' });
  return [
    b.h(1, 'Complex Table Conformance', { styleId: 'Heading1' }),
    b.table(
      [
        [{ text: 'Assay', header: true, colspan: 2 }, { text: 'Limits', header: true, colspan: 2 }],
        [{ text: 'Analyte', header: true }, { text: 'Method', header: true }, { text: 'Low', header: true }, { text: 'High', header: true }],
        [{ text: 'Glucose', rowspan: 2 }, { text: 'Hexokinase' }, { text: '3.9' }, { text: '5.6' }],
        [{ text: 'Enzymatic' }, { text: '3.8' }, { text: '5.8' }],
        [{ text: 'Creatinine' }, { text: 'Jaffe', backgroundColor: '#FFF2CC' }, { text: '' }, { text: '110' }],
        [
          {
            colspan: 4,
            children: [
              b.p('Notes spanning all columns:'),
              b.ul(['Fasting samples only', { text: 'Repeat above the limit', children: [b.ul(['Dilute 1:2 and rerun'])] }]),
            ],
          },
        ],
      ],
      { widthMode: 'fixed', widthValue: 9000 }
    ),
    b.table([
      [{ children: [b.p('Cell with a nested table:'), nestedTable], colspan: 2 }, { text: 'Right' }],
      [{ text: 'Left bottom' }, { text: 'Middle' }, { text: 'Right bottom', backgroundColor: '#E2EFDA' }],
    ], { widthMode: 'pct', widthValue: 5000 }),
    b.table([
      [{ text: 'Column A', header: true, colwidth: [100] }, { text: 'Column B', header: true, colwidth: [400] }],
      [{ text: '', colwidth: [100] }, { text: '', colwidth: [400] }],
    ], { widthMode: 'auto' }),
    b.p('A paragraph after the tables keeps the document ending well formed.'),
  ];
}

/** Multilingual: French with accents and guillemets, Arabic right-to-left runs, Chinese text and mixed scripts. */
export function multilingualDoc(): Block[] {
  const b = docBuilder('lang');
  return [
    b.h(1, 'Procédure de contrôle qualité / إجراء مراقبة الجودة / 质量控制规程', { styleId: 'Heading1' }),
    b.p('Le technicien vérifie « l’étiquette » avant chaque série d’analyses. Température : 37 °C, l’échantillon doit être à l’abri de la lumière.'),
    b.p('يجب على الفني التحقق من ملصق العينة قبل بدء التحليل، ويُسجل رقم الجهاز ورقم الدفعة في سجل التشغيل.'),
    b.p([
      b.text('يُسجَّل الناتج كـ '),
      b.text('(mg/L)', { bold: true }),
      b.text(' دائما بالرقم الإنجليزي 12.5 مع الوحدة.'),
    ]),
    b.p('样品在接收后两小时内完成登记，并核对患者标识与申请单信息。结果以 mmol/L 报告，保留两位小数。'),
    b.ol(['Vérifier le volume (≥ 4 mL).', 'مراجعة الحجم الأدنى.', '检查采样时间。']),
    b.p('Mixed: Ünïcödé, Ελληνικά, Русский, हिन्दी, and emoji 🧪 are all carried verbatim.'),
  ];
}

/** Reviewed draft: insertions and deletions from three authors, one AI-generated proposal, one replacement pair. */
export function reviewedDraft(): Block[] {
  const b = docBuilder('rev');
  const at = '2026-04-15T10:00:00.000Z';
  return [
    b.h(1, 'Reviewed Draft: Storage of Reagents', { styleId: 'Heading1' }),
    b.p([
      b.text('Reagents are stored at '),
      b.revisionText('2 to 8 °C', 'delete', 'ann', 'Ann', 'rev-del-1', at),
      b.revisionText('2 to 8 °C in the refrigerator', 'insert', 'ben', 'Ben', 'rev-ins-1', '2026-04-16T09:00:00.000Z'),
      b.text(' and protected from light.'),
    ]),
    b.p([
      b.text('Opened vials are used within '),
      b.revisionText('28', 'delete', 'cy', 'Cy', 'rev-del-2', '2026-04-17T12:00:00.000Z'),
      b.revisionText('14', 'insert', 'cy', 'Cy', 'rev-ins-2', '2026-04-17T12:00:00.000Z'),
      b.text(' days.'),
    ]),
    b.p([
      b.text('Temperature logs are reviewed weekly. '),
      b.revisionText('AI proposal: add a second-person check for excursions.', 'insert', 'assistant', 'Assistant (AI)', 'rev-ai-1', '2026-04-18T08:00:00.000Z', true),
    ]),
    b.p([b.text('This paragraph has no tracked changes.')]),
    b.p([b.revisionText('A paragraph inserted entirely by Ann.', 'insert', 'ann', 'Ann', 'rev-ins-3', at)]),
  ];
}
