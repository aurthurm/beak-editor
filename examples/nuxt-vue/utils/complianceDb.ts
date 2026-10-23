/**
 * Shared storage for the compliance demo: section versions, comment snapshots, approvals, releases,
 * templates and document instances.
 *
 * Every compliance store goes through the `db*` helpers below. They use IndexedDB when it can be opened and
 * otherwise fall back to an in-memory backend with the same semantics for the rest of this page session.
 * Availability is detected once (missing `indexedDB`, open error, SecurityError, blocked or timed-out open);
 * stores therefore never need their own try/catch for storage being blocked.
 */

export const COMPLIANCE_DB_NAME = 'beakblock-compliance-demo';
export const COMPLIANCE_DB_VERSION = 6;

export const VERSIONS_STORE = 'sectionVersions';
export const COMMENTS_STORE = 'sectionComments';
export const APPROVALS_STORE = 'sectionApprovals';
export const DOCUMENT_RELEASE_STORE = 'documentRelease';
export const TEMPLATES_STORE = 'complianceTemplates';
export const DOCUMENT_INSTANCES_STORE = 'documentInstances';

export type ComplianceStoreName =
  | typeof VERSIONS_STORE
  | typeof COMMENTS_STORE
  | typeof APPROVALS_STORE
  | typeof DOCUMENT_RELEASE_STORE
  | typeof TEMPLATES_STORE
  | typeof DOCUMENT_INSTANCES_STORE;

/** Primary key path of each object store (matches the upgrade handler below). */
const KEY_PATHS: Record<ComplianceStoreName, string> = {
  [VERSIONS_STORE]: 'id',
  [COMMENTS_STORE]: 'sectionKey',
  [APPROVALS_STORE]: 'sectionKey',
  [DOCUMENT_RELEASE_STORE]: 'docKey',
  [TEMPLATES_STORE]: 'id',
  [DOCUMENT_INSTANCES_STORE]: 'instanceId',
};

/** `'indexeddb'` once the database opened; `'memory'` after an availability failure; `'pending'` before detection. */
export type ComplianceStorageMode = 'pending' | 'indexeddb' | 'memory';

/** Reason IndexedDB could not be used, or null while it is usable. */
let fallbackReason: string | null = null;
let mode: ComplianceStorageMode = 'pending';
let dbPromise: Promise<IDBDatabase> | null = null;

const OPEN_TIMEOUT_MS = 4000;

/** Per-session backend used when IndexedDB is unavailable. Rows are snapshots, like IndexedDB clones. */
const memoryStores = new Map<ComplianceStoreName, Map<string, unknown>>();

function memoryStore(store: ComplianceStoreName): Map<string, unknown> {
  let m = memoryStores.get(store);
  if (!m) {
    m = new Map();
    memoryStores.set(store, m);
  }
  return m;
}

/** Structured clone, or a JSON copy for reactive (Vue proxy) values that structuredClone refuses. */
function snapshot<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

function switchToMemory(reason: string): void {
  if (mode === 'memory') return;
  mode = 'memory';
  fallbackReason = reason;
  dbPromise = null;
  console.warn(`[compliance] IndexedDB unavailable (${reason}); using in-memory storage for this session.`);
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined' || indexedDB === null) {
      reject(new Error('indexedDB is not available'));
      return;
    }
    let settled = false;
    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error('IndexedDB open timed out'))),
      OPEN_TIMEOUT_MS
    );

    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(COMPLIANCE_DB_NAME, COMPLIANCE_DB_VERSION);
    } catch (err) {
      finish(() => reject(err));
      return;
    }
    req.onerror = (): void => finish(() => reject(req.error ?? new Error('IndexedDB open failed')));
    req.onblocked = (): void =>
      finish(() => reject(new Error('IndexedDB open blocked by another connection')));
    req.onsuccess = (): void => {
      const db = req.result;
      if (settled) {
        // Gave up on this open already (timeout or blocked); do not keep a stray connection.
        db.close();
        return;
      }
      finish(() => {
        db.onversionchange = (): void => {
          // Another tab is upgrading the schema: release our connection and reopen on next use.
          db.close();
          dbPromise = null;
        };
        resolve(db);
      });
    };
    req.onupgradeneeded = (ev): void => {
      const db = req.result;
      const old = ev.oldVersion;
      if (old < 1 && !db.objectStoreNames.contains(VERSIONS_STORE)) {
        const store = db.createObjectStore(VERSIONS_STORE, { keyPath: 'id' });
        store.createIndex('sectionKey', 'sectionKey', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (old < 2 && !db.objectStoreNames.contains(COMMENTS_STORE)) {
        db.createObjectStore(COMMENTS_STORE, { keyPath: 'sectionKey' });
      }
      if (old < 3 && !db.objectStoreNames.contains(APPROVALS_STORE)) {
        db.createObjectStore(APPROVALS_STORE, { keyPath: 'sectionKey' });
      }
      if (old < 4 && !db.objectStoreNames.contains(DOCUMENT_RELEASE_STORE)) {
        db.createObjectStore(DOCUMENT_RELEASE_STORE, { keyPath: 'docKey' });
      }
      if (old < 5 && !db.objectStoreNames.contains(TEMPLATES_STORE)) {
        db.createObjectStore(TEMPLATES_STORE, { keyPath: 'id' });
      }
      if (old < 6 && !db.objectStoreNames.contains(DOCUMENT_INSTANCES_STORE)) {
        const store = db.createObjectStore(DOCUMENT_INSTANCES_STORE, { keyPath: 'instanceId' });
        store.createIndex('templateId', 'templateId', { unique: false });
      }
    };
  });
}

/** Opens the shared database; detection happens on the first call only. Rejects if IndexedDB is unusable. */
export function openComplianceDb(): Promise<IDBDatabase> {
  if (mode === 'memory') return Promise.reject(new Error(fallbackReason ?? 'storage unavailable'));
  if (!dbPromise) {
    dbPromise = openIndexedDb().then(
      (db) => {
        mode = 'indexeddb';
        return db;
      },
      (err: unknown) => {
        dbPromise = null;
        switchToMemory(err instanceof Error ? err.message : String(err));
        throw err;
      }
    );
  }
  return dbPromise;
}

/** Current storage mode; `'memory'` means the compliance data lives only for this page session. */
export function complianceStorageMode(): ComplianceStorageMode {
  return mode;
}

/** True when this page session is running on the in-memory fallback. */
export function isComplianceStorageFallback(): boolean {
  return mode === 'memory';
}

/** Why IndexedDB was not used (null when it is usable or not yet detected). */
export function complianceStorageFallbackReason(): string | null {
  return fallbackReason;
}

/**
 * Detects storage availability (once) and resolves with the resulting mode. Never rejects for blocked storage;
 * use it before rendering so the UI can show the fallback notice.
 */
export async function ensureComplianceStorage(): Promise<ComplianceStorageMode> {
  try {
    await openComplianceDb();
  } catch {
    /* switchToMemory() already recorded the reason and logged the single warning */
  }
  return mode;
}

/** Runs one request-based operation on IndexedDB; resolves with the request result once the transaction commits. */
function runIdb<T>(
  db: IDBDatabase,
  store: ComplianceStoreName,
  access: IDBTransactionMode,
  op: (os: IDBObjectStore) => IDBRequest | void
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, access);
    let result: unknown;
    const req = op(tx.objectStore(store));
    if (req) {
      req.onsuccess = (): void => {
        result = req.result;
      };
    }
    tx.oncomplete = (): void => resolve(result as T | undefined);
    tx.onerror = (): void => reject(tx.error ?? req?.error ?? new Error(`${store} transaction failed`));
    tx.onabort = (): void => reject(tx.error ?? new Error(`${store} transaction aborted`));
  });
}

/** Resolves the backend for one operation: IndexedDB when usable, otherwise null (use the memory store). */
async function idbOrNull(): Promise<IDBDatabase | null> {
  if (mode === 'memory') return null;
  try {
    return await openComplianceDb();
  } catch {
    return null;
  }
}

export async function dbGet<T = unknown>(store: ComplianceStoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await idbOrNull();
  if (!db) {
    const row = memoryStore(store).get(String(key));
    return row === undefined ? undefined : snapshot(row as T);
  }
  return runIdb<T>(db, store, 'readonly', (os) => os.get(key));
}

export async function dbGetAll<T = unknown>(store: ComplianceStoreName): Promise<T[]> {
  const db = await idbOrNull();
  if (!db) return [...memoryStore(store).values()].map((r) => snapshot(r as T));
  return (await runIdb<T[]>(db, store, 'readonly', (os) => os.getAll())) ?? [];
}

/** All rows whose index value equals `value` (index must exist on the store; see the upgrade handler). */
export async function dbGetAllByIndex<T = unknown>(
  store: ComplianceStoreName,
  index: string,
  value: IDBValidKey
): Promise<T[]> {
  const db = await idbOrNull();
  if (!db) {
    return [...memoryStore(store).values()]
      .filter((r) => (r as Record<string, unknown>)[index] === value)
      .map((r) => snapshot(r as T));
  }
  return (
    (await runIdb<T[]>(db, store, 'readonly', (os) => os.index(index).getAll(value))) ?? []
  );
}

export async function dbPut(store: ComplianceStoreName, row: object): Promise<void> {
  const plain = snapshot(row) as Record<string, unknown>;
  const db = await idbOrNull();
  if (!db) {
    const key = String(plain[KEY_PATHS[store]]);
    memoryStore(store).set(key, plain);
    return;
  }
  await runIdb(db, store, 'readwrite', (os) => {
    os.put(plain);
  });
}

export async function dbDelete(store: ComplianceStoreName, key: IDBValidKey): Promise<void> {
  const db = await idbOrNull();
  if (!db) {
    memoryStore(store).delete(String(key));
    return;
  }
  await runIdb(db, store, 'readwrite', (os) => {
    os.delete(key);
  });
}
