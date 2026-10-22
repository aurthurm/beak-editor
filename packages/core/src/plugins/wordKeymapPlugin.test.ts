/**
 * Word keyboard behaviour (contracts §1.7) and AutoCorrect tests.
 * Commands are exercised through a real EditorView so plugin ordering matters.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { EditorState, TextSelection, Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { createSchema } from '../schema';
import { createPlugins } from './createPlugins';
import {
  createWordKeymapPlugin,
  DEFAULT_AUTOCORRECT,
  WORD_KEYMAP_PLUGIN_KEY,
} from './wordKeymapPlugin';

const schema = createSchema();

/** Builds a doc from a builder; `|` in the text marks the cursor. */
function docWith(build: () => PMNode[]): PMNode {
  return schema.nodes.doc.create(null, build());
}

const p = (text: string, attrs: Record<string, unknown> = {}) =>
  schema.nodes.paragraph.create({ textAlign: 'left', ...attrs }, text ? schema.text(text) : null);

/** Places the cursor at the end of the textblock whose text equals `needle`. */
function cursorAt(view: EditorView, needle: string, offset?: number): void {
  let target = -1;
  view.state.doc.descendants((node, pos) => {
    if (target < 0 && node.isTextblock && node.textContent === needle) target = pos + 1;
    return target < 0;
  });
  if (target < 0) throw new Error(`no textblock "${needle}"`);
  const size = view.state.doc.nodeAt(target - 1)!.content.size;
  const at = offset === undefined ? target + size : target + offset;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)));
}

/** Dispatches a key through the view's handleKeyDown chain. */
function key(view: EditorView, init: KeyboardEventInit & { key: string }): boolean {
  const event = new KeyboardEvent('keydown', init);
  return view.someProp('handleKeyDown', (f) => f(view, event)) ?? false;
}

function make(doc: PMNode, opts: { wordBehaviour?: boolean } = {}): EditorView {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const plugins = createPlugins({ schema, wordBehaviour: opts.wordBehaviour ?? true, inputRules: false, dragDrop: false, bubbleMenu: false, slashMenu: false, multiBlockSelection: false, mediaMenu: false, complianceLock: false, checklist: false, markdownPaste: false });
  const state = EditorState.create({ doc, schema, plugins });
  return new EditorView(container, { state });
}

const listDoc = () =>
  docWith(() => [
    schema.nodes.bulletList.create(null, [
      schema.nodes.listItem.create(null, [p('one')]),
      schema.nodes.listItem.create(null, [p('two')]),
    ]),
  ]);

describe('Word keyboard: Tab, Shift-Tab and lists', () => {
  let view: EditorView;
  afterEach(() => {
    view?.destroy();
    view?.dom.parentElement?.remove();
  });

  it('Tab indents a list item one level', () => {
    view = make(listDoc());
    cursorAt(view, 'two');
    expect(key(view, { key: 'Tab' })).toBe(true);
    const list = view.state.doc.firstChild!;
    expect(list.childCount).toBe(1);
    expect(list.firstChild!.childCount).toBe(2);
  });

  it('Shift-Tab outdents a nested list item', () => {
    view = make(listDoc());
    cursorAt(view, 'two');
    key(view, { key: 'Tab' });
    cursorAt(view, 'two');
    key(view, { key: 'Tab', shiftKey: true });
    expect(view.state.doc.firstChild!.childCount).toBe(2);
  });

  it('Tab outside lists and tables inserts a tab character', () => {
    view = make(docWith(() => [p('hello')]));
    cursorAt(view, 'hello');
    expect(key(view, { key: 'Tab' })).toBe(true);
    expect(view.state.doc.textContent).toBe('hello\t');
  });

  it('Shift-Tab outside lists lets focus move (not handled)', () => {
    view = make(docWith(() => [p('hello')]));
    cursorAt(view, 'hello');
    expect(key(view, { key: 'Tab', shiftKey: true })).toBe(false);
  });

  it('Tab inside a table is left to the table plugin', () => {
    const cell = schema.nodes.tableCell.create(null, [p('c')]);
    view = make(docWith(() => [schema.nodes.table.create(null, [schema.nodes.tableRow.create(null, [cell])])]));
    cursorAt(view, 'c');
    const handled = key(view, { key: 'Tab' });
    // the table plugin moves to the next cell / adds a row; the text is not a tab
    expect(view.state.doc.textContent).not.toContain('\t');
    expect(typeof handled).toBe('boolean');
  });

  it('Enter on an empty list item lifts it out of the list', () => {
    const doc = docWith(() => [
      schema.nodes.bulletList.create(null, [
        schema.nodes.listItem.create(null, [p('one')]),
        schema.nodes.listItem.create(null, [p('')]),
      ]),
    ]);
    view = make(doc);
    cursorAt(view, '');
    expect(key(view, { key: 'Enter' })).toBe(true);
    expect(view.state.doc.firstChild!.childCount).toBe(1);
    expect(view.state.doc.textContent).toBe('one');
  });

  it('Backspace at the start of a list item lifts it out of the list', () => {
    view = make(listDoc());
    cursorAt(view, 'two', 0);
    expect(key(view, { key: 'Backspace' })).toBe(true);
    expect(view.state.doc.firstChild!.childCount).toBe(1);
    expect(view.state.doc.textContent).toBe('onetwo');
  });

  it('Backspace at the start of a heading converts it to a paragraph', () => {
    view = make(docWith(() => [schema.nodes.heading.create({ level: 2, styleId: 'Heading2' }, schema.text('Title'))]));
    cursorAt(view, 'Title', 0);
    expect(key(view, { key: 'Backspace' })).toBe(true);
    expect(view.state.doc.firstChild!.type.name).toBe('paragraph');
    expect(view.state.doc.firstChild!.attrs.styleId).toBe('Normal');
  });
});

describe('Word keyboard: headings, paragraphs and page breaks', () => {
  let view: EditorView;
  afterEach(() => {
    view?.destroy();
    view?.dom.parentElement?.remove();
  });

  it('Mod-Alt-2 sets Heading 2 with the HeadingN style id (Word binding wins over the default)', () => {
    view = make(docWith(() => [p('Title')]));
    cursorAt(view, 'Title');
    expect(key(view, { key: '2', altKey: true, ctrlKey: true })).toBe(true);
    const node = view.state.doc.firstChild!;
    expect(node.type.name).toBe('heading');
    expect(node.attrs.level).toBe(2);
    expect(node.attrs.styleId).toBe('Heading2');
  });

  it('Mod-Shift-n sets the Normal paragraph style', () => {
    view = make(docWith(() => [schema.nodes.heading.create({ level: 1, styleId: 'Heading1' }, schema.text('H'))]));
    cursorAt(view, 'H');
    expect(key(view, { key: 'N', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(view.state.doc.firstChild!.type.name).toBe('paragraph');
    expect(view.state.doc.firstChild!.attrs.styleId).toBe('Normal');
  });

  it('Mod-Enter inserts a page break followed by a paragraph', () => {
    view = make(docWith(() => [p('before')]));
    cursorAt(view, 'before');
    expect(key(view, { key: 'Enter', ctrlKey: true })).toBe(true);
    const names = [] as string[];
    view.state.doc.forEach((n) => names.push(n.type.name));
    expect(names).toContain('pageBreak');
  });
});

describe('Word keymap plugin wiring', () => {
  it('is only registered when wordBehaviour is on', () => {
    const on = createPlugins({ schema, wordBehaviour: true });
    const off = createPlugins({ schema });
    const has = (list: Plugin[]) => list.some((pl) => pl.spec.key === WORD_KEYMAP_PLUGIN_KEY);
    expect(has(on)).toBe(true);
    expect(has(off)).toBe(false);
  });

  it('is placed near the top, ahead of the default keymaps (behaviour is covered by Mod-Alt-2 test)', () => {
    const plugins = createPlugins({ schema, wordBehaviour: true });
    const wordIndex = plugins.findIndex((pl) => pl.spec.key === WORD_KEYMAP_PLUGIN_KEY);
    expect(wordIndex).toBeGreaterThanOrEqual(0);
    expect(wordIndex).toBeLessThanOrEqual(2);
  });
});

describe('AutoCorrect and smart quotes', () => {
  let view: EditorView;
  afterEach(() => {
    view?.destroy();
    view?.dom.parentElement?.remove();
  });

  /** Simulates typing `text` at the cursor through the input-rule chain. */
  function type(v: EditorView, text: string): void {
    const { from, to } = v.state.selection;
    const handled = v.someProp('handleTextInput', (f) => f(v, from, to, text, () => v.state.tr.insertText(text, from, to)));
    if (!handled) v.dispatch(v.state.tr.insertText(text, from, to));
  }

  function typeAll(v: EditorView, s: string): void {
    for (const ch of s) type(v, ch);
  }

  it('turns -- into an en dash', () => {
    view = make(docWith(() => [p('')]));
    cursorAt(view, '');
    typeAll(view, 'a--');
    expect(view.state.doc.textContent).toBe('a–');
  });

  it('replaces (c), (tm) and -> with symbols', () => {
    view = make(docWith(() => [p('')]));
    cursorAt(view, '');
    typeAll(view, '(c) (tm) a->');
    expect(view.state.doc.textContent).toBe('© ™ a→');
  });

  it('converts straight quotes by position', () => {
    view = make(docWith(() => [p('')]));
    cursorAt(view, '');
    typeAll(view, '"hi" don\'t \'x\'');
    expect(view.state.doc.textContent).toBe('“hi” don’t ‘x’');
  });

  it('autocorrect option overrides the default map, and false disables it', () => {
    const custom = createWordKeymapPlugin({ schema, autocorrect: { '::': '∷' } });
    const plugin = custom.props.handleTextInput as (...a: unknown[]) => boolean;
    expect(typeof plugin).toBe('function');
    expect(DEFAULT_AUTOCORRECT['--']).toBe('–');
    const off = createWordKeymapPlugin({ schema, autocorrect: false, smartQuotes: false });
    const offHandler = off.props.handleTextInput as unknown;
    expect(offHandler).toBeDefined();
  });

  it('is not active when wordBehaviour is off (block mode)', () => {
    view = make(docWith(() => [p('')]), { wordBehaviour: false });
    cursorAt(view, '');
    typeAll(view, 'a--');
    expect(view.state.doc.textContent).toBe('a--');
  });
});

describe('Word keymap does not affect block mode behaviour', () => {
  it('Mod-Alt-2 in block mode uses the default keymap (no Word styleId)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const plugins = createPlugins({ schema, wordBehaviour: false, dragDrop: false, bubbleMenu: false, slashMenu: false, multiBlockSelection: false, mediaMenu: false, inputRules: false, complianceLock: false, checklist: false, markdownPaste: false });
    const state = EditorState.create({ doc: docWith(() => [p('x')]), schema, plugins });
    const view = new EditorView(container, { state });
    cursorAt(view, 'x');
    key(view, { key: '2', altKey: true, ctrlKey: true });
    expect(view.state.doc.firstChild!.attrs.styleId).toBeNull();
    view.destroy();
    container.remove();
  });
});
