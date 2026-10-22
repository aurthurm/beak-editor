/**
 * @module
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BeakBlockEditor, TextSelection } from '@amusendame/beakblock-core';

import { createDefaultRibbon, getContextualTabs } from './ribbon';
import { createBuiltInCommands } from './builtins';

describe('default ribbon', () => {
  it('declares the standard tabs and contextual tabs in order', () => {
    const ribbon = createDefaultRibbon();
    const ids = ribbon.tabs.map((t) => t.id);
    expect(ids).toEqual([
      'home',
      'insert',
      'layout',
      'references',
      'review',
      'view',
      'qms',
      'table',
      'picture',
      'chart',
      'controlledSection',
    ]);
    const contextual = ribbon.tabs.filter((t) => t.contextual).map((t) => t.contextual);
    expect(contextual).toEqual(['table', 'picture', 'chart', 'controlledSection']);
  });

  it('every item has a dotted command id and groups are non-empty', () => {
    const ribbon = createDefaultRibbon();
    for (const tab of ribbon.tabs) {
      expect(tab.groups.length).toBeGreaterThan(0);
      for (const group of tab.groups) {
        expect(group.items.length).toBeGreaterThan(0);
        for (const item of group.items) {
          expect(item.command).toMatch(/^[a-z][A-Za-z]*(\.[A-Za-z0-9]+)+$/);
        }
      }
    }
  });

  it('references built-in command ids that exist', () => {
    const builtIn = new Set(createBuiltInCommands().map((c) => c.id));
    const ribbon = createDefaultRibbon();
    for (const id of ['format.bold', 'paragraph.align.justify', 'insert.table', 'table.deleteRow', 'history.redo', 'view.mode.controlled']) {
      expect(builtIn.has(id)).toBe(true);
    }
    const refs = ribbon.tabs.flatMap((t) => t.groups.flatMap((g) => g.items.map((i) => i.command)));
    expect(refs.filter((r) => builtIn.has(r)).length).toBeGreaterThan(20);
  });
});

describe('getContextualTabs', () => {
  let container: HTMLElement;
  let editor: BeakBlockEditor;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      initialContent: [
        { id: 'p1', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'plain', styles: {} }] },
        {
          id: 't1',
          type: 'table',
          props: {},
          children: [
            {
              id: 'r1',
              type: 'tableRow',
              props: {},
              children: [
                {
                  id: 'c1',
                  type: 'tableCell',
                  props: {},
                  children: [
                    { id: 'cp', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'cell', styles: {} }] },
                  ],
                },
              ],
            },
          ],
        } as unknown as import('@amusendame/beakblock-core').Block,
      ],
    });
  });

  afterEach(() => {
    editor.destroy();
    container.remove();
  });

  it('returns no contextual tabs for plain text', () => {
    editor.pm.setSelection(TextSelection.create(editor.pm.doc, 2));
    expect(getContextualTabs(editor)).toEqual([]);
  });

  it('returns table inside a table cell', () => {
    let cellText = -1;
    editor.pm.state.doc.descendants((node, pos) => {
      if (node.isTextblock && node.textContent === 'cell') cellText = pos + 1;
    });
    editor.pm.setSelection(TextSelection.create(editor.pm.doc, cellText));
    expect(getContextualTabs(editor)).toEqual(['table']);
  });
});
