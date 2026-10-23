import { DOCUMENT_INSTANCES_STORE, dbGet, dbGetAllByIndex, dbPut } from './complianceDb';

/**
 * A controlled document instance: one working copy of a template. Approvals and release sign-offs are
 * keyed by its `instanceId`, so the id must survive reloads or sign-offs appear to disappear.
 * Storage falls back to per-session memory when IndexedDB is unavailable (see complianceDb.ts).
 */
export type DocumentInstanceRecord = {
  instanceId: string;
  templateId: string;
  createdAt: string;
  /** Bumped whenever the instance is created or opened; the newest record per template is its current instance. */
  updatedAt: string;
};

/** Instance by id (from the URL `?doc=` param), or null if this browser has never stored it. */
export async function findDocumentInstance(instanceId: string): Promise<DocumentInstanceRecord | null> {
  const row = await dbGet<DocumentInstanceRecord>(DOCUMENT_INSTANCES_STORE, instanceId);
  return row?.instanceId ? row : null;
}

/** Most recently opened or created instance for a template, or null. */
export async function findCurrentInstanceForTemplate(templateId: string): Promise<DocumentInstanceRecord | null> {
  const rows = await dbGetAllByIndex<DocumentInstanceRecord>(DOCUMENT_INSTANCES_STORE, 'templateId', templateId);
  rows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return rows[0] ?? null;
}

/** Mints a new instance for a template and makes it the template's current instance. */
export async function createDocumentInstance(templateId: string): Promise<string> {
  const now = new Date().toISOString();
  const record: DocumentInstanceRecord = {
    instanceId: crypto.randomUUID(),
    templateId,
    createdAt: now,
    updatedAt: now,
  };
  await dbPut(DOCUMENT_INSTANCES_STORE, record);
  return record.instanceId;
}

/** Marks an existing instance as opened (makes it the current instance for its template). */
export async function touchDocumentInstance(record: DocumentInstanceRecord): Promise<void> {
  await dbPut(DOCUMENT_INSTANCES_STORE, { ...record, updatedAt: new Date().toISOString() });
}

/**
 * Re-applying a template keeps its existing current instance (and therefore its approvals).
 * A new instance is only minted when none exists yet for this template.
 */
export async function openTemplateInstance(templateId: string): Promise<string> {
  const existing = await findCurrentInstanceForTemplate(templateId);
  if (existing) {
    await touchDocumentInstance(existing);
    return existing.instanceId;
  }
  return createDocumentInstance(templateId);
}
