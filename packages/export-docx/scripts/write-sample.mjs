#!/usr/bin/env node
/**
 * Writes `sample-sop.docx` from the rich SOP fixture so a person can open it in
 * Word or LibreOffice.
 *
 * Usage: node scripts/write-sample.mjs [outputPath]
 *
 * The output path defaults to `sample-sop.docx` in the OS temp directory. Run
 * `pnpm --filter @amusendame/beakblock-export-docx build` first; the script imports
 * the built export and the sibling schema and IR builds.
 *
 * @module
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { documentToIR } from '@amusendame/beakblock-ir';
import { exportDocxWithReport } from '../dist/index.js';
// The schema is not a dependency of this package, so the fixture is read from the workspace build.
import { blocksToDocument, richSopBlocksWithSections } from '../../schema/dist/index.js';

const outputPath = resolve(process.argv[2] ?? join(tmpdir(), 'sample-sop.docx'));

const ir = documentToIR(blocksToDocument(richSopBlocksWithSections));
const { bytes, report } = await exportDocxWithReport(ir, { created: '2026-01-02T10:00:00Z' });

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, bytes);

console.log(`Wrote ${outputPath} (${bytes.length} bytes)`);
if (report.losses.length > 0) {
  console.log(`Losses (${report.losses.length}):`);
  for (const loss of report.losses) console.log(`  ${loss.code}: ${loss.message}${loss.blockId ? ` [${loss.blockId}]` : ''}`);
}
