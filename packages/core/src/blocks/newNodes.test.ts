import { describe, expect, it } from 'vitest';
import { createSchema } from '../schema';
import { blocksToDoc, docToBlocks } from './index';
import { blocksToMarkdown } from '../markdown';
import type { Block } from './types';
import { FieldNodeView } from '../nodeviews/FieldNodeView';

const schema = createSchema();

describe('field inline node', () => {
  it('round-trips field inline content', () => {
    const block: Block = {
      id: 'p1',
      type: 'paragraph',
      props: {},
      content: [
        { type: 'text', text: 'Doc ', styles: {} },
        { type: 'field', fieldType: 'DOCPROPERTY', name: 'docNumber', fallback: 'SOP-001' },
        { type: 'text', text: ' page ', styles: {} },
        { type: 'field', fieldType: 'PAGE', name: null, format: 'arabic' },
      ],
    };
    const [out] = docToBlocks(blocksToDoc(schema, [block]));
    expect(out?.content).toEqual([
      { type: 'text', text: 'Doc ', styles: {} },
      { type: 'field', fieldType: 'DOCPROPERTY', name: 'docNumber', fallback: 'SOP-001' },
      { type: 'text', text: ' page ', styles: {} },
      { type: 'field', fieldType: 'PAGE', name: null, format: 'arabic' },
    ]);
  });

  it('degrades to fallback text in Markdown export', () => {
    const block: Block = {
      id: 'p1',
      type: 'paragraph',
      props: {},
      content: [
        { type: 'text', text: 'Version ', styles: {} },
        { type: 'field', fieldType: 'DOCPROPERTY', name: 'revision', fallback: '3' },
      ],
    };
    expect(blocksToMarkdown([block]).trim()).toBe('Version 3');
  });

  it('renders a span with data attributes in the node view', () => {
    const node = schema.nodes.field!.create({ fieldType: 'REF', name: 'b1', fallback: 'Section 2' });
    const view = new FieldNodeView(node, () => () => 'Section 2.1');
    expect(view.dom.tagName).toBe('SPAN');
    expect(view.dom.className).toContain('beakblock-field');
    expect(view.dom.getAttribute('data-field-type')).toBe('REF');
    expect(view.dom.getAttribute('data-field-name')).toBe('b1');
    expect(view.dom.textContent).toBe('Section 2.1');
  });
});

describe('page and section breaks', () => {
  it('round-trips pageBreak as a block atom', () => {
    const blocks: Block[] = [
      { id: 'a', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'one', styles: {} }] },
      { id: 'pb', type: 'pageBreak', props: {} },
      { id: 'b', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'two', styles: {} }] },
    ];
    const out = docToBlocks(blocksToDoc(schema, blocks));
    expect(out.map((b) => b.type)).toEqual(['paragraph', 'pageBreak', 'paragraph']);
    expect(out[1]?.props).toEqual({});
  });

  it('round-trips sectionBreak with page setup', () => {
    const pageSetup = {
      size: { widthTwips: 15840, heightTwips: 12240 },
      orientation: 'landscape' as const,
      margins: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720, gutter: 0 },
    };
    const blocks: Block[] = [{ id: 'sb', type: 'sectionBreak', props: { pageSetup } }];
    const [out] = docToBlocks(blocksToDoc(schema, blocks));
    expect(out?.type).toBe('sectionBreak');
    expect(out?.props).toEqual({ pageSetup });
  });

  it('omits null pageSetup from sectionBreak props', () => {
    const blocks: Block[] = [{ id: 'sb', type: 'sectionBreak', props: { pageSetup: null } }];
    const [out] = docToBlocks(blocksToDoc(schema, blocks));
    expect(out?.props).toEqual({});
  });
});

describe('revision marks', () => {
  it('round-trips insertion and deletion through TextStyles.revision', () => {
    const block: Block = {
      id: 'p',
      type: 'paragraph',
      props: {},
      content: [
        { type: 'text', text: 'kept ', styles: {} },
        {
          type: 'text',
          text: 'added',
          styles: {
            bold: true,
            revision: { kind: 'insert', revisionId: 'r1', authorId: 'u1', authorName: 'Ann', at: '2026-01-01T00:00:00.000Z' },
          },
        },
        {
          type: 'text',
          text: 'gone',
          styles: {
            revision: { kind: 'delete', revisionId: 'r2', at: '2026-01-02T00:00:00.000Z', aiGenerated: true },
          },
        },
      ],
    };
    const [out] = docToBlocks(blocksToDoc(schema, [block]));
    expect(out?.content).toEqual([
      { type: 'text', text: 'kept ', styles: {} },
      {
        type: 'text',
        text: 'added',
        styles: {
          bold: true,
          revision: { kind: 'insert', revisionId: 'r1', authorId: 'u1', authorName: 'Ann', at: '2026-01-01T00:00:00.000Z' },
        },
      },
      {
        type: 'text',
        text: 'gone',
        styles: {
          revision: { kind: 'delete', revisionId: 'r2', at: '2026-01-02T00:00:00.000Z', aiGenerated: true },
        },
      },
    ]);
  });

  it('renders ins and del elements with revision attributes', () => {
    const ins = schema.marks.insertion!.create({ revisionId: 'r1', at: 'now' });
    const del = schema.marks.deletion!.create({ revisionId: 'r2', at: 'now' });
    const insEl = schema.marks.insertion!.spec.toDOM!(ins, true) as unknown as [string, Record<string, string>];
    const delEl = schema.marks.deletion!.spec.toDOM!(del, true) as unknown as [string, Record<string, string>];
    expect(insEl[0]).toBe('ins');
    expect(insEl[1].class).toBe('beakblock-ins');
    expect(insEl[1]['data-revision-id']).toBe('r1');
    expect(delEl[0]).toBe('del');
    expect(delEl[1].class).toBe('beakblock-del');
  });
});
