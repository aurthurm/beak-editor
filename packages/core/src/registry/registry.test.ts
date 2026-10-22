import { describe, expect, it } from 'vitest';
import { BlockRegistry, createDefaultBlockRegistry } from './index';
import type { Block } from '../blocks/types';

describe('default block registry', () => {
  it('defines every built-in block type', () => {
    const registry = createDefaultBlockRegistry();
    for (const type of [
      'doc', 'paragraph', 'heading', 'blockquote', 'callout', 'codeBlock', 'divider',
      'bulletList', 'orderedList', 'listItem', 'checkList', 'checkListItem',
      'columnList', 'column', 'table', 'tableRow', 'tableCell', 'tableHeader',
      'image', 'embed', 'tableOfContents', 'pageBreak', 'sectionBreak', 'field',
    ]) {
      expect(registry.has(type), type).toBe(true);
    }
    expect(registry.get('pageBreak')?.family).toBe('office');
    expect(registry.list('text').length).toBeGreaterThan(0);
  });
});

describe('BlockRegistry.validate', () => {
  it('validates nested children and reports paths', () => {
    const registry = createDefaultBlockRegistry();
    const blocks: Block[] = [
      { id: 'ok', type: 'paragraph', props: {}, content: [] },
      {
        id: 'list',
        type: 'bulletList',
        props: {},
        children: [
          {
            id: 'item',
            type: 'listItem',
            props: {},
            children: [{ id: 'bad-heading', type: 'heading', props: { level: 9 } }],
          },
        ],
      },
    ];
    const issues = registry.validate(blocks);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      severity: 'error',
      code: 'invalid-heading-level',
      blockId: 'bad-heading',
      path: '1/children/0/children/0',
    });
  });

  it('flags invalid field types in inline content', () => {
    const registry = createDefaultBlockRegistry();
    const issues = registry.validate([
      {
        id: 'p',
        type: 'paragraph',
        props: {},
        content: [{ type: 'field', fieldType: 'NOPE', name: null }],
      },
    ]);
    expect(issues.map((i) => i.code)).toEqual(['invalid-field-type']);
  });

  it('validates section page setup sizes', () => {
    const registry = createDefaultBlockRegistry();
    const issues = registry.validate([
      { id: 'sb', type: 'sectionBreak', props: { pageSetup: { size: { widthTwips: 0, heightTwips: 100 } } } },
    ]);
    expect(issues[0]?.code).toBe('invalid-page-setup');
  });

  it('warns about unregistered block types and passes section id through', () => {
    const registry = new BlockRegistry();
    registry.register({
      type: 'note',
      version: 1,
      family: 'text',
      capabilities: { editable: true, nested: false, printable: true, splittable: true, collaborative: true },
      validate: () => [{ severity: 'info', code: 'note', message: 'hello' }],
    });
    const issues = registry.validate(
      [{ id: 'x', type: 'mystery', props: {} }, { id: 'n', type: 'note', props: {} }],
      { sectionId: 'sec-1' }
    );
    expect(issues).toEqual([
      expect.objectContaining({ severity: 'warning', code: 'unregistered-block-type', blockId: 'x', path: '0' }),
      expect.objectContaining({ severity: 'info', code: 'note', blockId: 'n', path: '1', sectionId: 'sec-1' }),
    ]);
  });
});
