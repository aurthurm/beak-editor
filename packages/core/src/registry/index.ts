/**
 * Block registry module for BeakBlock.
 *
 * @module
 */

export { BlockRegistry } from './BlockRegistry';
export { createDefaultBlockRegistry } from './defaultRegistry';
export type {
  BeakBlockDefinition,
  BlockPrintContext,
  BlockCapabilities,
  BlockFamily,
  BlockMigration,
  ValidationContext,
  ValidationIssue,
  ValidationSeverity,
} from './types';
