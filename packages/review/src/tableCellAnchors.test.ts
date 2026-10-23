/**
 * Comments anchored inside a table cell paragraph must survive a getDocument/setDocument round-trip.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Block } from '@amusendame/beakblock-core';
import { BeakBlockEditor } from '@amusendame/beakblock-core';
import { TextSelection } from 'prosemirror-state';

import { createCommentAnchorFromSelection, reanchorComments } from './comments';
import type { AnchoredComment } from './types';

const text = (value: string) => ({ type: 'text' as const, text: value, styles: {} });

const blocks = (): Block[] => [
  { id: 'p-intro', type: 'paragraph', props: {}, content: [text('Intro')] },
  {
    id: 'tbl-1',
    type: 'table',
    props: {},
    children: [
      {
        id: 'row-1',
        type: 'tableRow',
        props: {},
        children: [
          {
            id: 'cell-1',
            type: 'tableCell',
            props: {},
            content: [text('Wear gloves at all times')],
          },
        ],
      },
    ],
  },
];

/** Selects `[from, to)` of the text inside the textblock whose text is `needle`. */
function selectInside(editor: BeakBlockEditor, needle: string, from: number, to: number): void {
  let start = -1;
  editor.pm.state.doc.descendants((node, pos) => {
    if (start < 0 && node.isTextblock && node.textContent === needle) start = pos + 1;
    return start < 0;
  });
  if (start < 0) throw new Error(`no textblock "${needle}"`);
  editor.pm.dispatch(
    editor.pm.state.tr.setSelection(TextSelection.create(editor.pm.state.doc, start + from, start + to))
  );
}

describe('comments in table cells', () => {
  let container: HTMLElement;
  let editor: BeakBlockEditor;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new BeakBlockEditor({ element: container, injectStyles: false });
    editor.setDocument(blocks());
  });

  afterEach(() => {
    editor.destroy();
    container.remove();
  });

  it('anchors to the table cell paragraph and is not orphaned after getDocument/setDocument', () => {
    selectInside(editor, 'Wear gloves at all times', 5, 11);
    const before = editor.getDocument();
    const anchor = createCommentAnchorFromSelection(before, editor.pm.state.selection);
    expect(anchor).not.toBeNull();

    const cellParagraph = before[1]!.children![0]!.children![0]!.children![0]!;
    expect(anchor!.blockId).toBe(cellParagraph.id);
    expect(anchor!.quote).toBe('gloves');

    const comment: AnchoredComment = {
      id: 'c1',
      anchor: anchor!,
      thread: [],
      status: 'open',
    };

    editor.setDocument(editor.getDocument());
    const [after] = reanchorComments(editor.getDocument(), [comment]);
    expect(after!.orphaned).toBe(false);
    expect(after!.anchor.blockId).toBe(cellParagraph.id);
  });

  it('keeps the cell paragraph id across repeated reads', () => {
    const first = editor.getDocument()[1]!.children![0]!.children![0]!.children![0]!.id;
    const second = editor.getDocument()[1]!.children![0]!.children![0]!.children![0]!.id;
    expect(second).toBe(first);
  });
});
