/**
 * Office paste normalisation tests. Fixtures are modelled on the clipboard
 * HTML Word 2016+ and Excel emit (mso-* inline styles, conditional list
 * markers, `colgroup`-less Excel tables with `width`/`height` attributes).
 */
import { describe, expect, it } from 'vitest';
import { DOMParser as PMDOMParser } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { TableMap } from 'prosemirror-tables';
import { createSchema } from '../schema';
import {
  createOfficePastePlugin,
  cssLengthToPt,
  isOfficeHtml,
  normaliseOfficeHtml,
} from './officePaste';

const schema = createSchema();

const WORD_FIXTURE = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"><head>
<meta name=ProgId content=Word.Document><style><!-- p.MsoNormal {margin:0cm;font-size:11.0pt;} --></style></head>
<body lang=EN-US><!--StartFragment-->
<p class=MsoHeading1><span lang=EN-US style='font-size:16.0pt;mso-bidi-font-size:14.0pt'>Quality Procedure<o:p></o:p></span></p>
<p class=MsoListParagraphCxSpFirst style='text-indent:-18.0pt;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='font-family:Symbol;mso-fareast-font-family:Symbol'><span style='mso-list:Ignore'>&middot;<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;</span></span></span><![endif]>First bullet<o:p></o:p></p>
<p class=MsoListParagraphCxSpLast style='text-indent:-18.0pt;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='mso-list:Ignore'>&middot;<span>&nbsp;&nbsp;</span></span><![endif]>Second bullet<o:p></o:p></p>
<p class=MsoListParagraphCxSpFirst style='text-indent:-18.0pt;mso-list:l1 level1 lfo2'><![if !supportLists]><span style='mso-list:Ignore'>1.<span>&nbsp;&nbsp;</span></span><![endif]>Step one<o:p></o:p></p>
<p class=MsoListParagraphCxSpLast style='text-indent:-18.0pt;mso-list:l1 level1 lfo2'><![if !supportLists]><span style='mso-list:Ignore'>2.<span>&nbsp;&nbsp;</span></span><![endif]>Step two<o:p></o:p></p>
<p class=MsoNormal><b><span style='font-size:11.0pt;font-family:"Calibri",sans-serif'>Bold</span></b><span style='mso-spacerun:yes'>&nbsp;</span>plain text</p>
<table class=MsoTableGrid border=1 cellspacing=0 cellpadding=0 style='border-collapse:collapse;border:none;mso-border-alt:solid windowtext .5pt;mso-yfti-tbllook:1184;mso-padding-alt:0cm 5.4pt 0cm 5.4pt'>
 <tr style='mso-yfti-irow:0;mso-yfti-firstrow:yes;height:24.0pt'>
  <td width=288 colspan=2 valign=top style='width:216.0pt;border:solid windowtext 1.0pt;background:#D9E2F3;mso-background-themecolor:accent1;mso-background-themetint:20%;padding:0cm 5.4pt 0cm 5.4pt;height:24.0pt'>
  <p class=MsoNormal align=center style='text-align:center'><b>Head A</b><o:p></o:p></p></td>
  <td width=144 valign=top style='width:108.0pt;border:solid windowtext 1.0pt;padding:0cm 5.4pt 0cm 5.4pt'><p class=MsoNormal>Head B</p></td>
 </tr>
 <tr style='mso-yfti-irow:1;height:20pt'>
  <td width=144 rowspan=2 style='width:108.0pt;border:solid windowtext 1.0pt;border-top:none;mso-border-top-alt:solid windowtext .5pt'><p class=MsoNormal>Merged</p></td>
  <td width=144 style='width:108.0pt;border:solid windowtext 1.0pt'><p class=MsoNormal>x</p></td>
  <td width=144 style='width:108.0pt;border:solid windowtext 1.0pt'><p class=MsoNormal>y</p></td>
 </tr>
 <tr style='mso-yfti-irow:2;height:20pt'>
  <td width=144 style='width:108.0pt;border:solid windowtext 1.0pt'><p class=MsoNormal>z</p></td>
  <td width=144 style='width:108.0pt;border:solid windowtext 1.0pt'><p class=MsoNormal>w</p></td>
 </tr>
</table>
<p class=MsoNormal><o:p>&nbsp;</o:p></p>
<!--EndFragment--></body></html>`;

const EXCEL_FIXTURE = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta name=ProgId content=Excel.Sheet></head><body>
<!--StartFragment--><table border=0 cellpadding=0 cellspacing=0 width=400 style='border-collapse:collapse;table-layout:fixed;width:300pt'>
<col width=128 span=2 style='mso-width-source:userset;mso-width-alt:4681;width:96pt'>
<col width=144 style='mso-width-source:userset;width:108pt'>
<tr height=20 style='mso-height-source:userset;height:15.0pt'>
  <td height=20 class=xl65 width=128 style='height:15.0pt;width:96pt;background:#FFCC00;mso-pattern:black none'>Name</td>
  <td class=xl65 width=128 style='width:96pt;font-weight:700'>Qty</td>
  <td class=xl65 width=144 style='width:108pt'>Total</td>
</tr>
<tr height=20 style='height:15.0pt'>
  <td height=20 colspan=2 style='height:15.0pt;mso-ignore:colspan'>Merged</td>
  <td align=right x:num>9</td>
</tr>
</table><!--EndFragment--></body></html>`;

/** First node of `type` in document order. */
function findNode(doc: import('prosemirror-model').Node, type: string): import('prosemirror-model').Node {
  let found: import('prosemirror-model').Node | null = null;
  doc.descendants((n) => {
    if (!found && n.type.name === type) found = n;
    return !found;
  });
  if (!found) throw new Error(`no ${type}`);
  return found;
}

function parse(html: string) {
  const dom = new DOMParser().parseFromString(html, 'text/html').body;
  return dom;
}

describe('detection and units', () => {
  it('detects Word and Excel clipboard HTML and ignores plain HTML', () => {
    expect(isOfficeHtml(WORD_FIXTURE)).toBe(true);
    expect(isOfficeHtml(EXCEL_FIXTURE)).toBe(true);
    expect(isOfficeHtml('<p>Hello</p>')).toBe(false);
  });

  it('converts CSS lengths to points', () => {
    expect(cssLengthToPt('12pt')).toBe(12);
    expect(cssLengthToPt('16px')).toBe(12);
    expect(cssLengthToPt('1in')).toBe(72);
    expect(cssLengthToPt('50%')).toBeNull();
    expect(cssLengthToPt(null)).toBeNull();
  });
});

describe('Word fixture', () => {
  const out = normaliseOfficeHtml(WORD_FIXTURE);
  const dom = parse(out);

  it('leaves no mso styles, style attributes or Office elements behind', () => {
    expect(out).not.toMatch(/mso-/);
    expect(out).not.toMatch(/style=/);
    expect(out).not.toMatch(/<o:/i);
    expect(out).not.toMatch(/<!\[/);
    expect(out).not.toMatch(/<style/i);
  });

  it('maps MsoHeading1 to a level 1 heading with the Heading1 style', () => {
    const h1 = dom.querySelector('h1');
    expect(h1?.textContent).toBe('Quality Procedure');
    expect(h1?.getAttribute('data-style-id')).toBe('Heading1');
  });

  it('builds real lists from mso-list paragraphs, bullets and numbers', () => {
    const lists = dom.querySelectorAll('ul, ol');
    expect(lists.length).toBe(2);
    expect(dom.querySelector('ul')!.tagName).toBe('UL');
    expect(dom.querySelector('ul > li')!.textContent).toBe('First bullet');
    expect(dom.querySelectorAll('ul > li').length).toBe(2);
    expect(dom.querySelector('ol')!.querySelectorAll('li').length).toBe(2);
    expect(dom.querySelector('ol > li')!.textContent).toBe('Step one');
  });

  it('keeps bold as a strong element', () => {
    expect(dom.querySelector('b, strong')?.textContent).toBe('Bold');
  });

  it('converts table widths, merges and shading into data attributes', () => {
    const table = dom.querySelector('table')!;
    expect(table.getAttribute('data-width-mode')).toBeNull();
    const headA = [...dom.querySelectorAll('th, td')].find((c) => c.textContent!.trim() === 'Head A')!;
    expect(headA.getAttribute('colspan')).toBe('2');
    expect(headA.getAttribute('data-colwidth')).toBe('144,144');
    expect(headA.getAttribute('data-width-twips')).toBe('4320');
    expect(headA.getAttribute('data-shading')).toBe('#d9e2f3');
    expect(headA.getAttribute('data-halign')).toBeNull(); // paragraph align stays on the inner <p>
    expect(headA.getAttribute('data-valign')).toBe('top');
    expect(JSON.parse(headA.getAttribute('data-borders')!).top).toEqual({ style: 'solid', sizePt: 1, color: '#000000' });
    expect(JSON.parse(headA.getAttribute('data-padding')!)).toEqual({ topPt: 0, rightPt: 5.4, bottomPt: 0, leftPt: 5.4 });
  });

  it('places cells under a rowspan in the correct grid column', () => {
    const rows = [...dom.querySelectorAll('tr')];
    const cellsRow2 = rows[2]!.querySelectorAll('td');
    // row 2 has only two own cells: the merged cell above covers column 0
    expect(cellsRow2.length).toBe(2);
    expect(cellsRow2[0]!.textContent).toBe('z');
    expect(rows[1]!.querySelector('td')!.getAttribute('rowspan')).toBe('2');
    // Through the schema the grid is 3 columns wide and every row is covered.
    const parsed = PMDOMParser.fromSchema(schema).parse(parse(out));
    const tbl = findNode(parsed, 'table');
    expect(TableMap.get(tbl).width).toBe(3);
    expect(TableMap.get(tbl).problems).toBeFalsy();
  });

  it('parses through the schema into table nodes with Office attrs', () => {
    const parsed = PMDOMParser.fromSchema(schema).parse(parse(out));
    let headCell: import('prosemirror-model').Node | null = null;
    parsed.descendants((node) => {
      if (node.type.name === 'tableCell' && node.textContent.trim() === 'Head A') headCell = node;
      return true;
    });
    expect(headCell).not.toBeNull();
    expect(headCell!.attrs.colspan).toBe(2);
    expect(headCell!.attrs.shading).toBe('#d9e2f3');
    expect(headCell!.attrs.widthTwips).toBe(4320);
    const h1 = parsed.firstChild!;
    expect(h1.type.name).toBe('heading');
    expect(h1.attrs.styleId).toBe('Heading1');
  });
});

describe('Excel fixture', () => {
  const out = normaliseOfficeHtml(EXCEL_FIXTURE);
  const dom = parse(out);

  it('reads the table width in points into twips', () => {
    const table = dom.querySelector('table')!;
    expect(table.getAttribute('data-width-mode')).toBe('fixed');
    expect(table.getAttribute('data-width-value')).toBe('6000');
  });

  it('takes column widths from the first row and col elements', () => {
    const first = dom.querySelector('td')!;
    expect(first.getAttribute('data-colwidth')).toBe('128');
    expect(first.getAttribute('data-shading')).toBe('#ffcc00');
  });

  it('keeps colspan from merged cells and uses the summed column width', () => {
    const merged = [...dom.querySelectorAll('td')].find((c) => c.textContent!.trim() === 'Merged')!;
    expect(merged.getAttribute('colspan')).toBe('2');
    expect(merged.getAttribute('data-colwidth')).toBe('128,128');
  });

  it('reads row height in twips', () => {
    expect(dom.querySelector('tr')!.getAttribute('data-height-twips')).toBe('300');
    // Excel first rows use td, so they are not treated as repeating headers.
    expect(dom.querySelector('tr')!.getAttribute('data-is-header')).toBeNull();
  });

  it('removes the inline font-weight style and keeps the text', () => {
    expect(out).not.toMatch(/font-weight/);
    expect(dom.textContent).toContain('Qty');
  });
});

describe('plugin', () => {
  it('transforms only Office HTML', () => {
    const plugin = createOfficePastePlugin();
    const transform = plugin.spec.props!.transformPastedHTML as (html: string) => string;
    expect(transform('<p>plain</p>')).toBe('<p>plain</p>');
    expect(transform(EXCEL_FIXTURE)).not.toMatch(/mso-|style=/);
  });

  it('is a valid plugin for an editor state', () => {
    const state = EditorState.create({ schema, plugins: [createOfficePastePlugin()] });
    expect(state.plugins.length).toBe(1);
  });
});
