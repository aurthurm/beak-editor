/**
 * Importer tests. Fixtures are built in-test: hand-written XML zipped with fflate.
 */

import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { irToDocument, type IRBlock, type IRInline, type IRParagraph, type IRTable } from '@amusendame/beakblock-ir';

import { importDocx } from './importDocx';
import { ooxmlPassthroughExtension } from './passthrough';

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ' +
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
  'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" ' +
  'xmlns:v="urn:schemas-microsoft-com:vml"';

const HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const REL_TYPES = {
  styles: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
  numbering: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering',
  image: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  hyperlink: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
  header: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header',
  footer: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer',
};

function rels(entries: Array<[string, string, string, boolean?]>): string {
  const items = entries
    .map(([id, type, target, external]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"${external ? ' TargetMode="External"' : ''}/>`)
    .join('');
  return `${HEADER}<Relationships xmlns="${REL_NS}">${items}</Relationships>`;
}

function document(body: string): string {
  return `${HEADER}<w:document ${NS}><w:body>${body}</w:body></w:document>`;
}

function makeDocx(parts: Record<string, string>, media: Record<string, Uint8Array> = {}): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const [path, xml] of Object.entries(parts)) files[path] = strToU8(xml);
  for (const [path, data] of Object.entries(media)) files[path] = data;
  return zipSync(files);
}

/** Package with a document body and optional extra parts. */
function pkg(body: string, extra: Record<string, string> = {}, relEntries: Array<[string, string, string, boolean?]> = []): Record<string, string> {
  return {
    'word/document.xml': document(body),
    'word/_rels/document.xml.rels': rels(relEntries),
    ...extra,
  };
}

function paragraphs(blocks: IRBlock[]): IRParagraph[] {
  return blocks.filter((b): b is IRParagraph => b.type === 'paragraph');
}

function runsOf(p: IRParagraph): Extract<IRInline, { type: 'run' }>[] {
  return p.runs.filter((r): r is Extract<IRInline, { type: 'run' }> => r.type === 'run');
}

function textOfP(p: IRParagraph): string {
  return p.runs.map((r) => (r.type === 'run' ? r.text : r.type === 'field' ? r.cachedText : '')).join('');
}

describe('importDocx: styles and numbering', () => {
  it('parses paragraph, character and table styles, and numbering', async () => {
    const styles = `${HEADER}<w:styles ${NS}>
      <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
      <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>
        <w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>
        <w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
      <w:style w:type="character" w:styleId="Code"><w:name w:val="Code"/><w:rPr><w:rFonts w:ascii="Courier New"/></w:rPr></w:style>
      <w:style w:type="table" w:styleId="Grid"><w:name w:val="Grid"/>
        <w:tblPr><w:tblBorders><w:top w:val="single" w:sz="8" w:color="000000"/></w:tblBorders><w:tblCellMar><w:left w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
    </w:styles>`;
    const numbering = `${HEADER}<w:numbering ${NS}>
      <w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="multilevel"/>
        <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:pStyle w:val="Heading1"/><w:pPr><w:ind w:left="432" w:hanging="432"/></w:pPr></w:lvl>
        <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2"/></w:lvl>
      </w:abstractNum>
      <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum>
      <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
      <w:num w:numId="2"><w:abstractNumId w:val="0"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="3"/></w:lvlOverride></w:num>
    </w:numbering>`;
    const bytes = makeDocx(
      pkg('<w:p><w:r><w:t>x</w:t></w:r></w:p>', { 'word/styles.xml': styles, 'word/numbering.xml': numbering }, [
        ['rId1', REL_TYPES.styles, 'styles.xml'],
        ['rId2', REL_TYPES.numbering, 'numbering.xml'],
      ]),
    );
    const { ir, losses } = await importDocx(bytes);
    expect(losses).toEqual([]);

    const h1 = ir.styles.paragraph.Heading1;
    expect(h1.name).toBe('heading 1');
    expect(h1.basedOn).toBe('Normal');
    expect(h1.next).toBe('Normal');
    expect(h1.outlineLevel).toBe(0);
    expect(h1.paraProps?.keepNext).toBe(true);
    expect(h1.paraProps?.spacing).toEqual({ beforePt: 12, afterPt: 6, line: 240, lineRule: 'auto' });
    expect(h1.runProps).toEqual({ bold: true, sizePt: 16 });
    expect(ir.styles.character.Code.runProps?.font).toBe('Courier New');
    expect(ir.styles.table.Grid.borders?.top).toEqual({ style: 'single', sizePt: 1, color: '#000000' });
    expect(ir.styles.table.Grid.cellPaddingPt?.left).toBe(5.4);

    const abs0 = ir.numbering.abstract['0'];
    expect(abs0.multiLevelType).toBe('multilevel');
    expect(abs0.levels[0]).toMatchObject({ level: 0, format: 'decimal', text: '%1.', start: 1, paraStyleId: 'Heading1' });
    expect(abs0.levels[0].indent).toEqual({ leftPt: 21.6, hangingPt: 21.6 });
    expect(abs0.levels[1].text).toBe('%1.%2');
    expect(ir.numbering.abstract['1'].levels[0].format).toBe('bullet');
    expect(ir.numbering.instances['2']).toEqual({ abstractId: '0', overrides: { 0: { startOverride: 3 } } });
  });

  it('applies style-level numbering to paragraphs that use the style', async () => {
    const styles = `${HEADER}<w:styles ${NS}><w:style w:type="paragraph" w:styleId="ListPara"><w:name w:val="List Para"/>
      <w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr></w:style></w:styles>`;
    const numbering = `${HEADER}<w:numbering ${NS}><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="-"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
    const bytes = makeDocx(
      pkg('<w:p><w:pPr><w:pStyle w:val="ListPara"/></w:pPr><w:r><w:t>item</w:t></w:r></w:p>', { 'word/styles.xml': styles, 'word/numbering.xml': numbering }, [
        ['rId1', REL_TYPES.styles, 'styles.xml'],
        ['rId2', REL_TYPES.numbering, 'numbering.xml'],
      ]),
    );
    const { ir } = await importDocx(bytes);
    expect(paragraphs(ir.sections[0].body)[0].props.numbering).toEqual({ numId: '1', level: 0 });
  });
});

describe('importDocx: paragraph properties', () => {
  it('maps pPr to ParaProps in pt and twips', async () => {
    const body = `<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:jc w:val="center"/>
      <w:spacing w:before="120" w:after="60" w:line="360" w:lineRule="auto"/>
      <w:ind w:left="720" w:hanging="360"/><w:keepNext/><w:keepLines w:val="0"/><w:pageBreakBefore/><w:widowControl/>
      <w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr>
      <w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9000"/><w:tab w:val="clear" w:pos="100"/></w:tabs></w:pPr>
      <w:r><w:t>Hello</w:t></w:r></w:p>`;
    const { ir } = await importDocx(makeDocx(pkg(body)));
    const p = paragraphs(ir.sections[0].body)[0];
    expect(p.props).toEqual({
      styleId: 'Heading1',
      align: 'center',
      spacing: { beforePt: 6, afterPt: 3, line: 360, lineRule: 'auto' },
      indent: { leftPt: 36, hangingPt: 18 },
      keepNext: true,
      keepLines: false,
      pageBreakBefore: true,
      widowControl: true,
      numbering: { numId: '1', level: 1 },
      tabs: [{ posPt: 450, kind: 'right', leader: 'dot' }],
    });
  });

  it('treats numId 0 as removed numbering', async () => {
    const body = '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="0"/></w:numPr></w:pPr><w:r><w:t>x</w:t></w:r></w:p>';
    const { ir } = await importDocx(makeDocx(pkg(body)));
    expect(paragraphs(ir.sections[0].body)[0].props.numbering).toBeNull();
  });
});

describe('importDocx: runs', () => {
  it('maps run properties, tabs, line and page breaks', async () => {
    const body = `<w:p><w:r><w:rPr><w:rStyle w:val="Code"/><w:rFonts w:ascii="Arial"/><w:b/><w:i w:val="0"/>
      <w:u w:val="single"/><w:strike/><w:color w:val="FF0000"/><w:sz w:val="22"/><w:highlight w:val="yellow"/>
      <w:vertAlign w:val="superscript"/><w:shd w:val="clear" w:color="auto" w:fill="EEEEEE"/></w:rPr>
      <w:t xml:space="preserve">Hi </w:t><w:tab/><w:t>there</w:t><w:br/><w:t>line2</w:t><w:br w:type="page"/></w:r></w:p>`;
    const { ir } = await importDocx(makeDocx(pkg(body)));
    const p = paragraphs(ir.sections[0].body)[0];
    const runs = runsOf(p);
    expect(runs.map((r) => r.text)).toEqual(['Hi \tthere', 'line2']);
    expect(runs[0].props).toEqual({
      styleId: 'Code',
      font: 'Arial',
      bold: true,
      underline: true,
      strike: true,
      color: '#FF0000',
      sizePt: 11,
      highlight: 'yellow',
      vertAlign: 'superscript',
      shading: '#EEEEEE',
    });
    expect(p.runs.filter((r) => r.type === 'break').map((r) => (r.type === 'break' ? r.kind : ''))).toEqual(['line', 'page']);
  });

  it('resolves hyperlinks through relationships and anchors', async () => {
    const body = `<w:p><w:hyperlink r:id="rId5"><w:r><w:t>Site</w:t></w:r></w:hyperlink>
      <w:hyperlink w:anchor="sec1"><w:r><w:t>Jump</w:t></w:r></w:hyperlink></w:p>`;
    const bytes = makeDocx(pkg(body, {}, [['rId5', REL_TYPES.hyperlink, 'https://example.com/sop', true]]));
    const { ir } = await importDocx(bytes);
    const runs = runsOf(paragraphs(ir.sections[0].body)[0]);
    expect(runs[0].link).toEqual({ href: 'https://example.com/sop' });
    expect(runs[1].link).toEqual({ href: '#sec1' });
  });
});

describe('importDocx: fields', () => {
  it('parses complex and simple fields and keeps unsupported ones as text', async () => {
    const body = `<w:p>
      <w:r><w:t xml:space="preserve">Page </w:t></w:r>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
      <w:r><w:t xml:space="preserve"> of </w:t></w:r>
      <w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>7</w:t></w:r></w:fldSimple>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> DOCPROPERTY docNumber </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>SOP-001</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> HYPERLINK "http://x" </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>link text</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
      <w:fldSimple w:instr=' SEQ Figure \\* ARABIC '><w:r><w:t>3</w:t></w:r></w:fldSimple>
    </w:p>`;
    const { ir, losses } = await importDocx(makeDocx(pkg(body)));
    const items = paragraphs(ir.sections[0].body)[0].runs;
    expect(items[0]).toMatchObject({ type: 'run', text: 'Page ' });
    expect(items[1]).toMatchObject({ type: 'field', fieldType: 'PAGE', cachedText: '1', name: null });
    expect(items[2]).toMatchObject({ type: 'run', text: ' of ' });
    expect(items[3]).toMatchObject({ type: 'field', fieldType: 'NUMPAGES', cachedText: '7' });
    expect(items[4]).toMatchObject({ type: 'field', fieldType: 'DOCPROPERTY', name: 'docNumber', cachedText: 'SOP-001' });
    expect(items[5]).toMatchObject({ type: 'run', text: 'link text' });
    expect(items[6]).toMatchObject({ type: 'field', fieldType: 'SEQ', name: 'Figure', cachedText: '3' });
    expect(losses.map((l) => l.code)).toEqual(['field-unsupported']);
  });
});

describe('importDocx: revisions', () => {
  it('maps w:ins and w:del to run revisions', async () => {
    const body = `<w:p><w:ins w:id="1" w:author="Ann" w:date="2026-01-02T10:00:00Z"><w:r><w:t>added</w:t></w:r></w:ins>
      <w:del w:id="2" w:author="Bob" w:date="2026-01-03T10:00:00Z"><w:r><w:delText>removed</w:delText></w:r></w:del></w:p>`;
    const { ir } = await importDocx(makeDocx(pkg(body)));
    const runs = runsOf(paragraphs(ir.sections[0].body)[0]);
    expect(runs[0].revision).toEqual({ kind: 'insert', id: '1', author: 'Ann', at: '2026-01-02T10:00:00Z' });
    expect(runs[1].text).toBe('removed');
    expect(runs[1].revision).toEqual({ kind: 'delete', id: '2', author: 'Bob', at: '2026-01-03T10:00:00Z' });
  });
});

describe('importDocx: tables', () => {
  it('maps grid, spans, merges, header row, borders and shading', async () => {
    const body = `<w:tbl>
      <w:tblPr><w:tblStyle w:val="Grid"/><w:tblW w:w="9000" w:type="dxa"/>
        <w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>
      <w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid>
      <w:tr><w:trPr><w:tblHeader/><w:cantSplit/><w:trHeight w:val="500"/></w:trPr>
        <w:tc><w:tcPr><w:tcW w:w="6000" w:type="dxa"/><w:gridSpan w:val="2"/>
          <w:tcBorders><w:top w:val="single" w:sz="12" w:color="FF0000"/><w:bottom w:val="nil"/></w:tcBorders>
          <w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:r><w:t>Wide</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:vMerge w:val="restart"/></w:tcPr><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>c</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>d</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p/></w:tc>
      </w:tr></w:tbl>`;
    const { ir, losses } = await importDocx(makeDocx(pkg(body)));
    expect(losses).toEqual([]);
    const table = ir.sections[0].body[0] as IRTable;
    expect(table.type).toBe('table');
    expect(table.grid).toEqual([3000, 3000, 3000]);
    expect(table.props).toMatchObject({
      styleId: 'Grid',
      widthMode: 'fixed',
      widthValue: 9000,
      look: { headerRow: true, lastRow: false, firstColumn: true, bandedRows: true },
    });
    expect(table.rows[0].props).toEqual({ isHeader: true, cantSplit: true, heightTwips: 500 });
    const first = table.rows[0].cells[0];
    expect(first.props).toMatchObject({
      gridSpan: 2,
      widthTwips: 6000,
      shading: '#D9D9D9',
      vAlign: 'center',
      borders: { top: { style: 'single', sizePt: 1.5, color: '#FF0000' }, right: null, bottom: null, left: null },
    });
    expect(table.rows[0].cells[1].props.vMerge).toBe('restart');
    expect(table.rows[1].cells[2].props.vMerge).toBe('continue');
    expect(table.rows[1].cells[2].blocks).toEqual([]);
  });
});

describe('importDocx: content controls', () => {
  it('maps tagged block sdt to IRSdt and flattens untagged ones', async () => {
    const body = `<w:sdt><w:sdtPr><w:alias w:val="Purpose"/><w:tag w:val="sec-purpose"/><w:lock w:val="sdtLocked"/></w:sdtPr>
      <w:sdtContent><w:p><w:r><w:t>Body</w:t></w:r></w:p></w:sdtContent></w:sdt>
      <w:sdt><w:sdtPr/><w:sdtContent><w:p><w:r><w:t>Plain</w:t></w:r></w:p></w:sdtContent></w:sdt>`;
    const { ir } = await importDocx(makeDocx(pkg(body)));
    const [sdt, plain] = ir.sections[0].body;
    expect(sdt.type).toBe('sdt');
    if (sdt.type !== 'sdt') throw new Error('expected sdt');
    expect(sdt).toMatchObject({ tag: 'sec-purpose', alias: 'Purpose', lock: 'sdtLocked' });
    expect(textOfP(sdt.blocks[0] as IRParagraph)).toBe('Body');
    expect(textOfP(plain as IRParagraph)).toBe('Plain');
  });
});

describe('importDocx: sections, headers and footers', () => {
  it('splits sections at sectPr paragraphs and resolves header parts', async () => {
    const body = `<w:p><w:pPr><w:sectPr>
        <w:headerReference w:type="default" r:id="rIdH1"/><w:footerReference w:type="default" r:id="rIdF1"/>
        <w:pgSz w:w="11906" w:h="16838"/>
        <w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="500" w:footer="500" w:gutter="0"/>
        <w:cols w:num="2" w:space="360"/></w:sectPr></w:pPr><w:r><w:t>Sec1</w:t></w:r></w:p>
      <w:p><w:r><w:t>Sec2</w:t></w:r></w:p>
      <w:sectPr><w:headerReference w:type="first" r:id="rIdH2"/>
        <w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>
        <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
        <w:titlePg/></w:sectPr>`;
    const headerPart = `${HEADER}<w:hdr ${NS}><w:p><w:r><w:t>Header A</w:t></w:r></w:p></w:hdr>`;
    const footerPart = `${HEADER}<w:ftr ${NS}><w:p><w:r><w:t>Footer B</w:t></w:r></w:p></w:ftr>`;
    const firstPart = `${HEADER}<w:hdr ${NS}><w:p><w:r><w:t>First page</w:t></w:r></w:p></w:hdr>`;
    const bytes = makeDocx(
      pkg(body, { 'word/header1.xml': headerPart, 'word/footer1.xml': footerPart, 'word/header2.xml': firstPart }, [
        ['rIdH1', REL_TYPES.header, 'header1.xml'],
        ['rIdF1', REL_TYPES.footer, 'footer1.xml'],
        ['rIdH2', REL_TYPES.header, 'header2.xml'],
      ]),
    );
    const { ir } = await importDocx(bytes);
    expect(ir.sections).toHaveLength(2);

    const [s1, s2] = ir.sections;
    expect(s1.pageSetup.orientation).toBe('portrait');
    expect(s1.pageSetup.size).toEqual({ widthTwips: 11906, heightTwips: 16838 });
    expect(s1.pageSetup.margins.top).toBe(1000);
    expect(s1.pageSetup.columns).toEqual({ count: 2, spaceTwips: 360 });
    expect(textOfP(s1.headers?.default?.[0] as IRParagraph)).toBe('Header A');
    expect(textOfP(s1.footers?.default?.[0] as IRParagraph)).toBe('Footer B');

    expect(s2.pageSetup.orientation).toBe('landscape');
    expect(s2.pageSetup.size).toEqual({ widthTwips: 16838, heightTwips: 11906 });
    expect(s2.titlePage).toBe(true);
    expect(textOfP(s2.headers?.first?.[0] as IRParagraph)).toBe('First page');
    expect(textOfP(s2.headers?.default?.[0] as IRParagraph)).toBe('Header A');
  });
});

describe('importDocx: images', () => {
  it('turns a standalone picture into an image block with a data URI', async () => {
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const body = `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="1270000" cy="635000"/><wp:docPr id="1" name="Picture 1" descr="Logo"/>
        <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic><pic:blipFill><a:blip r:embed="rIdImg1"/></pic:blipFill></pic:pic>
        </a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    const bytes = makeDocx(
      pkg(body, {}, [['rIdImg1', REL_TYPES.image, 'media/image1.png']]),
      { 'word/media/image1.png': png },
    );
    const { ir, losses } = await importDocx(bytes);
    expect(losses).toEqual([]);
    const block = ir.sections[0].body[0];
    expect(block.type).toBe('image');
    if (block.type !== 'image') throw new Error('expected image');
    expect(block.src.startsWith('data:image/png;base64,')).toBe(true);
    expect(atob(block.src.split(',')[1])).toBe(String.fromCharCode(...png));
    expect(block.widthPt).toBe(100);
    expect(block.heightPt).toBe(50);
    expect(block.alt).toBe('Logo');
  });

  it('keeps floating pictures as inline images and reports the conversion', async () => {
    const body = `<w:p><w:r><w:drawing><wp:anchor><wp:extent cx="12700" cy="12700"/><wp:docPr id="2" name="Float"/>
        <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic><pic:blipFill><a:blip r:embed="rIdImg1"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>
        <w:r><w:t>Text</w:t></w:r></w:p>`;
    const bytes = makeDocx(pkg(body, {}, [['rIdImg1', REL_TYPES.image, 'media/a.gif']]), { 'word/media/a.gif': Uint8Array.from([71, 73, 70]) });
    const { ir, losses } = await importDocx(bytes);
    expect(losses.map((l) => l.code)).toEqual(['float-converted']);
    // Images in a paragraph with text follow that paragraph as image blocks.
    expect(textOfP(ir.sections[0].body[0] as IRParagraph)).toBe('Text');
    expect(ir.sections[0].body[1].type).toBe('image');
    expect((ir.sections[0].body[1] as { src: string }).src.startsWith('data:image/gif;base64,')).toBe(true);
  });
});

describe('importDocx: passthrough and losses', () => {
  const smartArt = `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="2540000" cy="1270000"/><wp:docPr id="3" name="Diagram 1"/>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram">
        <dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" r:dm="rIdDm"/>
      </a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

  it('preserves SmartArt as a passthrough block with a loss report', async () => {
    const { ir, losses } = await importDocx(makeDocx(pkg(`${smartArt}<w:p><w:r><w:t>After</w:t></w:r></w:p>`)));
    expect(losses.map((l) => l.code)).toEqual(['smartart-passthrough']);
    const pt = ir.sections[0].body[0];
    expect(pt.type).toBe('passthrough');
    if (pt.type !== 'passthrough') throw new Error('expected passthrough');
    expect(pt.xml).toContain('drawingml/2006/diagram');
    expect(pt.xml).toContain('xmlns:wp=');
    expect(pt.source?.blockType).toBe('ooxmlPassthrough');
    expect(textOfP(ir.sections[0].body[1] as IRParagraph)).toBe('After');
  });

  it('converts passthrough blocks to ooxmlPassthrough document blocks', async () => {
    const { ir } = await importDocx(makeDocx(pkg(smartArt)));
    const document = irToDocument(ir);
    const block = document.sections[0].blocks[0];
    expect(block.type).toBe('ooxmlPassthrough');
    expect(String(block.props.xml)).toContain('drawingml/2006/diagram');
    expect(block.props.preview).toBe('');
  });

  it('prefers the AlternateContent fallback text as the preview', async () => {
    const body = `<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps">
        <w:drawing><wp:inline><wp:extent cx="1" cy="1"/><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp/></a:graphicData></a:graphic></wp:inline></w:drawing>
      </mc:Choice><mc:Fallback><w:pict><v:shape><v:textbox><w:txbxContent><w:p><w:r><w:t>Callout text</w:t></w:r></w:p></w:txbxContent></v:textbox></v:shape></w:pict></mc:Fallback>
      </mc:AlternateContent></w:r></w:p>`;
    const { ir, losses } = await importDocx(makeDocx(pkg(body)));
    expect(losses.map((l) => l.code)).toEqual(['alternate-content']);
    const pt = ir.sections[0].body[0];
    expect(pt.type).toBe('passthrough');
    if (pt.type !== 'passthrough') throw new Error('expected passthrough');
    expect(pt.preview).toBe('Callout text');
  });

  it('reports VML and footnote references, and keeps unknown block elements', async () => {
    const body = `<w:p><w:r><w:pict><v:shape/></w:pict></w:r><w:r><w:footnoteReference w:id="1"/></w:r></w:p>
      <w:customThing><w:foo>keep me</w:foo></w:customThing>`;
    const { ir, losses } = await importDocx(makeDocx(pkg(body)));
    expect(losses.map((l) => l.code).sort()).toEqual(['footnote-ref', 'unknown-block', 'vml-passthrough'].sort());
    const p = paragraphs(ir.sections[0].body)[0];
    expect(p.runs.some((r) => r.type === 'footnoteRef' && r.id === '1')).toBe(true);
    expect(ir.sections[0].body[1].type).toBe('passthrough');
  });

  it('drops passthrough blocks when keepPassthrough is false but still reports losses', async () => {
    const { ir, losses } = await importDocx(makeDocx(pkg(smartArt)), { keepPassthrough: false });
    expect(ir.sections[0].body.some((b) => b.type === 'passthrough')).toBe(false);
    expect(losses.map((l) => l.code)).toEqual(['smartart-passthrough']);
  });
});

describe('importDocx: document properties', () => {
  it('reads core and custom properties', async () => {
    const core = `${HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title>SOP Title</dc:title><cp:revision>3</cp:revision></cp:coreProperties>`;
    const custom = `${HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
      <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="docNumber"><vt:lpwstr>SOP-042</vt:lpwstr></property>
      <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="3" name="lab"><vt:lpwstr>Virology</vt:lpwstr></property>
      <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="4" name="site"><vt:lpwstr>North</vt:lpwstr></property>
    </Properties>`;
    const bytes = makeDocx(pkg('<w:p/>', { 'docProps/core.xml': core, 'docProps/custom.xml': custom }));
    const { ir } = await importDocx(bytes);
    expect(ir.properties).toEqual({ title: 'SOP Title', revision: '3', docNumber: 'SOP-042', lab: 'Virology', custom: { site: 'North' } });
  });
});

describe('importDocx: robustness', () => {
  it('rejects input that is not a DOCX package', async () => {
    await expect(importDocx(strToU8('not a zip'))).rejects.toThrow();
    await expect(importDocx(makeDocx({ 'other.xml': '<x/>' }))).rejects.toThrow(/word\/document.xml/);
  });

  it('reports malformed header parts without throwing', async () => {
    const body = '<w:p><w:r><w:t>ok</w:t></w:r></w:p><w:sectPr><w:headerReference w:type="default" r:id="rIdH"/></w:sectPr>';
    const bytes = makeDocx(pkg(body, { 'word/header9.xml': '<w:hdr><broken' }, [['rIdH', REL_TYPES.header, 'header9.xml']]));
    const { ir, losses } = await importDocx(bytes);
    expect(ir.sections[0].headers).toBeUndefined();
    expect(losses.map((l) => l.code)).toEqual(['part-parse-error']);
  });
});

describe('ooxmlPassthroughExtension', () => {
  it('registers an office, non-editable block and a preview node view', () => {
    const ext = ooxmlPassthroughExtension();
    expect(ext.name).toBe('ooxmlPassthrough');
    expect(ext.nodes?.ooxmlPassthrough.atom).toBe(true);
    const def = ext.blocks?.[0];
    expect(def).toMatchObject({ type: 'ooxmlPassthrough', family: 'office' });
    expect(def?.capabilities.editable).toBe(false);

    const make = ext.nodeViews?.ooxmlPassthrough;
    if (!make) throw new Error('missing node view');
    const node = {
      type: { name: 'ooxmlPassthrough' },
      attrs: { id: 'pt-1', xml: '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram"/>', preview: 'Step one' },
    };
    const view = make(node as never, {} as never, () => 0, [] as never, [] as never) as { dom: HTMLElement };
    expect(view.dom.textContent).toContain('Preserved Word content (SmartArt)');
    expect(view.dom.textContent).toContain('Step one');
  });
});
