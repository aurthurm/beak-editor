/**
 * The `ooxmlPassthrough` block: preserved Word content the editor cannot model.
 *
 * The block is an atom with a read-only preview card. The original XML travels
 * in the `xml` attribute so exporters can write it back verbatim.
 *
 * @module
 */

import type { BeakBlockDefinition, BeakExtension } from '@amusendame/beakblock-core';

import { OOXML_PASSTHROUGH_TYPE } from './context';

type NodeSpec = NonNullable<BeakExtension['nodes']>[string];
type NodeViewCtor = NonNullable<BeakExtension['nodeViews']>[string];

/** Node spec for the `ooxmlPassthrough` block (block atom, attrs `id`, `xml`, `preview`). */
export const OOXML_PASSTHROUGH_NODE_SPEC: NodeSpec = {
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    id: { default: null },
    xml: { default: '' },
    preview: { default: '' },
  },
  parseDOM: [
    {
      tag: 'div[data-beakblock-ooxml-passthrough]',
      getAttrs(dom: HTMLElement) {
        return {
          id: dom.getAttribute('data-block-id'),
          xml: dom.getAttribute('data-ooxml') ?? '',
          preview: dom.getAttribute('data-preview') ?? '',
        };
      },
    },
  ],
  toDOM(node) {
    return [
      'div',
      {
        class: 'beakblock-ooxml-passthrough',
        'data-beakblock-ooxml-passthrough': 'true',
        'data-block-id': String(node.attrs.id ?? ''),
        'data-ooxml': String(node.attrs.xml ?? ''),
        'data-preview': String(node.attrs.preview ?? ''),
        contenteditable: 'false',
      },
      String(node.attrs.preview ?? ''),
    ];
  },
};

/** Human label for the kind of content preserved in a passthrough XML fragment. */
export function passthroughKindLabel(xml: string): string {
  if (/drawingml\/2006\/diagram/.test(xml)) return 'SmartArt';
  if (/drawingml\/2006\/chart/.test(xml)) return 'chart';
  if (/<(?:\w+:)?object\b/.test(xml)) return 'embedded object';
  if (/<(?:\w+:)?oMath/.test(xml)) return 'equation';
  if (/<(?:\w+:)?pict\b|v:shape|v:imagedata/.test(xml)) return 'drawing';
  if (/AlternateContent/.test(xml)) return 'alternate content';
  return 'content';
}

/** Node view: a non-editable preview card for preserved Word content. */
export const ooxmlPassthroughNodeView: NodeViewCtor = (node) => {
  const xml = String(node.attrs.xml ?? '');
  const preview = String(node.attrs.preview ?? '');
  const dom = document.createElement('div');
  dom.className = 'beakblock-ooxml-passthrough';
  dom.contentEditable = 'false';
  dom.setAttribute('data-beakblock-ooxml-passthrough', 'true');
  dom.setAttribute('data-block-id', String(node.attrs.id ?? ''));

  const label = document.createElement('div');
  label.className = 'beakblock-ooxml-passthrough__label';
  label.textContent = `Preserved Word content (${passthroughKindLabel(xml)})…`;

  const body = document.createElement('div');
  body.className = 'beakblock-ooxml-passthrough__preview';
  body.textContent = preview || 'This object is kept as it was in the Word file and cannot be edited here.';

  dom.append(label, body);
  return {
    dom,
    ignoreMutation: () => true,
    update: () => false,
  };
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Block definition for `ooxmlPassthrough` (family `office`, not editable). */
export const ooxmlPassthroughBlockDefinition: BeakBlockDefinition = {
  type: OOXML_PASSTHROUGH_TYPE,
  version: 1,
  family: 'office',
  schema: OOXML_PASSTHROUGH_NODE_SPEC,
  capabilities: { editable: false, nested: false, printable: true, splittable: false, collaborative: false },
  validate: (block) =>
    typeof block.props.xml === 'string' && block.props.xml.length > 0
      ? []
      : [{ severity: 'error', code: 'passthrough-empty', message: 'Preserved Word content has no XML.', blockId: block.id }],
  renderPrint: (block) =>
    `<div class="beakblock-ooxml-passthrough">${escapeHtml(String(block.props.preview ?? ''))}</div>`,
};

/**
 * Editor extension that registers the `ooxmlPassthrough` block, its node spec,
 * and its preview node view.
 *
 * @example
 * ```typescript
 * const editor = new BeakBlockEditor({ mode: 'office', extensions: [ooxmlPassthroughExtension()] });
 * ```
 */
export function ooxmlPassthroughExtension(): BeakExtension {
  return {
    name: 'ooxmlPassthrough',
    nodes: { [OOXML_PASSTHROUGH_TYPE]: OOXML_PASSTHROUGH_NODE_SPEC },
    nodeViews: { [OOXML_PASSTHROUGH_TYPE]: ooxmlPassthroughNodeView },
    blocks: [ooxmlPassthroughBlockDefinition],
  };
}
