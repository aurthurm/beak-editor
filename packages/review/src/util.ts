/**
 * Internal helpers shared across the review package: identifiers, document traversal and block text.
 *
 * @module
 */

import type { Mark, Node as PMNode } from 'prosemirror-model';
import { isBuiltinInline, type Block, type InlineContent } from '@amusendame/beakblock-core';
import type { RevisionKind, RevisionStyleRef } from './types';

/** Mark name for inserted text. */
export const INSERTION_MARK = 'insertion';
/** Mark name for deleted text. */
export const DELETION_MARK = 'deletion';

/** Resolves the section for a document position. Return `undefined` to keep the default lookup. */
export type SectionResolver = (doc: PMNode, pos: number) => string | null | undefined;

/** Creates a prefixed unique id. Uses `crypto.randomUUID` when available. */
export function newId(prefix: string): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const raw = c?.randomUUID
    ? c.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${raw}`;
}

/** Current time as an ISO string. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Clamps a position into the document range. */
export function clampPos(doc: PMNode, pos: number): number {
  return Math.max(0, Math.min(pos, doc.content.size));
}

/** A run of text with the same marks, clipped to a range. */
export interface TextSegment {
  from: number;
  to: number;
  marks: readonly Mark[];
}

/** Text segments intersecting `[from, to)`, clipped to that range. */
export function textSegments(doc: PMNode, from: number, to: number): TextSegment[] {
  const out: TextSegment[] = [];
  if (to <= from) return out;
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.isText) {
      const s = Math.max(from, pos);
      const e = Math.min(to, pos + node.nodeSize);
      if (e > s) out.push({ from: s, to: e, marks: node.marks });
    }
    return true;
  });
  return out;
}

/** Maps a mark name to a revision kind. */
export function revisionKindOfMark(name: string): RevisionKind | null {
  if (name === INSERTION_MARK) return 'insert';
  if (name === DELETION_MARK) return 'delete';
  return null;
}

/** Facts about a revision, read from its marks in the document. */
export interface RevisionMarkInfo {
  id: string;
  kind: 'insert' | 'delete';
  authorId: string | null;
  authorName: string | null;
  at: string | null;
  aiGenerated: boolean;
  groupId: string | null;
  /** Position of the first text carrying the mark. */
  from: number;
}

/** Collects every revision in the document, keyed by revision id, in document order. */
export function collectRevisionInfo(doc: PMNode): Map<string, RevisionMarkInfo> {
  const map = new Map<string, RevisionMarkInfo>();
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      const kind = revisionKindOfMark(mark.type.name);
      if (!kind) continue;
      const id = mark.attrs.revisionId as string | null;
      if (!id || map.has(id)) continue;
      map.set(id, {
        id,
        kind: kind === 'insert' ? 'insert' : 'delete',
        authorId: (mark.attrs.authorId as string | null) ?? null,
        authorName: (mark.attrs.authorName as string | null) ?? null,
        at: (mark.attrs.at as string | null) ?? null,
        aiGenerated: Boolean(mark.attrs.aiGenerated),
        groupId: (mark.attrs.groupId as string | null) ?? null,
        from: pos,
      });
    }
  });
  return map;
}

/** Ids of revision marks that occur in `[from, to)`. */
export function revisionIdsIn(doc: PMNode, from: number, to: number): Set<string> {
  const ids = new Set<string>();
  for (const seg of textSegments(doc, from, to)) {
    for (const mark of seg.marks) {
      if (revisionKindOfMark(mark.type.name) && mark.attrs.revisionId) {
        ids.add(String(mark.attrs.revisionId));
      }
    }
  }
  return ids;
}

/** Text carried by one revision (inserted, deleted, or formatted text). */
export function revisionText(doc: PMNode, id: string): string {
  let text = '';
  doc.descendants((node) => {
    if (node.isText && node.marks.some((m) => revisionKindOfMark(m.type.name) && m.attrs.revisionId === id)) {
      text += node.text ?? '';
    }
  });
  return text;
}

/** Nearest enclosing block id and `controlledSection` id for a document position. */
export function resolveLocation(
  doc: PMNode,
  pos: number,
  getSectionId?: SectionResolver
): { blockId?: string; sectionId: string | null } {
  const $pos = doc.resolve(clampPos(doc, pos));
  let blockId: string | undefined;
  let sectionId: string | null = null;
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (blockId === undefined && node.attrs.id) blockId = String(node.attrs.id);
    if (sectionId === null && node.type.name === 'controlledSection' && node.attrs.sectionId) {
      sectionId = String(node.attrs.sectionId);
    }
  }
  const override = getSectionId?.(doc, pos);
  if (override !== undefined) sectionId = override;
  return { blockId, sectionId };
}

/** Plain text of inline content. Hard breaks become newlines, icons contribute their symbol. */
export function inlineText(content?: InlineContent[]): string {
  if (!content) return '';
  return content
    .map((item) => {
      if (!isBuiltinInline(item)) return '';
      switch (item.type) {
        case 'text':
          return item.text;
        case 'link':
          return item.content.map((t) => t.text).join('');
        case 'icon':
          return item.symbol;
        case 'hardBreak':
          return '\n';
        default:
          return '';
      }
    })
    .join('');
}

/** Plain text of a block's own inline content (children are not included). */
export function blockPlainText(block: Block): string {
  return inlineText(block.content);
}

/** Reads the revision reference from a text item's styles. */
export function revisionRefOf(styles: unknown): RevisionStyleRef | undefined {
  return (styles as { revision?: RevisionStyleRef } | undefined)?.revision;
}

/** A block with the section it belongs to, in pre-order. */
export interface FlatBlock {
  block: Block;
  sectionId: string | null;
  parentId: string | null;
}

/** Flattens a block tree in pre-order, tracking the enclosing `controlledSection`. */
export function flattenBlocks(
  blocks: Block[],
  sectionId: string | null = null,
  parentId: string | null = null,
  out: FlatBlock[] = []
): FlatBlock[] {
  for (const block of blocks) {
    const own =
      block.type === 'controlledSection'
        ? typeof block.props.sectionId === 'string'
          ? block.props.sectionId
          : null
        : sectionId;
    out.push({ block, sectionId: own, parentId });
    if (block.children && block.children.length > 0) {
      flattenBlocks(block.children, own, block.id, out);
    }
  }
  return out;
}

/** JSON with object keys sorted, for comparing blocks by value. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** Escapes text for inclusion in HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
