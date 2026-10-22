/**
 * Block registry.
 *
 * Holds {@link BeakBlockDefinition}s by block type and validates documents
 * by walking blocks recursively. Contract §1.5.
 *
 * @module
 */

import type { Block } from '../blocks/types';
import type {
  BeakBlockDefinition,
  BlockFamily,
  ValidationContext,
  ValidationIssue,
} from './types';

/**
 * Registry of block definitions.
 *
 * @example
 * ```typescript
 * const registry = new BlockRegistry();
 * registry.register({ type: 'note', version: 1, family: 'text', capabilities: {...} });
 * const issues = registry.validate(editor.getDocument());
 * ```
 */
export class BlockRegistry {
  private _definitions = new Map<string, BeakBlockDefinition>();

  /**
   * Registers a block definition.
   *
   * @param definition - The definition to add
   * @param options - Set `replace: true` to overwrite an existing definition
   * @throws If a definition for the same type exists and `replace` is not set
   */
  register(definition: BeakBlockDefinition, options: { replace?: boolean } = {}): this {
    if (this._definitions.has(definition.type) && !options.replace) {
      throw new Error(`Block type "${definition.type}" is already registered`);
    }
    this._definitions.set(definition.type, definition);
    return this;
  }

  /** Returns the definition for a block type, if registered. */
  get(type: string): BeakBlockDefinition | undefined {
    return this._definitions.get(type);
  }

  /** Whether a block type is registered. */
  has(type: string): boolean {
    return this._definitions.has(type);
  }

  /**
   * Lists registered definitions, optionally filtered by family.
   *
   * @param family - Only return definitions in this family
   */
  list(family?: BlockFamily): BeakBlockDefinition[] {
    const all = [...this._definitions.values()];
    return family ? all.filter((def) => def.family === family) : all;
  }

  /**
   * Validates blocks recursively (children included).
   *
   * Each definition's `validate` is called for its block type. Blocks whose
   * type is not registered produce a `warning` with code `unregistered-block-type`.
   *
   * @param blocks - Blocks to validate
   * @param ctx - Optional context; `blocks` defaults to the input blocks
   * @returns All issues found, in document order
   */
  validate(blocks: Block[], ctx?: Partial<ValidationContext>): ValidationIssue[] {
    const context: ValidationContext = {
      ...ctx,
      blocks: ctx?.blocks ?? blocks,
    };
    const issues: ValidationIssue[] = [];
    this._walk(blocks, context, [], issues);
    return issues;
  }

  private _walk(
    blocks: Block[],
    ctx: ValidationContext,
    parentSegments: string[],
    issues: ValidationIssue[]
  ): void {
    blocks.forEach((block, index) => {
      const segments = [...parentSegments, String(index)];
      const path = segments.join('/');
      const def = this._definitions.get(block.type);

      if (!def) {
        issues.push({
          severity: 'warning',
          code: 'unregistered-block-type',
          message: `Block type "${block.type}" is not registered`,
          blockId: block.id,
          path,
        });
      } else if (def.validate) {
        for (const issue of def.validate(block, ctx)) {
          issues.push({
            ...issue,
            blockId: issue.blockId ?? block.id,
            path: issue.path ?? path,
            ...(ctx.sectionId ? { sectionId: issue.sectionId ?? ctx.sectionId } : {}),
          });
        }
      }

      if (block.children?.length) {
        this._walk(block.children, ctx, [...segments, 'children'], issues);
      }
    });
  }
}
