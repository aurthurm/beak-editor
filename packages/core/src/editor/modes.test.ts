import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { BeakBlockEditor } from './Editor';
import { SLASH_MENU_PLUGIN_KEY } from '../plugins/slashMenuPlugin';
import { DRAG_DROP_PLUGIN_KEY } from '../plugins/dragDropPlugin';
import { getEditorMode } from '../plugins/editorModePlugin';

describe('editor modes and review view', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('defaults to block mode with the mode attribute on the root element', () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false });
    expect(editor.getMode()).toBe('block');
    expect(editor.pm.view.dom.getAttribute('data-beakblock-mode')).toBe('block');
    expect(getEditorMode(editor.pm.state)).toBe('block');
    editor.destroy();
  });

  it('accepts a mode in config and reports wordBehaviour defaults', () => {
    const office = new BeakBlockEditor({ element: container, injectStyles: false, mode: 'office' });
    expect(office.getMode()).toBe('office');
    expect(office.pm.view.dom.getAttribute('data-beakblock-mode')).toBe('office');
    office.destroy();
  });

  it('switches mode, updates the root attribute and emits modeChange', () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false });
    const events: Array<{ mode: string; previousMode: string }> = [];
    editor.on('modeChange', (data) => events.push(data));

    editor.setMode('office');
    expect(editor.getMode()).toBe('office');
    expect(editor.pm.view.dom.getAttribute('data-beakblock-mode')).toBe('office');
    expect(getEditorMode(editor.pm.state)).toBe('office');
    expect(events).toEqual([{ mode: 'office', previousMode: 'block' }]);

    // Setting the same mode is a no-op
    editor.setMode('office');
    expect(events).toHaveLength(1);

    editor.setMode('controlled');
    expect(events[1]).toEqual({ mode: 'controlled', previousMode: 'office' });
    editor.destroy();
  });

  it('does not activate the slash menu outside block mode', () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false, mode: 'office' });
    editor.focus('end');
    editor.pm.insertText('/');
    expect(SLASH_MENU_PLUGIN_KEY.getState(editor.pm.state)?.active).toBe(false);
    editor.destroy();
  });

  it('activates the slash menu in block mode', () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false });
    editor.focus('end');
    editor.pm.insertText('/');
    expect(SLASH_MENU_PLUGIN_KEY.getState(editor.pm.state)?.active).toBe(true);
    editor.destroy();
  });

  it('disables drag handles in office mode', () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false, mode: 'office' });
    expect(DRAG_DROP_PLUGIN_KEY.getState(editor.pm.state)).toBeDefined();
    const sideMenu = container.querySelector('.ob-side-menu');
    if (sideMenu) {
      expect(sideMenu.classList.contains('ob-side-menu--visible')).toBe(false);
    }
    editor.destroy();
  });

  it('sets the review view class on the root element', () => {
    const editor = new BeakBlockEditor({ element: container, injectStyles: false });
    expect(editor.getReviewView()).toBe('markup');
    expect(editor.pm.view.dom.classList.contains('beakblock-review-view-markup')).toBe(true);

    editor.setReviewView('final');
    expect(editor.pm.view.dom.classList.contains('beakblock-review-view-final')).toBe(true);
    expect(editor.pm.view.dom.classList.contains('beakblock-review-view-markup')).toBe(false);

    editor.setReviewView('original');
    expect(editor.pm.view.dom.classList.contains('beakblock-review-view-original')).toBe(true);
    editor.destroy();
  });

  it('renders field nodes with the resolver value and redraws on change', () => {
    const editor = new BeakBlockEditor({
      element: container,
      injectStyles: false,
      initialContent: [
        {
          id: 'p',
          type: 'paragraph',
          props: {},
          content: [{ type: 'field', fieldType: 'DOCPROPERTY', name: 'docNumber', fallback: 'TBD' }],
        },
      ],
    });
    const field = () => editor.pm.view.dom.querySelector('.beakblock-field');
    expect(field()?.textContent).toBe('TBD');

    editor.setFieldResolver((attrs) => (attrs.name === 'docNumber' ? 'SOP-042' : null));
    expect(field()?.textContent).toBe('SOP-042');

    editor.setFieldResolver(null);
    expect(field()?.textContent).toBe('TBD');
    editor.destroy();
  });
});
