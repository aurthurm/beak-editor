/**
 * Document Composer (roadmap 5G).
 *
 * Assembles a release-ready document from a published template and pinned, approved section
 * revisions. Sections follow template order. Heading numbering runs continuously across sections.
 * Generated parts (notice, revision history, distribution list, approval and signature page) are
 * added, and page masters, header, footer and watermark are applied. The output is the same for
 * single-section and multi-section documents.
 *
 * Not yet resolved here: TOC, cross-references, captions and bibliography (see README).
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';
import type { BeakDocument, DocumentProperties, DocumentSection, PageSetup } from '@amusendame/beakblock-schema';
import { createDefaultNumbering, createDefaultStyleSheet, NUMBERING_IDS } from '@amusendame/beakblock-schema';
import { documentToIR } from '@amusendame/beakblock-ir';
import type { IRDocument } from '@amusendame/beakblock-ir';

import { sectionContentHash } from './hash';
import { cloneDeep, cloneWithNewIds, defaultFooterBlocks, defaultHeaderBlocks, newId, paragraph } from './blocks';
import { validateProperties } from './validate';
import type { ValidationIssue } from './types';
import type {
  ManifestDraft,
  SectionRevision,
  SignatureRecord,
  TemplateDefinition,
  TemplateSectionDefinition,
} from './types';

/** Thrown when a composition input is incomplete or inconsistent. */
export class ComposeError extends Error {
  readonly code: string;
  readonly issues: ValidationIssue[];

  constructor(code: string, message: string, issues: ValidationIssue[] = []) {
    super(message);
    this.name = 'ComposeError';
    this.code = code;
    this.issues = issues;
  }
}

/** Generated parts that the composer adds. */
export interface GeneratedParts {
  /** Revision history table rows. */
  revisionHistory?: Array<{ revision: string; date: string; author: string; description: string }>;
  /** Approval table and signature blocks. Unsigned approvers get placeholders. */
  approvalPage?: {
    approvers: Array<{ role: string; name: string | null }>;
    signatures?: SignatureRecord[];
  };
  /** Names for the distribution list. */
  distributionList?: string[];
  /** Controlled notice at the top of the document. */
  notice?: { kind: 'uncontrolledWhenPrinted' | 'controlledCopy' | 'draft' | 'superseded'; copyNumber?: number | null };
}

/** Options for {@link composeDocument}. */
export interface ComposeOptions {
  template: TemplateDefinition;
  /** Approved, pinned section revisions. Required sections must have one. */
  sectionRevisions: SectionRevision[];
  /** Document properties. `docNumber` and `revision` are required. */
  properties: DocumentProperties;
  documentId?: string;
  generatedParts?: GeneratedParts;
  /** Watermark text. Defaults to the template's watermark. */
  watermark?: string;
}

/** The composed document, its IR and the manifest draft (signatures are added at release). */
export interface ComposedDocument {
  document: BeakDocument;
  ir: IRDocument;
  manifestDraft: ManifestDraft;
}

/** Heading numbering level and style for a heading block. */
function applyHeadingNumbering(blocks: Block[], numId: string): void {
  for (const block of blocks) {
    if (block.type === 'heading') {
      const level = Math.min(9, Math.max(1, Number((block.props as Record<string, unknown>).level ?? 1)));
      const props = block.props as Record<string, unknown>;
      props.numbering = { numId, level: level - 1 };
      props.styleId = props.styleId ?? `Heading${level}`;
    }
    if (block.children) applyHeadingNumbering(block.children, numId);
  }
}

/** Splits a section revision into the composed controlled section block. */
function sectionBlock(def: TemplateSectionDefinition, rev: SectionRevision, template: TemplateDefinition): Block {
  const children = cloneDeep([...rev.blocks]);
  applyHeadingNumbering(children, NUMBERING_IDS.heading);
  return {
    id: newId('blk'),
    type: 'controlledSection',
    props: {
      sectionId: rev.sectionId,
      templateSectionId: def.templateSectionId,
      policyRef: `${template.id}@${template.version}/${def.templateSectionId}`,
      required: def.required,
      allowedBlocks: def.allowedBlocks ?? null,
      title: def.title,
      ownerName: rev.approvedBy,
      workflowState: 'approved',
      locked: true,
    },
    children,
  };
}

function generatedBlocks(parts: GeneratedParts | undefined, docNumber: string): { head: Block[]; tail: Block[] } {
  const head: Block[] = [];
  const tail: Block[] = [];
  if (parts?.notice) {
    head.push({
      id: newId('blk'),
      type: 'controlledNotice',
      props: { kind: parts.notice.kind, copyNumber: parts.notice.copyNumber ?? null },
    });
  }
  if (parts?.revisionHistory && parts.revisionHistory.length > 0) {
    head.push({ id: newId('blk'), type: 'revisionHistory', props: { entries: cloneDeep(parts.revisionHistory) } });
  }
  if (parts?.distributionList && parts.distributionList.length > 0) {
    tail.push({
      id: newId('blk'),
      type: 'heading',
      props: { level: 2, generated: true },
      content: [{ type: 'text', text: `Distribution list (${docNumber})`, styles: {} }],
    });
    tail.push({
      id: newId('blk'),
      type: 'bulletList',
      props: {},
      children: parts.distributionList.map((name) => ({
        id: newId('blk'),
        type: 'listItem',
        props: {},
        content: [{ type: 'text', text: name, styles: {} }],
      })),
    });
  }
  if (parts?.approvalPage) {
    const { approvers, signatures = [] } = parts.approvalPage;
    tail.push({ id: newId('blk'), type: 'pageBreak', props: {} });
    tail.push({
      id: newId('blk'),
      type: 'heading',
      props: { level: 2, generated: true },
      content: [{ type: 'text', text: 'Approval', styles: {} }],
    });
    tail.push({
      id: newId('blk'),
      type: 'approvalBlock',
      props: {
        approvers: approvers.map((a) => {
          const sig = signatures.find((s) => s.role === a.role);
          return { role: a.role, name: sig?.signerName ?? a.name, signedAt: sig?.signedAt ?? null, signatureId: sig?.signatureId ?? null };
        }),
      },
    });
    for (const sig of signatures) {
      tail.push({
        id: newId('blk'),
        type: 'signatureBlock',
        props: {
          role: sig.role,
          signerName: sig.signerName,
          signedAt: sig.signedAt,
          meaning: sig.meaning,
          contentHash: sig.contentHash,
          signatureId: sig.signatureId,
        },
      });
    }
    for (const a of approvers) {
      if (signatures.some((s) => s.role === a.role)) continue;
      tail.push({
        id: newId('blk'),
        type: 'signatureBlock',
        props: { role: a.role, signerName: null, signedAt: null, meaning: 'approved', contentHash: null, signatureId: null },
      });
    }
  }
  return { head, tail };
}

/**
 * Composes a document from a template and pinned section revisions.
 *
 * @throws {ComposeError} for a missing required revision, an unknown or duplicate revision,
 *   a revision whose content no longer matches its hash, or invalid document properties
 */
export async function composeDocument(options: ComposeOptions): Promise<ComposedDocument> {
  const { template, sectionRevisions } = options;
  if (template.status !== 'published') {
    throw new ComposeError('not-published', `Template "${template.id}" must be published before composition`);
  }
  const known = new Map(template.sections.map((s) => [s.templateSectionId, s]));
  const byTemplate = new Map<string, SectionRevision>();
  for (const rev of sectionRevisions) {
    const tsid = rev.templateSectionId ?? '';
    if (!known.has(tsid)) {
      throw new ComposeError('unknown-revision', `Revision of section "${rev.sectionId}" matches no template section`);
    }
    if (byTemplate.has(tsid)) throw new ComposeError('duplicate-revision', `Two revisions for section "${tsid}"`);
    if ((await sectionContentHash(rev.blocks)) !== rev.contentHash) {
      throw new ComposeError('revision-hash-mismatch', `Revision of section "${tsid}" does not match its hash`);
    }
    byTemplate.set(tsid, rev);
  }
  for (const def of template.sections) {
    if (def.required && !byTemplate.has(def.templateSectionId)) {
      throw new ComposeError('missing-revision', `Required section "${def.title}" has no approved revision`);
    }
  }

  const docNumber = options.properties.docNumber ?? '';
  const revision = options.properties.revision ?? '';
  const propertyIssues = validateProperties(options.properties, template.properties, { fromWorkflow: true });
  if (propertyIssues.some((i) => i.severity === 'error')) {
    throw new ComposeError('properties-invalid', 'Document properties do not satisfy the template', propertyIssues);
  }

  const documentId = options.documentId ?? newId('doc');

  const { head, tail } = generatedBlocks(options.generatedParts, docNumber);

  // Each entry: the page master of a template section and its block.
  const entries: Array<{ master: 'default' | 'landscape'; block: Block }> = [];
  for (const def of template.sections) {
    const rev = byTemplate.get(def.templateSectionId);
    if (!rev) continue;
    entries.push({ master: def.pageMaster ?? 'default', block: sectionBlock(def, rev, template) });
  }
  if (entries.length === 0 && head.length === 0 && tail.length === 0) {
    throw new ComposeError('empty', 'Nothing to compose');
  }

  // Chunk by page master; generated head joins the first chunk, generated tail the last.
  const chunks: Array<{ master: 'default' | 'landscape'; blocks: Block[] }> = [];
  const push = (master: 'default' | 'landscape', block: Block) => {
    const last = chunks[chunks.length - 1];
    if (last && last.master === master) last.blocks.push(block);
    else chunks.push({ master, blocks: [block] });
  };
  for (const block of head) push('default', block);
  for (const entry of entries) push(entry.master, entry.block);
  for (const block of tail) push(chunks[chunks.length - 1]?.master ?? 'default', block);

  const sections: DocumentSection[] = chunks.map((chunk, index) => {
    const pageSetup: PageSetup = cloneDeep(
      chunk.master === 'landscape' && template.pageMasters.landscape ? template.pageMasters.landscape : template.pageMasters.default
    );
    return {
      id: `${documentId}-sec-${index + 1}`,
      pageSetup,
      headers: { default: template.header ? cloneWithNewIds(template.header) : defaultHeaderBlocks({ docNumber, revision, title: options.properties.title }) },
      footers: { default: template.footer ? cloneWithNewIds(template.footer) : defaultFooterBlocks() },
      blocks: chunk.blocks,
    };
  });
  if (sections.length === 0) {
    sections.push({
      id: `${documentId}-sec-1`,
      pageSetup: cloneDeep(template.pageMasters.default),
      headers: { default: defaultHeaderBlocks({ docNumber, revision }) },
      footers: { default: defaultFooterBlocks() },
      blocks: [paragraph('')],
    });
  }

  const watermark = options.watermark ?? template.watermark;
  const properties: DocumentProperties = {
    ...cloneDeep(options.properties),
    custom: {
      ...(options.properties.custom ?? {}),
      templateId: template.id,
      templateVersion: String(template.version),
      documentType: template.documentType,
      ...(watermark ? { watermark } : {}),
    },
  };

  const document: BeakDocument = {
    schemaVersion: 2,
    id: documentId,
    properties,
    styles: cloneDeep(template.styles ?? createDefaultStyleSheet()),
    numbering: cloneDeep(template.numbering ?? createDefaultNumbering()),
    sections,
  };

  const manifestDraft: ManifestDraft = {
    documentId,
    docNumber,
    revision,
    templateId: template.id,
    templateVersion: template.version,
    sections: template.sections
      .filter((def) => byTemplate.has(def.templateSectionId))
      .map((def) => {
        const rev = byTemplate.get(def.templateSectionId)!;
        return { sectionId: rev.sectionId, templateSectionId: def.templateSectionId, revision: rev.revision, contentHash: rev.contentHash };
      }),
  };

  return { document, ir: documentToIR(document), manifestDraft };
}
