/**
 * Writes the corpus to reports/corpus.json so that plain Node scripts (scripts/fidelity.mjs) can use
 * it without a TypeScript loader. Runs as part of `pnpm test`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

import { corpus } from './index';

it('exports the corpus for the Node scripts', () => {
  const dir = resolve(process.cwd(), 'reports');
  mkdirSync(dir, { recursive: true });
  const payload = { generatedBy: 'src/corpus/export.test.ts', count: corpus.length, entries: corpus };
  writeFileSync(resolve(dir, 'corpus.json'), `${JSON.stringify(payload, null, 2)}\n`);
  expect(corpus.length).toBe(20);
});
