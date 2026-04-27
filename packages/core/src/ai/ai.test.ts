import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NodeSpec } from 'prosemirror-model';

import { BeakBlockEditor } from '../editor';
import { docToBlocks } from '../blocks';
import { buildAIContext } from './context';
import { buildAIMessages } from './prompt';
import { applyAIBlockOutput, parseAIBlockOutput } from './output';
import { BUBBLE_AI_PRESETS, SLASH_AI_PRESETS } from './presets';

const widgetNode: NodeSpec = {
  group: 'block',
  content: 'inline*',
  attrs: {
    id: { default: null },
    tone: { default: 'info' },
  },
  parseDOM: [
    {
      tag: 'div[data-widget]',
      getAttrs: (dom: HTMLElement) => ({
        id: dom.getAttribute('data-block-id'),
        tone: dom.getAttribute('data-tone') ?? 'info',
      }),
    },
  ],
  toDOM(node) {
    return ['div', { 'data-widget': 'true', 'data-block-id': String(node.attrs.id ?? ''), 'data-tone': String(node.attrs.tone ?? 'info') }, 0];
  },
};

describe('ai helpers', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  function createEditor(customNodes?: Record<string, NodeSpec>) {
    return new BeakBlockEditor({
      element: container,
      injectStyles: false,
      customNodes,
      initialContent: [
        {
          id: 'p-1',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: 'Hello world', styles: {} }],
        },
      ],
    });
  }

  it('buildAIContext includes schema summaries and selection blocks', () => {
    const editor = createEditor({ widget: widgetNode });
    editor.pm.setSelection(editor.pm.createTextSelection(1, 6));

    const context = buildAIContext(editor, 'bubble', BUBBLE_AI_PRESETS[0], 'Rewrite');
    expect(context.selection?.text).toBe('Hello');
    expect(context.cursor.blockType).toBe('paragraph');
    expect(context.cursor.blockId).toBe('p-1');
    expect(context.cursor.blockEnd).toBeGreaterThan(context.cursor.blockStart);
    expect(context.schema.blockNodes.some((node) => node.name === 'widget')).toBe(true);
    expect(context.schema.blockNodes.some((node) => node.name === 'paragraph')).toBe(true);
    editor.destroy();
  });

  it('captures cursor context even when the selection is collapsed', () => {
    const editor = createEditor();
    editor.pm.setSelection(editor.pm.createTextSelection(7));

    const context = buildAIContext(editor, 'slash', SLASH_AI_PRESETS[0], 'Continue');
    expect(context.selection).toBeNull();
    expect(context.cursor.blockType).toBe('paragraph');
    expect(context.cursor.blockId).toBe('p-1');
    expect(context.cursor.from).toBe(context.cursor.to);
    editor.destroy();
  });

  it('buildAIMessages asks for JSON block output and includes schema context', () => {
    const editor = createEditor({ widget: widgetNode });
    const request = {
      mode: 'slash' as const,
      preset: SLASH_AI_PRESETS[0],
      instruction: 'Continue the document',
      context: buildAIContext(editor, 'slash', SLASH_AI_PRESETS[0], 'Continue the document'),
    };

    const messages = buildAIMessages(request);
    expect(messages[0]?.content).toContain('Return strict JSON only');
    expect(messages[0]?.content).toContain('BeakBlock block JSON');
    expect(messages[0]?.content).toContain('"version": 1');
    expect(messages[1]?.content).toContain('Editor schema block nodes');
    editor.destroy();
  });

  it('parses fenced JSON block output and markdown fallback', () => {
    const json = parseAIBlockOutput(
      '```json\n{"version":1,"blocks":[{"id":"h-1","type":"heading","props":{"level":2},"content":[{"type":"text","text":"Title","styles":{}}]}]}\n```'
    );
    expect(json?.blocks).toHaveLength(1);
    expect(json?.blocks[0]?.type).toBe('heading');

    const markdown = parseAIBlockOutput('# Title\n\nBody paragraph.');
    expect(markdown?.blocks.map((block) => block.type)).toEqual(['heading', 'paragraph']);
  });

  it('normalizes structured container blocks from AI-shaped content trees', () => {
    const parsed = parseAIBlockOutput(
      JSON.stringify({
        version: 1,
        blocks: [
          {
            id: 'cl-1',
            type: 'columnList',
            attrs: { gap: 24 },
            content: [
              {
                id: 'col-a',
                type: 'column',
                attrs: { width: 50 },
                content: [
                  {
                    id: 'p-1',
                    type: 'paragraph',
                    props: {},
                    content: [{ type: 'text', text: 'Left', styles: {} }],
                  },
                ],
              },
            ],
          },
        ],
      })
    );

    expect(parsed?.blocks[0]).toMatchObject({
      id: 'cl-1',
      type: 'columnList',
      props: { gap: 24 },
      children: [
        {
          id: 'col-a',
          type: 'column',
          props: { width: 50 },
          children: [
            {
              id: 'p-1',
              type: 'paragraph',
              props: {},
              content: [{ type: 'text', text: 'Left', styles: {} }],
            },
          ],
        },
      ],
    });
  });

  it('replaces a selected block with structured AI blocks', () => {
    const editor = createEditor();
    const firstBlockPos = 0;
    editor.pm.setSelection(editor.pm.createNodeSelection(firstBlockPos));

    const request = {
      mode: 'bubble' as const,
      preset: BUBBLE_AI_PRESETS[0],
      instruction: 'Rewrite the block',
      context: buildAIContext(editor, 'bubble', BUBBLE_AI_PRESETS[0], 'Rewrite the block'),
    };

    const applied = applyAIBlockOutput(
      editor,
      request,
      JSON.stringify({
        version: 1,
        blocks: [
          {
            id: 'h-1',
            type: 'heading',
            props: { level: 2 },
            content: [{ type: 'text', text: 'Rewritten title', styles: {} }],
          },
        ],
      })
    );

    expect(applied).toBe(true);
    expect(docToBlocks(editor.pm.doc)).toEqual([
      {
        id: 'h-1',
        type: 'heading',
        props: { level: 2, textAlign: 'left', locked: false, lockReason: null, lockId: null },
        content: [{ type: 'text', text: 'Rewritten title', styles: {} }],
      },
    ]);
    editor.destroy();
  });

  it('inserts structured AI blocks after the current block and preserves custom block types', () => {
    const editor = createEditor({ widget: widgetNode });
    editor.pm.setSelection(editor.pm.createTextSelection(1));

    const request = {
      mode: 'slash' as const,
      preset: SLASH_AI_PRESETS[0],
      instruction: 'Add a widget block',
      context: buildAIContext(editor, 'slash', SLASH_AI_PRESETS[0], 'Add a widget block'),
    };

    const applied = applyAIBlockOutput(editor, request, [
      {
        id: 'w-1',
        type: 'widget',
        props: { tone: 'warning' },
        content: [{ type: 'text', text: 'AI widget', styles: {} }],
      },
    ]);

    expect(applied).toBe(true);
    expect(docToBlocks(editor.pm.doc)).toEqual([
      {
        id: 'p-1',
        type: 'paragraph',
        props: { textAlign: 'left' },
        content: [{ type: 'text', text: 'Hello world', styles: {} }],
      },
      {
        id: 'w-1',
        type: 'widget',
        props: { tone: 'warning' },
        content: [{ type: 'text', text: 'AI widget', styles: {} }],
      },
    ]);
    editor.destroy();
  });

  it('uses the captured cursor position when applying slash output without a selection', () => {
    const editor = createEditor();
    editor.pm.setSelection(editor.pm.createTextSelection(12));

    const request = {
      mode: 'slash' as const,
      preset: SLASH_AI_PRESETS[0],
      instruction: 'Insert a follow-up block',
      context: buildAIContext(editor, 'slash', SLASH_AI_PRESETS[0], 'Insert a follow-up block'),
    };

    const applied = applyAIBlockOutput(editor, request, [
      {
        id: 'p-2',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Follow-up', styles: {} }],
      },
    ]);

    expect(applied).toBe(true);
    expect(docToBlocks(editor.pm.doc).map((block) => block.id)).toEqual(['p-1', 'p-2']);
    editor.destroy();
  });

  it('replaces the full top-level block when applying structured block output', () => {
    const editor = createEditor();
    editor.pm.setSelection(editor.pm.createTextSelection(6));

    const request = {
      mode: 'bubble' as const,
      preset: BUBBLE_AI_PRESETS[0],
      instruction: 'Insert a layout block',
      context: buildAIContext(editor, 'bubble', BUBBLE_AI_PRESETS[0], 'Insert a layout block'),
    };

    const applied = applyAIBlockOutput(
      editor,
      request,
      JSON.stringify({
        version: 1,
        blocks: [
          {
            id: 'cl-1',
            type: 'columnList',
            attrs: { gap: 24 },
            content: [
              {
                id: 'col-a',
                type: 'column',
                attrs: { width: 50 },
                content: [
                  {
                    id: 'p-a',
                    type: 'paragraph',
                    props: {},
                    content: [{ type: 'text', text: 'Left', styles: {} }],
                  },
                ],
              },
              {
                id: 'col-b',
                type: 'column',
                attrs: { width: 50 },
                content: [
                  {
                    id: 'p-b',
                    type: 'paragraph',
                    props: {},
                    content: [{ type: 'text', text: 'Right', styles: {} }],
                  },
                ],
              },
            ],
          },
        ],
      })
    );

    expect(applied).toBe(true);
    expect(docToBlocks(editor.pm.doc)).toEqual([
      {
        id: 'cl-1',
        type: 'columnList',
        props: { gap: 24 },
        children: [
          {
            id: 'col-a',
            type: 'column',
            props: { width: 50 },
            children: [
              {
                id: 'p-a',
                type: 'paragraph',
                props: { textAlign: 'left' },
                content: [{ type: 'text', text: 'Left', styles: {} }],
              },
            ],
          },
          {
            id: 'col-b',
            type: 'column',
            props: { width: 50 },
            children: [
              {
                id: 'p-b',
                type: 'paragraph',
                props: { textAlign: 'left' },
                content: [{ type: 'text', text: 'Right', styles: {} }],
              },
            ],
          },
        ],
      },
    ]);
    editor.destroy();
  });
});
