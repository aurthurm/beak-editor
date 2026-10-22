#!/usr/bin/env node
/**
 * Fidelity proxy for ADR-2 (layout authority).
 *
 * For every corpus document:
 *   1. IR -> DOCX (export-docx, built package).
 *   2. DOCX -> PDF with LibreOffice headless (`soffice --convert-to pdf`), as the server rendition
 *      stand-in. Skipped with a notice when `soffice` is not on PATH.
 *   3. Page count of the PDF, read from the root `/Pages` `/Count` and cross-checked against the
 *      number of `/Type /Page` objects.
 *   4. `layoutDocument(ir).pageCount` from the heuristic measurer (the browser-side estimate).
 *
 * Writes reports/fidelity.json and reports/fidelity.md. It reports drift and does not fail on it.
 * The CI gate for page-count drift is a later step (roadmap Phase 3 exit).
 *
 * Requires the packages to be built (ir, schema, export-docx, layout) and reports/corpus.json, which
 * `pnpm --filter @amusendame/beakblock-conformance test` writes.
 *
 * Usage: node tests/conformance/scripts/fidelity.mjs [--only <id>]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const conformanceDir = resolve(here, '..');
const repoRoot = resolve(conformanceDir, '..', '..');
const reportsDir = join(conformanceDir, 'reports');
const fidelityDir = join(reportsDir, 'fidelity');
const FIXED_NOW = new Date('2026-06-01T09:00:00.000Z');
const CONVERT_TIMEOUT_MS = 180_000;

const onlyIndex = process.argv.indexOf('--only');
const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : null;

async function loadPackage(name) {
  const entry = join(repoRoot, 'packages', name, 'dist', 'index.js');
  if (!existsSync(entry)) {
    throw new Error(`packages/${name} is not built (missing ${entry}). Run: pnpm --filter @amusendame/beakblock-${name} build`);
  }
  return import(pathToFileURL(entry).href);
}

const corpusPath = join(reportsDir, 'corpus.json');
if (!existsSync(corpusPath)) {
  throw new Error(`${corpusPath} is missing. Run: pnpm --filter @amusendame/beakblock-conformance test`);
}
const { entries } = JSON.parse(readFileSync(corpusPath, 'utf8'));

const { documentToIR } = await loadPackage('ir');
const { migrateDocument } = await loadPackage('schema');
const { exportDocxWithReport } = await loadPackage('export-docx');
const { layoutDocument } = await loadPackage('layout');

/** Counts pages in a PDF: the root Pages /Count, and the number of /Type /Page objects. */
function countPdfPages(bytes) {
  const text = Buffer.from(bytes).toString('latin1');
  const counts = [...text.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  const declared = counts.length ? Math.max(...counts) : null;
  const objects = (text.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
  return { declared, objects };
}

function soffice() {
  const probe = spawnSync('soffice', ['--version'], { encoding: 'utf8', timeout: 30_000 });
  if (probe.error || probe.status !== 0) return null;
  return probe.stdout.trim();
}

const sofficeVersion = soffice();
mkdirSync(fidelityDir, { recursive: true });
const profileDir = join(tmpdir(), 'beakblock-fidelity-lo-profile');

const selected = entries.filter((entry) => !only || entry.id === only);
const rows = [];

for (const entry of selected) {
  const row = { id: entry.id, title: entry.title, category: entry.meta.category, approxPages: entry.meta.approxPages };
  try {
    const ir = documentToIR(migrateDocument(structuredClone(entry.blocks)));
    const { bytes, report } = await exportDocxWithReport(ir);
    const docxPath = join(fidelityDir, `${entry.id}.docx`);
    writeFileSync(docxPath, bytes);
    row.docxLosses = report.losses.map((loss) => loss.code);
    row.layoutPages = layoutDocument(ir, { now: FIXED_NOW }).pageCount;

    if (!sofficeVersion) {
      row.status = 'skipped';
      row.note = 'soffice not on PATH';
    } else {
      const convert = spawnSync(
        'soffice',
        [`-env:UserInstallation=file://${profileDir}`, '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', fidelityDir, docxPath],
        { encoding: 'utf8', timeout: CONVERT_TIMEOUT_MS }
      );
      const pdfPath = join(fidelityDir, `${entry.id}.pdf`);
      if (convert.status !== 0 || !existsSync(pdfPath)) {
        row.status = 'convert-failed';
        row.note = (convert.stderr || convert.stdout || convert.error?.message || 'no output').trim().split('\n').slice(-2).join(' ');
      } else {
        const pages = countPdfPages(readFileSync(pdfPath));
        row.serverPages = pages.declared ?? pages.objects;
        row.pdfObjectPages = pages.objects;
        row.pdfDeclaredPages = pages.declared;
        row.drift = row.layoutPages - row.serverPages;
        row.driftPct = row.serverPages ? Math.round((row.drift / row.serverPages) * 1000) / 10 : null;
        row.status = 'ok';
      }
    }
  } catch (error) {
    row.status = 'error';
    row.note = String(error?.message ?? error).slice(0, 300);
  }
  rows.push(row);
  console.info(`[fidelity] ${entry.id}: ${row.status} layout=${row.layoutPages ?? '-'} server=${row.serverPages ?? '-'} drift=${row.drift ?? '-'}`);
}

const measured = rows.filter((r) => r.status === 'ok');
const absDrift = measured.map((r) => Math.abs(r.drift));
const summary = {
  documents: rows.length,
  measured: measured.length,
  skipped: rows.filter((r) => r.status === 'skipped').length,
  failed: rows.filter((r) => r.status === 'error' || r.status === 'convert-failed').length,
  exactMatches: measured.filter((r) => r.drift === 0).length,
  withinOnePage: measured.filter((r) => Math.abs(r.drift) <= 1).length,
  withinTenPercent: measured.filter((r) => Math.abs(r.driftPct ?? 100) <= 10).length,
  meanAbsDrift: absDrift.length ? Math.round((absDrift.reduce((a, b) => a + b, 0) / absDrift.length) * 10) / 10 : null,
  maxAbsDrift: absDrift.length ? Math.max(...absDrift) : null,
};

const report = {
  generatedAt: new Date().toISOString(),
  adr: 'ADR-2 (layout authority): heuristic layout vs LibreOffice rendition of the DOCX export',
  libreOffice: sofficeVersion,
  layoutMeasurer: 'heuristic (createHeuristicMeasurer default)',
  summary,
  rows,
};
writeFileSync(join(reportsDir, 'fidelity.json'), `${JSON.stringify(report, null, 2)}\n`);

const cell = (value) => (value === null || value === undefined ? '-' : String(value));
const lines = [
  '# Fidelity report (ADR-2 proxy)',
  '',
  `Generated ${report.generatedAt}. Layout: heuristic measurer. Server rendition: ${sofficeVersion ?? 'LibreOffice (not available)'}, DOCX export.`,
  '',
  'Drift is `layoutPages - serverPages`. The script reports drift and does not fail on it; the CI gate is a later step.',
  '',
  '## Summary',
  '',
  `- Documents: ${summary.documents} (measured ${summary.measured}, skipped ${summary.skipped}, failed ${summary.failed})`,
  `- Exact page-count matches: ${summary.exactMatches}`,
  `- Within one page: ${summary.withinOnePage}`,
  `- Within 10 %: ${summary.withinTenPercent}`,
  `- Mean absolute drift: ${cell(summary.meanAbsDrift)} pages; maximum: ${cell(summary.maxAbsDrift)} pages`,
  '',
  '## Per document',
  '',
  '| Document | Category | Layout pages | Server pages (PDF) | Drift | Drift % | Status | DOCX losses |',
  '| --- | --- | ---: | ---: | ---: | ---: | --- | --- |',
  ...rows.map((r) =>
    `| ${r.id} | ${cell(r.category)} | ${cell(r.layoutPages)} | ${cell(r.serverPages)} | ${cell(r.drift)} | ${cell(r.driftPct)} | ${r.status}${r.note ? ` (${r.note.replace(/\|/g, '/')})` : ''} | ${(r.docxLosses ?? []).join(', ') || '-'} |`
  ),
  '',
];
writeFileSync(join(reportsDir, 'fidelity.md'), `${lines.join('\n')}\n`);
console.info(`[fidelity] wrote ${join('reports', 'fidelity.md')} and fidelity.json`);
console.info(`[fidelity] summary: ${JSON.stringify(summary)}`);
