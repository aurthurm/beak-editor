/**
 * ProseMirror node specs for the QMS block family.
 *
 * `controlledSection` is a block container. Every other QMS block is an atom whose
 * data lives in attributes, so it round-trips through `Block.props`.
 *
 * @module
 */

import type { DOMOutputSpec, NodeSpec, Node as PMNode } from 'prosemirror-model';

/** Parses a JSON-encoded attribute from the DOM, falling back to a default. */
function parseJsonAttr<T>(value: string | null, fallback: T): T {
  if (value === null || value === '') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Controlled section container (contract section 7, roadmap 5F).
 *
 * Content is `block+`. `isolating` stops selections and deletions from silently
 * crossing the section boundary.
 */
export const controlledSectionNode: NodeSpec = {
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  selectable: true,
  draggable: false,
  attrs: {
    id: { default: null },
    sectionId: { default: null },
    templateSectionId: { default: null },
    policyRef: { default: null },
    required: { default: false },
    allowedBlocks: { default: null },
    title: { default: '' },
    ownerName: { default: null },
    workflowState: { default: 'draft' },
    locked: { default: false },
  },
  parseDOM: [
    {
      tag: 'section[data-controlled-section]',
      getAttrs(dom: HTMLElement) {
        return {
          id: dom.getAttribute('data-block-id'),
          sectionId: dom.getAttribute('data-section-id'),
          templateSectionId: dom.getAttribute('data-template-section-id'),
          policyRef: dom.getAttribute('data-policy-ref'),
          required: dom.getAttribute('data-required') === 'true',
          allowedBlocks: parseJsonAttr<string[] | null>(dom.getAttribute('data-allowed-blocks'), null),
          title: dom.getAttribute('data-title') ?? '',
          ownerName: dom.getAttribute('data-owner-name'),
          workflowState: dom.getAttribute('data-workflow-state') ?? 'draft',
          locked: dom.getAttribute('data-locked') === 'true',
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const a = node.attrs;
    const attrs: Record<string, string> = {
      class: 'beakblock-controlled-section',
      'data-controlled-section': '',
      'data-section-id': String(a.sectionId ?? ''),
      'data-title': String(a.title ?? ''),
      'data-workflow-state': String(a.workflowState ?? 'draft'),
      'data-required': String(Boolean(a.required)),
      'data-locked': String(Boolean(a.locked)),
    };
    if (a.id) attrs['data-block-id'] = String(a.id);
    if (a.templateSectionId) attrs['data-template-section-id'] = String(a.templateSectionId);
    if (a.policyRef) attrs['data-policy-ref'] = String(a.policyRef);
    if (a.ownerName) attrs['data-owner-name'] = String(a.ownerName);
    if (a.allowedBlocks) attrs['data-allowed-blocks'] = JSON.stringify(a.allowedBlocks);
    return ['section', attrs, 0];
  },
};

/** Builds a block atom spec whose attributes are serialised as JSON in the DOM. */
function atomBlockSpec(
  type: string,
  ownAttrs: Record<string, { default: unknown }>,
  jsonAttrs: readonly string[] = []
): NodeSpec {
  // A domain `id` in block props cannot use the reserved `id` attr (the block id), so it is
  // stored as `domainId` and mapped back on load and save.
  const attrs: Record<string, { default: unknown }> = { ...ownAttrs, domainId: { default: null } };
  return {
    group: 'block',
    atom: true,
    selectable: true,
    draggable: false,
    attrs,
    blockPropAliases: { id: 'domainId' },
    parseDOM: [
      {
        tag: `div[data-qms-type="${type}"]`,
        getAttrs(dom: HTMLElement) {
          const out: Record<string, unknown> = { id: dom.getAttribute('data-block-id') };
          for (const name of Object.keys(attrs)) {
            if (name === 'id') continue;
            const raw = dom.getAttribute(`data-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
            out[name] = jsonAttrs.includes(name) ? parseJsonAttr<unknown>(raw, attrs[name]!.default) : raw ?? attrs[name]!.default;
          }
          return out;
        },
      },
    ],
    toDOM(node: PMNode): DOMOutputSpec {
      const dom: Record<string, string> = {
        class: `beakblock-qms-block beakblock-${type.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`,
        'data-qms-type': type,
        contenteditable: 'false',
      };
      if (node.attrs.id) dom['data-block-id'] = String(node.attrs.id);
      for (const name of Object.keys(attrs)) {
        if (name === 'id') continue;
        const value = node.attrs[name];
        if (value === null || value === undefined) continue;
        const attr = `data-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
        dom[attr] = jsonAttrs.includes(name) ? JSON.stringify(value) : String(value);
      }
      return ['div', dom];
    },
  };
}

/** Signature placeholder or signed signature. Written only by the signature service. */
export const signatureBlockNode: NodeSpec = atomBlockSpec('signatureBlock', {
  id: { default: null },
  role: { default: '' },
  signerName: { default: null },
  signedAt: { default: null },
  meaning: { default: 'authored' },
  contentHash: { default: null },
  signatureId: { default: null },
});

/** Table of approvers. */
export const approvalBlockNode: NodeSpec = atomBlockSpec(
  'approvalBlock',
  {
    id: { default: null },
    approvers: { default: [] },
  },
  ['approvers']
);

/** Revision history table generated from entries. */
export const revisionHistoryNode: NodeSpec = atomBlockSpec(
  'revisionHistory',
  {
    id: { default: null },
    entries: { default: [] },
  },
  ['entries']
);

/** Controlled notice ("uncontrolled when printed", "controlled copy", ...). */
export const controlledNoticeNode: NodeSpec = atomBlockSpec('controlledNotice', {
  id: { default: null },
  kind: { default: 'uncontrolledWhenPrinted' },
  copyNumber: { default: null },
});

/** Read-and-acknowledge statement. Acknowledgements are recorded by the QMS service. */
export const acknowledgementNode: NodeSpec = atomBlockSpec('acknowledgement', {
  id: { default: null },
  statement: { default: '' },
  required: { default: true },
});

/** Inline identifier showing the document number or revision. */
export const documentIdentifierNode: NodeSpec = {
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    id: { default: null },
    property: { default: 'docNumber' },
    fallback: { default: null },
  },
  parseDOM: [
    {
      tag: 'span[data-qms-type="documentIdentifier"]',
      getAttrs(dom: HTMLElement) {
        return {
          id: dom.getAttribute('data-block-id'),
          property: dom.getAttribute('data-property') ?? 'docNumber',
          fallback: dom.getAttribute('data-fallback') ?? dom.textContent ?? null,
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const attrs: Record<string, string> = {
      class: 'beakblock-qms-block beakblock-document-identifier',
      'data-qms-type': 'documentIdentifier',
      'data-property': String(node.attrs.property ?? 'docNumber'),
      contenteditable: 'false',
    };
    if (node.attrs.id) attrs['data-block-id'] = String(node.attrs.id);
    if (node.attrs.fallback) attrs['data-fallback'] = String(node.attrs.fallback);
    return ['span', attrs, String(node.attrs.fallback ?? '')];
  },
};

/** All QMS node specs keyed by node type name. */
export const QMS_NODE_SPECS: Readonly<Record<string, NodeSpec>> = {
  controlledSection: controlledSectionNode,
  signatureBlock: signatureBlockNode,
  approvalBlock: approvalBlockNode,
  revisionHistory: revisionHistoryNode,
  controlledNotice: controlledNoticeNode,
  acknowledgement: acknowledgementNode,
  documentIdentifier: documentIdentifierNode,
};
