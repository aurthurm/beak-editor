/**
 * Public DOCX export API: packages the writer output as a zip archive.
 *
 * @module
 */

import { strToU8, zipSync } from 'fflate';
import type { ZipOptions } from 'fflate';
import type { IRDocument } from '@amusendame/beakblock-ir';

import { appPropsXml, contentTypesXml, corePropsXml, CONTENT_TYPES, customPropsXml, rootRelsXml } from './parts';
import { DocxWriter } from './writer';
import type { WriterOutput } from './writer';
import type { ExportDocxOptions, ExportReport } from './types';
import { DOCX_MIME } from './types';

export { DOCX_MIME, DEFAULT_FONT_MAP } from './types';

/** Result of {@link exportDocxWithReport}. */
export interface ExportDocxResult {
  /** The `.docx` file bytes. */
  bytes: Uint8Array;
  /** Everything that was approximated or dropped. */
  report: ExportReport;
}

/** Default `dcterms:created` value. A fixed epoch keeps exports reproducible. */
const DEFAULT_CREATED = '1970-01-01T00:00:00Z';

/** Zip entry options: fixed timestamp (the earliest DOS time) so archives are byte-identical. */
const ZIP_OPTIONS: ZipOptions = { level: 6, mtime: new Date(1980, 0, 1, 0, 0, 0) };

function assemble(ir: IRDocument, output: WriterOutput, created: string): Uint8Array {
  const overrides: Array<[string, string]> = [
    ['/word/document.xml', CONTENT_TYPES.document],
    ['/word/styles.xml', CONTENT_TYPES.styles],
    ['/word/numbering.xml', CONTENT_TYPES.numbering],
    ['/word/settings.xml', CONTENT_TYPES.settings],
    ['/word/fontTable.xml', CONTENT_TYPES.fontTable],
    ['/docProps/core.xml', CONTENT_TYPES.core],
    ['/docProps/app.xml', CONTENT_TYPES.app],
    ['/docProps/custom.xml', CONTENT_TYPES.custom],
    ...output.parts.map((part): [string, string] => [
      `/${part.path}`,
      part.kind === 'header' ? CONTENT_TYPES.header : CONTENT_TYPES.footer,
    ]),
  ];

  const text: Array<[string, string]> = [
    ['[Content_Types].xml', contentTypesXml(overrides)],
    ['_rels/.rels', rootRelsXml()],
    ['docProps/core.xml', corePropsXml(ir.properties, created)],
    ['docProps/app.xml', appPropsXml()],
    ['docProps/custom.xml', customPropsXml(ir.properties)],
    ['word/document.xml', output.document],
    ['word/_rels/document.xml.rels', output.documentRels.toXml()],
    ['word/styles.xml', output.styles],
    ['word/numbering.xml', output.numbering],
    ['word/settings.xml', output.settings],
    ['word/fontTable.xml', output.fontTable],
  ];
  for (const part of output.parts) {
    text.push([part.path, part.xml]);
    const name = part.path.slice('word/'.length);
    text.push([`word/_rels/${name}.rels`, part.rels.toXml()]);
  }

  const entries: Record<string, [Uint8Array, ZipOptions]> = {};
  for (const [path, content] of text) entries[path] = [strToU8(content), ZIP_OPTIONS];
  for (const media of output.media) entries[media.path] = [media.data, ZIP_OPTIONS];
  return zipSync(entries);
}

/**
 * Exports an IR document as a `.docx` file and reports approximations.
 *
 * @example
 * ```typescript
 * const { bytes, report } = await exportDocxWithReport(ir);
 * report.losses.length; // 0 for a fully supported document
 * ```
 */
export async function exportDocxWithReport(
  ir: IRDocument,
  options: ExportDocxOptions = {}
): Promise<ExportDocxResult> {
  const output = new DocxWriter(ir, { fontMap: options.fontMap }).run();
  const bytes = assemble(ir, output, options.created ?? DEFAULT_CREATED);
  return { bytes, report: { losses: output.losses } };
}

/**
 * Exports an IR document as `.docx` bytes.
 *
 * @example
 * ```typescript
 * const bytes = await exportDocx(ir);
 * await fs.promises.writeFile('sop.docx', bytes);
 * ```
 */
export async function exportDocx(ir: IRDocument, options: ExportDocxOptions = {}): Promise<Uint8Array> {
  return (await exportDocxWithReport(ir, options)).bytes;
}

/**
 * Exports an IR document as a `Blob` with the DOCX MIME type (browsers and Node 18+).
 */
export async function exportDocxBlob(ir: IRDocument, options: ExportDocxOptions = {}): Promise<Blob> {
  const bytes = await exportDocx(ir, options);
  return new Blob([bytes as BlobPart], { type: DOCX_MIME });
}

/**
 * Returns the `word/document.xml` part as a string. Intended for tests and debugging.
 */
export function irToDocumentXml(ir: IRDocument, options: ExportDocxOptions = {}): string {
  return new DocxWriter(ir, { fontMap: options.fontMap }).run().document;
}
