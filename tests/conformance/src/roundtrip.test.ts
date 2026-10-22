/**
 * Phase 1 exit criterion: every corpus document goes Block[] -> migrateDocument -> documentToIR ->
 * irToDocument -> documentToBlocks with no structural loss.
 *
 * Known defects found by this suite are recorded in KNOWN_BUGS and asserted with `it.fails`: the
 * test passes while the bug exists and fails once it is fixed, which is the signal to remove the
 * entry. Bugs are listed in docs/2.0/status.md.
 */
import { describe, expect, it } from 'vitest';
import { documentToIR, irToDocument, validateIR } from '@amusendame/beakblock-ir';
import { documentToBlocks, migrateDocument, validateDocumentStructure } from '@amusendame/beakblock-schema';

import { corpus, cloneBlocks } from './corpus';
import { canonicalBlocks } from './support/canonical';
import { deepDiff, formatDiff } from './support/deepDiff';

/** Bugs in packages, keyed by corpus id. Each value names the defect and the affected package. */
export const KNOWN_BUGS: Record<string, { validation?: string; loss?: string }> = {};

describe('Phase 1 exit: corpus round-trips through IR without structural loss', () => {
  for (const entry of corpus) {
    const bug = KNOWN_BUGS[entry.id] ?? {};

    const validate = bug.validation ? it.fails : it;
    validate(`${entry.id} validates in schema and IR${bug.validation ? ` [known bug: ${bug.validation}]` : ''}`, () => {
      const doc = migrateDocument(cloneBlocks(entry.blocks));
      const structureErrors = validateDocumentStructure(doc).filter((issue) => issue.severity === 'error');
      expect(structureErrors, entry.id).toEqual([]);
      const irErrors = validateIR(documentToIR(doc)).filter((issue) => issue.severity === 'error');
      expect(irErrors, entry.id).toEqual([]);
    });

    const roundTrip = bug.loss ? it.fails : it;
    roundTrip(`${entry.id} round-trips with no structural loss${bug.loss ? ` [known bug: ${bug.loss}]` : ''}`, () => {
      const input = cloneBlocks(entry.blocks);
      const ir = documentToIR(migrateDocument(input));
      const output = documentToBlocks(irToDocument(ir));
      const diffs = deepDiff(canonicalBlocks(input), canonicalBlocks(output));
      expect(diffs.length, `${entry.id} loses or changes data:\n${formatDiff(diffs)}`).toBe(0);
    });
  }

  it('migration is idempotent on the corpus', () => {
    for (const entry of corpus) {
      const once = migrateDocument(cloneBlocks(entry.blocks));
      const twice = migrateDocument(structuredClone(once));
      expect(twice, entry.id).toStrictEqual(once);
    }
  });

  it('does not mutate the corpus input', () => {
    for (const entry of corpus) {
      const snapshot = structuredClone(entry.blocks);
      documentToIR(migrateDocument(entry.blocks));
      expect(entry.blocks, entry.id).toStrictEqual(snapshot);
    }
  });
});

describe('round trip through JSON serialisation of the IR', () => {
  it('keeps every corpus document without a known bug intact', () => {
    for (const entry of corpus) {
      if (KNOWN_BUGS[entry.id]?.loss) continue;
      const ir = JSON.parse(JSON.stringify(documentToIR(migrateDocument(cloneBlocks(entry.blocks))))) as ReturnType<typeof documentToIR>;
      const diffs = deepDiff(canonicalBlocks(entry.blocks), canonicalBlocks(documentToBlocks(irToDocument(ir))));
      expect(diffs.length, `${entry.id}:\n${formatDiff(diffs)}`).toBe(0);
    }
  });
});
