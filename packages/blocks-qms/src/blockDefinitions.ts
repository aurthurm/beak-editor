/**
 * Block definitions for the QMS family (`family: 'qms'`).
 *
 * Each definition provides validation for the block registry, a print HTML fragment
 * for `renderPrint`, and a `toIR` hint. The IR package maps `controlledSection` to an
 * `sdt` content control itself, so the section definition's `toIR` is not used there.
 *
 * @module
 */

import type { Block, BeakBlockDefinition, ValidationContext, ValidationIssue } from '@amusendame/beakblock-core';

import { CONTROLLED_SECTION_TYPE, NOTICE_KINDS, SIGNATURE_MEANINGS, WORKFLOW_STATES } from './types';
import type { ApprovalEntry, RevisionHistoryEntry } from './types';

/** Escapes text for inclusion in HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CAPABILITIES = {
  editable: false,
  nested: false,
  printable: true,
  splittable: false,
  collaborative: true,
} as const;

const CONTAINER_CAPABILITIES = { ...CAPABILITIES, nested: true, editable: true, splittable: true } as const;

/** Returns the block's own props as a plain object. */
function propsOf(block: Block): Record<string, unknown> {
  return (block.props ?? {}) as Record<string, unknown>;
}

/** Whether a signature block carries service-written data. */
function isSignedProps(props: Record<string, unknown>): boolean {
  return Boolean(props.signatureId || props.signedAt || props.contentHash);
}

function issue(
  severity: ValidationIssue['severity'],
  code: string,
  message: string,
  block: Block
): ValidationIssue {
  return { severity, code, message, blockId: block.id };
}

/** Validates a controlled section and the direct children it allows. */
export function validateControlledSection(block: Block, _ctx?: ValidationContext): ValidationIssue[] {
  const props = propsOf(block);
  const issues: ValidationIssue[] = [];
  const sectionId = typeof props.sectionId === 'string' ? props.sectionId : '';
  if (!sectionId) issues.push(issue('error', 'section-id-missing', 'Controlled section has no sectionId', block));
  if (!props.title) issues.push(issue('warning', 'section-title-missing', 'Controlled section has no title', block));
  if (!(WORKFLOW_STATES as readonly string[]).includes(String(props.workflowState ?? 'draft'))) {
    issues.push(issue('error', 'section-state-invalid', `Unknown workflow state "${String(props.workflowState)}"`, block));
  }
  const allowed = props.allowedBlocks;
  if (allowed !== null && allowed !== undefined && !(Array.isArray(allowed) && allowed.every((t) => typeof t === 'string'))) {
    issues.push(issue('error', 'section-allowed-blocks-invalid', 'allowedBlocks must be a string array or null', block));
  }
  if (Array.isArray(allowed)) {
    for (const child of block.children ?? []) {
      if (!allowed.includes(child.type)) {
        issues.push(
          issue('error', 'disallowed-block', `Block type "${child.type}" is not allowed in this section`, child)
        );
      }
    }
  }
  return issues;
}

/** Validates a signature block. Unsigned placeholders are valid. */
export function validateSignatureBlock(block: Block): ValidationIssue[] {
  const props = propsOf(block);
  const issues: ValidationIssue[] = [];
  if (!(SIGNATURE_MEANINGS as readonly string[]).includes(String(props.meaning ?? 'authored'))) {
    issues.push(issue('error', 'signature-meaning-invalid', `Unknown signature meaning "${String(props.meaning)}"`, block));
  }
  if (!props.role) issues.push(issue('warning', 'signature-role-missing', 'Signature block has no role', block));
  if (isSignedProps(props)) {
    if (!props.signerName) issues.push(issue('error', 'signature-incomplete', 'Signed block has no signerName', block));
    if (!props.contentHash) issues.push(issue('error', 'signature-incomplete', 'Signed block has no contentHash', block));
    if (!props.signatureId) issues.push(issue('error', 'signature-incomplete', 'Signed block has no signatureId', block));
  }
  return issues;
}

/** Validates a controlled notice. */
export function validateControlledNotice(block: Block): ValidationIssue[] {
  const props = propsOf(block);
  const issues: ValidationIssue[] = [];
  if (!(NOTICE_KINDS as readonly string[]).includes(String(props.kind))) {
    issues.push(issue('error', 'notice-kind-invalid', `Unknown notice kind "${String(props.kind)}"`, block));
  }
  if (props.kind === 'controlledCopy' && (typeof props.copyNumber !== 'number' || props.copyNumber < 1)) {
    issues.push(issue('error', 'notice-copy-number-missing', 'Controlled copies need a copyNumber of at least 1', block));
  }
  return issues;
}

/** Renders a controlled section as a print title band. Children are rendered by the layout. */
function renderSectionPrint(block: Block): string {
  const props = propsOf(block);
  const title = props.title ? escapeHtml(props.title) : '';
  return `<div class="beakblock-cs-print" data-section-id="${escapeHtml(props.sectionId)}">${title}</div>`;
}

/** Print HTML for each QMS block. */
export function renderQmsPrint(block: Block): string {
  const props = propsOf(block);
  switch (block.type) {
    case CONTROLLED_SECTION_TYPE:
      return renderSectionPrint(block);
    case 'signatureBlock': {
      const who = isSignedProps(props)
        ? `${escapeHtml(props.signerName)} (${escapeHtml(props.role)})`
        : `Signature pending - ${escapeHtml(props.role)}`;
      return `<div class="beakblock-signature-print">${who}<div class="beakblock-signature-print-meta">${escapeHtml(props.meaning)} ${escapeHtml(props.signedAt ?? '')}</div></div>`;
    }
    case 'approvalBlock': {
      const rows = ((props.approvers ?? []) as ApprovalEntry[])
        .map((a) => `<tr><td>${escapeHtml(a.role)}</td><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.signedAt)}</td></tr>`)
        .join('');
      return `<table class="beakblock-qms-table"><thead><tr><th>Role</th><th>Name</th><th>Signed</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    case 'revisionHistory': {
      const rows = ((props.entries ?? []) as RevisionHistoryEntry[])
        .map((e) => `<tr><td>${escapeHtml(e.revision)}</td><td>${escapeHtml(e.date)}</td><td>${escapeHtml(e.author)}</td><td>${escapeHtml(e.description)}</td></tr>`)
        .join('');
      return `<table class="beakblock-qms-table"><thead><tr><th>Revision</th><th>Date</th><th>Author</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    case 'controlledNotice': {
      const text = props.kind === 'controlledCopy' && props.copyNumber != null
        ? `CONTROLLED COPY No. ${escapeHtml(props.copyNumber)}`
        : escapeHtml(props.kind === 'uncontrolledWhenPrinted' ? 'UNCONTROLLED WHEN PRINTED' : props.kind === 'draft' ? 'DRAFT - NOT FOR USE' : props.kind === 'superseded' ? 'SUPERSEDED - DO NOT USE' : 'CONTROLLED COPY');
      return `<p class="beakblock-notice-print">${text}</p>`;
    }
    case 'acknowledgement':
      return `<p class="beakblock-acknowledgement-print">[ ] ${escapeHtml(props.statement)}</p>`;
    case 'documentIdentifier':
      return escapeHtml(props.fallback ?? '');
    default:
      return '';
  }
}

/**
 * Lossy IR hint: a paragraph carrying a text summary and the original block as `source`.
 * Exporters that know the type can use `source` to rebuild the block losslessly.
 */
function toIRSummary(block: Block, text: string): unknown {
  return {
    type: 'paragraph',
    props: {},
    runs: [{ type: 'run', text, props: {} }],
    source: { blockType: block.type, blockId: block.id, props: block.props },
  };
}

function summaryText(block: Block): string {
  const props = propsOf(block);
  switch (block.type) {
    case 'signatureBlock':
      return `${String(props.role ?? 'Signature')}: ${String(props.signerName ?? 'pending')}${props.signedAt ? ` (${String(props.signedAt)})` : ''}`;
    case 'controlledNotice':
      return renderQmsPrint(block).replace(/<[^>]+>/g, '');
    case 'acknowledgement':
      return `[ ] ${String(props.statement ?? '')}`;
    case 'revisionHistory':
      return `Revision history (${((props.entries ?? []) as unknown[]).length} entries)`;
    case 'approvalBlock':
      return `Approval (${((props.approvers ?? []) as unknown[]).length} approvers)`;
    default:
      return String(props.title ?? block.type);
  }
}

const SIGNATURE_BLOCK: BeakBlockDefinition = {
  type: 'signatureBlock',
  version: 1,
  family: 'qms',
  capabilities: CAPABILITIES,
  validate: (block) => validateSignatureBlock(block),
  renderPrint: renderQmsPrint,
  toIR: (block) => toIRSummary(block, summaryText(block)),
};

/**
 * Block definitions for the QMS family. Register them with a `BlockRegistry` or pass
 * them through `qmsExtension()`.
 */
export const qmsBlockDefinitions: BeakBlockDefinition[] = [
  {
    type: CONTROLLED_SECTION_TYPE,
    version: 1,
    family: 'qms',
    capabilities: CONTAINER_CAPABILITIES,
    validate: (block, ctx) => validateControlledSection(block, ctx),
    renderPrint: renderQmsPrint,
    toIR: (block) => toIRSummary(block, summaryText(block)),
  },
  SIGNATURE_BLOCK,
  {
    type: 'approvalBlock',
    version: 1,
    family: 'qms',
    capabilities: CAPABILITIES,
    validate: (block) =>
      Array.isArray(propsOf(block).approvers)
        ? []
        : [issue('error', 'approvers-invalid', 'approvers must be an array', block)],
    renderPrint: renderQmsPrint,
    toIR: (block) => toIRSummary(block, summaryText(block)),
  },
  {
    type: 'revisionHistory',
    version: 1,
    family: 'qms',
    capabilities: CAPABILITIES,
    validate: (block) =>
      Array.isArray(propsOf(block).entries)
        ? (propsOf(block).entries as RevisionHistoryEntry[]).flatMap((entry) =>
            entry && entry.revision
              ? []
              : [issue('warning', 'revision-entry-incomplete', 'Revision entry has no revision', block)]
          )
        : [issue('error', 'entries-invalid', 'entries must be an array', block)],
    renderPrint: renderQmsPrint,
    toIR: (block) => toIRSummary(block, summaryText(block)),
  },
  {
    type: 'controlledNotice',
    version: 1,
    family: 'qms',
    capabilities: CAPABILITIES,
    validate: (block) => validateControlledNotice(block),
    renderPrint: renderQmsPrint,
    toIR: (block) => toIRSummary(block, summaryText(block)),
  },
  {
    type: 'acknowledgement',
    version: 1,
    family: 'qms',
    capabilities: CAPABILITIES,
    validate: (block) =>
      String(propsOf(block).statement ?? '').trim()
        ? []
        : [issue('error', 'acknowledgement-statement-missing', 'Acknowledgement needs a statement', block)],
    renderPrint: renderQmsPrint,
    toIR: (block) => toIRSummary(block, summaryText(block)),
  },
  {
    type: 'documentIdentifier',
    version: 1,
    family: 'qms',
    capabilities: { ...CAPABILITIES, splittable: false },
    renderPrint: renderQmsPrint,
    toIR: (block) => toIRSummary(block, String(propsOf(block).fallback ?? '')),
  },
];
