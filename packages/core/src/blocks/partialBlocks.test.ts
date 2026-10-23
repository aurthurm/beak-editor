/**
 * Input blocks (`PartialBlock`) load without an `id` or `props`, and the editor fills
 * the defaults. The type-level checks at the bottom run under `tsc --noEmit` (see the
 * `typecheck` script), since vitest does not type-check.
 *
 * @module
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BeakBlockEditor } from '../editor/Editor';
import type { EditorConfig } from '../editor/EditorConfig';
import { createSchema } from '../schema/createSchema';
import { blockToNode, normalizeBlock } from './blockToNode';
import { blocksToDoc } from './blockToNode';
import { docToBlocks } from './nodeToBlock';
import type { Block, InlineContent, PartialBlock, TextStyles } from './types';

const text = (t: string) => ({ type: 'text' as const, text: t, styles: {} });

const schema = createSchema();

describe('normalizeBlock', () => {
  it('generates ids and empty props for a bare block', () => {
    const out = normalizeBlock({ type: 'paragraph', content: [text('x')] });
    expect(typeof out.id).toBe('string');
    expect(out.id.length).toBeGreaterThan(0);
    expect(out.props).toEqual({});
    expect(out.content).toEqual([text('x')]);
  });

  it('keeps a supplied id and props', () => {
    const out = normalizeBlock({ id: 'h1', type: 'heading', props: { level: 2 } });
    expect(out).toEqual({ id: 'h1', type: 'heading', props: { level: 2 } });
  });

  it('normalizes children recursively and gives each a distinct id', () => {
    const out = normalizeBlock({
      type: 'columnList',
      children: [
        { type: 'column', children: [{ type: 'paragraph', content: [text('a')] }] },
        { type: 'column', children: [{ type: 'paragraph', content: [text('b')] }] },
      ],
    });
    const [colA, colB] = out.children as Block[];
    const leafA = colA!.children![0]!;
    const leafB = colB!.children![0]!;
    expect(leafA.props).toEqual({});
    expect(leafB.props).toEqual({});
    const ids = [out.id, colA!.id, colB!.id, leafA.id, leafB.id];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('partial blocks through blocksToDoc and blockToNode', () => {
  it('loads blocks without id or props and round-trips with generated fields', () => {
    const doc = blocksToDoc(schema, [
      { type: 'paragraph', content: [text('Hello')] },
      { type: 'heading', props: { level: 1 }, content: [text('Title')] },
    ]);
    const out = docToBlocks(doc);
    expect(out).toHaveLength(2);
    expect(out[0]!.id).toBeTruthy();
    expect(out[0]!.content).toEqual([text('Hello')]);
    expect(out[1]!.id).toBeTruthy();
    expect(out[1]!.props).toMatchObject({ level: 1 });
  });

  it('keeps unknown block types working when props are omitted', () => {
    const node = blockToNode(schema, { type: 'paragraph', content: [] });
    expect(node.type.name).toBe('paragraph');
    expect(node.attrs.id).toBeTruthy();
  });
});

describe('BeakBlockEditor partial input', () => {
  let container: HTMLElement;
  let editor: BeakBlockEditor | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    container.remove();
  });

  it('accepts partial initialContent and assigns ids and props', () => {
    editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      initialContent: [
        { type: 'paragraph', content: [text('Intro')] },
        { type: 'heading', props: { level: 2 }, content: [text('Section')] },
      ],
    });
    const blocks = editor.getDocument();
    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      expect(block.id).toBeTruthy();
      expect(block.props).toBeDefined();
    }
    // Node attr defaults (for example textAlign) are filled in by the schema.
    expect(blocks[1]!.props).toMatchObject({ level: 2 });
    expect(blocks[0]!.content).toEqual([text('Intro')]);
  });

  it('accepts partial children in initialContent', () => {
    editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      initialContent: [
        {
          type: 'columnList',
          children: [{ type: 'column', children: [{ type: 'paragraph', content: [text('Left')] }] }],
        },
      ],
    });
    const [list] = editor.getDocument();
    expect(list!.id).toBeTruthy();
    const column = list!.children![0]!;
    expect(column.id).toBeTruthy();
    expect(column.children![0]!.content).toEqual([text('Left')]);
  });

  it('setDocument and insertBlocks accept partial blocks', () => {
    editor = new BeakBlockEditor({ element: container, injectStyles: false });
    editor.setDocument([{ type: 'paragraph', content: [text('First')] }]);
    const [first] = editor.getDocument();
    editor.insertBlocks([{ type: 'paragraph', content: [text('Second')] }], first!.id, 'after');
    const blocks = editor.getDocument();
    expect(blocks.map((b) => b.content)).toEqual([[text('First')], [text('Second')]]);
    expect(blocks[1]!.id).toBeTruthy();
    expect(blocks[1]!.id).not.toBe(first!.id);
  });
});

// ---------------------------------------------------------------------------
// Type-level checks (compiled by `tsc --noEmit`, not executed)
// ---------------------------------------------------------------------------

describe('PartialBlock types', () => {
  it('compiles the docs-style initialContent shape', () => {
    const config: Pick<EditorConfig, 'initialContent'> = {
      initialContent: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', styles: {} }] }],
    };
    const input: PartialBlock[] = config.initialContent ?? [];
    expect(input).toHaveLength(1);
  });

  it('requires type but not id or props', () => {
    const ok: PartialBlock = { type: 'divider' };
    // @ts-expect-error - `type` is required
    const missingType: PartialBlock = { content: [] };
    expect(ok.type).toBe('divider');
    expect(missingType).toBeDefined();
  });

  it('keeps Block assignable to PartialBlock', () => {
    const full: Block = { id: 'a', type: 'paragraph', props: {}, content: [] };
    const asInput: PartialBlock = full;
    expect(asInput.id).toBe('a');
  });
});

describe('InlineContent narrowing', () => {
  it('narrows built-in kinds with plain type checks', () => {
    const item = { type: 'text', text: 'x', styles: { bold: true } } as InlineContent;
    if (item.type === 'text') {
      const styles: TextStyles = item.styles;
      expect(styles.bold).toBe(true);
    } else {
      throw new Error('expected text');
    }
    const link = { type: 'link', href: 'https://example.com', content: [text('go')] } as InlineContent;
    if (link.type === 'link') {
      expect(link.href).toBe('https://example.com');
    }
  });
});
