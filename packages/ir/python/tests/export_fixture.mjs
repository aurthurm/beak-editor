// Regenerates tests/data/rich_sop_ir.json from the built TypeScript packages.
// Usage: node packages/ir/python/tests/export_fixture.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocksToIR } from '../../dist/index.js';
import { fixtures } from '../../../schema/dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, 'data', 'rich_sop_ir.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(blocksToIR(structuredClone(fixtures.richSopBlocksWithSections)), null, 2) + '\n');
console.log(`wrote ${out}`);
