import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BeakBlockEditor } from '@amusendame/beakblock-core';
import type { Block } from '@amusendame/beakblock-core';
import { ALL_CAPABILITIES } from '@amusendame/beakblock-permissions';
import type { PolicyContext } from '@amusendame/beakblock-permissions';

import { qmsExtension } from './extension';
import { injectQmsStyles, QMS_STYLE_ELEMENT_ID } from './styles';

const sectionBlock = (id: string, sectionId: string, title: string, text: string): Block => ({
  id,
  type: 'controlledSection',
  props: { sectionId, title, workflowState: 'draft', allowedBlocks: null, ownerName: 'Owner', required: false },
  children: [{ id: `${id}-p`, type: 'paragraph', props: {}, content: [{ type: 'text', text, styles: {} }] }],
});

describe('qmsExtension in the editor', () => {
  let container: HTMLElement;
  const editors: BeakBlockEditor[] = [];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    for (const e of editors.splice(0)) e.destroy();
    container.remove();
  });

  it('registers the controlled section node and renders its header tab', () => {
    const editor = new BeakBlockEditor({ element: container, mode: 'controlled', extensions: [qmsExtension()] });
    editors.push(editor);
    editor.setDocument([sectionBlock('s1', 'S1', 'Scope', 'Hello')]);

    const schema = editor.pm.state.schema;
    expect(schema.nodes.controlledSection).toBeDefined();
    expect(schema.nodes.signatureBlock).toBeDefined();
    expect(editor.pm.state.doc.child(0).type.name).toBe('controlledSection');
    expect(editor.pm.state.doc.child(0).childCount).toBe(1);

    const title = container.querySelector('.beakblock-cs-title');
    expect(title?.textContent).toBe('Scope');
    expect(container.querySelector('.beakblock-cs-owner')?.textContent).toContain('Owner');
    expect(container.querySelector('.beakblock-cs-state')?.textContent).toBe('Draft');
  });

  it('marks sections the principal cannot edit as read-only in the DOM', () => {
    // Loading a document is a service operation: it runs under a system context, then the
    // principal's context takes over. Edits by the principal are checked against their grants.
    const system: PolicyContext = { userId: 'service', roles: ['system'], sectionGrants: {}, defaultGrants: [...ALL_CAPABILITIES] };
    const ann: PolicyContext = { userId: 'ann', roles: ['author'], sectionGrants: { S1: ['section.editText'] } };
    let current: PolicyContext = system;
    const editor = new BeakBlockEditor({
      element: container,
      extensions: [qmsExtension({ getPolicyContext: () => current })],
    });
    editors.push(editor);
    editor.setDocument([sectionBlock('s1', 'S1', 'Scope', 'mine'), sectionBlock('s2', 'S2', 'Other', 'theirs')]);
    current = ann;
    editor.pm.dispatch(editor.pm.state.tr);

    const sections = [...container.querySelectorAll<HTMLElement>('section.beakblock-controlled-section')];
    expect(sections.length).toBe(2);
    expect(sections[0]!.getAttribute('data-editable')).toBe('true');
    expect(sections[1]!.getAttribute('data-editable')).toBe('false');
    expect(sections[1]!.getAttribute('contenteditable')).toBe('false');
  });

  it('round-trips controlled section children through getDocument and setDocument', () => {
    const editor = new BeakBlockEditor({ element: container, extensions: [qmsExtension()] });
    editors.push(editor);
    editor.setDocument([sectionBlock('s1', 'S1', 'Scope', 'Hello')]);
    const [section] = editor.getDocument();
    expect(section!.type).toBe('controlledSection');
    expect(section!.props.sectionId).toBe('S1');
    expect(section!.children?.[0]?.type).toBe('paragraph');
  });

  it('injects the stylesheet once', () => {
    document.getElementById(QMS_STYLE_ELEMENT_ID)?.remove();
    expect(injectQmsStyles(document)).toBe(true);
    expect(injectQmsStyles(document)).toBe(false);
    expect(document.getElementById(QMS_STYLE_ELEMENT_ID)).not.toBeNull();
    expect(injectQmsStyles(undefined)).toBe(false);
  });

  it('bundles block definitions and extension nodes', () => {
    const ext = qmsExtension();
    expect(ext.name).toBe('beakblock-qms');
    expect(Object.keys(ext.nodes ?? {})).toContain('controlledSection');
    expect(ext.blocks?.some((b) => b.type === 'approvalBlock')).toBe(true);
    expect(Object.keys(ext.nodeViews ?? {})).toContain('signatureBlock');
  });
});
