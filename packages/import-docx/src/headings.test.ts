/**
 * Heading detection tests over Word-like documents, built in-test.
 */

import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { detectHeadings, SOP_SECTION_SYNONYMS } from './headings';
import { importDocx } from './importDocx';

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function bold(text: string): string {
  return `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
}

function plain(text: string): string {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

async function importBody(body: string, styles?: string) {
  const files: Record<string, Uint8Array> = {
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><w:document ${NS}><w:body>${body}</w:body></w:document>`),
  };
  if (styles) files['word/styles.xml'] = strToU8(styles);
  const { ir } = await importDocx(zipSync(files));
  return ir;
}

describe('detectHeadings', () => {
  it('finds plain bold SOP headings with no styles', async () => {
    const body = [
      bold('PURPOSE'),
      plain('This procedure describes how to prepare reagents for the assay.'),
      bold('1. Scope'),
      plain('Applies to all analysts in the lab.'),
      bold('2.1 Sampling Method'),
      plain('Collect swabs using the sterile kit.'),
      plain('1. Put on gloves.'),
      bold('Responsibilities:'),
      plain('The lab manager approves changes.'),
    ].join('');
    const ir = await importBody(body);
    const candidates = detectHeadings(ir);

    const byText = Object.fromEntries(candidates.map((c) => [c.text, c]));
    expect(Object.keys(byText).sort()).toEqual(['1. Scope', '2.1 Sampling Method', 'PURPOSE', 'Responsibilities:'].sort());
    expect(byText.PURPOSE).toMatchObject({ level: 1, index: 0 });
    expect(byText.PURPOSE.reason).toContain('sop-section:Purpose');
    expect(byText['1. Scope'].level).toBe(1);
    expect(byText['2.1 Sampling Method'].level).toBe(2);
    expect(byText['Responsibilities:'].reason).toContain('sop-section:Responsibilities');
    expect(byText['2.1 Sampling Method'].confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('prefers heading styles with high confidence', async () => {
    const styles = `<?xml version="1.0"?><w:styles ${NS}><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style></w:styles>`;
    const ir = await importBody(`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Equipment list</w:t></w:r></w:p>${plain('Body text.')}`, styles);
    const [candidate] = detectHeadings(ir);
    expect(candidate).toMatchObject({ text: 'Equipment list', level: 2, index: 0 });
    expect(candidate.confidence).toBeGreaterThanOrEqual(0.9);
    expect(candidate.reason).toBe('style:Heading2');
  });

  it('ignores ordinary numbered steps and long sentences', async () => {
    const ir = await importBody([plain('1. Open the lid.'), plain('2. Add the buffer and mix well.'), bold('This is a much longer bold sentence that goes on and on and on and on and on and on and on and on.')].join(''));
    expect(detectHeadings(ir)).toEqual([]);
  });

  it('exposes canonical SOP section names with synonyms', () => {
    expect(Object.keys(SOP_SECTION_SYNONYMS)).toEqual(
      expect.arrayContaining(['Purpose', 'Scope', 'Responsibilities', 'Definitions', 'Procedure', 'Safety', 'References', 'Quality Control', 'Revision History']),
    );
    expect(SOP_SECTION_SYNONYMS.Procedure).toContain('steps');
  });
});
