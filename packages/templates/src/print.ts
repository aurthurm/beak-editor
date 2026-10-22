/**
 * Controlled printing: options for the layout renderer and the print register entry for the QMS service.
 *
 * `stampControlledCopy` returns a plain object. Pass it to `@amusendame/beakblock-layout`'s
 * `renderPrintHTML` as options: `watermark` (string) and `controlledCopy` ({ copyNumber, issuedTo }).
 * The layout package is built separately, so this module only produces the options object.
 *
 * @module
 */

import type { ReleaseManifest } from './types';

/** Thrown for invalid print requests. */
export class PrintError extends Error {
  readonly code = 'invalid-print-request';

  constructor(message: string) {
    super(message);
    this.name = 'PrintError';
  }
}

/** Input for {@link stampControlledCopy}. */
export interface ControlledPrintInput {
  copyNumber: number;
  issuedTo: string;
  printedAt?: string;
  /** Overrides the default watermark text `CONTROLLED COPY No. n`. */
  watermark?: string;
}

/**
 * Stamp for one controlled copy. The top-level `watermark` and `controlledCopy` fields match the
 * layout renderer's options. The other fields are for the print register.
 */
export interface ControlledPrintStamp {
  watermark: string;
  copyNumber: number;
  issuedTo: string;
  printedAt: string;
  controlledCopy: { copyNumber: number; issuedTo: string };
}

/**
 * Builds the print stamp for a controlled copy.
 *
 * @throws {PrintError} when the copy number is not a positive integer or the recipient is empty
 */
export function stampControlledCopy(input: ControlledPrintInput): ControlledPrintStamp {
  if (!Number.isInteger(input.copyNumber) || input.copyNumber < 1) {
    throw new PrintError('Copy number must be a positive integer');
  }
  if (!input.issuedTo.trim()) throw new PrintError('A controlled copy needs a recipient');
  return {
    watermark: input.watermark ?? `CONTROLLED COPY No. ${input.copyNumber}`,
    copyNumber: input.copyNumber,
    issuedTo: input.issuedTo,
    printedAt: input.printedAt ?? new Date().toISOString(),
    controlledCopy: { copyNumber: input.copyNumber, issuedTo: input.issuedTo },
  };
}

/** One row of the QMS print register. */
export interface PrintRegisterEntry {
  id: string;
  documentId: string;
  docNumber: string;
  revision: string;
  documentHash: string;
  renditionHash?: string;
  copyNumber: number;
  issuedTo: string;
  printedAt: string;
  printedBy: string;
}

/** Builds a print register entry from a release manifest and a stamp. */
export function createPrintRegisterEntry(
  manifest: ReleaseManifest,
  stamp: ControlledPrintStamp,
  printedBy: string,
  id: string
): PrintRegisterEntry {
  return {
    id,
    documentId: manifest.documentId,
    docNumber: manifest.docNumber,
    revision: manifest.revision,
    documentHash: manifest.documentHash,
    ...(manifest.renditionHash ? { renditionHash: manifest.renditionHash } : {}),
    copyNumber: stamp.copyNumber,
    issuedTo: stamp.issuedTo,
    printedAt: stamp.printedAt,
    printedBy,
  };
}
