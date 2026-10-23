/**
 * Unknown content in the editor: it round-trips through setDocument and getDocument, is reported by
 * getLoadDiagnostics and the `loadDiagnostics` event, can be deleted, and cannot be edited.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node as PMNode } from 'prosemirror-model';
import { BeakBlockEditor } from './Editor';
import type { Block } from '../blocks/types';

const text = (value: string) => ({ type: 'text' as const, text: value, styles: {} });

const input = [
  {
    id: 'h-1',
    type: 'hologram',
    props: { depth: 4, projection: 'front' },
    children: [{ id: 'p-in', type: 'paragraph', props: { textAlign: 'left' }, content: [text('inner')] }],
  },
  {
    id: 'p-1',
    type: 'paragraph',
    props: { textAlign: 'left', mystery: { nested: [1, { deep: true }] } },
    content: [text('Inline: '), { type: 'mystery', props: { code: 'X-9' } }, text(' continues.')],
  },
  { id: 't-1', type: 'telemetry', props: { channels: ['a'] } },
] as unknown as Block[];

describe('editor: unknown content', () => {
  let container: HTMLElement;
  let editor: BeakBlockEditor;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new BeakBlockEditor({ element: container, injectStyles: false });
  });

  afterEach(() => {
    editor.destroy();
    container.remove();
    vi.restoreAllMocks();
  });

  function findUnknownBlock(): { node: PMNode; pos: number } {
    let found: { node: PMNode; pos: number } | null = null;
    editor.pm.doc.descendants((node, pos) => {
      if (!found && node.type.name === 'unknownBlock') found = { node, pos };
      return found === null;
    });
    if (!found) throw new Error('no unknownBlock in document');
    return found;
  }

  it('round-trips unknown blocks, unknown inline items and unknown props unchanged', () => {
    editor.setDocument(input);
    expect(editor.getDocument()).toEqual(input);
  });

  it('reports unknown content through getLoadDiagnostics', () => {
    editor.setDocument(input);
    const issues = editor.getLoadDiagnostics();
    expect(issues.map((issue) => issue.code).sort()).toEqual(
      ['unknown-block-prop', 'unknown-inline-type', 'unregistered-block-type', 'unregistered-block-type'].sort()
    );
    expect(issues.find((issue) => issue.code === 'unknown-inline-type')).toMatchObject({
      severity: 'warning',
      blockId: 'p-1',
    });
    expect(issues.find((issue) => issue.code === 'unknown-block-prop')).toMatchObject({ blockId: 'p-1' });
    expect(issues.filter((issue) => issue.code === 'unregistered-block-type').map((issue) => issue.blockId)).toEqual([
      'h-1',
      't-1',
    ]);
  });

  it('returns no diagnostics for a document with only known content', () => {
    editor.setDocument([{ id: 'p-9', type: 'paragraph', props: { textAlign: 'left' }, content: [text('plain')] }]);
    expect(editor.getLoadDiagnostics()).toEqual([]);
  });

  it('emits loadDiagnostics with the issues when a load is accepted', () => {
    const handler = vi.fn();
    editor.on('loadDiagnostics', handler);
    editor.setDocument(input);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0].issues).toEqual(editor.getLoadDiagnostics());
  });

  it('does not emit loadDiagnostics for a clean load', () => {
    const handler = vi.fn();
    editor.on('loadDiagnostics', handler);
    editor.setDocument([{ id: 'p-9', type: 'paragraph', props: { textAlign: 'left' }, content: [text('plain')] }]);
    expect(handler).not.toHaveBeenCalled();
  });

  it('allows deleting an unknown block', () => {
    editor.setDocument(input);
    const { node, pos } = findUnknownBlock();
    const tr = editor.pm.createTransaction();
    tr.delete(pos, pos + node.nodeSize);
    editor.pm.dispatch(tr);

    const ids = editor.getDocument().map((block) => block.id);
    expect(ids).not.toContain('h-1');
    expect(ids).toContain('t-1');
    expect(editor.getLoadDiagnostics().some((issue) => issue.blockId === 'h-1')).toBe(false);
  });

  it('does not let text be typed into an unknown block', () => {
    editor.setDocument(input);
    const { node, pos } = findUnknownBlock();
    const before = JSON.stringify(node.attrs);

    // Typing at the boundary of the atom must not change the placeholder's content.
    const tr = editor.pm.createTransaction();
    tr.insertText('edited', pos + 1);
    if (tr.docChanged) editor.pm.dispatch(tr);

    const after = findUnknownBlock();
    expect(after.node.childCount).toBe(0);
    expect(after.node.isAtom).toBe(true);
    expect(JSON.stringify(after.node.attrs)).toBe(before);
    expect(editor.getDocument().find((block) => block.id === 'h-1')).toEqual(input[0]);
  });
});
