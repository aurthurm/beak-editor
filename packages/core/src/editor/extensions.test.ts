import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Plugin, PluginKey } from 'prosemirror-state';
import { BeakBlockEditor } from './Editor';
import type { BeakExtension } from '../extensions';
import type { BeakBlockDefinition } from '../registry';

const probeKey = new PluginKey<number>('probe');

describe('extensions', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('registers extension nodes, marks, plugins and blocks', () => {
    const calloutBlock: BeakBlockDefinition = {
      type: 'warningNote',
      version: 1,
      family: 'clinical',
      capabilities: { editable: true, nested: false, printable: true, splittable: true, collaborative: true },
      validate: (block) =>
        block.props.severity
          ? []
          : [{ severity: 'error', code: 'missing-severity', message: 'Severity is required' }],
    };

    const extension: BeakExtension = {
      name: 'test-ext',
      nodes: {
        warningNote: {
          group: 'block',
          content: 'inline*',
          attrs: { id: { default: null }, severity: { default: 'low' } },
          parseDOM: [{ tag: 'aside[data-warning]' }],
          toDOM: () => ['aside', { 'data-warning': 'true' }, 0],
        },
      },
      marks: {
        highlight: {
          parseDOM: [{ tag: 'mark' }],
          toDOM: () => ['mark', 0],
        },
      },
      plugins: ({ schema }) => {
        expect(schema.nodes.warningNote).toBeDefined();
        return [
          new Plugin<number>({
            key: probeKey,
            state: { init: () => 42, apply: (_tr, value) => value },
          }),
        ];
      },
      blocks: [calloutBlock],
    };

    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      extensions: [extension],
      initialContent: [
        {
          id: 'w1',
          type: 'warningNote',
          props: { severity: 'high' },
          content: [{ type: 'text', text: 'Careful', styles: {} }],
        },
      ],
    });

    expect(editor.pm.state.schema.nodes.warningNote).toBeDefined();
    expect(editor.pm.state.schema.marks.highlight).toBeDefined();
    expect(probeKey.getState(editor.pm.state)).toBe(42);
    expect(editor.blockRegistry.has('warningNote')).toBe(true);
    expect(editor.blockRegistry.get('warningNote')?.family).toBe('clinical');
    expect(editor.getDocument()[0]?.type).toBe('warningNote');

    const issues = editor.blockRegistry.validate([
      { id: 'w2', type: 'warningNote', props: {}, content: [] },
    ]);
    expect(issues.map((i) => i.code)).toEqual(['missing-severity']);
    editor.destroy();
  });

  it('accepts customMarks and customMarks merge with defaults', () => {
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      customMarks: {
        keyword: { parseDOM: [{ tag: 'kbd' }], toDOM: () => ['kbd', 0] },
      },
    });
    expect(editor.pm.state.schema.marks.keyword).toBeDefined();
    expect(editor.pm.state.schema.marks.bold).toBeDefined();
    editor.destroy();
  });

  it('extension node views are used for their node type', () => {
    const calls: string[] = [];
    const extension: BeakExtension = {
      name: 'views',
      nodeViews: {
        divider: (node) => {
          calls.push(node.type.name);
          const dom = document.createElement('hr');
          return { dom };
        },
      },
    };
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      extensions: [extension],
      initialContent: [{ id: 'd', type: 'divider', props: {} }],
    });
    expect(calls).toContain('divider');
    editor.destroy();
  });

  it('rejects duplicate block registration without replace', () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false });
    expect(() =>
      editor.blockRegistry.register({
        type: 'paragraph',
        version: 1,
        family: 'text',
        capabilities: { editable: true, nested: false, printable: true, splittable: true, collaborative: true },
      })
    ).toThrow(/already registered/);
    editor.destroy();
  });
});
