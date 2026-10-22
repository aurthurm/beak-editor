/**
 * DOCX suite: IR -> exportDocx -> importDocx keeps the structure a Word user would notice, the
 * export is byte-identical across runs, and the package is well-formed OOXML.
 */
import { describe, expect, it } from 'vitest';
import { exportDocxWithReport } from '@amusendame/beakblock-export-docx';
import { importDocx } from '@amusendame/beakblock-import-docx';
import { documentToIR } from '@amusendame/beakblock-ir';
import { migrateDocument } from '@amusendame/beakblock-schema';
import { strFromU8, unzipSync } from 'fflate';

import { corpus, cloneBlocks } from './corpus';
import { countKinds, normaliseForDocx, summariseStructure } from './support/docxStructure';
import { deepDiff, formatDiff } from './support/deepDiff';

/** DOCX-level defects, keyed by corpus id. Asserted with `it.fails`. None are known at present. */
const KNOWN_DOCX_BUGS: Record<string, string> = {};

async function exportCorpus(id: string) {
  const entry = corpus.find((c) => c.id === id)!;
  const ir = documentToIR(migrateDocument(cloneBlocks(entry.blocks)));
  return { entry, ir, ...(await exportDocxWithReport(ir)) };
}

describe('DOCX: structure survives export and import', () => {
  for (const entry of corpus) {
    const bug = KNOWN_DOCX_BUGS[entry.id];
    const runner = bug ? it.fails : it;
    runner(`${entry.id} export -> import keeps paragraphs, styles, lists, tables, sdt, fields and revisions${bug ? ` [known bug: ${bug}]` : ''}`, async () => {
      const { ir, bytes } = await exportCorpus(entry.id);
      const { ir: imported } = await importDocx(bytes);
      const diffs = deepDiff(normaliseForDocx(summariseStructure(ir)), normaliseForDocx(summariseStructure(imported)));
      expect(diffs.length, `${entry.id} structural diff (-> = before export -> after import):\n${formatDiff(diffs)}`).toBe(0);
    });
  }
});

describe('DOCX: export is deterministic', () => {
  for (const entry of corpus) {
    it(`${entry.id} exports byte-identical files on two runs`, async () => {
      const ir = documentToIR(migrateDocument(cloneBlocks(entry.blocks)));
      const first = await exportDocxWithReport(ir);
      const second = await exportDocxWithReport(ir);
      expect(Buffer.from(first.bytes).equals(Buffer.from(second.bytes))).toBe(true);
      expect(first.report).toStrictEqual(second.report);
    });
  }
});

describe('DOCX: package is well formed', () => {
  for (const entry of corpus) {
    it(`${entry.id} has the required parts, parseable XML and counts that match the IR`, async () => {
      const { ir, bytes } = await exportCorpus(entry.id);
      const files = unzipSync(bytes);
      for (const part of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml']) {
        expect(files[part], `${entry.id} missing ${part}`).toBeDefined();
      }
      const parser = new DOMParser();
      for (const name of Object.keys(files).filter((n) => n.endsWith('.xml') || n.endsWith('.rels'))) {
        const xml = strFromU8(files[name]);
        const doc = parser.parseFromString(xml, 'application/xml');
        expect(doc.getElementsByTagName('parsererror').length, `${entry.id} ${name} is not well formed`).toBe(0);
      }
      const documentXml = strFromU8(files['word/document.xml']);
      const counts = countKinds(summariseStructure(ir));
      const xmlCount = (tag: string) => (documentXml.match(new RegExp(`<w:${tag}[ >]`, 'g')) ?? []).length;
      // Table and sdt counts in the XML include nested ones, so they are at least the IR counts.
      expect(xmlCount('tbl'), `${entry.id} tables`).toBeGreaterThanOrEqual(counts.table);
      expect(xmlCount('sdt'), `${entry.id} content controls`).toBeGreaterThanOrEqual(counts.sdt);
      expect(xmlCount('ins'), `${entry.id} insertions`).toBe(counts.insRun);
      expect(xmlCount('del'), `${entry.id} deletions`).toBe(counts.delRun);
    });
  }
});

describe('DOCX: export report', () => {
  it('reports no losses for the plain-text corpus documents', async () => {
    const quiet = ['lab-gram-stain', 'lab-blood-culture', 'validation-protocol', 'long-sop-50', 'multilingual'];
    for (const id of quiet) {
      const { report } = await exportCorpus(id);
      expect(report.losses.map((l) => l.code), id).toEqual([]);
    }
  });

  it('writes control characters as removed text rather than invalid XML', async () => {
    const { bytes } = await exportCorpus('pathological-unicode');
    const documentXml = strFromU8(unzipSync(bytes)['word/document.xml']);
    // XML 1.0 forbids most C0 control characters; only tab, LF and CR may appear.
    expect(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(documentXml)).toBe(false);
  });
});
