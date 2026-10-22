/**
 * Node views for the QMS block family.
 *
 * The controlled section is drawn as a subtle Office-style content control: a thin
 * bracket appears on hover or focus, with a small header tab (title, owner, state chip,
 * lock icon). It looks like part of the document, not a card. Attribute-only blocks render
 * read-only, with text set through `textContent` so document data is never parsed as HTML.
 *
 * @module
 */

import type { Node as PMNode } from 'prosemirror-model';
import type { NodeView, NodeViewConstructor } from 'prosemirror-view';

import type {
  ApprovalEntry,
  ControlledSectionAttrs,
  NoticeKind,
  RevisionHistoryEntry,
  SignatureBlockAttrs,
} from './types';
import { CONTROLLED_SECTION_TYPE } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Human labels for workflow states. */
export const WORKFLOW_STATE_LABELS: Readonly<Record<string, string>> = {
  draft: 'Draft',
  submitted: 'Submitted',
  reviewed: 'Reviewed',
  approved: 'Approved',
  reopened: 'Reopened',
};

/** Printable text for controlled notices. */
export function noticeText(kind: NoticeKind | string, copyNumber?: number | null): string {
  switch (kind) {
    case 'uncontrolledWhenPrinted':
      return 'UNCONTROLLED WHEN PRINTED';
    case 'controlledCopy':
      return copyNumber != null ? `CONTROLLED COPY No. ${copyNumber}` : 'CONTROLLED COPY';
    case 'draft':
      return 'DRAFT - NOT FOR USE';
    case 'superseded':
      return 'SUPERSEDED - DO NOT USE';
    default:
      return String(kind);
  }
}

/** A small padlock drawn as SVG (no external assets). */
function lockIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '10');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'beakblock-cs-lock');
  const body = document.createElementNS(SVG_NS, 'rect');
  body.setAttribute('x', '2');
  body.setAttribute('y', '5');
  body.setAttribute('width', '8');
  body.setAttribute('height', '6');
  body.setAttribute('rx', '1');
  body.setAttribute('fill', 'currentColor');
  const shackle = document.createElementNS(SVG_NS, 'path');
  shackle.setAttribute('d', 'M4 5V3.5a2 2 0 0 1 4 0V5');
  shackle.setAttribute('fill', 'none');
  shackle.setAttribute('stroke', 'currentColor');
  shackle.setAttribute('stroke-width', '1.2');
  svg.append(shackle, body);
  return svg;
}

/**
 * Node view for `controlledSection`.
 *
 * The header tab sits outside the content DOM, so ProseMirror ignores mutations there.
 */
export class ControlledSectionView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private readonly tab: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly ownerEl: HTMLElement;
  private readonly stateEl: HTMLElement;
  private readonly lockSlot: HTMLElement;

  constructor(node: PMNode) {
    this.dom = document.createElement('section');
    this.dom.className = 'beakblock-controlled-section';

    this.tab = document.createElement('div');
    this.tab.className = 'beakblock-cs-tab';
    this.tab.setAttribute('contenteditable', 'false');

    this.titleEl = document.createElement('span');
    this.titleEl.className = 'beakblock-cs-title';
    this.ownerEl = document.createElement('span');
    this.ownerEl.className = 'beakblock-cs-owner';
    this.stateEl = document.createElement('span');
    this.stateEl.className = 'beakblock-cs-state';
    this.lockSlot = document.createElement('span');
    this.lockSlot.className = 'beakblock-cs-lock-slot';

    this.tab.append(this.titleEl, this.ownerEl, this.stateEl, this.lockSlot);

    this.contentDOM = document.createElement('div');
    this.contentDOM.className = 'beakblock-cs-content';

    this.dom.append(this.tab, this.contentDOM);
    this.render(node);
  }

  update(node: PMNode): boolean {
    if (node.type.name !== CONTROLLED_SECTION_TYPE) return false;
    this.render(node);
    return true;
  }

  /** Ignore DOM mutations in the header tab; they are not document content. */
  ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: Node }): boolean {
    if (mutation.type === 'selection') return false;
    return !this.contentDOM.contains(mutation.target);
  }

  private render(node: PMNode): void {
    const a = node.attrs as ControlledSectionAttrs;
    const state = a.workflowState ?? 'draft';
    this.dom.setAttribute('data-section-id', String(a.sectionId ?? ''));
    this.dom.setAttribute('data-workflow-state', state);
    this.dom.setAttribute('data-required', String(Boolean(a.required)));
    this.dom.classList.toggle('is-locked', Boolean(a.locked) || state === 'approved');
    this.titleEl.textContent = a.title || 'Untitled section';
    this.ownerEl.textContent = a.ownerName ? `· ${a.ownerName}` : '';
    this.ownerEl.style.display = a.ownerName ? '' : 'none';
    this.stateEl.textContent = WORKFLOW_STATE_LABELS[state] ?? state;
    this.stateEl.setAttribute('data-state', state);
    this.lockSlot.replaceChildren();
    if (a.locked || state === 'approved') this.lockSlot.append(lockIcon());
    if (a.required) this.tab.setAttribute('data-required-tab', 'true');
    else this.tab.removeAttribute('data-required-tab');
  }
}

/** Generic read-only block view: a labelled frame with a caller-rendered body. */
class AtomBlockView implements NodeView {
  dom: HTMLElement;

  constructor(
    private readonly type: string,
    node: PMNode,
    private readonly paint: (dom: HTMLElement, node: PMNode) => void
  ) {
    this.dom = document.createElement('div');
    this.dom.className = `beakblock-qms-block beakblock-${kebab(type)}`;
    this.dom.setAttribute('data-qms-type', type);
    this.dom.setAttribute('contenteditable', 'false');
    this.paint(this.dom, node);
  }

  update(node: PMNode): boolean {
    if (node.type.name !== this.type) return false;
    this.dom.replaceChildren();
    this.paint(this.dom, node);
    return true;
  }
}

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function cell(tag: 'th' | 'td', text: string): HTMLElement {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}

function table(headers: string[], rows: string[][], caption: string): HTMLElement {
  const t = document.createElement('table');
  t.className = 'beakblock-qms-table';
  const cap = document.createElement('caption');
  cap.textContent = caption;
  t.append(cap);
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const h of headers) hr.append(cell('th', h));
  thead.append(hr);
  const tbody = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    for (const v of r) tr.append(cell('td', v));
    tbody.append(tr);
  }
  t.append(thead, tbody);
  return t;
}

function paintSignature(dom: HTMLElement, node: PMNode): void {
  const a = node.attrs as SignatureBlockAttrs;
  const line = document.createElement('div');
  line.className = 'beakblock-signature-line';
  const signed = Boolean(a.signatureId || a.signedAt);
  line.textContent = signed
    ? `${a.signerName ?? ''} (${a.role || 'signer'})`
    : `Signature pending - ${a.role || 'signer'}`;
  const meta = document.createElement('div');
  meta.className = 'beakblock-signature-meta';
  const meaning = a.meaning ?? 'authored';
  meta.textContent = [meaning, a.signedAt ?? '', a.contentHash ? `hash ${String(a.contentHash).slice(0, 12)}` : '']
    .filter(Boolean)
    .join(' · ');
  dom.append(line, meta);
}

function paintApproval(dom: HTMLElement, node: PMNode): void {
  const approvers = (node.attrs.approvers ?? []) as ApprovalEntry[];
  dom.append(
    table(
      ['Role', 'Name', 'Signed', 'Signature ID'],
      approvers.map((ap) => [ap.role ?? '', ap.name ?? '', ap.signedAt ?? '', ap.signatureId ?? '']),
      'Approval'
    )
  );
}

function paintRevisionHistory(dom: HTMLElement, node: PMNode): void {
  const entries = (node.attrs.entries ?? []) as RevisionHistoryEntry[];
  dom.append(
    table(
      ['Revision', 'Date', 'Author', 'Description'],
      entries.map((e) => [e.revision ?? '', e.date ?? '', e.author ?? '', e.description ?? '']),
      'Revision history'
    )
  );
}

function paintNotice(dom: HTMLElement, node: PMNode): void {
  const p = document.createElement('p');
  p.className = 'beakblock-notice-text';
  p.setAttribute('data-kind', String(node.attrs.kind ?? ''));
  p.textContent = noticeText(String(node.attrs.kind ?? ''), node.attrs.copyNumber as number | null);
  dom.append(p);
}

function paintAcknowledgement(dom: HTMLElement, node: PMNode): void {
  const label = document.createElement('label');
  label.className = 'beakblock-acknowledgement';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.disabled = true;
  box.setAttribute('aria-label', 'Acknowledgement');
  const text = document.createElement('span');
  text.textContent = String(node.attrs.statement ?? '');
  label.append(box, text);
  dom.append(label);
}

/**
 * Node views for every QMS node type, keyed by node type name. Pass to the editor through
 * `nodeViews` (the QMS extension does this for you).
 */
export const qmsNodeViews: Record<string, NodeViewConstructor> = {
  controlledSection: (node) => new ControlledSectionView(node),
  signatureBlock: (node) => new AtomBlockView('signatureBlock', node, paintSignature),
  approvalBlock: (node) => new AtomBlockView('approvalBlock', node, paintApproval),
  revisionHistory: (node) => new AtomBlockView('revisionHistory', node, paintRevisionHistory),
  controlledNotice: (node) => new AtomBlockView('controlledNotice', node, paintNotice),
  acknowledgement: (node) => new AtomBlockView('acknowledgement', node, paintAcknowledgement),
  documentIdentifier: (node) => {
    const span = document.createElement('span');
    span.className = 'beakblock-qms-block beakblock-document-identifier';
    span.setAttribute('data-qms-type', 'documentIdentifier');
    span.setAttribute('contenteditable', 'false');
    span.textContent = String(node.attrs.fallback ?? node.attrs.property ?? '');
    return {
      dom: span,
      update(next: PMNode): boolean {
        if (next.type.name !== 'documentIdentifier') return false;
        span.textContent = String(next.attrs.fallback ?? next.attrs.property ?? '');
        return true;
      },
    } satisfies NodeView;
  },
};
