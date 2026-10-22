import { describe, expect, it } from 'vitest';

import { bulkParagraphs, documentOf, field, fixedMeasurer, LANDSCAPE_SETUP, para, paraRuns, run, section, table, row } from './__fixtures__/builders';
import { layoutDocument } from './layout';
import { escapeHtml, pt, renderPrintHTML, renderPrintToWindow } from './print';

const OPTIONS = { measurer: fixedMeasurer, now: new Date(2026, 9, 21) };

describe('attribute and style hardening', () => {
  it('keeps an injected alignment value inside its allowlist', () => {
    const ir = documentOf([
      section('sec-1', [para('hostile', { align: 'left;" onmouseover="alert(1)' } as never, 'p1')]),
    ]);
    const html = renderPrintHTML(ir, undefined, OPTIONS);
    expect(html).not.toContain('onmouseover');
    expect(html).not.toContain('alert(1)');
    expect(html).toContain('text-align:left');
  });

  it('drops javascript: and other non-http image sources', () => {
    const ir = documentOf([
      section('sec-1', [paraRuns([{ type: 'image', src: 'javascript:alert(1)' }], {}, 'p2')]),
    ]);
    const html = renderPrintHTML(ir, undefined, OPTIONS);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('javascript:');
  });

  it('drops malicious colours and keeps plain colour names', () => {
    const ir = documentOf([
      section('sec-1', [
        paraRuns([run('a', { color: '#fff" onload="x' })], {}, 'p3'),
        paraRuns([run('b', { color: 'red' })], {}, 'p4'),
      ]),
    ]);
    const html = renderPrintHTML(ir, undefined, OPTIONS);
    expect(html).not.toContain('onload');
    expect(html).toContain('color:red');
  });

  it('turns non-finite numbers into zero lengths', () => {
    expect(pt(Number.NaN)).toBe('0.00');
    expect(pt('12;position:fixed' as never)).toBe('0.00');
    expect(pt(12.345)).toBe('12.35');
  });

  it('sandboxes the print iframe without scripts', () => {
    const html = renderPrintHTML(documentOf([section('sec-1', [para('x', {}, 'x')])]), undefined, OPTIONS);
    expect(renderPrintToWindow(html)).toBe(true);
    const frame = document.querySelector('iframe[aria-hidden="true"]');
    expect(frame?.getAttribute('sandbox')).toBe('allow-modals allow-same-origin');
    expect(frame?.getAttribute('sandbox')).not.toContain('allow-scripts');
    frame?.remove();
  });
});

describe('renderPrintHTML', () => {
  it('escapes text and rejects unsafe colours and image sources', () => {
    const body = [
      paraRuns([run('<script>alert("x")</script> & more', { color: 'red;}</style><script>' })], {}, 'p1'),
      paraRuns([{ type: 'image', src: 'javascript:alert(1)', alt: '"><img onerror=x>' }], {}, 'p2'),
    ];
    const ir = documentOf([section('sec-1', body)]);
    const html = renderPrintHTML(ir, undefined, OPTIONS);
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; more');
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('red;}</style>');
    expect(html).not.toContain('javascript:alert');
    expect(html).not.toContain('onerror=x>');
  });

  it('escapes the helper directly', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });

  it('emits one page section per laid-out page, with a named @page rule per section', () => {
    const ir = documentOf([
      section('sec-1', bulkParagraphs(200)),
      section('sec-2', [para('appendix', {}, 'ap')], { pageSetup: LANDSCAPE_SETUP }),
    ]);
    const layout = layoutDocument(ir, OPTIONS);
    const html = renderPrintHTML(ir, layout, OPTIONS);
    expect(html.match(/<section class="bb-page /g)?.length).toBe(layout.pageCount);
    expect(html.match(/@page bb-s\d+/g)?.length).toBe(ir.sections.length);
    expect(html).toContain('size: 841.90pt 595.30pt');
  });

  it('computes a layout when none is given and resolves header fields per page', () => {
    const header = [paraRuns([run('Page '), field('PAGE', null), run(' of '), field('NUMPAGES', null)])];
    const ir = documentOf([section('sec-1', bulkParagraphs(200), { headers: { default: header } })]);
    const html = renderPrintHTML(ir, undefined, OPTIONS);
    // Field values are wrapped in spans, so check the text pieces around them.
    expect(html).toMatch(/Page <\/span><span[^>]*>2<\/span>/);
    expect(html).toMatch(/ of <\/span><span[^>]*>3<\/span>/);
    expect(html.match(/<section class="bb-page /g)?.length).toBe(3);
  });

  it('renders table rows of the fragment with repeated header rows', () => {
    const rows = Array.from({ length: 80 }, (_v, index) => row([`cell-${index}`], index === 0 ? { isHeader: true } : {}));
    const ir = documentOf([section('sec-1', [table([4513, 4513], rows)])]);
    const html = renderPrintHTML(ir, undefined, OPTIONS);
    expect(html.match(/cell-0</g)?.length).toBe(2);
    expect(html).toContain('cell-79');
  });

  it('draws the watermark and controlled-copy stamp on every page, escaped', () => {
    const ir = documentOf([section('sec-1', bulkParagraphs(200))]);
    const html = renderPrintHTML(ir, undefined, {
      ...OPTIONS,
      watermark: 'UNCONTROLLED <WHEN> PRINTED',
      controlledCopy: { copyNumber: 3, issuedTo: 'Lab <A>' },
    });
    expect(html.match(/class="bb-watermark"/g)?.length).toBe(3);
    expect(html.match(/class="bb-stamp"/g)?.length).toBe(3);
    expect(html).toContain('UNCONTROLLED &lt;WHEN&gt; PRINTED');
    expect(html).toContain('Issued to Lab &lt;A&gt;');
  });
});
