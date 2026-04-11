/**
 * In-memory versioning adapter for tests and demos.
 *
 * @module
 */

import type { DocumentVersion } from './types';
import type { VersioningAdapter } from './types';

/**
 * Keeps versions in memory only (lost when the process or tab ends).
 */
export class InMemoryVersioningAdapter implements VersioningAdapter {
  private readonly versions = new Map<string, DocumentVersion>();

  async listVersions(): Promise<DocumentVersion[]> {
    return [...this.versions.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getVersion(id: string): Promise<DocumentVersion | null> {
    const v = this.versions.get(id);
    return v ? structuredClone(v) : null;
  }

  async saveVersion(version: DocumentVersion): Promise<void> {
    this.versions.set(version.id, structuredClone(version));
  }

  async deleteVersion(id: string): Promise<void> {
    this.versions.delete(id);
  }
}
