/**
 * Loss reporting for the DOCX importer.
 *
 * A loss is recorded whenever the importer cannot represent a construct
 * faithfully. Content is never dropped silently: unsupported structures become
 * passthrough blocks, or their text is kept, and a {@link LossReport} explains it.
 *
 * @module
 */

/** Severity of a loss. */
export type LossSeverity = 'info' | 'warning' | 'error';

/** Stable loss codes. */
export type LossCode =
  | 'smartart-passthrough'
  | 'chart-passthrough'
  | 'drawing-passthrough'
  | 'vml-passthrough'
  | 'object-passthrough'
  | 'alternate-content'
  | 'math-passthrough'
  | 'unknown-block'
  | 'float-converted'
  | 'footnote-ref'
  | 'endnote-ref'
  | 'field-unsupported'
  | 'field-spans-paragraphs'
  | 'image-missing'
  | 'numbering-missing'
  | 'numfmt-approximated'
  | 'part-parse-error';

/** A single loss found while importing. */
export interface LossReport {
  code: LossCode;
  severity: LossSeverity;
  message: string;
  /** Package part and position, e.g. `word/document.xml#block:12`. */
  location?: string;
}

/** Default severity and description for each loss code. */
export const LOSS_CODES: Readonly<Record<LossCode, { severity: LossSeverity; description: string }>> = {
  'smartart-passthrough': { severity: 'warning', description: 'SmartArt diagram kept verbatim as a passthrough block.' },
  'chart-passthrough': { severity: 'warning', description: 'Chart kept verbatim as a passthrough block.' },
  'drawing-passthrough': { severity: 'warning', description: 'Other DrawingML shape or group kept verbatim.' },
  'vml-passthrough': { severity: 'warning', description: 'Legacy VML drawing (w:pict) kept verbatim.' },
  'object-passthrough': { severity: 'warning', description: 'Embedded OLE object (w:object) kept verbatim.' },
  'alternate-content': { severity: 'warning', description: 'mc:AlternateContent kept verbatim; the Fallback text is the preview.' },
  'math-passthrough': { severity: 'info', description: 'Office Math equation kept verbatim.' },
  'unknown-block': { severity: 'warning', description: 'Unrecognised block-level element kept verbatim.' },
  'float-converted': { severity: 'warning', description: 'Floating (anchored) picture converted to an inline image.' },
  'footnote-ref': { severity: 'info', description: 'Footnote reference kept; footnote body is not imported.' },
  'endnote-ref': { severity: 'info', description: 'Endnote reference kept; endnote body is not imported.' },
  'field-unsupported': { severity: 'info', description: 'Field type not modelled; its cached result is kept as text.' },
  'field-spans-paragraphs': { severity: 'info', description: 'Field continues into another paragraph; kept as text.' },
  'image-missing': { severity: 'warning', description: 'Picture references a missing relationship or media part.' },
  'numbering-missing': { severity: 'info', description: 'Paragraph references a numbering instance that is not defined.' },
  'numfmt-approximated': { severity: 'info', description: 'Unsupported number format approximated as decimal.' },
  'part-parse-error': { severity: 'error', description: 'A package part is not well-formed XML and was skipped.' },
};
