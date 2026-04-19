import type { Block, InlineContent } from '@amusendame/beakblock-core';
import type { ComplianceSectionDefinition } from '~/data';
import { collectBlockIds, type ComplianceMergeManifest } from '~/utils/complianceMerge';

/** Stable id for the document title heading in the full SOP editor. */
export const COMPLIANCE_DOC_H1_ID = 'compliance-doc-title';

/** Controlled outline depth supported for compliance subsections. */
export type ComplianceHeadingLevel = 1 | 2 | 3;

export function complianceSectionHeadingId(sectionId: string): string {
  return `compliance-h2-${sectionId}`;
}

function inlinePlainText(content: InlineContent[] | undefined): string {
  if (!content?.length) return '';
  let s = '';
  for (const item of content) {
    if (item.type === 'text') s += item.text;
    else if (item.type === 'link') s += inlinePlainText(item.content);
  }
  return s;
}

function headingPlainText(block: Block): string {
  return inlinePlainText(block.content).trim();
}

export function complianceHeadingLevel(block: Block | undefined): number {
  return Number(block?.props?.level ?? 0);
}

function hasComplianceLockId(block: Block | undefined): boolean {
  return String(block?.props?.lockId ?? '').length > 0;
}

/**
 * H1–H3 heading with a non-empty `lockId` — marks a controlled section boundary.
 * The document title line is usually H1 *without* a lock id; it is not a boundary.
 * `props.locked` may be false while the title is temporarily editable; slicing still uses `lockId`.
 */
export function isComplianceSectionBoundaryHeading(block: Block | undefined): boolean {
  if (block?.type !== 'heading') return false;
  const L = complianceHeadingLevel(block);
  if (!Number.isFinite(L) || L < 1 || L > 3) return false;
  return hasComplianceLockId(block);
}

const DEFAULT_SECTION_LOCK_REASON = 'Required section heading (controlled document)';

/** Read whether the section heading is enforcement-locked (`props.locked`), or null if not found. */
export function isComplianceSectionHeadingLocked(
  blocks: Block[],
  sectionLockId: string
): boolean | null {
  const walk = (list: Block[]): boolean | null => {
    for (const b of list) {
      if (b.type === 'heading' && String(b.props?.lockId ?? '') === sectionLockId) {
        return b.props?.locked === true;
      }
      if (b.children?.length) {
        const r = walk(b.children);
        if (r !== null) return r;
      }
    }
    return null;
  };
  return walk(blocks);
}

/** Set `props.locked` on the heading with the given lockId (deep walk). */
export function applyComplianceSectionHeadingLockState(
  blocks: Block[],
  sectionLockId: string,
  locked: boolean
): Block[] {
  const mapTree = (list: Block[]): Block[] =>
    list.map((b) => {
      let out = b;
      if (b.type === 'heading' && String(b.props?.lockId ?? '') === sectionLockId) {
        const p = { ...(b.props as Record<string, unknown>) };
        p.locked = locked;
        if (locked) {
          p.lockReason = p.lockReason ?? DEFAULT_SECTION_LOCK_REASON;
        }
        out = { ...b, props: p };
      }
      if (out.children?.length) {
        out = { ...out, children: mapTree(out.children) };
      }
      return out;
    });
  return mapTree(blocks);
}

export type ComplianceDocumentSectionSlice = {
  sectionId: string;
  title: string;
  /** Direct body only (excludes nested subsection blocks). */
  blocks: Block[];
  /** From template sidecar; defaults true when map omitted. */
  required: boolean;
  level: ComplianceHeadingLevel;
  parentLockId?: string;
  /** PM block id of the heading node. */
  headingBlockId: string;
  children?: ComplianceDocumentSectionSlice[];
};

function isDocTitleOnlyH1(blocks: Block[], index: number): boolean {
  const b = blocks[index];
  return (
    index === 0 &&
    b?.type === 'heading' &&
    complianceHeadingLevel(b) === 1 &&
    !hasComplianceLockId(b)
  );
}

/**
 * Parse controlled sections as an outline: each boundary owns blocks until the next boundary
 * with level ≤ its own; deeper boundaries become child sections.
 */
export function sliceComplianceDocumentTree(doc: Block[]): ComplianceDocumentSectionSlice[] {
  let i = 0;
  if (isDocTitleOnlyH1(doc, 0)) {
    i = 1;
  }

  const top: ComplianceDocumentSectionSlice[] = [];
  while (i < doc.length) {
    const b = doc[i];
    if (!isComplianceSectionBoundaryHeading(b)) {
      break;
    }
    const { slice, nextIndex } = extractComplianceSlice(doc, i);
    top.push(slice);
    i = nextIndex;
  }
  assignParentLockIds(top, undefined);
  return top;
}

function assignParentLockIds(slices: ComplianceDocumentSectionSlice[], parentId: string | undefined): void {
  for (const s of slices) {
    s.parentLockId = parentId;
    if (s.children?.length) {
      assignParentLockIds(s.children, s.sectionId);
    }
  }
}

/** First index after this section’s heading, body, and nested subsections (outline-aligned). */
export function nextIndexAfterComplianceSlice(doc: Block[], start: number): number {
  return extractComplianceSlice(doc, start).nextIndex;
}

function extractComplianceSlice(
  doc: Block[],
  start: number
): { slice: ComplianceDocumentSectionSlice; nextIndex: number } {
  const h = doc[start]!;
  const level = clampHeadingLevel(complianceHeadingLevel(h));
  const sectionId = String(h.props!.lockId);
  const title = headingPlainText(h);
  const headingBlockId = String(h.id ?? '');
  let i = start + 1;
  const body: Block[] = [];
  const children: ComplianceDocumentSectionSlice[] = [];

  while (i < doc.length) {
    const b = doc[i]!;
    if (!isComplianceSectionBoundaryHeading(b)) {
      body.push(b);
      i++;
      continue;
    }
    const nextLevel = complianceHeadingLevel(b);
    if (nextLevel <= level) {
      break;
    }
    const { slice: child, nextIndex } = extractComplianceSlice(doc, i);
    children.push(child);
    i = nextIndex;
  }

  const slice: ComplianceDocumentSectionSlice = {
    sectionId,
    title,
    blocks: body,
    required: true,
    level,
    headingBlockId,
    ...(children.length ? { children } : {}),
  };
  return { slice, nextIndex: i };
}

function clampHeadingLevel(L: number): ComplianceHeadingLevel {
  if (L <= 1) return 1;
  if (L >= 3) return 3;
  return 2 as ComplianceHeadingLevel;
}

/** Depth-first flat list (parent before descendants); omits `children` on each row. */
export function flattenComplianceSectionSlices(
  slices: ComplianceDocumentSectionSlice[]
): Omit<ComplianceDocumentSectionSlice, 'children'>[] {
  const out: Omit<ComplianceDocumentSectionSlice, 'children'>[] = [];
  const walk = (list: ComplianceDocumentSectionSlice[]) => {
    for (const s of list) {
      const { children, ...rest } = s;
      out.push(rest);
      if (children?.length) {
        walk(children);
      }
    }
  };
  walk(slices);
  return out;
}

/**
 * Split the document by hierarchical section boundaries (`lockId` on H1–H3).
 * Optional leading H1 without `lockId` is treated as the document title only.
 */
export function sliceComplianceDocumentByLockedHeadings(
  doc: Block[],
  sectionRequiredByLockId?: Record<string, boolean>
): Omit<ComplianceDocumentSectionSlice, 'children'>[] {
  const tree = sliceComplianceDocumentTree(doc);
  const flat = flattenComplianceSectionSlices(tree);
  return flat.map((s) => ({
    ...s,
    required: sectionRequiredByLockId?.[s.sectionId] ?? true,
  }));
}

/**
 * One continuous document: H1 title, then for each template section a locked H2 plus that section's body blocks.
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

/**
 * Legacy: assumes a flat list of template sections in order, each introduced by a locked H2 with matching `lockId`.
 * For hierarchical templates, prefer {@link sliceComplianceDocumentByLockedHeadings}.
 */
export function sliceComplianceFullDocument(
  doc: Block[],
  sections: ComplianceSectionDefinition[]
): ComplianceDocumentSectionSlice[] {
  const result: ComplianceDocumentSectionSlice[] = [];
  let i = 0;
  if (doc[0]?.type === 'heading' && complianceHeadingLevel(doc[0]) === 1) {
    i = 1;
  }

  for (const def of sections) {
    const expectedH2Id = complianceSectionHeadingId(def.id);
    const block = doc[i];
    const matchesHeading =
      block?.type === 'heading' &&
      (block.id === expectedH2Id || String(block.props?.lockId ?? '') === def.id);

    if (!matchesHeading) {
      result.push({
        sectionId: def.id,
        title: def.title,
        blocks: [],
        required: def.required,
        level: 2,
        headingBlockId: '',
      });
      continue;
    }

    const headingBlockId = String(block!.id ?? '');
    i++;
    const body: Block[] = [];
    while (i < doc.length) {
      const b = doc[i]!;
      if (
        b.type === 'heading' &&
        complianceHeadingLevel(b) === 2 &&
        (String(b.props?.lockId ?? '').length > 0 || String(b.id).startsWith('compliance-h2-'))
      ) {
        break;
      }
      body.push(b);
      i++;
    }
    result.push({
      sectionId: def.id,
      title: def.title,
      blocks: body,
      required: def.required,
      level: 2,
      headingBlockId,
    });
  }

  return result;
}

/** Map a block id from the PM document to its compliance section lockId (innermost subsection). */
export function findComplianceSectionIdForBlockId(doc: Block[], targetBlockId: string): string | undefined {
  if (
    doc[0]?.type === 'heading' &&
    complianceHeadingLevel(doc[0]) === 1 &&
    String(doc[0].id) === targetBlockId &&
    !hasComplianceLockId(doc[0])
  ) {
    return undefined;
  }

  const tree = sliceComplianceDocumentTree(doc);

  const search = (slices: ComplianceDocumentSectionSlice[]): string | undefined => {
    for (const s of slices) {
      if (s.headingBlockId === targetBlockId) {
        return s.sectionId;
      }
      if (blockIdInTree(s.blocks, targetBlockId)) {
        return s.sectionId;
      }
      if (s.children?.length) {
        const nested = search(s.children);
        if (nested) return nested;
      }
    }
    return undefined;
  };

  return search(tree);
}

export function findSectionTitleInDoc(doc: Block[], sectionId: string): string | undefined {
  return sliceComplianceDocumentByLockedHeadings(doc).find((s) => s.sectionId === sectionId)?.title;
}

export function buildMergeManifestFromFullDoc(doc: Block[], documentTitle: string): ComplianceMergeManifest {
  const flat = flattenComplianceSectionSlices(sliceComplianceDocumentTree(doc));
  const h1 = doc[0];
  const manifest: ComplianceMergeManifest = {
    generatedAt: new Date().toISOString(),
    sections: [],
    documentTitle,
    documentTitleBlockId:
      h1?.type === 'heading' && complianceHeadingLevel(h1) === 1 ? String(h1.id) : undefined,
  };

  for (const s of flat) {
    const headingId = s.headingBlockId;
    const bodyIds = collectBlockIds(s.blocks);
    manifest.sections.push({
      sectionId: s.sectionId,
      title: s.title,
      blockIds: [headingId, ...bodyIds].filter(Boolean),
    });
  }

  return manifest;
}
