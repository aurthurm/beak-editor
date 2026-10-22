/**
 * @amusendame/beakblock-export-docx
 *
 * BeakDoc IR to OOXML (DOCX) writer. Writes WordprocessingML by hand and zips it
 * with fflate: styles, numbering, sections with headers and footers, fields,
 * tables, content controls, tracked changes, hyperlinks and embedded images.
 *
 * @example
 * ```typescript
 * import { exportDocx } from '@amusendame/beakblock-export-docx';
 *
 * const bytes = await exportDocx(ir);
 * ```
 *
 * @module
 */

export { exportDocx, exportDocxBlob, exportDocxWithReport, irToDocumentXml, DOCX_MIME, DEFAULT_FONT_MAP } from './export';
export type { ExportDocxResult } from './export';
export type {
  ExportDocxOptions,
  ExportLoss,
  ExportLossCode,
  ExportReport,
} from './types';
