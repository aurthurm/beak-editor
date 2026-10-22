import { describe, it, expect, afterEach } from 'vitest';
import { BeakBlockEditor } from '@amusendame/beakblock-core';
import type { Block } from '@amusendame/beakblock-core';
import { countWords, getHeadings, getSectionContext, getParagraphContext, selectRange } from './editorUtils';

let counter = 0;
const text = (value: string) => ({ type: 'text' as const, text: value, styles: {} });
const paragraph = (value: string): Block =>
  ({ id: `p-${++counter}`, type: 'paragraph', props: {}, content: [text(value)] }) as Block;
const heading = (level: number, value: string): Block =>
  ({ id: `h-${++counter}`, type: 'heading', props: { level }, content: [text(value)] }) as Block;

let editor: BeakBlockEditor | null = null;

function create(blocks: Block[]): BeakBlockEditor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  editor = new BeakBlockEditor({ element, initialContent: blocks });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

describe('editorUtils against a real editor', () => {
  it('lists headings in document order with levels and text', () => {
    const e = create([
      heading(1, 'Intro'),
      paragraph('Body text'),
      heading(2, 'Details'),
    ]);
    const headings = getHeadings(e);
    expect(headings.map((h) => [h.level, h.text])).toEqual([
      [1, 'Intro'],
      [2, 'Details'],
    ]);
  });

  it('counts words across blocks', () => {
    const e = create([
      paragraph('one two three'),
      paragraph('four'),
    ]);
    expect(countWords(e)).toBe(4);
  });

  it('returns no controlled section outside a controlledSection', () => {
    const e = create([paragraph('plain')]);
    expect(getSectionContext(e)).toBeNull();
  });

  it('finds the paragraph around the selection and selects a range', () => {
    const e = create([
      paragraph('first'),
      paragraph('second'),
    ]);
    selectRange(e, 2);
    const para = getParagraphContext(e);
    expect(para?.node.textContent).toBe('first');
    expect(e.pm.state.selection.from).toBe(2);
  });
});
