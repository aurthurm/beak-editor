/**
 * @module
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { BeakBlockEditor } from '../editor/Editor';
import { moveBlock } from './dragDropPlugin';
import { COMPLIANCE_LOCK_BYPASS_META } from './complianceLockPlugin';

describe('compliance lock plugin', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('blocks insertText inside a locked heading', () => {
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      complianceLock: {},
      initialContent: [
        {
          id: 'h',
          type: 'heading',
          props: { level: 1, locked: true },
          content: [{ type: 'text', text: 'Title', styles: {} }],
        },
        { id: 'p', type: 'paragraph', props: {}, content: [] },
      ],
    });

    const before = editor.getDocument();
    const { state, dispatch } = editor.pm.view;
    let insertPos = 0;
    state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Title') {
        insertPos = pos + node.nodeSize;
        return false;
      }
      return true;
    });
    dispatch(state.tr.insertText('!', insertPos));
    expect(editor.getDocument()).toEqual(before);
    editor.destroy();
  });

  it('allows inserting a paragraph before a locked heading', () => {
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      complianceLock: {},
      initialContent: [
        {
          id: 'h',
          type: 'heading',
          props: { level: 1, locked: true },
          content: [{ type: 'text', text: 'Title', styles: {} }],
        },
      ],
    });

    const { state, dispatch } = editor.pm.view;
    dispatch(state.tr.insert(state.doc.resolve(1).before(), editor.pm.schema.node('paragraph', { id: 'np' })));
    expect(editor.getDocument().length).toBe(2);
    expect(editor.getDocument()[0]?.type).toBe('paragraph');
    editor.destroy();
  });

  it('blocks deleting a locked heading', () => {
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      complianceLock: {},
      initialContent: [
        {
          id: 'h',
          type: 'heading',
          props: { level: 1, locked: true },
          content: [{ type: 'text', text: 'T', styles: {} }],
        },
      ],
    });

    const before = editor.getDocument();
    const { state, dispatch } = editor.pm.view;
    let hPos = 0;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && node.attrs.id === 'h') {
        hPos = pos;
        return false;
      }
      return true;
    });
    const h = state.doc.nodeAt(hPos);
    expect(h).toBeTruthy();
    if (!h) return;
    dispatch(state.tr.delete(hPos, hPos + h.nodeSize));
    expect(editor.getDocument()).toEqual(before);
    editor.destroy();
  });

  it('allows edits when COMPLIANCE_LOCK_BYPASS_META is set', () => {
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      complianceLock: {},
      initialContent: [
        {
          id: 'h',
          type: 'heading',
          props: { level: 1, locked: true },
          content: [{ type: 'text', text: 'Title', styles: {} }],
        },
      ],
    });

    const { state, dispatch } = editor.pm.view;
    let insertPos = 0;
    state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Title') {
        insertPos = pos + node.nodeSize;
        return false;
      }
      return true;
    });
    const tr = state.tr.insertText('!', insertPos).setMeta(COMPLIANCE_LOCK_BYPASS_META, true);
    dispatch(tr);
    const text = editor
      .getDocument()[0]
      ?.content?.find((c) => c.type === 'text') as { text?: string } | undefined;
    expect(text?.text).toContain('!');
    editor.destroy();
  });

  it('rejects reordering two locked headings when allowReorder is false', () => {
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      complianceLock: { allowReorder: false },
      initialContent: [
        {
          id: 'a',
          type: 'heading',
          props: { level: 2, locked: true },
          content: [{ type: 'text', text: 'A', styles: {} }],
        },
        {
          id: 'b',
          type: 'heading',
          props: { level: 2, locked: true },
          content: [{ type: 'text', text: 'B', styles: {} }],
        },
      ],
    });

    const before = editor.getDocument();
    const { state } = editor.pm.view;
    let bPos = 0;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && node.attrs.id === 'b') {
        bPos = pos;
        return false;
      }
      return true;
    });

    moveBlock(editor.pm.view, bPos, 0);
    expect(editor.getDocument().map((x) => x.id)).toEqual(before.map((x) => x.id));
    editor.destroy();
  });

  it('allows reordering two locked headings when allowReorder is true', () => {
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      complianceLock: { allowReorder: true },
      initialContent: [
        {
          id: 'a',
          type: 'heading',
          props: { level: 2, locked: true },
          content: [{ type: 'text', text: 'A', styles: {} }],
        },
        {
          id: 'b',
          type: 'heading',
          props: { level: 2, locked: true },
          content: [{ type: 'text', text: 'B', styles: {} }],
        },
      ],
    });

    const { state } = editor.pm.view;
    let bPos = 0;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && node.attrs.id === 'b') {
        bPos = pos;
        return false;
      }
      return true;
    });

    moveBlock(editor.pm.view, bPos, 0);
    const ids = editor.getDocument().map((x) => x.id);
    expect(ids[0]).toBe('b');
    expect(ids[1]).toBe('a');
    editor.destroy();
  });
});
