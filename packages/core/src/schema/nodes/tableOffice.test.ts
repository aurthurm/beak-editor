import { describe, expect, it } from 'vitest';
import { createSchema } from '../index';
import { blocksToDoc, docToBlocks } from '../../blocks';
import type { Block } from '../../blocks';
import { tableCellCss } from './tableOffice';

const schema = createSchema();

describe('Office table attrs', () => {
  it('round-trips widths, borders, shading and look through Block JSON', () => {
    const blocks: Block[] = [
      {
        id: 't',
        type: 'table',
        props: { widthMode: 'fixed', widthValue: 9360, styleId: 'GridTable4', look: { headerRow: true, bandedRows: true, firstColumn: false, lastRow: false } },
        children: [
          {
            id: 'r',
            type: 'tableRow',
            props: { isHeader: true, heightTwips: 400 },
            children: [
              {
                id: 'c',
                type: 'tableCell',
                props: {
                  colspan: 1,
                  rowspan: 1,
                  colwidth: [624],
                  backgroundColor: null,
                  widthTwips: 9360,
                  borders: { top: { style: 'single', sizePt: 1, color: '#000000' }, right: null, bottom: null, left: null },
                  shading: '#ffcc00',
                  padding: { topPt: 2, rightPt: 2, bottomPt: 2, leftPt: 2 },
                  vAlign: 'center',
                  hAlign: 'right',
                },
                children: [{ id: 'p', type: 'paragraph', props: { textAlign: 'left' }, content: [{ type: 'text', text: 'x', styles: {} }] }],
              },
            ],
          },
        ],
      },
    ];
    const out = docToBlocks(blocksToDoc(schema, blocks));
    expect(out).toEqual(blocks);
  });

  it('omits unset Office attrs but keeps legacy colwidth and backgroundColor keys', () => {
    const out = docToBlocks(
      blocksToDoc(schema, [
        {
          id: 't',
          type: 'table',
          props: {},
          children: [
            { id: 'r', type: 'tableRow', props: {}, children: [
              { id: 'c', type: 'tableCell', props: {}, children: [{ id: 'p', type: 'paragraph', props: {}, content: [] }] },
            ] },
          ],
        },
      ])
    );
    expect(out[0]!.props).toEqual({});
    const cell = out[0]!.children![0]!.children![0]!;
    expect(cell.props).toEqual({ colspan: 1, rowspan: 1, colwidth: null, backgroundColor: null });
  });

  it('renders border, shading, padding and alignment as CSS', () => {
    const css = tableCellCss({
      colwidth: null,
      borders: { top: { style: 'double', sizePt: 2, color: '#112233' }, right: null, bottom: null, left: null },
      shading: '#abcdef',
      padding: { topPt: 1, rightPt: 2, bottomPt: 3, leftPt: 4 },
      vAlign: 'center',
      hAlign: 'justify',
    });
    expect(css).toContain('border-top: 2pt double #112233');
    expect(css).toContain('background-color: #abcdef');
    expect(css).toContain('padding: 1pt 2pt 3pt 4pt');
    expect(css).toContain('vertical-align: middle');
    expect(css).toContain('text-align: justify');
  });
});
