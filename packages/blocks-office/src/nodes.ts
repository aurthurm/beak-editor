/**
 * ProseMirror node specifications for office blocks.
 *
 * Inline atoms (footnote, endnote, inlineEquation, crossReference, variable,
 * computedValue) carry their display text as a decoration attribute supplied
 * by the office plugin, so numbering stays correct without mutating the
 * document. Container blocks (textBox, conditional, repeatingSection) hold
 * block content.
 *
 * @module
 */

import type { NodeSpec, DOMOutputSpec, Node as PMNode } from 'prosemirror-model';

const ID_ATTR = { default: null };

/** Footnote reference (inline atom). Numbered per document order by the plugin. */
export const footnoteNode: NodeSpec = {
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: { id: ID_ATTR, text: { default: '' } },
  parseDOM: [
    {
      tag: 'sup[data-footnote]',
      getAttrs(dom: HTMLElement) {
        return { id: dom.getAttribute('data-block-id'), text: dom.getAttribute('data-note-text') ?? '' };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    return [
      'sup',
      {
        class: 'beakblock-footnote',
        'data-footnote': '',
        'data-block-id': String(node.attrs.id ?? ''),
        'data-note-text': String(node.attrs.text ?? ''),
        contenteditable: 'false',
      },
    ];
  },
};

/** Endnote reference (inline atom). Numbered separately from footnotes. */
export const endnoteNode: NodeSpec = {
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: { id: ID_ATTR, text: { default: '' } },
  parseDOM: [
    {
      tag: 'sup[data-endnote]',
      getAttrs(dom: HTMLElement) {
        return { id: dom.getAttribute('data-block-id'), text: dom.getAttribute('data-note-text') ?? '' };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    return [
      'sup',
      {
        class: 'beakblock-endnote',
        'data-endnote': '',
        'data-block-id': String(node.attrs.id ?? ''),
        'data-note-text': String(node.attrs.text ?? ''),
        contenteditable: 'false',
      },
    ];
  },
};

/** Inline equation (inline atom). */
export const inlineEquationNode: NodeSpec = {
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: { id: ID_ATTR, latex: { default: '' } },
  parseDOM: [
    {
      tag: 'span[data-inline-equation]',
      getAttrs(dom: HTMLElement) {
        return { id: dom.getAttribute('data-block-id'), latex: dom.getAttribute('data-latex') ?? '' };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    return [
      'span',
      {
        class: 'beakblock-inline-equation',
        'data-inline-equation': '',
        'data-block-id': String(node.attrs.id ?? ''),
        'data-latex': String(node.attrs.latex ?? ''),
        contenteditable: 'false',
      },
    ];
  },
};

/** Display equation (block atom). */
export const equationNode: NodeSpec = {
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: { id: ID_ATTR, latex: { default: '' } },
  parseDOM: [
    {
      tag: 'div[data-equation]',
      getAttrs(dom: HTMLElement) {
        return { id: dom.getAttribute('data-block-id'), latex: dom.getAttribute('data-latex') ?? '' };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    return [
      'div',
      {
        class: 'beakblock-equation',
        'data-equation': '',
        'data-block-id': String(node.attrs.id ?? ''),
        'data-latex': String(node.attrs.latex ?? ''),
        contenteditable: 'false',
      },
    ];
  },
};

/** Caption (textblock). Shows "Label N: text" through CSS, with N set by the plugin. */
/**
 * Caption. The sequence number is computed for the whole document (`computeCaptionNumbers`).
 * `number` keeps the value saved with the block, so it survives load and save; print uses the
 * computed number when the document context provides one.
 */
export const captionNode: NodeSpec = {
  content: 'inline*',
  group: 'block',
  attrs: { id: ID_ATTR, label: { default: 'Figure' }, number: { default: null } },
  parseDOM: [
    {
      tag: 'p[data-caption]',
      getAttrs(dom: HTMLElement) {
        const number = Number(dom.getAttribute('data-caption-number'));
        return {
          id: dom.getAttribute('data-block-id'),
          label: dom.getAttribute('data-caption-label') ?? 'Figure',
          number: dom.hasAttribute('data-caption-number') && Number.isFinite(number) ? number : null,
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const attrs: Record<string, string> = {
      class: 'beakblock-caption',
      'data-caption': '',
      'data-block-id': String(node.attrs.id ?? ''),
      'data-caption-label': String(node.attrs.label ?? 'Figure'),
    };
    if (node.attrs.number !== null && node.attrs.number !== undefined) {
      attrs['data-caption-number'] = String(node.attrs.number);
    }
    return ['p', attrs, 0];
  },
};

/** Cross-reference to a caption or heading (inline atom). */
export const crossReferenceNode: NodeSpec = {
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    id: ID_ATTR,
    targetId: { default: '' },
    display: { default: 'number' },
  },
  parseDOM: [
    {
      tag: 'span[data-cross-reference]',
      getAttrs(dom: HTMLElement) {
        return {
          id: dom.getAttribute('data-block-id'),
          targetId: dom.getAttribute('data-target-id') ?? '',
          display: dom.getAttribute('data-display') ?? 'number',
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    return [
      'span',
      {
        class: 'beakblock-xref',
        'data-cross-reference': '',
        'data-block-id': String(node.attrs.id ?? ''),
        'data-target-id': String(node.attrs.targetId ?? ''),
        'data-display': String(node.attrs.display ?? 'number'),
        contenteditable: 'false',
      },
    ];
  },
};

/** Text box container (block). */
export const textBoxNode: NodeSpec = {
  content: 'block+',
  group: 'block',
  defining: true,
  attrs: {
    id: ID_ATTR,
    width: { default: 200 },
    float: { default: 'none' },
    borderPt: { default: 0.75 },
    fill: { default: null },
  },
  parseDOM: [
    {
      tag: 'div[data-text-box]',
      getAttrs(dom: HTMLElement) {
        return {
          id: dom.getAttribute('data-block-id'),
          width: Number(dom.getAttribute('data-width') ?? 200),
          float: dom.getAttribute('data-float') ?? 'none',
          borderPt: Number(dom.getAttribute('data-border-pt') ?? 0.75),
          fill: dom.getAttribute('data-fill'),
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const { id, width, float, borderPt, fill } = node.attrs;
    const style = [
      `width: ${String(width)}pt`,
      `border-width: ${String(borderPt)}pt`,
      fill ? `background: ${String(fill)}` : '',
    ]
      .filter(Boolean)
      .join('; ');
    return [
      'div',
      {
        class: 'beakblock-textbox',
        'data-text-box': '',
        'data-block-id': String(id ?? ''),
        'data-width': String(width),
        'data-float': String(float),
        'data-border-pt': String(borderPt),
        ...(fill ? { 'data-fill': String(fill) } : {}),
        style,
      },
      0,
    ];
  },
};

/** Shape (block atom). Rendered as inline SVG by its node view. */
export const shapeNode: NodeSpec = {
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    id: ID_ATTR,
    kind: { default: 'rect' },
    width: { default: 120 },
    height: { default: 80 },
    fill: { default: null },
    stroke: { default: '#334155' },
    strokeWidth: { default: 1 },
  },
  parseDOM: [
    {
      tag: 'div[data-shape]',
      getAttrs(dom: HTMLElement) {
        return {
          id: dom.getAttribute('data-block-id'),
          kind: dom.getAttribute('data-kind') ?? 'rect',
          width: Number(dom.getAttribute('data-width') ?? 120),
          height: Number(dom.getAttribute('data-height') ?? 80),
          fill: dom.getAttribute('data-fill'),
          stroke: dom.getAttribute('data-stroke') ?? '#334155',
          strokeWidth: Number(dom.getAttribute('data-stroke-width') ?? 1),
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    return [
      'div',
      {
        class: 'beakblock-shape',
        'data-shape': '',
        'data-block-id': String(node.attrs.id ?? ''),
        'data-kind': String(node.attrs.kind),
        'data-width': String(node.attrs.width),
        'data-height': String(node.attrs.height),
        'data-stroke': String(node.attrs.stroke),
        'data-stroke-width': String(node.attrs.strokeWidth),
        ...(node.attrs.fill ? { 'data-fill': String(node.attrs.fill) } : {}),
        contenteditable: 'false',
      },
    ];
  },
};

/** Variable (inline atom). Value comes from the variables provider. */
export const variableNode: NodeSpec = {
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: { id: ID_ATTR, name: { default: '' }, format: { default: null } },
  parseDOM: [
    {
      tag: 'span[data-variable]',
      getAttrs(dom: HTMLElement) {
        return {
          id: dom.getAttribute('data-block-id'),
          name: dom.getAttribute('data-name') ?? '',
          format: dom.getAttribute('data-format'),
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    return [
      'span',
      {
        class: 'beakblock-variable',
        'data-variable': '',
        'data-block-id': String(node.attrs.id ?? ''),
        'data-name': String(node.attrs.name ?? ''),
        contenteditable: 'false',
      },
    ];
  },
};

/** Conditional section (block container). Hidden when its expression is false. */
export const conditionalNode: NodeSpec = {
  content: 'block+',
  group: 'block',
  defining: true,
  attrs: { id: ID_ATTR, expression: { default: 'true' } },
  parseDOM: [
    {
      tag: 'div[data-conditional]',
      getAttrs(dom: HTMLElement) {
        return {
          id: dom.getAttribute('data-block-id'),
          expression: dom.getAttribute('data-expression') ?? 'true',
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    return [
      'div',
      {
        class: 'beakblock-conditional',
        'data-conditional': '',
        'data-block-id': String(node.attrs.id ?? ''),
        'data-expression': String(node.attrs.expression ?? 'true'),
      },
      0,
    ];
  },
};

/** Repeating section (block container) repeated once per item in a list variable. */
export const repeatingSectionNode: NodeSpec = {
  content: 'block+',
  group: 'block',
  defining: true,
  attrs: {
    id: ID_ATTR,
    itemsKey: { default: '' },
    min: { default: 0 },
    max: { default: null },
  },
  parseDOM: [
    {
      tag: 'div[data-repeating-section]',
      getAttrs(dom: HTMLElement) {
        const max = dom.getAttribute('data-max');
        return {
          id: dom.getAttribute('data-block-id'),
          itemsKey: dom.getAttribute('data-items-key') ?? '',
          min: Number(dom.getAttribute('data-min') ?? 0),
          max: max == null || max === '' ? null : Number(max),
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const attrs: Record<string, string> = {
      class: 'beakblock-repeating',
      'data-repeating-section': '',
      'data-block-id': String(node.attrs.id ?? ''),
      'data-items-key': String(node.attrs.itemsKey ?? ''),
      'data-min': String(node.attrs.min ?? 0),
    };
    if (node.attrs.max != null) attrs['data-max'] = String(node.attrs.max);
    return ['div', attrs, 0];
  },
};

/** Computed value (inline atom). Evaluated by the plugin; shows the formatted result. */
export const computedValueNode: NodeSpec = {
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    id: ID_ATTR,
    expression: { default: '' },
    format: { default: 'number' },
    decimals: { default: 2 },
    unit: { default: null },
  },
  parseDOM: [
    {
      tag: 'span[data-computed-value]',
      getAttrs(dom: HTMLElement) {
        return {
          id: dom.getAttribute('data-block-id'),
          expression: dom.getAttribute('data-expression') ?? '',
          format: dom.getAttribute('data-format') ?? 'number',
          decimals: Number(dom.getAttribute('data-decimals') ?? 2),
          unit: dom.getAttribute('data-unit'),
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    return [
      'span',
      {
        class: 'beakblock-computed',
        'data-computed-value': '',
        'data-block-id': String(node.attrs.id ?? ''),
        'data-expression': String(node.attrs.expression ?? ''),
        'data-format': String(node.attrs.format ?? 'number'),
        'data-decimals': String(node.attrs.decimals ?? 2),
        contenteditable: 'false',
      },
    ];
  },
};

/** Reusable (transcluded) content (block atom). Pinned to a revision when `revision` is set. */
export const reusableContentNode: NodeSpec = {
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    id: ID_ATTR,
    contentId: { default: '' },
    revision: { default: null },
    title: { default: '' },
  },
  parseDOM: [
    {
      tag: 'div[data-reusable-content]',
      getAttrs(dom: HTMLElement) {
        const revision = dom.getAttribute('data-revision');
        return {
          id: dom.getAttribute('data-block-id'),
          contentId: dom.getAttribute('data-content-id') ?? '',
          revision: revision == null || revision === '' ? null : Number(revision),
          title: dom.getAttribute('data-title') ?? '',
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const attrs: Record<string, string> = {
      class: 'beakblock-reusable',
      'data-reusable-content': '',
      'data-block-id': String(node.attrs.id ?? ''),
      'data-content-id': String(node.attrs.contentId ?? ''),
      'data-title': String(node.attrs.title ?? ''),
      contenteditable: 'false',
    };
    if (node.attrs.revision != null) attrs['data-revision'] = String(node.attrs.revision);
    return ['div', attrs];
  },
};

/** All node specs keyed by node name. */
export function createOfficeNodeSpecs(): Record<string, NodeSpec> {
  return {
    footnote: footnoteNode,
    endnote: endnoteNode,
    equation: equationNode,
    inlineEquation: inlineEquationNode,
    caption: captionNode,
    crossReference: crossReferenceNode,
    textBox: textBoxNode,
    shape: shapeNode,
    variable: variableNode,
    conditional: conditionalNode,
    repeatingSection: repeatingSectionNode,
    computedValue: computedValueNode,
    reusableContent: reusableContentNode,
  };
}
