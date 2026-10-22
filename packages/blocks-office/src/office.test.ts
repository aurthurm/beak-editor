import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BeakBlockEditor, type Block } from '@amusendame/beakblock-core';

import {
  officeBlocksExtension,
  officeSlashItems,
  refreshOfficeBlocks,
  validateOfficeContent,
  computeCaptionNumbers,
  collectNotes,
  isConditionVisible,
  injectOfficeBlocksStyles,
  OFFICE_BLOCKS_STYLE_ID,
  createOfficeBlockDefinitions,
  formatComputedValue,
} from './index';
import type { OfficeBlocksOptions } from './types';

let editor: BeakBlockEditor | null = null;

function createEditor(options: OfficeBlocksOptions = {}, initialContent?: Block[]): BeakBlockEditor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  editor = new BeakBlockEditor({
    element,
    injectStyles: false,
    initialContent,
    extensions: [officeBlocksExtension(options)],
  });
  return editor;
}

/** Replaces the ProseMirror document from PM JSON (needed for inline atoms). */
function setPmDoc(target: BeakBlockEditor, json: Record<string, unknown>): void {
  const doc = target.pm.state.schema.nodeFromJSON(json);
  const tr = target.pm.createTransaction();
  tr.replaceWith(0, target.pm.doc.content.size, doc.content);
  target.pm.dispatch(tr);
}

function text(value: string): Record<string, unknown> {
  return { type: 'text', text: value };
}

function para(id: string, content: Record<string, unknown>[]): Record<string, unknown> {
  return { type: 'paragraph', attrs: { id }, content };
}

/** Text of every element matching a selector, in document order. */
function domTexts(target: BeakBlockEditor, selector: string): string[] {
  return Array.from(target.pm.view.dom.querySelectorAll(selector)).map((el) => el.textContent ?? '');
}

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

describe('officeBlocksExtension: registration', () => {
  it('injects the stylesheet by default and not when injectStyles is false', () => {
    document.getElementById(OFFICE_BLOCKS_STYLE_ID)?.remove();
    officeBlocksExtension({ injectStyles: false });
    expect(document.getElementById(OFFICE_BLOCKS_STYLE_ID)).toBeNull();
    officeBlocksExtension();
    expect(document.getElementById(OFFICE_BLOCKS_STYLE_ID)).not.toBeNull();
  });

  beforeEach(() => {
    createEditor();
  });

  it('adds every office node to the schema', () => {
    const names = [
      'footnote', 'endnote', 'equation', 'inlineEquation', 'caption', 'crossReference',
      'textBox', 'shape', 'variable', 'conditional', 'repeatingSection', 'computedValue', 'reusableContent',
    ];
    for (const name of names) {
      expect(editor?.pm.state.schema.nodes[name], name).toBeDefined();
    }
  });

  it('registers block definitions with families and print renderers', () => {
    const registry = editor!.blockRegistry;
    expect(registry.get('equation')?.family).toBe('office');
    expect(registry.get('conditional')?.family).toBe('smart');
    expect(registry.get('reusableContent')?.family).toBe('smart');
    expect(registry.get('variable')?.family).toBe('smart');
    expect(registry.get('shape')?.renderPrint).toBeTypeOf('function');
    expect(registry.list('smart').length).toBeGreaterThan(0);
  });

  it('injects the stylesheet once', () => {
    document.getElementById(OFFICE_BLOCKS_STYLE_ID)?.remove();
    expect(injectOfficeBlocksStyles()).toBe(true);
    expect(injectOfficeBlocksStyles()).toBe(false);
    expect(document.getElementById(OFFICE_BLOCKS_STYLE_ID)).not.toBeNull();
  });
});

describe('block-level round trip through getDocument/setDocument', () => {
  it('preserves equation, caption, shape and reusable content blocks', () => {
    const blocks: Block[] = [
      { id: 'eq1', type: 'equation', props: { latex: 'x^2 + y^2 = r^2' } },
      { id: 'cap1', type: 'caption', props: { label: 'Figure' }, content: [{ type: 'text', text: 'Pump layout', styles: {} }] },
      { id: 'sh1', type: 'shape', props: { kind: 'ellipse', width: 90, height: 40, fill: null, stroke: '#111827', strokeWidth: 2 } },
      { id: 'rc1', type: 'reusableContent', props: { contentId: 'safety-notice', revision: 3, title: 'Safety' } },
    ];
    createEditor({}, blocks);
    const before = editor!.getDocument();
    editor!.setDocument(before);
    expect(editor!.getDocument()).toEqual(before);
    expect(before.map((b) => b.type)).toEqual(['equation', 'caption', 'shape', 'reusableContent']);
  });

  it('round-trips container blocks at the ProseMirror level', () => {
    createEditor();
    const json = {
      type: 'doc',
      content: [
        {
          type: 'conditional',
          attrs: { id: 'c1', expression: "procedureType == 'micro'" },
          content: [para('p1', [text('Micro only')])],
        },
        {
          type: 'repeatingSection',
          attrs: { id: 'r1', itemsKey: 'samples', min: 1, max: 5 },
          content: [para('p2', [text('Sample row')])],
        },
        {
          type: 'textBox',
          attrs: { id: 't1', width: 200, float: 'left', borderPt: 0.75, fill: null },
          content: [para('p3', [text('Boxed')])],
        },
      ],
    };
    setPmDoc(editor!, json);
    const doc = editor!.pm.doc;
    const reparsed = editor!.pm.state.schema.nodeFromJSON(doc.toJSON());
    expect(reparsed.eq(doc)).toBe(true);
    expect(doc.child(0).type.name).toBe('conditional');
    expect(doc.child(1).attrs.max).toBe(5);
  });

  it('round-trips inline atoms and containers through getDocument/setDocument', () => {
    createEditor({ variables: { patient: { name: 'Ada' }, qty: 3 } });
    setPmDoc(editor!, {
      type: 'doc',
      content: [
        { type: 'caption', attrs: { id: 'c1', label: 'Figure' }, content: [text('Pump layout')] },
        para('p1', [
          text('Note'),
          { type: 'footnote', attrs: { id: 'f1', text: 'Alpha' } },
          text(' see '),
          { type: 'crossReference', attrs: { id: 'x1', targetId: 'c1', display: 'number' } },
          text(' for '),
          { type: 'variable', attrs: { id: 'v1', name: 'patient.name', format: null } },
          text(' dose '),
          {
            type: 'computedValue',
            attrs: { id: 'cv1', expression: 'qty * 2', format: 'number', decimals: 2, unit: null },
          },
        ]),
        {
          type: 'textBox',
          attrs: { id: 't1', width: 200, float: 'none', borderPt: 0.75, fill: null },
          content: [para('p2', [text('Boxed')])],
        },
        {
          type: 'conditional',
          attrs: { id: 'k1', expression: "patient.name == 'Ada'" },
          content: [para('p3', [text('Shown')])],
        },
        {
          type: 'repeatingSection',
          attrs: { id: 'r1', itemsKey: 'samples', min: 0, max: null },
          content: [para('p4', [text('Row')])],
        },
      ],
    });

    const before = editor!.getDocument();
    const para1 = before.find((b) => b.id === 'p1')!;
    expect(para1.content?.map((item) => item.type)).toEqual([
      'text', 'footnote', 'text', 'crossReference', 'text', 'variable', 'text', 'computedValue',
    ]);
    expect(before.find((b) => b.id === 'k1')?.props).toEqual({ expression: "patient.name == 'Ada'" });
    expect(before.find((b) => b.id === 't1')?.children?.[0]?.id).toBe('p2');

    editor!.setDocument(before);
    expect(editor!.getDocument()).toEqual(before);
    expect(domTexts(editor!, '.beakblock-footnote')).toEqual(['1']);
    expect(domTexts(editor!, '.beakblock-variable')).toEqual(['Ada']);
    expect(domTexts(editor!, '.beakblock-computed')).toEqual(['6.00']);
  });
});

describe('inline atoms in the editor', () => {
  it('numbers footnotes and endnotes in document order and updates on insert', () => {
    createEditor({}, undefined);
    setPmDoc(editor!, {
      type: 'doc',
      content: [
        para('p1', [
          text('First'),
          { type: 'footnote', attrs: { id: 'f1', text: 'Alpha' } },
          text(' and '),
          { type: 'endnote', attrs: { id: 'e1', text: 'Beta' } },
        ]),
        para('p2', [{ type: 'footnote', attrs: { id: 'f2', text: 'Gamma' } }]),
      ],
    });
    expect(domTexts(editor!, '.beakblock-footnote')).toEqual(['1', '2']);
    expect(domTexts(editor!, '.beakblock-endnote')).toEqual(['1']);

    // Insert a footnote at the start; later notes renumber without a document edit to them.
    const tr = editor!.pm.createTransaction();
    tr.insert(2, editor!.pm.state.schema.nodes.footnote!.create({ id: 'f0', text: 'Zero' }));
    editor!.pm.dispatch(tr);
    expect(domTexts(editor!, '.beakblock-footnote')).toEqual(['1', '2', '3']);
    expect(domTexts(editor!, '.beakblock-endnote')).toEqual(['1']);
  });

  it('collects notes in order for layout and print', () => {
    // Inline office atoms are not part of core's InlineContent union yet, so build the JSON loosely.
    const blocks = [
      { id: 'p1', type: 'paragraph', props: {}, content: [{ type: 'footnote', props: { text: 'A' } }] },
      { id: 'p2', type: 'paragraph', props: {}, content: [{ type: 'endnote', props: { text: 'B' } }] },
      { id: 'p3', type: 'paragraph', props: {}, content: [{ type: 'footnote', props: { text: 'C' } }] },
    ] as unknown as Block[];
    expect(collectNotes(blocks)).toEqual([
      { kind: 'footnote', id: null, number: 1, text: 'A' },
      { kind: 'endnote', id: null, number: 1, text: 'B' },
      { kind: 'footnote', id: null, number: 2, text: 'C' },
    ]);
  });

  it('renders equation source when no math renderer is available', () => {
    createEditor();
    setPmDoc(editor!, {
      type: 'doc',
      content: [{ type: 'equation', attrs: { id: 'eq1', latex: '\\frac{a}{b}' } }],
    });
    const code = editor!.pm.view.dom.querySelector('.beakblock-equation-source');
    expect(code?.textContent).toBe('\\frac{a}{b}');
  });

  it('uses the supplied math renderer for inline and display equations', () => {
    createEditor({ renderMath: (latex, display) => `<i data-display="${display}">${latex.length}</i>` });
    setPmDoc(editor!, {
      type: 'doc',
      content: [
        {
          type: 'equation',
          attrs: { id: 'eq1', latex: 'abc' },
        },
        para('p1', [text('x '), { type: 'inlineEquation', attrs: { id: 'ie1', latex: 'xy' } }]),
      ],
    });
    const display = editor!.pm.view.dom.querySelector('.beakblock-equation i');
    const inline = editor!.pm.view.dom.querySelector('.beakblock-inline-equation i');
    expect(display?.getAttribute('data-display')).toBe('true');
    expect(display?.textContent).toBe('3');
    expect(inline?.getAttribute('data-display')).toBe('false');
  });

  it('numbers captions per label and resolves cross-references', () => {
    createEditor({});
    setPmDoc(editor!, {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { id: 'h1', level: 1 }, content: [text('Results')] },
        { type: 'caption', attrs: { id: 'c1', label: 'Figure' }, content: [text('Pump layout')] },
        { type: 'caption', attrs: { id: 't1', label: 'Table' }, content: [text('Samples')] },
        { type: 'caption', attrs: { id: 'c2', label: 'Figure' }, content: [text('Flow')] },
        para('p1', [
          text('See '),
          { type: 'crossReference', attrs: { id: 'x1', targetId: 'c2', display: 'number' } },
          text(' / '),
          { type: 'crossReference', attrs: { id: 'x2', targetId: 'c1', display: 'text' } },
          text(' / '),
          { type: 'crossReference', attrs: { id: 'x3', targetId: 'h1', display: 'text' } },
          text(' / '),
          { type: 'crossReference', attrs: { id: 'x4', targetId: 't1', display: 'label' } },
          text(' / '),
          { type: 'crossReference', attrs: { id: 'x5', targetId: 'missing', display: 'number' } },
        ]),
      ],
    });
    expect(domTexts(editor!, '.beakblock-xref')).toEqual([
      '2',
      'Figure 1: Pump layout',
      'Results',
      'Table',
      '?',
    ]);
    const captionLabels = Array.from(editor!.pm.view.dom.querySelectorAll('.beakblock-caption')).map(
      (el) => el.getAttribute('data-caption-number')
    );
    expect(captionLabels).toEqual(['1', '1', '2']);
  });

  it('computes caption numbers from block JSON', () => {
    const blocks: Block[] = [
      { id: 'c1', type: 'caption', props: { label: 'Figure' }, content: [{ type: 'text', text: 'A', styles: {} }] },
      { id: 't1', type: 'caption', props: { label: 'Table' }, content: [{ type: 'text', text: 'B', styles: {} }] },
      { id: 'c2', type: 'caption', props: { label: 'Figure' }, content: [{ type: 'text', text: 'C', styles: {} }] },
    ];
    const numbers = computeCaptionNumbers(blocks);
    expect(numbers.get('c1')).toEqual({ label: 'Figure', number: 1 });
    expect(numbers.get('t1')).toEqual({ label: 'Table', number: 1 });
    expect(numbers.get('c2')).toEqual({ label: 'Figure', number: 2 });
  });

  it('prints the computed caption number from the document context', () => {
    const blocks: Block[] = [
      { id: 'c1', type: 'caption', props: { label: 'Figure' }, content: [{ type: 'text', text: 'A', styles: {} }] },
      { id: 'c2', type: 'caption', props: { label: 'Figure' }, content: [{ type: 'text', text: 'B', styles: {} }] },
    ];
    const caption = createOfficeBlockDefinitions().find((definition) => definition.type === 'caption')!;
    const html = caption.renderPrint!(blocks[1]!, { captionNumbers: computeCaptionNumbers(blocks) });
    expect(html).toContain('Figure 2');
  });

  it('keeps a saved caption number on load', () => {
    createEditor({}, [
      { id: 'c1', type: 'caption', props: { label: 'Figure', number: 3 }, content: [{ type: 'text', text: 'A', styles: {} }] },
    ]);
    expect(editor!.getDocument()[0]!.props.number).toBe(3);
  });

  it('shows variables and computed values, and reflects changes after refresh', () => {
    const variables: Record<string, unknown> = { patient: { name: 'Ada' }, qty: 3, price: 2.5 };
    createEditor({ variables: () => variables });
    setPmDoc(editor!, {
      type: 'doc',
      content: [
        para('p1', [
          { type: 'variable', attrs: { id: 'v1', name: 'patient.name' } },
          text(' '),
          { type: 'variable', attrs: { id: 'v2', name: 'missing' } },
          text(' '),
          {
            type: 'computedValue',
            attrs: { id: 'cv1', expression: 'qty * price', format: 'currency', decimals: 2, unit: '$' },
          },
        ]),
      ],
    });
    expect(domTexts(editor!, '.beakblock-variable')).toEqual(['Ada', '[missing]']);
    expect(domTexts(editor!, '.beakblock-computed')).toEqual(['$7.50']);

    variables.qty = 4;
    refreshOfficeBlocks(editor!);
    expect(domTexts(editor!, '.beakblock-computed')).toEqual(['$10.00']);
  });

  it('shows #ERROR for a computed value that cannot be evaluated', () => {
    createEditor();
    setPmDoc(editor!, {
      type: 'doc',
      content: [para('p1', [{ type: 'computedValue', attrs: { id: 'cv', expression: '1 / 0' } }])],
    });
    expect(domTexts(editor!, '.beakblock-computed')).toEqual(['#ERROR']);
  });
});

describe('conditional and repeating sections', () => {
  it('hides a conditional section whose expression is false', () => {
    const variables: Record<string, unknown> = { procedureType: 'micro' };
    createEditor({ variables: () => variables });
    setPmDoc(editor!, {
      type: 'doc',
      content: [
        {
          type: 'conditional',
          attrs: { id: 'c1', expression: "procedureType == 'micro'" },
          content: [para('p1', [text('Micro steps')])],
        },
      ],
    });
    const node = editor!.pm.view.dom.querySelector('.beakblock-conditional');
    expect(node?.getAttribute('data-condition-result')).toBe('true');

    variables.procedureType = 'chem';
    refreshOfficeBlocks(editor!);
    expect(editor!.pm.view.dom.querySelector('.beakblock-conditional')?.getAttribute('data-condition-result')).toBe(
      'false'
    );
  });

  it('evaluates conditions safely', () => {
    expect(isConditionVisible("procedureType == 'micro'", { procedureType: 'micro' })).toBe(true);
    expect(isConditionVisible("constructor.constructor('x')()", {})).toBe(true);
    expect(isConditionVisible('count > 2', { count: 1 })).toBe(false);
  });

  it('reports repeating section min and max violations', () => {
    const variables = { samples: [1, 2] };
    const make = (min: number, max: number | null): Block[] => [
      {
        id: 'r1',
        type: 'repeatingSection',
        props: { itemsKey: 'samples', min, max },
        children: [{ id: 'p', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'row', styles: {} }] }],
      },
    ];
    const codes = (blocks: Block[]) =>
      validateOfficeContent(blocks, { variables }).map((issue) => issue.code);

    expect(codes(make(3, null))).toContain('repeat-below-min');
    expect(codes(make(0, 1))).toContain('repeat-above-max');
    expect(codes(make(2, 1))).toContain('max-below-min');
    expect(codes(make(0, 5))).toEqual([]);
    expect(codes(make(-1, null))).toContain('invalid-min');
  });

  it('validates repeating bounds through the registry too', () => {
    createEditor();
    const issues = editor!.blockRegistry.validate([
      { id: 'r1', type: 'repeatingSection', props: { itemsKey: '', min: 0, max: null } },
    ]);
    expect(issues.map((i) => i.code)).toContain('missing-items-key');
  });
});

describe('reusable content', () => {
  const sharedBlocks: Block[] = [
    { id: 'src', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Store at 4 C', styles: {} }] },
  ];

  it('warns when reusable content is not pinned to a revision', () => {
    const resolver = () => sharedBlocks;
    const defs = createOfficeBlockDefinitions({ resolveReusableContent: resolver });
    const reusable = defs.find((d) => d.type === 'reusableContent')!;
    const floating = reusable.validate!(
      { id: 'rc', type: 'reusableContent', props: { contentId: 'storage', revision: null, title: 'Storage' } },
      { blocks: [] }
    );
    expect(floating.map((i) => i.code)).toContain('reusable-unpinned');
    expect(floating.find((i) => i.code === 'reusable-unpinned')?.severity).toBe('warning');

    const pinned = reusable.validate!(
      { id: 'rc', type: 'reusableContent', props: { contentId: 'storage', revision: 2, title: 'Storage' } },
      { blocks: [] }
    );
    expect(pinned.map((i) => i.code)).not.toContain('reusable-unpinned');
  });

  it('shows a read-only preview from the resolver', () => {
    createEditor({ resolveReusableContent: (id, revision) => (id === 'storage' && revision === 2 ? sharedBlocks : null) });
    setPmDoc(editor!, {
      type: 'doc',
      content: [{ type: 'reusableContent', attrs: { id: 'rc', contentId: 'storage', revision: 2, title: 'Storage' } }],
    });
    const preview = editor!.pm.view.dom.querySelector('.beakblock-reusable-body');
    expect(preview?.textContent).toBe('Store at 4 C');
    expect(editor!.pm.view.dom.querySelector('.beakblock-reusable-badge')?.textContent).toContain('revision 2');
  });
});

describe('validation and print', () => {
  it('validates inline atoms: unknown variables, bad expressions, empty notes', () => {
    const blocks: Block[] = [
      {
        id: 'p1',
        type: 'paragraph',
        props: {},
        content: [
          { type: 'variable', props: { name: 'nope' } } as unknown as never,
          { type: 'computedValue', props: { expression: '(' } } as unknown as never,
          { type: 'footnote', props: { text: '' } } as unknown as never,
          { type: 'crossReference', props: { targetId: 'gone', display: 'number' } } as unknown as never,
        ],
      },
    ];
    const codes = validateOfficeContent(blocks, { variables: {} }).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['unknown-variable', 'invalid-expression', 'empty-note', 'unresolved-reference']));
  });

  it('flags an empty caption label and invalid shape kind via the registry', () => {
    createEditor();
    const issues = editor!.blockRegistry.validate([
      { id: 'c', type: 'caption', props: { label: 'Chart' }, content: [] },
      { id: 's', type: 'shape', props: { kind: 'star', width: 10, height: 10 } },
    ]);
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(['invalid-caption-label', 'empty-caption', 'invalid-shape-kind']));
  });

  it('renders print fragments for block definitions', () => {
    const defs = createOfficeBlockDefinitions({ variables: { procedureType: 'chem' } });
    const byType = (type: string) => defs.find((d) => d.type === type)!;
    expect(byType('caption').renderPrint!({ id: 'c', type: 'caption', props: { label: 'Table', number: 2 }, content: [{ type: 'text', text: 'Data', styles: {} }] }))
      .toContain('Table 2');
    expect(byType('shape').renderPrint!({ id: 's', type: 'shape', props: { kind: 'arrow', width: 60, height: 20 } }))
      .toContain('<svg');
    expect(byType('conditional').renderPrint!({ id: 'c', type: 'conditional', props: { expression: "procedureType == 'micro'" }, children: [] })).toBe('');
    expect(byType('equation').renderPrint!({ id: 'e', type: 'equation', props: { latex: 'a<b' } }))
      .toContain('a&lt;b');
  });

  it('formats computed values', () => {
    expect(formatComputedValue(1234.5, 'number', 1, 'kg')).toBe('1,234.5 kg');
    expect(formatComputedValue(0.256, 'percent', 1)).toBe('25.6%');
    expect(formatComputedValue('x', 'text')).toBe('x');
    expect(() => formatComputedValue('abc', 'number')).toThrow();
  });

  it('exposes slash menu items that insert office nodes', () => {
    createEditor();
    const item = officeSlashItems.find((i) => i.id === 'office-equation')!;
    item.action(editor!.pm.view, {} as never);
    const types: string[] = [];
    editor!.pm.doc.descendants((node) => {
      types.push(node.type.name);
    });
    expect(types).toContain('equation');
  });
});
