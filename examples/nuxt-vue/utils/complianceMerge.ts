import type { Block } from '@aurthurm/beakblock-core';

function remapBlockTreeIds(blocks: Block[]): Block[] {
  const clone = JSON.parse(JSON.stringify(blocks)) as Block[];
  const walk = (list: Block[]) => {
    for (const b of list) {
      b.id = crypto.randomUUID();
      if (b.children?.length) walk(b.children);
    }
  };
  walk(clone);
  return clone;
}

function collectBlockIds(blocks: Block[]): string[] {
  const ids: string[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      ids.push(b.id);
      if (b.children?.length) walk(b.children);
    }
  };
  walk(blocks);
  return ids;
}

export type ComplianceSectionSource = { sectionId: string; title: string; blocks: Block[] };

export interface ComplianceMergeManifest {
  documentTitle?: string;
  documentTitleBlockId?: string;
  generatedAt: string;
  sections: Array<{
    sectionId: string;
    title: string;
    /** Section heading block id followed by remapped content block ids */
    blockIds: string[];
  }>;
}

export interface ComplianceMergeResult {
  blocks: Block[];
  manifest: ComplianceMergeManifest;
}

/**
 * Builds one continuous document: optional H1, then for each section an H2 title
 * followed by that section's blocks (IDs remapped so the merged doc is valid).
 */
export function mergeComplianceSections(
  sections: ComplianceSectionSource[],
  options?: { documentTitle?: string; sectionHeadingLevel?: 1 | 2 | 3 }
): Block[] {
  return mergeComplianceSectionsWithManifest(sections, options).blocks;
}

/**
 * Same as {@link mergeComplianceSections} plus a manifest mapping logical section ids to merged block ids (provenance for export / audit).
 */
export function mergeComplianceSectionsWithManifest(
  sections: ComplianceSectionSource[],
  options?: { documentTitle?: string; sectionHeadingLevel?: 1 | 2 | 3 }
): ComplianceMergeResult {
  const level = options?.sectionHeadingLevel ?? 2;
  const out: Block[] = [];
  const manifest: ComplianceMergeManifest = {
    generatedAt: new Date().toISOString(),
    sections: [],
  };

  if (options?.documentTitle) {
    manifest.documentTitle = options.documentTitle;
    const titleId = crypto.randomUUID();
    manifest.documentTitleBlockId = titleId;
    out.push({
      id: titleId,
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: options.documentTitle, styles: {} }],
    });
  }

  for (const sec of sections) {
    const headingId = crypto.randomUUID();
    out.push({
      id: headingId,
      type: 'heading',
      props: { level },
      content: [{ type: 'text', text: sec.title, styles: {} }],
    });
    const remapped = remapBlockTreeIds(sec.blocks);
    out.push(...remapped);
    manifest.sections.push({
      sectionId: sec.sectionId,
      title: sec.title,
      blockIds: [headingId, ...collectBlockIds(remapped)],
    });
  }

  return { blocks: out, manifest };
}
