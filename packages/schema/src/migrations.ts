/**
 * Schema migrations: a registry of `N -> N+1` steps and the entry point
 * {@link migrateDocument} that upgrades any supported input to the current version.
 *
 * Version 1 is the legacy flat `Block[]` format (optionally wrapped as
 * `{ schemaVersion: 1, blocks }`). The v1 -> v2 step is lossless: blocks are
 * stored verbatim in a single section, and `sectionBreak` blocks split sections.
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';

import { blocksToDocument, CURRENT_SCHEMA_VERSION, cloneValue, createId } from './document';
import { createDefaultNumbering } from './numbering';
import { normalizeBlockSpacing, normalizeStyleSheet } from './spacing';
import { createDefaultStyleSheet } from './styles';
import type { BeakDocument } from './types';

/** The legacy (version 1) wrapped format. */
export interface LegacyDocumentV1 {
  schemaVersion: 1;
  blocks: Block[];
}

/** A migration step from one version to the next. */
export type MigrationStep = (document: unknown) => unknown;

/** Options for {@link MigrationRegistry}. */
export interface MigrationRegistryOptions {
  /** Version that migrations target. Defaults to {@link CURRENT_SCHEMA_VERSION}. */
  currentVersion?: number;
}

/**
 * Registry of migration steps keyed by their source version.
 *
 * @example
 * ```typescript
 * const registry = new MigrationRegistry({ currentVersion: 3 });
 * registry.register(2, (doc) => ({ ...(doc as object), schemaVersion: 3 }));
 * registry.migrate(v2Doc, 2); // -> v3
 * ```
 */
export class MigrationRegistry {
  readonly currentVersion: number;
  private readonly steps = new Map<number, MigrationStep>();

  constructor(options: MigrationRegistryOptions = {}) {
    this.currentVersion = options.currentVersion ?? CURRENT_SCHEMA_VERSION;
  }

  /**
   * Registers the step that upgrades documents from `fromVersion` to `fromVersion + 1`.
   *
   * @throws If a step for `fromVersion` is already registered or the version is invalid.
   */
  register(fromVersion: number, migrate: MigrationStep): this {
    if (!Number.isInteger(fromVersion) || fromVersion < 1) {
      throw new RangeError(`Invalid migration source version: ${fromVersion}`);
    }
    if (this.steps.has(fromVersion)) {
      throw new Error(`A migration from version ${fromVersion} is already registered.`);
    }
    this.steps.set(fromVersion, migrate);
    return this;
  }

  /** Whether a step from `fromVersion` is registered. */
  has(fromVersion: number): boolean {
    return this.steps.has(fromVersion);
  }

  /** Source versions with a registered step, ascending. */
  versions(): number[] {
    return [...this.steps.keys()].sort((a, b) => a - b);
  }

  /**
   * Applies every step from `fromVersion` up to `toVersion` in order.
   *
   * @throws If a step is missing, or `fromVersion` is newer than `toVersion`.
   */
  migrate(input: unknown, fromVersion: number, toVersion: number = this.currentVersion): unknown {
    if (fromVersion > toVersion) {
      throw new RangeError(`Cannot migrate from version ${fromVersion} down to ${toVersion}.`);
    }
    let data = input;
    for (let version = fromVersion; version < toVersion; version += 1) {
      const step = this.steps.get(version);
      if (!step) {
        throw new Error(`No migration registered from version ${version}.`);
      }
      data = step(data);
    }
    return data;
  }
}

/** Creates the registry containing the built-in migrations (v1 -> v2). */
export function createDefaultMigrationRegistry(): MigrationRegistry {
  return new MigrationRegistry().register(1, (document) => {
    const legacy = document as LegacyDocumentV1;
    return blocksToDocument(legacy.blocks);
  });
}

/** The built-in registry used by {@link migrateDocument}. */
export const defaultMigrations: MigrationRegistry = createDefaultMigrationRegistry();

/** Fills defaults into a v2 document and returns a deep copy. */
function normalizeV2(input: unknown): BeakDocument {
  const doc = cloneValue(input) as Partial<BeakDocument> & { sections?: unknown };
  if (!Array.isArray(doc.sections)) {
    throw new TypeError('Schema v2 document must have a sections array.');
  }
  const sections = (doc.sections as BeakDocument['sections']).map((section) => ({
    ...section,
    blocks: normalizeBlockSpacing(section.blocks ?? []),
  }));
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: typeof doc.id === 'string' && doc.id ? doc.id : createId('doc'),
    properties: doc.properties ?? {},
    styles: normalizeStyleSheet(doc.styles ?? createDefaultStyleSheet()),
    numbering: doc.numbering ?? createDefaultNumbering(),
    sections,
  };
}

/**
 * Upgrades any supported input to a current-version {@link BeakDocument}.
 *
 * Accepts:
 * - a legacy `Block[]` (version 1),
 * - `{ schemaVersion: 1, blocks }`,
 * - a version 2 document (defaults are filled in for missing style and numbering data).
 *
 * @throws TypeError for unrecognised input, RangeError for versions newer than the library.
 *
 * @example
 * ```typescript
 * const doc = migrateDocument(JSON.parse(stored));
 * ```
 */
export function migrateDocument(input: unknown, registry: MigrationRegistry = defaultMigrations): BeakDocument {
  let versioned: { schemaVersion: number; [key: string]: unknown };

  if (Array.isArray(input)) {
    versioned = { schemaVersion: 1, blocks: input };
  } else if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    if (record.schemaVersion === undefined && Array.isArray(record.blocks)) {
      versioned = { ...record, schemaVersion: 1 };
    } else if (typeof record.schemaVersion === 'number') {
      versioned = { ...record, schemaVersion: record.schemaVersion };
    } else {
      throw new TypeError('Unrecognised document input: expected Block[] or a versioned document.');
    }
  } else {
    throw new TypeError('Unrecognised document input: expected Block[] or a versioned document.');
  }

  const from = versioned.schemaVersion;
  if (!Number.isInteger(from) || from < 1 || from > registry.currentVersion) {
    throw new RangeError(`Unsupported schema version: ${String(from)}.`);
  }

  if (from === registry.currentVersion) {
    return normalizeV2(versioned);
  }
  const migrated = registry.migrate(cloneValue(versioned), from) as BeakDocument;
  return normalizeV2(migrated);
}
