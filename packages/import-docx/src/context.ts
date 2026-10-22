/**
 * Shared import state passed through the part and body walkers.
 *
 * @module
 */

import type { IRBlock } from '@amusendame/beakblock-ir';

import type { DomParserLike } from './dom';
import { LOSS_CODES, type LossCode, type LossReport } from './losses';
import type { NumberingDefinitions, StyleSheet } from './model';

/** Block type used for preserved OOXML (matches the `ooxmlPassthrough` block in the editor). */
export const OOXML_PASSTHROUGH_TYPE = 'ooxmlPassthrough';

/** Document-wide state shared by all parts of one import. */
export interface SharedState {
  parser: DomParserLike;
  /** Every zip entry, keyed by its path inside the package. */
  files: Record<string, Uint8Array>;
  losses: LossReport[];
  /** Data URIs keyed by media part path, so repeated images are encoded once. */
  mediaCache: Map<string, string>;
  /** Parsed header and footer parts keyed by package path. */
  partBlocks: Map<string, IRBlock[]>;
  styles: StyleSheet;
  numbering: NumberingDefinitions;
  /** Returns a fresh id with the given prefix. */
  nextId(prefix: string): string;
}

/** A package relationship. */
export interface Relationship {
  type: string;
  /** Target resolved against the package root (external targets are kept as written). */
  target: string;
  external: boolean;
}

/** State for one XML part (document, header, footer). */
export interface PartContext {
  shared: SharedState;
  /** Package path of the part, e.g. `word/document.xml`. */
  partPath: string;
  rels: Map<string, Relationship>;
  /** Count of paragraphs seen in this part, used for loss locations. */
  paragraphIndex: number;
}

/** Records a loss with the default severity for its code. */
export function addLoss(ctx: PartContext, code: LossCode, message: string, detail?: string): void {
  const location = detail ? `${ctx.partPath}#${detail}` : ctx.partPath;
  ctx.shared.losses.push({ code, severity: LOSS_CODES[code].severity, message, location });
}
