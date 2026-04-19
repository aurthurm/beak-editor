import type { Block } from '@amusendame/beakblock-core';
import { complianceSopSections } from '~/data';
import {
  buildComplianceFullDocumentBlocks,
  flattenComplianceSectionSlices,
  isComplianceSectionBoundaryHeading,
  nextIndexAfterComplianceSlice,
  sliceComplianceDocumentTree,
} from '~/utils/complianceFullDocument';
import { TEMPLATES_STORE, openComplianceDb } from '~/utils/complianceDb';

/** Stable id for the seeded Gram stain demo template (one-time seed when store is empty). */
export const GRAM_STAIN_TEMPLATE_ID = 'tpl-seed-gram-stain-sop';

export type ComplianceTemplateRecord = {
  id: string;
  name: string;
  updatedAt: string;
  blocks: Block[];
  /** Required flags keyed by section `lockId`; omitted ids default to required at runtime. */
  sectionRequiredByLockId: Record<string, boolean>;
};

/** Starter document: H1 + one locked H2 + empty paragraph. */
export function emptyComplianceTemplateBlocks(documentTitle: string): Block[] {
  const sectionLockId = crypto.randomUUID();
  return [
    {
      id: crypto.randomUUID(),
      type: 'heading',
      props: { level: 1, textAlign: 'left' },
      content: [{ type: 'text', text: documentTitle, styles: {} }],
    },
    {
      id: crypto.randomUUID(),
      type: 'heading',
      props: {
        level: 2,
        textAlign: 'left',
        locked: true,
        lockReason: 'Section heading (template)',
        lockId: sectionLockId,
      },
      content: [{ type: 'text', text: 'New section', styles: {} }],
    },
    {
      id: crypto.randomUUID(),
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: ' ', styles: {} }],
    },
  ];
}

/**
 * Enforce: optional leading H1 (no lock id = title only), then a valid outline of H1–H3 headings
 * with `lockId` (subsections nest under deeper levels; see `sliceComplianceDocumentTree`).
 */
export function validateTemplateDocument(blocks: Block[]): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!blocks.length) {
    issues.push('Document is empty.');
    return { ok: false, issues };
  }
  let i = 0;
  if (blocks[0]?.type === 'heading' && Number(blocks[0].props?.level) === 1) {
    const hasLock = String(blocks[0].props?.lockId ?? '').length > 0;
    if (!hasLock) {
      i = 1;
    }
  }
  if (i >= blocks.length) {
    issues.push('Add at least one controlled heading (H1–H3) with a lock id after the title.');
    return { ok: false, issues };
  }

  let cursor = i;
  while (cursor < blocks.length) {
    const h = blocks[cursor];
    if (!isComplianceSectionBoundaryHeading(h)) {
      issues.push(
        `Expected a controlled section heading (H1–H3 with lock id) at block index ${cursor}. Use the toolbar or lock a heading from the side menu.`
      );
      return { ok: false, issues };
    }
    cursor = nextIndexAfterComplianceSlice(blocks, cursor);
  }

  const tree = sliceComplianceDocumentTree(blocks);
  const flat = flattenComplianceSectionSlices(tree);
  if (flat.length === 0) {
    issues.push('Add at least one controlled heading with a lock id.');
  }
  return { ok: flat.length > 0 && issues.length === 0, issues };
}

/** New compliance document instance: new block ids, same section lockIds. */
export function cloneTemplateBlocksForNewDocument(blocks: Block[]): Block[] {
  const clone = structuredClone(blocks) as Block[];
  const walk = (list: Block[]) => {
    for (const b of list) {
      b.id = crypto.randomUUID();
      if (b.children?.length) walk(b.children);
    }
  };
  walk(clone);
  return clone;
}

function normalizeTemplate(row: unknown): ComplianceTemplateRecord | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  const name = typeof r.name === 'string' ? r.name : '';
  const updatedAt = typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString();
  const blocks = Array.isArray(r.blocks) ? (r.blocks as Block[]) : [];
  const sectionRequiredByLockId =
    r.sectionRequiredByLockId && typeof r.sectionRequiredByLockId === 'object' ?
      (r.sectionRequiredByLockId as Record<string, boolean>)
    : {};
  if (!id || !name) return null;
  return { id, name, updatedAt, blocks, sectionRequiredByLockId };
}

export async function listTemplates(): Promise<ComplianceTemplateRecord[]> {
  const db = await openComplianceDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEMPLATES_STORE, 'readonly');
    const req = tx.objectStore(TEMPLATES_STORE).getAll();
    req.onerror = (): void => reject(req.error ?? new Error('list templates'));
    req.onsuccess = (): void => {
      const raw = req.result as unknown[];
      const out = raw.map(normalizeTemplate).filter((x): x is ComplianceTemplateRecord => x != null);
      out.sort((a, b) => a.name.localeCompare(b.name));
      resolve(out);
    };
  });
}

export async function getTemplate(id: string): Promise<ComplianceTemplateRecord | null> {
  const db = await openComplianceDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEMPLATES_STORE, 'readonly');
    const req = tx.objectStore(TEMPLATES_STORE).get(id);
    req.onerror = (): void => reject(req.error ?? new Error('get template'));
    req.onsuccess = (): void => resolve(normalizeTemplate(req.result));
  });
}

export async function putTemplate(record: ComplianceTemplateRecord): Promise<void> {
  const db = await openComplianceDb();
  const row: ComplianceTemplateRecord = {
    ...record,
    updatedAt: record.updatedAt || new Date().toISOString(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEMPLATES_STORE, 'readwrite');
    tx.oncomplete = (): void => resolve();
    tx.onerror = (): void => reject(tx.error ?? new Error('put template'));
    tx.objectStore(TEMPLATES_STORE).put(row);
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await openComplianceDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEMPLATES_STORE, 'readwrite');
    tx.oncomplete = (): void => resolve();
    tx.onerror = (): void => reject(tx.error ?? new Error('delete template'));
    tx.objectStore(TEMPLATES_STORE).delete(id);
  });
}

export function buildGramStainSeedTemplate(): ComplianceTemplateRecord {
  const title = 'Gram stain — standard operating procedure (controlled)';
  const blocks = buildComplianceFullDocumentBlocks(complianceSopSections, title);
  const sectionRequiredByLockId = Object.fromEntries(
    complianceSopSections.map((s) => [s.id, s.required])
  );
  return {
    id: GRAM_STAIN_TEMPLATE_ID,
    name: 'Gram stain SOP (demo seed)',
    updatedAt: new Date().toISOString(),
    blocks,
    sectionRequiredByLockId,
  };
}

export async function seedGramStainTemplateIfEmpty(): Promise<void> {
  const list = await listTemplates();
  if (list.length > 0) return;
  await putTemplate(buildGramStainSeedTemplate());
}
