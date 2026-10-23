/**
 * Helpers for content the editor does not understand: unregistered block types, unregistered
 * inline items and undeclared props. The content is kept as JSON on the node and reported through
 * {@link collectUnknownContentIssues}, so nothing is dropped silently.
 *
 * @module
 */

import type { Node as PMNode } from 'prosemirror-model';

import { UNKNOWN_PROPS_ATTR } from '../schema/nodes/unknownProps';
import type { ValidationIssue } from '../registry/types';
import type { UnknownInlineContent } from './types';

/** Parses the `unknownProps` attribute. Missing or unreadable JSON yields no props. */
export function parseUnknownProps(json: unknown): Record<string, unknown> {
  if (typeof json !== 'string' || json === '') return {};
  try {
    const value = JSON.parse(json) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Props of an inline node restored from its attributes. Undeclared props stored in `unknownProps`
 * are merged back in, and the attribute itself is not returned.
 */
export function propsFromAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  const { [UNKNOWN_PROPS_ATTR]: unknownJson, ...declared } = attrs;
  return { ...declared, ...parseUnknownProps(unknownJson) };
}

/**
 * Splits block props into the attributes a node type declares and the rest, which is stored as
 * JSON under `unknownProps`. Only the rest is kept, so a prop that is also declared still lands in
 * its attribute.
 *
 * @param declared - Attribute names the node type declares
 * @param attrs - Attributes built from the block props
 */
export function splitUnknownAttrs(
  declared: Readonly<Record<string, unknown>>,
  attrs: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    const isDeclared = key !== UNKNOWN_PROPS_ATTR && (key === 'id' || key in declared);
    if (isDeclared) out[key] = value;
    else extra[key] = value;
  }
  if (Object.keys(extra).length > 0) out[UNKNOWN_PROPS_ATTR] = JSON.stringify(extra);
  return out;
}

/** Serialises an unregistered inline node (type, props and content) back to its block JSON form. */
export function unknownInlineToItem(node: PMNode): UnknownInlineContent {
  const item: UnknownInlineContent = { type: String(node.attrs.originalType ?? '') };
  if (node.attrs.propsJson !== null && node.attrs.propsJson !== undefined) {
    item.props = JSON.parse(String(node.attrs.propsJson)) as Record<string, unknown>;
  }
  if (node.attrs.contentJson !== null && node.attrs.contentJson !== undefined) {
    item.content = JSON.parse(String(node.attrs.contentJson)) as UnknownInlineContent['content'];
  }
  return item;
}

/**
 * Lists the unknown content in a document: unregistered blocks, unregistered inline items and
 * undeclared props. Each finding is a {@link ValidationIssue} with the id of the block it concerns.
 *
 * @param doc - A ProseMirror document node
 */
export function collectUnknownContentIssues(doc: PMNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  doc.descendants((node, _pos, parent) => {
    if (node.type.name === 'unknownBlock') {
      const type = String(node.attrs.originalType ?? '');
      issues.push({
        severity: 'warning',
        code: 'unregistered-block-type',
        message: `Block type "${type}" is not registered. It is kept as an unsupported placeholder.`,
        blockId: String(node.attrs.id ?? ''),
      });
    } else if (node.type.name === 'unknownInline') {
      const type = String(node.attrs.originalType ?? '');
      issues.push({
        severity: 'warning',
        code: 'unknown-inline-type',
        message: `Inline type "${type}" is not registered. It is kept as an unsupported placeholder.`,
        blockId: String(parent?.attrs.id ?? ''),
      });
    } else if (node.type.spec.attrs && UNKNOWN_PROPS_ATTR in node.type.spec.attrs) {
      const keys = Object.keys(parseUnknownProps(node.attrs[UNKNOWN_PROPS_ATTR]));
      if (keys.length > 0) {
        issues.push({
          severity: 'warning',
          code: 'unknown-block-prop',
          message: `Block "${node.type.name}" has props that are not declared: ${keys.join(', ')}. They are kept unchanged.`,
          blockId: String(node.attrs.id ?? ''),
        });
      }
    }
    return true;
  });
  return issues;
}
