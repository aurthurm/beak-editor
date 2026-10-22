/**
 * Block registry type definitions.
 *
 * A {@link BeakBlockDefinition} declares a block's schema, capabilities,
 * validation, and (later) rendering and IR hooks. Contract §1.5.
 *
 * @module
 */

import type { NodeSpec } from 'prosemirror-model';
import type { Block } from '../blocks/types';

/** Severity of a validation finding. */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * A single validation finding.
 */
export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  /** Block the issue refers to. */
  blockId?: string;
  /** Section the issue refers to, when known. */
  sectionId?: string;
  /** Location of the block as a slash-separated index path, e.g. `2/children/0`. */
  path?: string;
}

/**
 * Context passed to validators.
 */
export interface ValidationContext {
  /** Top-level blocks of the document being validated. */
  blocks: Block[];
  /** Section the blocks belong to, when validating a section. */
  sectionId?: string | null;
  [key: string]: unknown;
}

/** Block family, used to group blocks in UI and docs. */
export type BlockFamily = 'text' | 'office' | 'smart' | 'clinical' | 'qms' | 'forms';

/** What a block is allowed to do. */
export interface BlockCapabilities {
  editable: boolean;
  nested: boolean;
  printable: boolean;
  splittable: boolean;
  collaborative: boolean;
}

/** A block migration step between two versions of a block definition. */
export interface BlockMigration {
  from: number;
  to: number;
  up: (props: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Declarative definition of a block type.
 *
 * @example
 * ```typescript
 * const calloutDef: BeakBlockDefinition = {
 *   type: 'warningNote',
 *   version: 1,
 *   family: 'clinical',
 *   capabilities: { editable: true, nested: true, printable: true, splittable: true, collaborative: true },
 *   validate: (block) => block.props.severity ? [] : [{ severity: 'error', code: 'missing-severity', message: 'Severity is required' }],
 * };
 * ```
 */
/**
 * Document-level values passed to `renderPrint`, such as computed caption numbers.
 * Keys are chosen by the family that defines them.
 */
export interface BlockPrintContext {
  [key: string]: unknown;
}

export interface BeakBlockDefinition {
  type: string;
  version: number;
  family: BlockFamily;
  schema?: NodeSpec;
  capabilities: BlockCapabilities;
  validate?: (block: Block, ctx: ValidationContext) => ValidationIssue[];
  /** Returns a print HTML fragment for the block. `context` carries document-level values. */
  renderPrint?: (block: Block, context?: BlockPrintContext) => string;
  /** Converts the block to a BeakDoc IR node (consumed by `@amusendame/beakblock-ir`). */
  toIR?: (block: Block, ctx: unknown) => unknown;
  /** Converts a BeakDoc IR node back into a block. */
  fromIR?: (ir: unknown, ctx: unknown) => Block | null;
  migrate?: BlockMigration[];
}
