/**
 * Pluggable document versioning types.
 *
 * @module
 */

import type { Block } from '../blocks/types';

/**
 * A saved snapshot of the document at a point in time.
 */
export interface DocumentVersion {
  id: string;
  createdAt: string;
  label?: string;
  blocks: Block[];
  meta?: Record<string, unknown>;
}

/**
 * Host-implemented persistence for document versions (API, IndexedDB, etc.).
 */
export interface VersioningAdapter {
  listVersions(): Promise<DocumentVersion[]>;
  getVersion(id: string): Promise<DocumentVersion | null>;
  saveVersion(version: DocumentVersion): Promise<void>;
  deleteVersion?(id: string): Promise<void>;
}
