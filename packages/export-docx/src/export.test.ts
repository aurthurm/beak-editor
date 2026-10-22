import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { documentToIR } from '@amusendame/beakblock-ir';
import type { IRBlock, IRDocument, IRInline, IRSection } from '@amusendame/beakblock-ir';
import { blocksToDocument, richSopBlocks, richSopBlocksWithSections } from '@amusendame/beakblock-schema';

import {
  DOCX_MIME,
  exportDocx,
  exportDocxBlob,
  exportDocxWithReport,
  irToDocumentXml,
} from './index';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** A 1x1 transparent PNG. */
const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function parse(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(`XML is not well formed: ${xml.slice(0, 200)}`);
  }
  return doc;
}

function fixtureIR(): IRDocument {
  return documentToIR(blocksToDocument(richSopBlocks));
}

function fixtureIRWithSections(): IRDocument {
  return documentToIR(blocksToDocument(richSopBlocksWithSections));
}

/** Replaces the body of the first section of the rich fixture with custom blocks. */
function irWithBody(body: IRBlock[], overrides: Partial<IRDocument> = {}): IRDocument {
  const base = fixtureIR();
  return { ...base, ...overrides, sections: [{ ...base.sections[0], body }] };
}

function paragraph(text: string): IRBlock {
  return { type: 'paragraph', props: {}, runs: [{ type: 'run', text, props: {} }] };
}

function unzip(bytes: Uint8Array): Record<string, Uint8Array> {
  return unzipSync(bytes);
}

function text(bytes: Uint8Array, path: string): string {
  const files = unzip(bytes);
  const entry = files[path];
  if (!entry) throw new Error(`missing part ${path}`);
  return strFromU8(entry);
}

describe('exportDocx package structure', () => {
  it('writes every required part with the correct content types', async () => {
    const bytes = await exportDocx(fixtureIR());
    const files = unzip(bytes);
    const required = [
      '[Content_Types].xml',
      '_rels/.rels',
      'docProps/core.xml',
      'docProps/app.xml',
      'docProps/custom.xml',
      'word/document.xml',
      'word/styles.xml',
      'word/numbering.xml',
      'word/settings.xml',
      'word/fontTable.xml',
      'word/_rels/document.xml.rels',
    ];
    for (const path of required) expect(files[path], path).toBeDefined();

    const types = parse(strFromU8(files['[Content_Types].xml']));
    const overrides = [...types.getElementsByTagName('Override')].map((node) => [
      node.getAttribute('PartName'),
      node.getAttribute('ContentType'),
    ]);
    expect(overrides).toContainEqual([
      '/word/document.xml',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    ]);
    expect(overrides).toContainEqual([
      '/word/styles.xml',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml',
    ]);
    expect(overrides).toContainEqual([
      '/docProps/custom.xml',
      'application/vnd.openxmlformats-officedocument.custom-properties+xml',
    ]);
  });

  it('produces well-formed XML for every part', async () => {
    const files = unzip(await exportDocx(fixtureIRWithSections()));
    for (const [path, data] of Object.entries(files)) {
      if (!path.endsWith('.xml') && !path.endsWith('.rels')) continue;
      expect(() => parse(strFromU8(data)), path).not.toThrow();
    }
  });

  it('exports a Blob with the DOCX MIME type', async () => {
    const blob = await exportDocxBlob(fixtureIR());
    expect(blob.type).toBe(DOCX_MIME);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('relates the document to its styles, numbering, settings and font table parts', async () => {
    const rels = parse(text(await exportDocx(fixtureIR()), 'word/_rels/document.xml.rels'));
    const types = [...rels.getElementsByTagName('Relationship')].map((node) => node.getAttribute('Type') ?? '');
    for (const kind of ['styles', 'numbering', 'settings', 'fontTable']) {
      expect(types.some((type) => type.endsWith(`/relationships/${kind}`)), kind).toBe(true);
    }
    const targets = [...rels.getElementsByTagName('Relationship')].map((node) => node.getAttribute('Target'));
    expect(targets).toContain('styles.xml');
  });

  it('is byte-identical across two exports', async () => {
    const ir = fixtureIRWithSections();
    const first = await exportDocx(ir);
    const second = await exportDocx(ir);
    expect(Array.from(second)).toEqual(Array.from(first));
  });
});

describe('styles and numbering', () => {
  it('declares Heading1 based on Normal with heading 1 built-in name', async () => {
    const styles = parse(text(await exportDocx(fixtureIR()), 'word/styles.xml'));
    const heading = [...styles.getElementsByTagNameNS(W, 'style')].find(
      (node) => node.getAttributeNS(W, 'styleId') === 'Heading1'
    );
    expect(heading).toBeDefined();
    expect(heading?.getElementsByTagNameNS(W, 'basedOn')[0]?.getAttributeNS(W, 'val')).toBe('Normal');
    expect(heading?.getElementsByTagNameNS(W, 'name')[0]?.getAttributeNS(W, 'val')).toBe('heading 1');
  });

  it('writes spacing in twips and maps fonts through the default font map', async () => {
    const xml = text(await exportDocx(fixtureIR()), 'word/styles.xml');
    expect(xml).toContain('w:after="160"');
    expect(xml).toContain('w:ascii="Calibri"');
    expect(xml).not.toContain('w:ascii="Carlito"');
  });

  it('honours a custom font map', async () => {
    const xml = text(
      await exportDocx(fixtureIR(), { fontMap: { Carlito: 'Source Sans Pro' } }),
      'word/styles.xml'
    );
    expect(xml).toContain('w:ascii="Source Sans Pro"');
  });

  it('writes abstract numbering for lists and references it from list paragraphs', async () => {
    const bytes = await exportDocx(fixtureIR());
    const numbering = parse(text(bytes, 'word/numbering.xml'));
    const levels = numbering.getElementsByTagNameNS(W, 'lvl');
    expect(levels.length).toBeGreaterThan(0);
    const bulletFormats = [...numbering.getElementsByTagNameNS(W, 'numFmt')].map((node) =>
      node.getAttributeNS(W, 'val')
    );
    expect(bulletFormats).toContain('bullet');
    expect(bulletFormats).toContain('decimal');

    const document = parse(text(bytes, 'word/document.xml'));
    const numIds = [...document.getElementsByTagNameNS(W, 'numId')].map((node) => node.getAttributeNS(W, 'val'));
    expect(numIds.length).toBeGreaterThan(0);
    const definedNums = [...numbering.getElementsByTagNameNS(W, 'num')].map((node) =>
      node.getAttributeNS(W, 'numId')
    );
    for (const id of numIds) expect(definedNums).toContain(id);
  });
});

describe('body mapping', () => {
  it('encodes fields as complex fields with cached text', async () => {
    const xml = irToDocumentXml(fixtureIR());
    const document = parse(xml);
    const begins = [...document.getElementsByTagNameNS(W, 'fldChar')].filter(
      (node) => node.getAttributeNS(W, 'fldCharType') === 'begin'
    ).length;
    const ends = [...document.getElementsByTagNameNS(W, 'fldChar')].filter(
      (node) => node.getAttributeNS(W, 'fldCharType') === 'end'
    ).length;
    expect(begins).toBeGreaterThan(0);
    expect(begins).toBe(ends);
    expect(xml).toContain('DOCPROPERTY docNumber');
    expect(xml).toContain('<w:instrText xml:space="preserve"> PAGE </w:instrText>');
    expect(xml).toContain('NUMPAGES');
  });

  it('writes tracked insertions with author and date', () => {
    const xml = irToDocumentXml(fixtureIR());
    const document = parse(xml);
    const ins = document.getElementsByTagNameNS(W, 'ins');
    expect(ins.length).toBeGreaterThan(0);
    expect(ins[0].getAttributeNS(W, 'author')).toBe('Asha');
    expect(ins[0].getAttributeNS(W, 'date')).toBe('2026-01-02T10:00:00Z');
    expect(ins[0].getAttributeNS(W, 'id')).toMatch(/^\d+$/);
  });

  it('writes deleted text as w:delText inside w:del', () => {
    const ir = irWithBody([
      {
        type: 'paragraph',
        props: {},
        runs: [
          { type: 'run', text: 'gone', props: {}, revision: { kind: 'delete', id: 'rev-d', author: 'Ben', at: '2026-02-01T00:00:00.000Z' } },
        ],
      },
    ]);
    const document = parse(irToDocumentXml(ir));
    const del = document.getElementsByTagNameNS(W, 'del')[0];
    expect(del).toBeDefined();
    expect(del.getElementsByTagNameNS(W, 'delText')[0].textContent).toBe('gone');
    expect(document.getElementsByTagNameNS(W, 't').length).toBe(0);
  });

  it('writes table grid, gridSpan, vMerge, header row, borders and shading', () => {
    const cell = (text: string, props: Record<string, unknown>) => ({
      props: { gridSpan: 1, ...props },
      blocks: [paragraph(text)],
    });
    const ir = irWithBody([
      {
        type: 'table',
        props: { widthMode: 'fixed', widthValue: 9000, look: { headerRow: true } },
        grid: [3000, 3000, 3000],
        rows: [
          {
            props: { isHeader: true, cantSplit: true, heightTwips: 400 },
            cells: [
              cell('a', { gridSpan: 2, widthTwips: 6000, shading: '#D9E2F3', borders: { top: { style: 'single', sizePt: 1, color: '#000000' }, bottom: null } }),
              cell('b', { widthTwips: 3000, vMerge: 'restart', vAlign: 'center' }),
            ],
          },
          {
            props: {},
            cells: [cell('c', { widthTwips: 3000 }), cell('d', { widthTwips: 3000, vMerge: 'continue' })],
          },
        ],
      },
    ] as IRBlock[]);
    const xml = irToDocumentXml(ir);
    const document = parse(xml);
    const gridCols = [...document.getElementsByTagNameNS(W, 'gridCol')].map((node) => node.getAttributeNS(W, 'w'));
    expect(gridCols).toEqual(['3000', '3000', '3000']);
    expect(document.getElementsByTagNameNS(W, 'gridSpan')[0].getAttributeNS(W, 'val')).toBe('2');
    const vMerge = [...document.getElementsByTagNameNS(W, 'vMerge')];
    expect(vMerge.map((node) => node.getAttributeNS(W, 'val'))).toEqual(['restart', null]);
    expect(document.getElementsByTagNameNS(W, 'tblHeader').length).toBe(1);
    expect(document.getElementsByTagNameNS(W, 'cantSplit').length).toBe(1);
    expect(document.getElementsByTagNameNS(W, 'trHeight')[0].getAttributeNS(W, 'val')).toBe('400');
    const top = document.getElementsByTagNameNS(W, 'tcBorders')[0].getElementsByTagNameNS(W, 'top')[0];
    expect(top.getAttributeNS(W, 'val')).toBe('single');
    expect(top.getAttributeNS(W, 'color')).toBe('000000');
    const bottom = document.getElementsByTagNameNS(W, 'tcBorders')[0].getElementsByTagNameNS(W, 'bottom')[0];
    expect(bottom.getAttributeNS(W, 'val')).toBe('nil');
    const shd = document.getElementsByTagNameNS(W, 'shd');
    expect(shd[0].getAttributeNS(W, 'fill')).toBe('D9E2F3');
    expect(document.getElementsByTagNameNS(W, 'tblLayout')[0].getAttributeNS(W, 'type')).toBe('fixed');
    // Every cell ends with a paragraph.
    for (const tc of [...document.getElementsByTagNameNS(W, 'tc')]) {
      const last = tc.lastElementChild;
      expect(last?.localName).toBe('p');
    }
  });

  it('wraps controlled sections in w:sdt tagged with the section id', () => {
    const document = parse(irToDocumentXml(fixtureIR()));
    const sdt = [...document.getElementsByTagNameNS(W, 'sdt')].find((node) =>
      [...node.getElementsByTagNameNS(W, 'tag')].some((tag) => tag.getAttributeNS(W, 'val') === 'sec-scope-1')
    );
    expect(sdt).toBeDefined();
    expect(sdt?.getElementsByTagNameNS(W, 'alias')[0]?.getAttributeNS(W, 'val')).toBe('Scope');
    expect(sdt?.getElementsByTagNameNS(W, 'sdtContent').length).toBe(1);
  });

  it('writes hyperlinks as relationships with an external target', async () => {
    const bytes = await exportDocx(fixtureIR());
    const document = parse(text(bytes, 'word/document.xml'));
    const link = document.getElementsByTagNameNS(W, 'hyperlink')[0];
    expect(link).toBeDefined();
    const rid = link.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const rels = parse(text(bytes, 'word/_rels/document.xml.rels'));
    const rel = [...rels.getElementsByTagName('Relationship')].find((node) => node.getAttribute('Id') === rid);
    expect(rel?.getAttribute('Target')).toBe('https://example.com/sop-index');
    expect(rel?.getAttribute('TargetMode')).toBe('External');
  });

  it('escapes markup and ampersands in text', () => {
    const raw = '<script>&"';
    const xml = irToDocumentXml(irWithBody([paragraph(raw)]));
    expect(xml).toContain('&lt;script&gt;&amp;&quot;');
    expect(xml).not.toContain('<script>');
    const document = parse(xml);
    expect(document.getElementsByTagNameNS(W, 't')[0].textContent).toBe(raw);
  });

  it('strips XML control characters from text', () => {
    const xml = irToDocumentXml(irWithBody([paragraph('a\u0001b')]));
    expect(xml).toContain('<w:t xml:space="preserve">ab</w:t>');
  });
});

describe('sections, headers and footers', () => {
  it('writes one sectPr per section, with landscape orientation on the appendix', async () => {
    const xml = irToDocumentXml(fixtureIRWithSections());
    const document = parse(xml);
    const sectPrs = [...document.getElementsByTagNameNS(W, 'sectPr')];
    expect(sectPrs.length).toBe(2);
    expect(sectPrs[0].parentElement?.localName).toBe('pPr');
    expect(sectPrs[1].parentElement?.localName).toBe('body');
    const landscape = sectPrs[1].getElementsByTagNameNS(W, 'pgSz')[0];
    expect(landscape.getAttributeNS(W, 'orient')).toBe('landscape');
    expect(Number(landscape.getAttributeNS(W, 'w'))).toBeGreaterThan(Number(landscape.getAttributeNS(W, 'h')));
    expect(sectPrs[1].getElementsByTagNameNS(W, 'pgMar')[0].getAttributeNS(W, 'top')).toBe('1440');
  });

  it('writes header and footer parts with relationships and title page setting', async () => {
    const ir = irWithBody([paragraph('Body')]);
    const section: IRSection = {
      ...ir.sections[0],
      titlePage: true,
      headers: { default: [paragraph('Header text')], first: [] },
      footers: {
        default: [
          {
            type: 'paragraph',
            props: {},
            runs: [{ type: 'field', fieldType: 'PAGE', instr: 'PAGE', cachedText: '1' }],
          },
        ],
        even: [paragraph('Even footer')],
      },
    };
    const bytes = await exportDocx({ ...ir, sections: [section] });
    const files = unzip(bytes);
    expect(files['word/header1.xml']).toBeDefined();
    expect(files['word/header2.xml']).toBeDefined();
    expect(files['word/footer1.xml']).toBeDefined();
    expect(files['word/footer2.xml']).toBeDefined();
    expect(files['word/_rels/header1.xml.rels']).toBeDefined();
    const document = parse(text(bytes, 'word/document.xml'));
    const refs = [...document.getElementsByTagNameNS(W, 'headerReference')].map((node) => node.getAttributeNS(W, 'type'));
    expect(refs).toEqual(['default', 'first']);
    expect(document.getElementsByTagNameNS(W, 'titlePg').length).toBe(1);
    expect(text(bytes, 'word/settings.xml')).toContain('w:evenAndOddHeaders');
    expect(text(bytes, 'word/footer1.xml')).toContain('PAGE');
  });
});

describe('images', () => {
  it('embeds data URI images as media parts with inline drawings', async () => {
    const ir = irWithBody([{ type: 'image', src: PNG_1X1, widthPt: 100, alt: 'Pixel <1>' } as IRBlock]);
    const { bytes, report } = await exportDocxWithReport(ir);
    const files = unzip(bytes);
    expect(files['word/media/image1.png']).toBeDefined();
    expect(report.losses).toEqual([]);
    const document = parse(text(bytes, 'word/document.xml'));
    const extent = document.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'extent')[0];
    expect(extent.getAttribute('cx')).toBe(String(100 * 12700));
    const rels = text(bytes, 'word/_rels/document.xml.rels');
    expect(rels).toContain('Target="media/image1.png"');
    expect(rels).toContain('/relationships/image"');
    expect(document.getElementsByTagNameNS(W, 'drawing').length).toBe(1);
  });

  it('skips remote images and reports a loss', async () => {
    const ir = irWithBody([{ type: 'image', src: 'https://example.com/x.png', source: { blockType: 'image', blockId: 'img-9' } } as IRBlock]);
    const { bytes, report } = await exportDocxWithReport(ir);
    expect(report.losses).toEqual([expect.objectContaining({ code: 'image-remote', blockId: 'img-9' })]);
    expect(unzip(bytes)['word/media/image1.png']).toBeUndefined();
  });
});

describe('passthrough, fields and document properties', () => {
  it('writes valid passthrough XML verbatim and placeholders for invalid XML', async () => {
    const valid = '<w:p><w:r><w:t>raw</w:t></w:r></w:p>';
    const valid_ir = irWithBody([{ type: 'passthrough', xml: valid }]);
    expect(irToDocumentXml(valid_ir)).toContain(valid);

    const broken = '<w:p><w:r><w:t>oops</w:p>';
    const { bytes, report } = await exportDocxWithReport(
      irWithBody([{ type: 'passthrough', xml: broken, preview: 'SmartArt' }])
    );
    expect(report.losses.map((loss) => loss.code)).toEqual(['passthrough-invalid']);
    expect(text(bytes, 'word/document.xml')).toContain('[SmartArt]');
  });

  it('reports REF fields that point at missing bookmarks', async () => {
    const ir = irWithBody([
      {
        type: 'paragraph',
        props: {},
        runs: [{ type: 'field', fieldType: 'REF', instr: 'REF missing-target \\h', cachedText: 'x', name: 'missing-target' }],
      },
    ]);
    const { report } = await exportDocxWithReport(ir);
    expect(report.losses.map((loss) => loss.code)).toEqual(['field-target-missing']);
  });

  it('exposes document properties as custom properties for DOCPROPERTY fields', async () => {
    const ir = irWithBody([paragraph('x')], {
      properties: { docNumber: 'SOP-001', revision: '3', owner: 'QA <Lead>', custom: { site: 'Lab 2' } },
    });
    const bytes = await exportDocx(ir);
    const custom = parse(text(bytes, 'docProps/custom.xml'));
    const props = Object.fromEntries(
      [...custom.getElementsByTagName('property')].map((node) => [
        node.getAttribute('name'),
        node.textContent,
      ])
    );
    expect(props.docNumber).toBe('SOP-001');
    expect(props.revision).toBe('3');
    expect(props.effectiveDate).toBe('');
    expect(props.site).toBe('Lab 2');
    const core = parse(text(bytes, 'docProps/core.xml'));
    expect(core.getElementsByTagName('dc:creator')[0].textContent).toBe('QA <Lead>');
  });

  it('keeps the same blocks in irToDocumentXml and exportDocx', async () => {
    const ir = fixtureIR();
    const bytes = await exportDocx(ir);
    expect(text(bytes, 'word/document.xml')).toBe(irToDocumentXml(ir));
  });
});

describe('LIMS fields and custom inline nodes', () => {
  function paragraphIR(runs: IRInline[]): IRDocument {
    return irWithBody([{ type: 'paragraph', props: {}, runs }]);
  }

  it('writes a LIMS field as a DOCVARIABLE complex field with its cached text', async () => {
    const ir = paragraphIR([
      { type: 'field', fieldType: 'LIMS', instr: 'LIMS temperatureLimit', name: 'temperatureLimit', cachedText: '0.5' },
    ]);
    const xml = text(await exportDocx(ir), 'word/document.xml');
    expect(xml).toContain('DOCVARIABLE beak.lims.temperatureLimit');
    expect(xml).toContain('<w:t xml:space="preserve">0.5</w:t>');
    expect(xml).not.toContain('LIMS temperatureLimit');
  });

  it('keeps the LIMS format switch in the DOCVARIABLE instruction', async () => {
    const ir = paragraphIR([
      { type: 'field', fieldType: 'LIMS', instr: 'LIMS limit \\* UPPER', name: 'limit', format: 'UPPER', cachedText: 'x' },
    ]);
    expect(text(await exportDocx(ir), 'word/document.xml')).toContain('DOCVARIABLE beak.lims.limit \\* UPPER');
  });

  it('writes a custom inline node as a run of its fallback text and reports it at info level', async () => {
    const ir = paragraphIR([
      { type: 'run', text: 'See ', props: { bold: true } },
      { type: 'custom', inlineType: 'footnote', props: {}, text: 'note' },
      { type: 'run', text: ' here.', props: { bold: true } },
    ]);
    const { bytes, report } = await exportDocxWithReport(ir);
    expect(report.losses).toEqual([expect.objectContaining({ code: 'inline-degraded', severity: 'info' })]);
    const xml = text(bytes, 'word/document.xml');
    expect(xml).toMatch(/<w:b\/><\/w:rPr><w:t xml:space="preserve">note<\/w:t>/);
    expect(xml).toContain('>See <');
  });
});

describe('paragraph line spacing units', () => {
  it('writes auto line spacing in 240ths and exact/atLeast in twips', async () => {
    const ir = irWithBody([
      {
        type: 'paragraph',
        props: { spacing: { beforePt: 0, afterPt: 8, line: 276, lineRule: 'auto' } },
        runs: [{ type: 'run', text: 'One and a bit', props: {} }],
      },
      {
        type: 'paragraph',
        props: { spacing: { beforePt: 0, afterPt: 0, line: 280, lineRule: 'exact' } },
        runs: [{ type: 'run', text: 'Exact', props: {} }],
      },
    ] as IRBlock[]);
    const xml = text(await exportDocx(ir), 'word/document.xml');
    expect(xml).toContain('w:line="276" w:lineRule="auto"');
    expect(xml).toContain('w:line="280" w:lineRule="exact"');
  });
});
