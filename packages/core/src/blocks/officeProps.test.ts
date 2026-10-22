import { describe, expect, it } from 'vitest';
import { createSchema } from '../schema';
import { blocksToDoc, docToBlocks } from './index';
import type { Block } from './types';
import { paragraphNode } from '../schema/nodes/paragraph';
import { headingNode } from '../schema/nodes/heading';

const schema = createSchema();

const officeParagraph: Block = {
  id: 'p1',
  type: 'paragraph',
  props: {
    textAlign: 'justify',
    styleId: 'Normal',
    numbering: { numId: '3', level: 1 },
    spacing: { beforePt: 6, afterPt: 12, line: 276, lineRule: 'auto' },
    indent: { leftPt: 36, hangingPt: 18 },
    keepNext: true,
    keepLines: false,
    pageBreakBefore: true,
    widowControl: true,
    tabs: [{ posPt: 72, kind: 'right', leader: 'dot' }],
  },
  content: [{ type: 'text', text: 'Office paragraph', styles: {} }],
};

describe('office paragraph properties', () => {
  it('round-trips every paragraph office attribute through Block.props', () => {
    const doc = blocksToDoc(schema, [officeParagraph]);
    const [block] = docToBlocks(doc);
    expect(block?.props).toEqual(officeParagraph.props);
  });

  it('round-trips heading office attributes', () => {
    const heading: Block = {
      id: 'h1',
      type: 'heading',
      props: { level: 2, styleId: 'Heading2', indent: { leftPt: 0, firstLinePt: 12 } },
      content: [{ type: 'text', text: 'Heading', styles: {} }],
    };
    const [block] = docToBlocks(blocksToDoc(schema, [heading]));
    expect(block?.props).toEqual({
      level: 2,
      textAlign: 'left',
      locked: false,
      lockReason: null,
      lockId: null,
      styleId: 'Heading2',
      indent: { leftPt: 0, firstLinePt: 12 },
    });
  });

  it('omits unset office attributes from serialized props', () => {
    const plain: Block = {
      id: 'p2',
      type: 'paragraph',
      props: { textAlign: 'left' },
      content: [{ type: 'text', text: 'Plain', styles: {} }],
    };
    const [block] = docToBlocks(blocksToDoc(schema, [plain]));
    expect(block?.props).toEqual({ textAlign: 'left' });
    expect(Object.keys(block?.props ?? {})).not.toContain('styleId');
    expect(Object.keys(block?.props ?? {})).not.toContain('spacing');
  });

  it('renders data attributes and inline CSS in pt', () => {
    const dom = paragraphNode.toDOM!(schema.nodes.paragraph!.create(officeParagraph.props)) as [
      string,
      Record<string, string>,
    ];
    const attrs = dom[1];
    expect(attrs['data-style-id']).toBe('Normal');
    expect(attrs.style).toContain('text-align: justify');
    expect(attrs.style).toContain('margin-top: 6pt');
    expect(attrs.style).toContain('margin-bottom: 12pt');
    expect(attrs.style).toContain('margin-left: 36pt');
    expect(attrs.style).toContain('text-indent: -18pt');
    expect(attrs.style).toContain('page-break-before: always');
    expect(attrs['data-keep-next']).toBe('true');
  });

  it('renders auto line spacing in 240ths as a unitless line-height of about 1.15', () => {
    const dom = paragraphNode.toDOM!(schema.nodes.paragraph!.create(officeParagraph.props)) as [
      string,
      Record<string, string>,
    ];
    expect(dom[1].style).toContain('line-height: 1.15');
  });

  it('still renders legacy multiplier line spacing (1.15) as 1.15', () => {
    const legacy = { ...officeParagraph.props, spacing: { beforePt: 0, afterPt: 0, line: 1.15, lineRule: 'auto' } };
    const dom = paragraphNode.toDOM!(schema.nodes.paragraph!.create(legacy)) as [string, Record<string, string>];
    expect(dom[1].style).toContain('line-height: 1.15');
  });

  it('parses office attributes back from DOM', () => {
    const container = document.createElement('div');
    container.innerHTML = '<p data-style-id="Caption" data-spacing=\'{"beforePt":2,"afterPt":4,"line":240,"lineRule":"auto"}\' data-keep-next="true" style="margin-left: 10pt">Hi</p>';
    const el = container.querySelector('p') as HTMLElement;
    const rule = paragraphNode.parseDOM!.find((r) => r.tag === 'p')!;
    const attrs = rule.getAttrs!(el) as Record<string, unknown>;
    expect(attrs.styleId).toBe('Caption');
    expect(attrs.spacing).toEqual({ beforePt: 2, afterPt: 4, line: 240, lineRule: 'auto' });
    expect(attrs.keepNext).toBe(true);
  });

  it('keeps heading parse rules wired to office attributes', () => {
    const container = document.createElement('div');
    container.innerHTML = '<h2 data-style-id="Heading2" data-page-break-before="false">Title</h2>';
    const el = container.querySelector('h2') as HTMLElement;
    const rule = headingNode.parseDOM!.find((r) => r.tag === 'h2')!;
    const attrs = rule.getAttrs!(el) as Record<string, unknown>;
    expect(attrs.level).toBe(2);
    expect(attrs.styleId).toBe('Heading2');
    expect(attrs.pageBreakBefore).toBe(false);
  });
});
