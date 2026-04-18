import type { Block } from '@amusendame/beakblock-core';
import type { ComplianceSectionDefinition } from '~/data';
import { collectBlockIds, type ComplianceMergeManifest } from '~/utils/complianceMerge';

/** Stable id for the document title heading in the full SOP editor. */
export const COMPLIANCE_DOC_H1_ID = 'compliance-doc-title';

export function complianceSectionHeadingId(sectionId: string): string {
  return `compliance-h2-${sectionId}`;
}

/**
 * One continuous document: H1 title, then for each section a locked H2 plus that section's body blocks.
 */
export function buildComplianceFullDocumentBlocks(
  sections: ComplianceSectionDefinition[],
  documentTitle: string
): Block[] {
  const out: Block[] = [
    {
      id: COMPLIANCE_DOC_H1_ID,
      type: 'heading',
      props: { level: 1, textAlign: 'left' },
      content: [{ type: 'text', text: documentTitle, styles: {} }],
    },
  ];

  for (const def of sections) {
    out.push({
      id: complianceSectionHeadingId(def.id),
      type: 'heading',
      props: {
        level: 2,
        textAlign: 'left',
        locked: true,
        lockReason: 'Required section heading (controlled document)',
        lockId: def.id,
      },
      content: [{ type: 'text', text: def.title, styles: {} }],
    });
    out.push(...def.initialBlocks);
  }

  return out;
}

function blockIdInTree(blocks: Block[], targetId: string): boolean {
  for (const b of blocks) {
    if (b.id === targetId) return true;
    if (b.children?.length && blockIdInTree(b.children, targetId)) return true;
  }
  return false;
}

export type ComplianceDocumentSectionSlice = { sectionId: string; title: string; blocks: Block[] };

/**
 * Split a full-document block list into per-section bodies (excluding locked H2 headings).
 * Assumes optional leading H1, then repeating [locked H2, ...body] in section definition order.
 */
export function sliceComplianceFullDocument(
  doc: Block[],
  sections: ComplianceSectionDefinition[]
): ComplianceDocumentSectionSlice[] {
  const result: ComplianceDocumentSectionSlice[] = [];
  let i = 0;
  if (doc[0]?.type === 'heading' && Number(doc[0].props?.level) === 1) {
    i = 1;
  }

  for (const def of sections) {
    const expectedH2Id = complianceSectionHeadingId(def.id);
    const block = doc[i];
    const matchesHeading =
      block?.type === 'heading' &&
      (block.id === expectedH2Id ||
        (block.props?.locked === true && String(block.props?.lockId ?? '') === def.id));

    if (!matchesHeading) {
      result.push({ sectionId: def.id, title: def.title, blocks: [] });
      continue;
    }

    i++;
    const body: Block[] = [];
    while (i < doc.length) {
      const b = doc[i]!;
      if (
        b.type === 'heading' &&
        Number(b.props?.level) === 2 &&
        (b.props?.locked === true || b.id.startsWith('compliance-h2-'))
      ) {
        break;
      }
      body.push(b);
      i++;
    }
    result.push({ sectionId: def.id, title: def.title, blocks: body });
  }

  return result;
}

/** Map a block id from the PM document to its compliance section (if any). */
export function findComplianceSectionIdForBlockId(
  doc: Block[],
  targetBlockId: string,
  sections: ComplianceSectionDefinition[]
): string | undefined {
  if (doc[0]?.id === targetBlockId) return undefined;

  for (const def of sections) {
    if (complianceSectionHeadingId(def.id) === targetBlockId) return def.id;
  }

  const slices = sliceComplianceFullDocument(doc, sections);
  for (const s of slices) {
    if (blockIdInTree(s.blocks, targetBlockId)) return s.sectionId;
  }
  return undefined;
}

export function buildMergeManifestFromFullDoc(
  doc: Block[],
  sections: ComplianceSectionDefinition[],
  documentTitle: string
): ComplianceMergeManifest {
  const sliced = sliceComplianceFullDocument(doc, sections);
  const h1 = doc[0];
  const manifest: ComplianceMergeManifest = {
    generatedAt: new Date().toISOString(),
    sections: [],
    documentTitle,
    documentTitleBlockId:
      h1?.type === 'heading' && Number(h1.props?.level) === 1 ? String(h1.id) : undefined,
  };

  let i = 0;
  if (h1?.type === 'heading' && Number(h1.props?.level) === 1) i = 1;

  for (const def of sections) {
    const heading = doc[i];
    const headingId = heading?.id ? String(heading.id) : '';
    const sec = sliced.find((s) => s.sectionId === def.id);
    const contentBlocks = sec?.blocks ?? [];
    const bodyIds = collectBlockIds(contentBlocks);
    manifest.sections.push({
      sectionId: def.id,
      title: def.title,
      blockIds: [headingId, ...bodyIds],
    });
    if (heading?.type === 'heading') i++;
    i += contentBlocks.length;
  }

  return manifest;
}
