import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, markRaw, nextTick, shallowRef } from 'vue';
import {
  CommandSearch,
  FindReplace,
  NavigationPane,
  OfficeShell,
  Ruler,
  StatusBar,
  Ribbon,
  compileFindPattern,
  findMatches,
  replaceMatches,
  useCommandRegistry,
} from '@amusendame/beakblock-vue';
import {
  BeakBlockEditor,
  TextSelection,
  undo,
  type Block,
} from '@amusendame/beakblock-core';
import { CommandRegistry, createBuiltInCommands } from '@amusendame/beakblock-commands';

const created: BeakBlockEditor[] = [];
const wrappers: Array<{ unmount: () => void }> = [];

afterEach(() => {
  while (wrappers.length) wrappers.pop()?.unmount();
  while (created.length) created.pop()?.destroy();
  document.body.replaceChildren();
});

function paragraph(id: string, text: string): Block {
  return { id, type: 'paragraph', props: {}, content: [{ type: 'text', text, styles: {} }] };
}

function createEditor(blocks: Block[], mode: 'office' | 'block' | 'controlled' = 'office'): BeakBlockEditor {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const editor = new BeakBlockEditor({ initialContent: blocks, injectStyles: false, mode });
  editor.mount(host);
  created.push(editor);
  // Editors are class instances with private state; keep Vue from wrapping them in proxies.
  return markRaw(editor);
}

/** Select text inside the first textblock. Positions are document positions. */
function selectRange(editor: BeakBlockEditor, from: number, to: number): void {
  const { doc } = editor.pm.state;
  editor.pm.dispatch(editor.pm.state.tr.setSelection(TextSelection.create(doc, from, to)));
}

function registryFor(editor: BeakBlockEditor): CommandRegistry {
  const registry = new CommandRegistry();
  registry.register(createBuiltInCommands());
  registry.bind(editor);
  editor.pm.addPlugin(registry.createKeymapPlugin());
  return registry;
}

describe('office shell: command registry composable', () => {
  it('creates a registry bound to the editor and drives the ribbon from it', async () => {
    const editor = createEditor([paragraph('p1', 'Hello office')]);
    const editorRef = shallowRef<BeakBlockEditor | null>(editor);

    const Harness = defineComponent({
      name: 'RegistryHarness',
      setup() {
        const { registry, version } = useCommandRegistry(editorRef);
        return () => h('div', [h(Ribbon, { registry: registry.value, editor: editorRef.value }), h('span', { 'data-version': version.value })]);
      },
    });

    const wrapper = mount(Harness);
    wrappers.push(wrapper);
    await nextTick();

    expect(wrapper.find('[data-command="format.bold"]').exists()).toBe(true);
    expect(wrapper.find('[data-command="history.undo"]').exists()).toBe(true);
  });
});

describe('office shell: ribbon', () => {
  it('renders the static tabs and runs bold from a toggle button', async () => {
    const editor = createEditor([paragraph('p1', 'Hello office')]);
    const registry = registryFor(editor);
    selectRange(editor, 1, 6);

    const wrapper = mount(Ribbon, { props: { registry, editor } });
    wrappers.push(wrapper);
    await nextTick();

    const tabs = wrapper.findAll('[role="tab"]').map((tab) => tab.text());
    expect(tabs).toEqual(expect.arrayContaining(['Home', 'Insert', 'Layout', 'References', 'Review', 'View', 'QMS']));
    expect(wrapper.find('[data-tab="table"]').exists()).toBe(false);

    const bold = wrapper.find('[data-command="format.bold"]');
    expect(bold.attributes('aria-pressed')).toBe('false');
    await bold.trigger('click');
    await nextTick();

    expect(editor.pm.isMarkActive('bold')).toBe(true);
    expect(wrapper.find('[data-command="format.bold"]').attributes('aria-pressed')).toBe('true');
  });

  it('shows the contextual table tab when the selection is inside a table', async () => {
    const editor = createEditor([paragraph('p1', 'Before table')]);
    const registry = registryFor(editor);
    const wrapper = mount(Ribbon, { props: { registry, editor } });
    wrappers.push(wrapper);
    await nextTick();
    expect(wrapper.find('[data-tab="table"]').exists()).toBe(false);

    expect(registry.execute('insert.table', { rows: 2, cols: 2 })).toBe(true);
    await nextTick();
    expect(wrapper.find('[data-tab="table"]').exists()).toBe(false);

    // The insert leaves the caret after the table, so move it into the first cell.
    let tablePos = -1;
    editor.pm.state.doc.descendants((node, pos) => {
      if (tablePos < 0 && node.type.name === 'table') tablePos = pos;
      return tablePos < 0;
    });
    expect(tablePos).toBeGreaterThanOrEqual(0);
    // table > row > cell > paragraph > text: the first text position is four tokens in.
    selectRange(editor, tablePos + 4, tablePos + 4);
    await nextTick();

    expect(wrapper.find('[data-tab="table"]').exists()).toBe(true);
    expect(wrapper.find('[data-tab="table"]').classes()).toContain('bb-office-ribbon-tab--contextual');
  });

  it('skips command ids that are not registered', async () => {
    const editor = createEditor([paragraph('p1', 'x')]);
    const registry = registryFor(editor);
    const wrapper = mount(Ribbon, { props: { registry, editor } });
    wrappers.push(wrapper);
    await nextTick();

    // The default ribbon references ai.generateImage and qms.* which are not registered here.
    expect(wrapper.find('[data-command="ai.generateImage"]').exists()).toBe(false);
    expect(wrapper.find('[data-command="qms.insertControlledSection"]').exists()).toBe(false);
  });
});

describe('office shell: command search', () => {
  it('ranks matching commands and executes the first one with Enter', async () => {
    const editor = createEditor([paragraph('p1', 'Hello search')]);
    const registry = registryFor(editor);

    expect(registry.search('bold')[0]?.command.id).toBe('format.bold');

    const wrapper = mount(CommandSearch, { props: { registry, editor, open: true } });
    wrappers.push(wrapper);
    await nextTick();

    const input = wrapper.find('input');
    await input.setValue('bold');
    const first = wrapper.find('[role="option"]');
    expect(first.attributes('data-command')).toBe('format.bold');

    await input.trigger('keydown', { key: 'Enter' });
    await nextTick();

    expect(wrapper.emitted('execute')?.[0]).toEqual(['format.bold', true]);
  });
});

describe('office shell: find and replace engine', () => {
  const text = 'Hello hello HELLO hellohello';

  it('matches case-insensitively by default and respects match case', () => {
    const editor = createEditor([paragraph('p1', text)]);
    const doc = editor.pm.state.doc;

    expect(findMatches(doc, 'hello')).toHaveLength(5);
    // Lowercase 'hello' appears as the second word and twice inside 'hellohello'.
    expect(findMatches(doc, 'hello', { matchCase: true })).toHaveLength(3);
  });

  it('supports whole word matching', () => {
    const editor = createEditor([paragraph('p1', text)]);
    expect(findMatches(editor.pm.state.doc, 'hello', { wholeWord: true })).toHaveLength(3);
  });

  it('supports regular expressions and reports invalid patterns', () => {
    const editor = createEditor([paragraph('p1', text)]);
    const doc = editor.pm.state.doc;

    expect(findMatches(doc, '\\bhello\\b', { regex: true, matchCase: true })).toHaveLength(1);
    expect(findMatches(doc, 'h.llo', { regex: true })).toHaveLength(5);

    const invalid = compileFindPattern('(', { regex: true });
    expect(invalid.regex).toBeNull();
    expect(invalid.error).toBeTruthy();
    expect(findMatches(doc, '(', { regex: true })).toEqual([]);
  });

  it('reports positions that select the matched text', () => {
    const editor = createEditor([paragraph('p1', text)]);
    const [first] = findMatches(editor.pm.state.doc, 'HELLO', { matchCase: true });
    expect(first).toBeDefined();
    expect(editor.pm.state.doc.textBetween(first!.from, first!.to)).toBe('HELLO');
  });

  it('replace all runs in one transaction, so a single undo reverts it', () => {
    const editor = createEditor([paragraph('p1', text)]);
    const matches = findMatches(editor.pm.state.doc, 'hello');

    expect(replaceMatches(editor, matches, 'bye')).toBe(5);
    expect(editor.pm.state.doc.textContent).toBe('bye bye bye byebye');

    undo(editor.pm.state, (tr) => editor.pm.dispatch(tr));
    expect(editor.pm.state.doc.textContent).toBe(text);
  });

  it('expands $1 capture groups in regex mode', () => {
    const editor = createEditor([paragraph('p1', 'alpha-1 beta-2')]);
    const matches = findMatches(editor.pm.state.doc, '(\\w+)-(\\d)', { regex: true });
    replaceMatches(editor, matches, '$2:$1', { regex: true });
    expect(editor.pm.state.doc.textContent).toBe('1:alpha 2:beta');
  });

  it('FindReplace gives every input and option an accessible name', async () => {
    const editor = createEditor([paragraph('p1', text)]);
    const wrapper = mount(FindReplace, { props: { editor } });
    wrappers.push(wrapper);
    await nextTick();

    const names = (el: HTMLInputElement): string[] => {
      const labelled = Array.from(el.labels ?? []).map((label) => label.textContent?.trim() ?? '');
      return [el.getAttribute('aria-label') ?? '', ...labelled].filter(Boolean);
    };
    const inputs = Array.from(wrapper.element.querySelectorAll<HTMLInputElement>('input'));
    expect(inputs.map((input) => names(input)[0] ?? '')).toEqual(['Find', 'Match case', 'Whole word', 'Regex', 'Replace with']);
    for (const input of inputs) expect(names(input).length).toBeGreaterThan(0);
    expect(wrapper.find('input[aria-label="Find"]').exists()).toBe(true);
    expect(wrapper.find('input[aria-label="Replace with"]').exists()).toBe(true);
  });

  it('FindReplace reports the match count and an invalid regex message', async () => {
    const editor = createEditor([paragraph('p1', text)]);
    const wrapper = mount(FindReplace, { props: { editor } });
    wrappers.push(wrapper);
    await nextTick();

    await wrapper.find('.bb-office-find-input').setValue('hello');
    await nextTick();
    expect(wrapper.find('.bb-office-find-count').text()).toBe('1 of 5');

    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    await checkboxes[2]!.setValue(true); // regex
    await wrapper.find('.bb-office-find-input').setValue('(');
    await nextTick();
    expect(wrapper.find('.bb-office-find-error').exists()).toBe(true);
  });
});

describe('office shell: status bar', () => {
  it('computes the word count from the document', async () => {
    const editor = createEditor([paragraph('p1', 'one two three'), paragraph('p2', 'four')]);
    const wrapper = mount(StatusBar, { props: { editor } });
    wrappers.push(wrapper);
    await nextTick();

    expect(wrapper.find('[data-status="words"]').text()).toBe('4 words');
    expect(wrapper.find('[role="status"]').exists()).toBe(true);
  });

  it('uses the supplied word count when given', async () => {
    const editor = createEditor([paragraph('p1', 'one two')]);
    const wrapper = mount(StatusBar, { props: { editor, wordCount: 42 } });
    wrappers.push(wrapper);
    await nextTick();
    expect(wrapper.find('[data-status="words"]').text()).toBe('42 words');
  });
});

describe('office shell: ruler', () => {
  it('dragging the left indent marker updates the paragraph indent attribute', async () => {
    const editor = createEditor([paragraph('p1', 'Indent me')]);
    selectRange(editor, 2, 2);

    const wrapper = mount(Ruler, {
      props: { editor, orientation: 'horizontal', zoom: 1 },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    await nextTick();

    const marker = wrapper.find('[data-marker="left"]');
    expect(marker.exists()).toBe(true);

    // 36pt at 100% zoom is 48px.
    marker.element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, clientY: 0, bubbles: true }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 148, clientY: 0 }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 148, clientY: 0 }));
    await nextTick();

    const indent = editor.pm.state.doc.firstChild?.attrs.indent as { leftPt: number } | null;
    expect(indent?.leftPt).toBeCloseTo(36, 1);
  });
});

describe('office shell: navigation pane', () => {
  it('lists headings and moves the caret to a heading when clicked', async () => {
    const editor = createEditor([
      { id: 'h1', type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Scope', styles: {} }] },
      paragraph('p1', 'Body text'),
    ]);
    const wrapper = mount(NavigationPane, { props: { editor } });
    wrappers.push(wrapper);
    await nextTick();

    const heading = wrapper.find('.bb-office-nav-item');
    expect(heading.text()).toBe('Scope');
    await heading.trigger('click');
    expect(editor.pm.state.selection.$from.parent.type.name).toBe('heading');
  });
});

describe('office shell: shell layout', () => {
  it('sets the editor to office mode and renders the shell regions', async () => {
    const editor = createEditor([paragraph('p1', 'Shell')], 'block');
    const registry = registryFor(editor);
    const wrapper = mount(OfficeShell, {
      props: { editor, registry, injectStyles: true },
      slots: { default: () => h('div', { class: 'surface' }, 'surface') },
    });
    wrappers.push(wrapper);
    await nextTick();

    expect(editor.getMode()).toBe('office');
    expect(wrapper.find('.bb-office-shell').exists()).toBe(true);
    expect(wrapper.find('.bb-office-ribbon').exists()).toBe(true);
    expect(wrapper.find('.bb-office-canvas').exists()).toBe(true);
    expect(wrapper.find('.bb-office-page .surface').exists()).toBe(true);
    expect(wrapper.find('[data-beakblock-ruler="horizontal"]').exists()).toBe(true);
    expect(document.getElementById('bb-office-shell-styles')).not.toBeNull();
  });
});
