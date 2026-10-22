/**
 * Server-side verification of a document change.
 *
 * The server holds the last accepted document and receives the proposed one. This module
 * diffs the two block trees itself and derives the operations. Operations that a client
 * might declare are never trusted. Pure TypeScript with no DOM or ProseMirror dependency,
 * so it runs in Node.
 *
 * @module
 */

import type { Block } from '@amusendame/beakblock-core';

import { createPolicyEngine } from './engine';
import { PROTECTED_SECTION_ATTRS, SERVICE_OWNED_BLOCK_TYPES } from './scopes';
import { CONTROLLED_SECTION_NODE } from './types';
import type {
  OperationKind,
  PolicyContext,
  PolicyEngine,
  ServiceOwnedOptions,
  TypedOperation,
  VerificationResult,
} from './types';

const TABLE_TYPES = ['table', 'tableRow', 'tableCell', 'tableHeader'];
const CELL_TYPES = ['tableCell', 'tableHeader'];
const UNIDENTIFIED = '__unidentified__';

/**
 * Deterministic JSON: object keys sorted, `undefined` dropped. Used to compare blocks and props.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : normalize(v)));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = normalize(v);
    }
    return out;
  }
  return value;
}

interface BlockEntry {
  id: string;
  type: string;
  sectionId: string | null;
  parentKey: string;
  parentId: string | null;
  index: number;
  inTable: boolean;
  /** True when the block is a service-owned type or sits inside one. */
  owned: boolean;
  /** Canonical JSON of the service-owned inline nodes in `content` (empty when there are none). */
  serviceInlines: string;
  props: Record<string, unknown>;
  content: unknown;
  json: string;
}

interface SectionEntry {
  id: string;
  sectionId: string;
  parentSection: string | null;
  parentKey: string;
  index: number;
  owned: boolean;
  props: Record<string, unknown>;
  block: Block;
}

interface Index {
  blocks: Map<string, BlockEntry>;
  sections: Map<string, SectionEntry>;
  invalid: TypedOperation[];
}

interface CollectContext {
  section: string | null;
  parentKey: string;
  parentBlockId: string | null;
  inTable: boolean;
  /** True inside a service-owned block. */
  owned: boolean;
}

function asProps(block: Block): Record<string, unknown> {
  return block.props && typeof block.props === 'object' ? block.props : {};
}

/**
 * Canonical JSON of every service-owned node in inline content (nested content included).
 * Two blocks with the same value hold the same service-owned inline nodes.
 */
function serviceInlineSignature(content: unknown, types: ReadonlySet<string>): string {
  const found: string[] = [];
  const visit = (nodes: unknown): void => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const item = node as { type?: unknown; content?: unknown };
      if (typeof item.type === 'string' && types.has(item.type)) found.push(canonicalJson(node));
      visit(item.content);
    }
  };
  visit(content);
  return found.join('\n');
}

function index(blocks: Block[], types: ReadonlySet<string>): Index {
  const out: Index = { blocks: new Map(), sections: new Map(), invalid: [] };

  const invalid = (sectionId: string | null, blockId?: string) =>
    out.invalid.push({ kind: 'editAttrs', sectionId, blockId, details: { invalid: true } });

  const walk = (list: Block[], ctx: CollectContext): void => {
    list.forEach((block, i) => {
      if (!block || typeof block.id !== 'string' || typeof block.type !== 'string') {
        invalid(ctx.section);
        return;
      }
      const props = asProps(block);
      if (block.type === CONTROLLED_SECTION_NODE) {
        const sid = typeof props.sectionId === 'string' && props.sectionId ? props.sectionId : UNIDENTIFIED;
        if (sid === UNIDENTIFIED || out.sections.has(sid)) invalid(ctx.section, block.id);
        out.sections.set(sid, {
          id: block.id,
          sectionId: sid,
          parentSection: ctx.section,
          parentKey: ctx.parentKey,
          index: i,
          owned: ctx.owned,
          props,
          block,
        });
        walk(block.children ?? [], {
          section: sid,
          parentKey: `sec:${sid}`,
          parentBlockId: null,
          inTable: false,
          owned: ctx.owned,
        });
        return;
      }
      if (out.blocks.has(block.id)) invalid(ctx.section, block.id);
      const inTable = ctx.inTable || block.type === 'table';
      const owned = ctx.owned || types.has(block.type);
      out.blocks.set(block.id, {
        id: block.id,
        type: block.type,
        sectionId: ctx.section,
        parentKey: ctx.parentKey,
        parentId: ctx.parentBlockId,
        index: i,
        inTable,
        owned,
        serviceInlines: serviceInlineSignature(block.content, types),
        props,
        content: block.content,
        json: canonicalJson({ type: block.type, props, content: block.content }),
      });
      walk(block.children ?? [], {
        section: ctx.section,
        parentKey: `blk:${block.id}`,
        parentBlockId: block.id,
        inTable,
        owned,
      });
    });
  };

  walk(blocks, { section: null, parentKey: 'root', parentBlockId: null, inTable: false, owned: false });
  return out;
}

/** Operation for a block that exists only in the old document. */
function removalOp(e: BlockEntry): TypedOperation {
  let kind: OperationKind = 'deleteBlock';
  if (TABLE_TYPES.includes(e.type)) kind = 'changeTableStructure';
  else if (e.inTable) kind = 'updateTableCell';
  return { kind, sectionId: e.sectionId, blockId: e.id, blockType: e.type };
}

/** Operation for a block that exists only in the new document. */
function insertionOp(e: BlockEntry): TypedOperation {
  let kind: OperationKind = 'insertBlock';
  if (TABLE_TYPES.includes(e.type)) kind = 'changeTableStructure';
  else if (e.inTable) kind = 'updateTableCell';
  return { kind, sectionId: e.sectionId, blockId: e.id, blockType: e.type };
}

/** A move between containers is checked on both sides. Within one container it is a single check. */
function movePair(
  kind: 'moveBlock' | 'moveSection',
  id: string,
  blockType: string,
  from: string | null,
  to: string | null
): TypedOperation[] {
  const base = { kind, blockId: id, blockType };
  if (from === to) {
    return [{ ...base, sectionId: to, details: { fromSection: from, toSection: to, direction: 'within' } }];
  }
  return [
    { ...base, sectionId: from, details: { fromSection: from, toSection: to, direction: 'out' } },
    { ...base, sectionId: to, details: { fromSection: from, toSection: to, direction: 'in' } },
  ];
}

/** Operations for a block present in both documents with the same container and parent. */
function contentOps(before: BlockEntry, after: BlockEntry): TypedOperation[] {
  const base = { sectionId: after.sectionId, blockId: after.id, blockType: after.type };
  const ops: TypedOperation[] = [];

  if (before.type !== after.type) {
    return [removalOp(before), insertionOp(after)];
  }

  const changedKeys = changedPropKeys(before.props, after.props);
  const contentChanged = canonicalJson(before.content) !== canonicalJson(after.content);

  if (after.type === 'table' || after.type === 'tableRow') {
    if (changedKeys.length > 0) ops.push({ ...base, kind: 'changeTableStructure', details: { attrs: changedKeys } });
    return ops;
  }
  if (CELL_TYPES.includes(after.type) || after.inTable) {
    if (changedKeys.length > 0 || contentChanged) {
      ops.push({ ...base, kind: 'updateTableCell', details: { attrs: changedKeys, content: contentChanged } });
    }
    return ops;
  }

  if (contentChanged) ops.push({ ...base, kind: 'replaceText' });
  for (const key of changedKeys) {
    if (key === 'styleId') ops.push({ ...base, kind: 'changeStyle', details: { attr: key } });
    else ops.push({ ...base, kind: 'editAttrs', details: { attr: key } });
  }
  return ops;
}

function changedPropKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].sort().filter((k) => canonicalJson(a[k]) !== canonicalJson(b[k]));
}

/**
 * Verify a proposed document against the last accepted one.
 *
 * Both trees are indexed by controlled section (`props.sectionId`). The operations are derived
 * from the difference, then the policy engine decides them. The result is allowed only when
 * every derived operation is allowed.
 *
 * @example
 * ```typescript
 * const result = verifyDocumentChange(storedBlocks, submittedBlocks, {
 *   userId: 'u1',
 *   roles: ['author'],
 *   sectionGrants: { S1: ['section.editText'] },
 * });
 * if (!result.allowed) reject(result.violations);
 * ```
 */
export function verifyDocumentChange(
  before: Block[],
  after: Block[],
  ctx: PolicyContext,
  engine: PolicyEngine = createPolicyEngine(),
  options: ServiceOwnedOptions = {}
): VerificationResult {
  const types = new Set(options.serviceOwnedTypes ?? SERVICE_OWNED_BLOCK_TYPES);
  const b = index(before, types);
  const a = index(after, types);
  const ops: TypedOperation[] = [...b.invalid, ...a.invalid];

  // Sections
  const removedSections = [...b.sections.keys()].filter((sid) => !a.sections.has(sid));
  const addedSections = [...a.sections.keys()].filter((sid) => !b.sections.has(sid));
  const addedSet = new Set(addedSections);

  // Every removed section is checked on its own, including nested ones inside a removed parent.
  for (const sid of removedSections) {
    const e = b.sections.get(sid)!;
    ops.push({
      kind: 'deleteSection',
      sectionId: sid,
      blockId: e.id,
      blockType: CONTROLLED_SECTION_NODE,
      details: {
        required: e.props.required === true,
        parentSection: e.parentSection,
        title: e.props.title,
      },
    });
  }

  for (const sid of addedSections) {
    const e = a.sections.get(sid)!;
    if (e.parentSection && addedSet.has(e.parentSection)) continue;
    ops.push({
      kind: 'insertBlock',
      sectionId: e.parentSection,
      blockId: e.id,
      blockType: CONTROLLED_SECTION_NODE,
      details: { newSectionId: sid, title: e.props.title },
    });
  }

  const commonSections = [...b.sections.keys()].filter((sid) => a.sections.has(sid));
  for (const sid of commonSections) {
    const be = b.sections.get(sid)!;
    const ae = a.sections.get(sid)!;
    if (be.parentSection !== ae.parentSection) {
      ops.push(...movePair('moveSection', ae.id, CONTROLLED_SECTION_NODE, be.parentSection, ae.parentSection));
      // The moved section itself must be allowed to move (catches locked or grant-less nested sections).
      ops.push({
        kind: 'moveSection',
        sectionId: sid,
        blockId: ae.id,
        blockType: CONTROLLED_SECTION_NODE,
        details: { direction: 'within', fromSection: be.parentSection, toSection: ae.parentSection, self: true },
      });
    }
    for (const key of changedPropKeys(be.props, ae.props)) {
      const base = { sectionId: sid, blockId: ae.id, blockType: CONTROLLED_SECTION_NODE };
      if (key === 'title') ops.push({ ...base, kind: 'renameSection', details: { attr: key } });
      else if (key === 'styleId') ops.push({ ...base, kind: 'changeStyle', details: { attr: key } });
      else if (PROTECTED_SECTION_ATTRS.includes(key)) {
        ops.push({ ...base, kind: 'editAttrs', details: { attr: key, protected: true } });
      } else ops.push({ ...base, kind: 'editAttrs', details: { attr: key } });
    }
  }

  // Blocks
  // Every removed block is checked against its own section, even when an ancestor is removed too.
  for (const [id, be] of b.blocks) {
    const ae = a.blocks.get(id);
    if (!ae) {
      ops.push(removalOp(be));
      continue;
    }
    if (be.sectionId !== ae.sectionId) {
      ops.push(...movePair('moveBlock', id, be.type, be.sectionId, ae.sectionId));
    } else if (be.parentId !== ae.parentId) {
      ops.push({
        kind: 'moveBlock',
        sectionId: ae.sectionId,
        blockId: id,
        blockType: be.type,
        details: { fromParent: be.parentId, toParent: ae.parentId, direction: 'within' },
      });
    }
    if (be.json !== ae.json) ops.push(...contentOps(be, ae));
  }

  for (const [id, ae] of a.blocks) {
    if (b.blocks.has(id)) continue;
    // Service-owned blocks are checked even when their section or parent is new.
    const carriesService = ae.owned || ae.serviceInlines !== '';
    if (!carriesService) {
      if (ae.sectionId !== null && addedSet.has(ae.sectionId)) continue;
      if (ae.parentId && !b.blocks.has(ae.parentId)) continue;
    }
    ops.push(insertionOp(ae));
  }

  // Sibling reordering: compare the order of siblings that exist in both documents.
  const beforeOrder = siblingOrder(b);
  const afterOrder = siblingOrder(a);
  const moved = new Set(ops.filter((o) => o.blockId).map((o) => o.blockId as string));
  for (const [key, beforeIds] of beforeOrder) {
    const afterIds = afterOrder.get(key);
    if (!afterIds) continue;
    const common = new Set(afterIds);
    const bList = beforeIds.filter((id) => common.has(id));
    const aSet = new Set(bList);
    const aList = afterIds.filter((id) => aSet.has(id));
    for (let i = 0; i < bList.length; i++) {
      if (bList[i] === aList[i]) continue;
      const token = aList[i]!;
      const isSection = token.startsWith('sec:');
      const rawId = isSection ? a.sections.get(token.slice(4))?.id : a.blocks.get(token.slice(4))?.id;
      if (!rawId || moved.has(rawId)) continue;
      moved.add(rawId);
      if (isSection) {
        const sec = a.sections.get(token.slice(4))!;
        ops.push({
          kind: 'moveSection',
          sectionId: sec.sectionId,
          blockId: sec.id,
          blockType: CONTROLLED_SECTION_NODE,
          details: { direction: 'within', reordered: true },
        });
      } else {
        const e = a.blocks.get(token.slice(4))!;
        ops.push({
          kind: 'moveBlock',
          sectionId: e.sectionId,
          blockId: e.id,
          blockType: e.type,
          details: { direction: 'within', reordered: true },
        });
      }
    }
  }

  // Flag every operation that creates, deletes or changes a service-owned node: the node is
  // owned itself or sits inside an owned block, or its service-owned inline nodes changed.
  const serviceIds = new Set<string>();
  for (const e of [...b.blocks.values(), ...a.blocks.values()]) if (e.owned) serviceIds.add(e.id);
  for (const e of [...b.sections.values(), ...a.sections.values()]) if (e.owned) serviceIds.add(e.id);
  for (const [id, be] of b.blocks) {
    const ae = a.blocks.get(id);
    if (ae ? ae.serviceInlines !== be.serviceInlines : be.serviceInlines !== '') serviceIds.add(id);
  }
  for (const [id, ae] of a.blocks) if (!b.blocks.has(id) && ae.serviceInlines !== '') serviceIds.add(id);
  for (const op of ops) {
    if (op.blockId !== undefined && serviceIds.has(op.blockId)) {
      op.details = { ...op.details, serviceOwned: true };
    }
  }

  const decisions = engine.decide(ops, ctx);
  const violations = decisions.filter((d) => !d.allowed);
  return {
    allowed: violations.length === 0,
    operations: ops,
    decisions,
    violations,
  };
}

/** Ordered children (blocks and sections) per parent key, using stable `blk:`/`sec:` ids. */
function siblingOrder(idx: Index): Map<string, string[]> {
  const rows: Array<{ key: string; index: number; id: string }> = [];
  for (const e of idx.blocks.values()) rows.push({ key: e.parentKey, index: e.index, id: `blk:${e.id}` });
  for (const e of idx.sections.values()) rows.push({ key: e.parentKey, index: e.index, id: `sec:${e.sectionId}` });
  rows.sort((x, y) => x.index - y.index);
  const out = new Map<string, string[]>();
  for (const row of rows) {
    const list = out.get(row.key) ?? [];
    list.push(row.id);
    out.set(row.key, list);
  }
  return out;
}
