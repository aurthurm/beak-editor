/**
 * @module
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BeakBlockEditor, TextSelection } from '@amusendame/beakblock-core';
import type { Block } from '@amusendame/beakblock-core';

import { CommandRegistry } from './registry';
import { createBuiltInCommands } from './builtins';

const paragraph = (id: string, text: string): Block => ({
  id,
  type: 'paragraph',
  props: {},
  content: [{ type: 'text', text, styles: {} }],
});

describe('built-in commands', () => {
  let container: HTMLElement;
  let editor: BeakBlockEditor;
  let registry: CommandRegistry;

  /** Select [from, to) in document positions. */
  const select = (from: number, to = from) => {
    editor.pm.setSelection(TextSelection.create(editor.pm.doc, from, to));
  };

  const setup = (blocks: Block[]) => {
    editor = new BeakBlockEditor({ element: container, injectStyles: false, initialContent: blocks });
    registry = new CommandRegistry();
    registry.register(createBuiltInCommands());
    registry.bind(editor);
  };

  beforeEach(() => {
    // Core's media menu measures nodes in animation frames; jsdom has no layout, so skip them.
    vi.stubGlobal('requestAnimationFrame', () => 0);
    container = document.createElement('div');
    document.body.appendChild(container);
    setup([paragraph('p1', 'hello world')]);
  });

  afterEach(() => {
    editor.destroy();
    container.remove();
    vi.unstubAllGlobals();
  });

  it('exposes unique dotted ids with labels, groups and operations', () => {
    const cmds = createBuiltInCommands();
    const ids = cmds.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of cmds) {
      expect(c.id).toMatch(/^[a-z][A-Za-z]*(\.[A-Za-z0-9]+)+$/);
      expect(c.label.length).toBeGreaterThan(0);
    }
    const bold = cmds.find((c) => c.id === 'format.bold');
    expect(bold?.shortcut).toBe('Mod-b');
    expect(bold?.operation).toBe('formatText');
    expect(cmds.find((c) => c.id === 'paragraph.style.heading2')?.shortcut).toBe('Mod-Alt-2');
    expect(cmds.find((c) => c.id === 'paragraph.style.normal')?.shortcut).toBe('Mod-Shift-n');
    expect(cmds.find((c) => c.id === 'insert.pageBreak')?.shortcut).toBe('Mod-Enter');
  });

  it('format.bold toggles bold on the selection and reports active state', () => {
    select(1, 6);
    expect(registry.isActive('format.bold')).toBe(false);
    expect(registry.execute('format.bold')).toBe(true);
    expect(editor.pm.doc.rangeHasMark(1, 6, editor.pm.schema.marks.bold!)).toBe(true);
    expect(registry.isActive('format.bold')).toBe(true);
    expect(registry.execute('format.bold')).toBe(true);
    expect(editor.pm.doc.rangeHasMark(1, 6, editor.pm.schema.marks.bold!)).toBe(false);
  });

  it('format.clearFormatting removes marks in range', () => {
    select(1, 6);
    registry.execute('format.bold');
    registry.execute('format.italic');
    select(1, 6);
    expect(registry.execute('format.clearFormatting')).toBe(true);
    expect(editor.pm.doc.rangeHasMark(1, 6, editor.pm.schema.marks.bold!)).toBe(false);
    expect(editor.pm.doc.rangeHasMark(1, 6, editor.pm.schema.marks.italic!)).toBe(false);
  });

  it('format.textColor requires a color argument', () => {
    select(1, 6);
    expect(registry.execute('format.textColor')).toBe(false);
    expect(registry.execute('format.textColor', { color: '#ff0000' })).toBe(true);
    expect(editor.pm.doc.rangeHasMark(1, 6, editor.pm.schema.marks.textColor!)).toBe(true);
  });

  it('paragraph styles change the block type, and heading1 is the fallback for title', () => {
    select(2);
    expect(registry.execute('paragraph.style.heading2')).toBe(true);
    expect(editor.pm.state.doc.firstChild?.type.name).toBe('heading');
    expect(editor.pm.state.doc.firstChild?.attrs.level).toBe(2);
    expect(registry.isActive('paragraph.style.heading2')).toBe(true);

    expect(registry.execute('paragraph.style.title')).toBe(true);
    expect(editor.pm.state.doc.firstChild?.attrs.level).toBe(1);

    expect(registry.execute('paragraph.style.normal')).toBe(true);
    expect(editor.pm.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(registry.execute('paragraph.style.quote')).toBe(true);
    expect(editor.pm.state.doc.firstChild?.type.name).toBe('blockquote');
  });

  it('paragraph alignment applies to the selected paragraphs', () => {
    select(2);
    expect(registry.execute('paragraph.align.center')).toBe(true);
    expect(editor.pm.state.doc.firstChild?.attrs.textAlign).toBe('center');
    expect(registry.isActive('paragraph.align.center')).toBe(true);
    expect(registry.execute('paragraph.align.justify')).toBe(true);
    expect(editor.pm.state.doc.firstChild?.attrs.textAlign).toBe('justify');
  });

  it('bullet and numbered list commands wrap, switch and unwrap the block', () => {
    select(2);
    expect(registry.execute('list.bullet')).toBe(true);
    expect(editor.pm.state.doc.firstChild?.type.name).toBe('bulletList');
    expect(registry.isActive('list.bullet')).toBe(true);
    select(3);
    expect(registry.execute('list.numbered')).toBe(true);
    expect(editor.pm.state.doc.firstChild?.type.name).toBe('orderedList');
    expect(editor.pm.state.doc.firstChild?.childCount).toBe(1);
    // Same kind again unwraps back to paragraphs.
    expect(registry.execute('list.numbered')).toBe(true);
    expect(editor.pm.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(editor.pm.state.doc.firstChild?.textContent).toBe('hello world');
  });

  it('list.indent nests an item under its previous sibling and list.outdent lifts it back', () => {
    setup([paragraph('p1', 'one'), paragraph('p2', 'two')]);
    // Build a bullet list with two items by converting the document.
    editor.setDocument([
      {
        id: 'list',
        type: 'bulletList',
        props: {},
        children: [
          { id: 'i1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'one', styles: {} }] },
          { id: 'i2', type: 'listItem', props: {}, content: [{ type: 'text', text: 'two', styles: {} }] },
        ],
      } as unknown as Block,
    ]);
    const listNode = editor.pm.state.doc.firstChild!;
    expect(listNode.type.name).toBe('bulletList');
    expect(listNode.childCount).toBe(2);

    // Caret inside "two" (second item): first item's paragraph starts at 3, so "two" is at pos 3 + 1 + 4 + 1 + 1.
    let twoPos = -1;
    editor.pm.state.doc.descendants((node, pos) => {
      if (node.isTextblock && node.textContent === 'two') twoPos = pos + 1;
    });
    select(twoPos);
    expect(registry.canExecute('list.indent')).toBe(true);
    expect(registry.execute('list.indent')).toBe(true);
    const top = editor.pm.state.doc.firstChild!;
    expect(top.childCount).toBe(1);
    const nested = top.firstChild!.lastChild!;
    expect(nested.type.name).toBe('bulletList');
    expect(nested.textContent).toBe('two');

    let twoPos2 = -1;
    editor.pm.state.doc.descendants((node, pos) => {
      if (node.isTextblock && node.textContent === 'two') twoPos2 = pos + 1;
    });
    select(twoPos2);
    expect(registry.execute('list.outdent')).toBe(true);
    const topAfter = editor.pm.state.doc.firstChild!;
    expect(topAfter.childCount).toBe(2);
    expect(topAfter.lastChild!.textContent).toBe('two');
  });

  it('insert.table inserts a table of the requested size and table commands operate inside it', () => {
    setup([{ id: 'empty', type: 'paragraph', props: {}, content: [] }]);
    select(1);
    expect(registry.execute('insert.table', { rows: 2, cols: 3 })).toBe(true);
    let table: { rowCount: number; colCount: number } | null = null;
    editor.pm.state.doc.descendants((node) => {
      if (node.type.name === 'table') {
        table = { rowCount: node.childCount, colCount: node.firstChild!.childCount };
        return false;
      }
      return true;
    });
    expect(table).toEqual({ rowCount: 2, colCount: 3 });

    // Caret is inside the table now.
    expect(registry.isActive('table.insertRowBelow')).toBe(false);
    expect(registry.canExecute('table.insertRowBelow')).toBe(true);
    expect(registry.execute('table.insertRowBelow')).toBe(true);
    const tableNode = () => {
      let found: import('@amusendame/beakblock-core').Node | null = null;
      editor.pm.state.doc.descendants((n) => {
        if (n.type.name === 'table') found = n;
        return found === null;
      });
      return found as unknown as import('@amusendame/beakblock-core').Node;
    };
    expect(tableNode().childCount).toBe(3);
    expect(registry.execute('table.insertColumnRight')).toBe(true);
    expect(tableNode().firstChild!.childCount).toBe(4);
  });

  it('insert.divider replaces an empty paragraph with a divider and a trailing paragraph', () => {
    setup([{ id: 'empty', type: 'paragraph', props: {}, content: [] }]);
    select(1);
    expect(registry.execute('insert.divider')).toBe(true);
    const names: string[] = [];
    editor.pm.state.doc.forEach((n) => names.push(n.type.name));
    expect(names).toEqual(['divider', 'paragraph']);
  });

  it('insert.divider splits a paragraph at the caret', () => {
    select(3);
    expect(registry.execute('insert.divider')).toBe(true);
    const names: string[] = [];
    const texts: string[] = [];
    editor.pm.state.doc.forEach((n) => {
      names.push(n.type.name);
      texts.push(n.textContent);
    });
    expect(names).toEqual(['paragraph', 'divider', 'paragraph']);
    expect(texts).toEqual(['he', '', 'llo world']);
    expect(editor.pm.state.selection.$from.parent.textContent).toBe('llo world');
  });

  it('insert.image requires a src argument', () => {
    select(2);
    expect(registry.execute('insert.image')).toBe(false);
    expect(registry.execute('insert.image', { src: 'https://example.com/a.png', alt: 'a' })).toBe(true);
    let found = false;
    editor.pm.state.doc.descendants((n) => {
      if (n.type.name === 'image') found = true;
    });
    expect(found).toBe(true);
  });

  it('insert.columns inserts a column list with the requested count', () => {
    select(2);
    expect(registry.execute('insert.columns', { count: 3 })).toBe(true);
    let cols = 0;
    editor.pm.state.doc.descendants((n) => {
      if (n.type.name === 'columnList') cols = n.childCount;
    });
    expect(cols).toBe(3);
  });

  it('insert.pageBreak and insert.field.* follow the schema', () => {
    select(2);
    const hasPageBreak = !!editor.pm.schema.nodes.pageBreak;
    const hasField = !!editor.pm.schema.nodes.field;
    expect(registry.canExecute('insert.pageBreak')).toBe(hasPageBreak);
    expect(registry.canExecute('insert.field.page')).toBe(hasField);
    expect(registry.execute('insert.field.page')).toBe(hasField);
  });

  it('view mode and review view commands are disabled when the editor lacks the method', () => {
    const e = editor as unknown as Record<string, unknown>;
    e.setMode = undefined;
    e.setReviewView = undefined;
    expect(registry.canExecute('view.mode.office')).toBe(false);
    expect(registry.execute('view.mode.office')).toBe(false);
    expect(registry.canExecute('review.view.final')).toBe(false);
    expect(registry.execute('review.view.final')).toBe(false);
  });

  it('view mode commands call setMode when present', () => {
    const modes: string[] = [];
    (editor as unknown as { setMode: (m: string) => void }).setMode = (m) => modes.push(m);
    expect(registry.canExecute('view.mode.office')).toBe(true);
    expect(registry.execute('view.mode.office')).toBe(true);
    expect(modes).toEqual(['office']);
    expect(registry.execute('view.mode.controlled')).toBe(true);
    expect(modes).toEqual(['office', 'controlled']);
  });

  it('history undo and redo delegate to the editor', () => {
    select(1, 6);
    registry.execute('format.bold');
    expect(editor.pm.doc.rangeHasMark(1, 6, editor.pm.schema.marks.bold!)).toBe(true);
    expect(registry.execute('history.undo')).toBe(true);
    expect(editor.pm.doc.rangeHasMark(1, 6, editor.pm.schema.marks.bold!)).toBe(false);
    expect(registry.execute('history.redo')).toBe(true);
    expect(editor.pm.doc.rangeHasMark(1, 6, editor.pm.schema.marks.bold!)).toBe(true);
  });

  it('repeatable formatting is repeated by F4 with the same arguments', () => {
    select(1, 6);
    registry.execute('format.highlight', { color: '#00ff00' });
    select(7, 11);
    expect(registry.repeatLast()).toBe(true);
    expect(editor.pm.doc.rangeHasMark(7, 11, editor.pm.schema.marks.backgroundColor!)).toBe(true);
  });
});
