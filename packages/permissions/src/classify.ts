/**
 * Classify a ProseMirror transaction into typed operations.
 *
 * Each step is applied to the document it was built against, so positions are
 * resolved in the right coordinate space. Removals and insertions that share a block id
 * within one transaction are paired into moves (`moveBlock` / `moveSection`).
 *
 * @module
 */

import type { Transaction } from 'prosemirror-state';
import type { Node as PMNode, Slice } from 'prosemirror-model';
import type { Step } from 'prosemirror-transform';

import { CONTROLLED_SECTION_NODE } from './types';
import type { OperationKind, ServiceOwnedOptions, TypedOperation } from './types';
import { PROTECTED_SECTION_ATTRS, SERVICE_OWNED_BLOCK_TYPES } from './scopes';

/** Section id used when a controlled section node has no usable `sectionId`. Grants never cover it. */
export const UNIDENTIFIED_SECTION = '__unidentified__';

const TABLE_TYPES = ['table', 'tableRow', 'tableCell', 'tableHeader'];
const CELL_TYPES = ['tableCell', 'tableHeader'];

/** The section id of a controlled section node. */
export function sectionIdOfNode(node: PMNode): string {
  const id = node.attrs.sectionId;
  return typeof id === 'string' && id.length > 0 ? id : UNIDENTIFIED_SECTION;
}

/** Nearest controlled section and table context at a document position. */
interface Container {
  sectionId: string | null;
  inTable: boolean;
  inCell: boolean;
}

function containerAt(doc: PMNode, pos: number): Container {
  const clamped = Math.max(0, Math.min(doc.content.size, pos));
  const $pos = doc.resolve(clamped);
  let sectionId: string | null = null;
  let inTable = false;
  let inCell = false;
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    const name = node.type.name;
    if (sectionId === null && name === CONTROLLED_SECTION_NODE) sectionId = sectionIdOfNode(node);
    if (name === 'table') inTable = true;
    if (CELL_TYPES.includes(name)) inCell = true;
  }
  return { sectionId, inTable, inCell };
}

interface TextTarget {
  sectionId: string | null;
  blockId?: string;
  blockType?: string;
  inCell: boolean;
  from: number;
  to: number;
}

/**
 * One target per section for the textblocks overlapping [from, to].
 * Textblocks that the caller treats as fully removed are excluded through `skip`.
 */
function textTargets(
  doc: PMNode,
  from: number,
  to: number,
  skip: (pos: number, node: PMNode) => boolean = () => false,
  fallback = true
): TextTarget[] {
  const bySection = new Map<string | null, TextTarget>();
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock) {
      if (!skip(pos, node)) {
        const c = containerAt(doc, pos);
        if (!bySection.has(c.sectionId)) {
          bySection.set(c.sectionId, {
            sectionId: c.sectionId,
            blockId: node.attrs.id ?? undefined,
            blockType: node.type.name,
            inCell: c.inCell,
            from,
            to,
          });
        }
      }
      return false;
    }
    return true;
  });
  if (bySection.size === 0 && fallback) {
    const c = containerAt(doc, from);
    bySection.set(c.sectionId, { sectionId: c.sectionId, inCell: c.inCell, from, to });
  }
  return [...bySection.values()];
}

/** Adds `serviceOwned: true` to an operation's details when it touches a service-owned node. */
function withOwned(op: TypedOperation, owned: boolean): TypedOperation {
  return owned ? { ...op, details: { ...op.details, serviceOwned: true } } : op;
}

/** True when the position is inside a service-owned node (any ancestor has a service-owned type). */
function ownedAncestor(doc: PMNode, pos: number, types: ReadonlySet<string>): boolean {
  const $pos = doc.resolve(Math.max(0, Math.min(doc.content.size, pos)));
  for (let depth = $pos.depth; depth > 0; depth--) {
    if (types.has($pos.node(depth).type.name)) return true;
  }
  return false;
}

/**
 * True when a step touches a service-owned node: a service-owned node in or around its range, or
 * one in the inserted slice.
 */
function touchesServiceOwned(doc: PMNode, from: number, to: number, slice: Slice | undefined, types: ReadonlySet<string>): boolean {
  if (ownedAncestor(doc, from, types) || ownedAncestor(doc, to, types)) return true;
  const lo = Math.max(0, Math.min(from, to));
  const hi = Math.min(doc.content.size, Math.max(from, to));
  let hit = false;
  doc.nodesBetween(lo, hi, (node) => {
    if (types.has(node.type.name)) hit = true;
    return !hit;
  });
  if (!hit && slice) {
    slice.content.descendants((node) => {
      if (types.has(node.type.name)) hit = true;
      return !hit;
    });
  }
  return hit;
}

/** Drop operations that repeat the same permission check (the same step can touch a section twice). */
function dedupe(ops: TypedOperation[]): TypedOperation[] {
  const seen = new Set<string>();
  return ops.filter((o) => {
    const key = [
      o.kind,
      o.sectionId ?? '',
      o.blockId ?? '',
      o.blockType ?? '',
      String(o.details?.direction ?? ''),
      String(o.details?.serviceOwned === true),
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Collects operations and pairs removals with insertions that share a block id. */
class Collector {
  private readonly ops: TypedOperation[] = [];
  private readonly removals: Array<{ op: TypedOperation; id: string | undefined }> = [];
  private readonly insertions: Array<{ op: TypedOperation; id: string | undefined }> = [];
  /** True while classifying a step that touches a service-owned node. */
  owned = false;

  push(op: TypedOperation): void {
    this.ops.push(withOwned(op, this.owned));
  }

  removal(op: TypedOperation, id: string | undefined): void {
    this.removals.push({ op: withOwned(op, this.owned), id });
  }

  insertion(op: TypedOperation, id: string | undefined): void {
    this.insertions.push({ op: withOwned(op, this.owned), id });
  }

  finish(): TypedOperation[] {
    const out = dedupe([...this.ops]);
    const usedInsertions = new Set<number>();
    for (const rem of this.removals) {
      const index = rem.id
        ? this.insertions.findIndex((ins, i) => !usedInsertions.has(i) && ins.id === rem.id)
        : -1;
      if (index === -1) {
        out.push(rem.op);
        continue;
      }
      usedInsertions.add(index);
      out.push(...movePair(rem.op, this.insertions[index]!.op));
    }
    this.insertions.forEach((ins, i) => {
      if (!usedInsertions.has(i)) out.push(ins.op);
    });
    return dedupe(out);
  }
}

/**
 * Turn a removal and an insertion of the same block into a move.
 * A move between containers yields two operations (`out` on the source, `in` on the target)
 * so that each section is checked on its own.
 */
function movePair(removed: TypedOperation, inserted: TypedOperation): TypedOperation[] {
  const owned = removed.details?.serviceOwned === true || inserted.details?.serviceOwned === true;
  const isSection = removed.kind === 'deleteSection' || inserted.blockType === CONTROLLED_SECTION_NODE;
  const kind: OperationKind = isSection ? 'moveSection' : 'moveBlock';
  const fromSection = isSection
    ? ((removed.details?.parentSection as string | null | undefined) ?? null)
    : removed.sectionId;
  const toSection = inserted.sectionId;
  const base = { kind, blockId: removed.blockId, blockType: removed.blockType };

  // A moved section is also checked on its own id, so a locked or ungranted nested section cannot move.
  const self: TypedOperation[] = isSection
    ? [{ ...base, sectionId: removed.sectionId, details: { fromSection, toSection, direction: 'within', self: true } }]
    : [];

  if (fromSection === toSection) {
    return [
      withOwned({
        ...base,
        sectionId: toSection,
        details: { fromSection, toSection, direction: 'within' },
      }, owned),
      ...self.map((op) => withOwned(op, owned)),
    ];
  }
  return [
    withOwned({
      ...base,
      sectionId: fromSection,
      from: removed.from,
      to: removed.to,
      details: { fromSection, toSection, direction: 'out' },
    }, owned),
    withOwned({
      ...base,
      sectionId: toSection,
      from: inserted.from,
      to: inserted.to,
      details: { fromSection, toSection, direction: 'in' },
    }, owned),
    ...self.map((op) => withOwned(op, owned)),
  ];
}

interface StepLike {
  from?: number;
  to?: number;
  pos?: number;
  slice?: Slice;
  attr?: string;
  value?: unknown;
  mark?: { type: { name: string }; attrs: Record<string, unknown> };
}

function stepType(step: Step): string {
  const json = step.toJSON() as { stepType?: string };
  return json.stepType ?? 'unknown';
}

function classifyReplace(doc: PMNode, from: number, to: number, slice: Slice, c: Collector): void {
  const removed: Array<{ node: PMNode; pos: number }> = [];
  if (to > from) {
    // Descend into fully removed blocks too, so nested sections and blocks are checked on their own.
    doc.nodesBetween(from, to, (node, pos) => {
      if (node.isBlock && pos >= from && pos + node.nodeSize <= to) removed.push({ node, pos });
      return true;
    });
  }

  // Open slice edges hold partial nodes that continue existing blocks. They are not insertions.
  // Their change is treated as an edit of the block at the insertion point.
  const inserted: PMNode[] = [];
  const partial: PMNode[] = [];
  const lastIndex = slice.content.childCount - 1;
  slice.content.forEach((node, _offset, index) => {
    if (!node.isBlock) return;
    const open = (index === 0 && slice.openStart > 0) || (index === lastIndex && slice.openEnd > 0);
    if (open) partial.push(node);
    else inserted.push(node);
  });
  if (partial.length > 0) {
    const at = containerAt(doc, from);
    const textual = partial.some((n) => n.isTextblock);
    c.push({
      kind: textual && !at.inCell ? 'replaceText' : at.inCell ? 'updateTableCell' : 'editAttrs',
      sectionId: at.sectionId,
      from,
      to,
      details: { partial: true },
    });
  }

  const removedRanges = removed.map((r) => [r.pos, r.pos + r.node.nodeSize] as const);
  const isRemovedTextblock = (pos: number, node: PMNode): boolean =>
    removedRanges.some(([s, e]) => pos >= s && pos + node.nodeSize <= e);

  // Inline change: text inside existing textblocks.
  if (inserted.length === 0 && (to > from || slice.size > 0)) {
    for (const target of textTargets(doc, from, to, isRemovedTextblock, false)) {
      c.push({
        kind: target.inCell ? 'updateTableCell' : 'replaceText',
        sectionId: target.sectionId,
        blockId: target.blockId,
        blockType: target.blockType,
        from: target.from,
        to: target.to,
      });
    }
  }

  for (const { node, pos } of removed) {
    const cont = containerAt(doc, pos);
    const id = node.attrs.id ?? undefined;
    if (node.type.name === CONTROLLED_SECTION_NODE) {
      c.removal(
        {
          kind: 'deleteSection',
          sectionId: sectionIdOfNode(node),
          blockId: id,
          blockType: CONTROLLED_SECTION_NODE,
          from: pos,
          to: pos + node.nodeSize,
          details: {
            required: node.attrs.required === true,
            parentSection: cont.sectionId,
            title: node.attrs.title,
          },
        },
        id
      );
      continue;
    }
    let kind: OperationKind = 'deleteBlock';
    if (TABLE_TYPES.includes(node.type.name)) kind = 'changeTableStructure';
    else if (cont.inTable) kind = 'updateTableCell';
    c.removal(
      { kind, sectionId: cont.sectionId, blockId: id, blockType: node.type.name, from: pos, to: pos + node.nodeSize },
      id
    );
  }

  const insertAt = containerAt(doc, from);
  for (const node of inserted) {
    const id = node.attrs.id ?? undefined;
    if (node.type.name === CONTROLLED_SECTION_NODE) {
      c.insertion(
        {
          kind: 'insertBlock',
          sectionId: insertAt.sectionId,
          blockId: id,
          blockType: CONTROLLED_SECTION_NODE,
          from,
          to: from,
          details: { newSectionId: sectionIdOfNode(node), title: node.attrs.title },
        },
        id
      );
      continue;
    }
    let kind: OperationKind = 'insertBlock';
    if (TABLE_TYPES.includes(node.type.name)) kind = 'changeTableStructure';
    else if (insertAt.inTable) kind = 'updateTableCell';
    c.insertion({ kind, sectionId: insertAt.sectionId, blockId: id, blockType: node.type.name, from, to: from }, id);
  }
}

function classifyAttr(doc: PMNode, pos: number, attr: string, c: Collector): void {
  const node = doc.nodeAt(pos);
  if (!node) {
    c.push({ kind: 'editAttrs', sectionId: null, from: pos, to: pos, details: { invalid: true } });
    return;
  }
  const blockId = node.attrs.id ?? undefined;
  if (node.type.name === CONTROLLED_SECTION_NODE) {
    const sid = sectionIdOfNode(node);
    const base = { sectionId: sid, blockId, blockType: CONTROLLED_SECTION_NODE, from: pos, to: pos + node.nodeSize };
    if (attr === 'title') c.push({ ...base, kind: 'renameSection', details: { attr } });
    else if (attr === 'styleId') c.push({ ...base, kind: 'changeStyle', details: { attr } });
    else if (PROTECTED_SECTION_ATTRS.includes(attr)) c.push({ ...base, kind: 'editAttrs', details: { attr, protected: true } });
    else c.push({ ...base, kind: 'editAttrs', details: { attr } });
    return;
  }
  const cont = containerAt(doc, pos);
  const base = {
    sectionId: cont.sectionId,
    blockId,
    blockType: node.type.name,
    from: pos,
    to: pos + node.nodeSize,
    details: { attr },
  };
  if (attr === 'styleId') c.push({ ...base, kind: 'changeStyle' });
  else if (node.type.name === 'table' || node.type.name === 'tableRow') c.push({ ...base, kind: 'changeTableStructure' });
  else if (CELL_TYPES.includes(node.type.name) || (cont.inTable && node.isTextblock)) c.push({ ...base, kind: 'updateTableCell' });
  else c.push({ ...base, kind: 'editAttrs' });
}

function classifyStep(doc: PMNode, step: Step, c: Collector, types: ReadonlySet<string>): void {
  const type = stepType(step);
  const s = step as unknown as StepLike;
  const extent = typeof s.pos === 'number'
    ? { from: s.pos, to: s.pos + (doc.nodeAt(s.pos)?.nodeSize ?? 0), slice: undefined }
    : { from: s.from ?? 0, to: s.to ?? s.from ?? 0, slice: s.slice };
  c.owned = touchesServiceOwned(doc, extent.from, extent.to, extent.slice, types);
  switch (type) {
    case 'replace':
      classifyReplace(doc, s.from ?? 0, s.to ?? 0, s.slice!, c);
      return;
    case 'replaceAround': {
      // Wrapping, lifting or retyping blocks. Content is preserved, so this is an edit of the
      // affected blocks rather than a removal or insertion.
      const from = s.from ?? 0;
      const to = s.to ?? 0;
      for (const target of textTargets(doc, from, to, () => false, true)) {
        c.push({
          kind: target.inCell ? 'updateTableCell' : 'editAttrs',
          sectionId: target.sectionId,
          blockId: target.blockId,
          blockType: target.blockType,
          from,
          to,
          details: { structure: true },
        });
      }
      return;
    }
    case 'addMark':
    case 'removeMark': {
      const from = s.from ?? 0;
      const to = s.to ?? 0;
      const markName = s.mark?.type.name ?? '';
      const accepting = type === 'removeMark' && (markName === 'insertion' || markName === 'deletion');
      for (const target of textTargets(doc, from, to, () => false, true)) {
        c.push({
          kind: accepting ? 'acceptRevision' : 'formatText',
          sectionId: target.sectionId,
          blockId: target.blockId,
          blockType: target.blockType,
          from,
          to,
          details: accepting ? { revisionId: s.mark?.attrs.revisionId ?? null, mark: markName } : { mark: markName },
        });
      }
      return;
    }
    case 'attr':
      classifyAttr(doc, s.pos ?? 0, s.attr ?? '', c);
      return;
    case 'addNodeMark':
    case 'removeNodeMark': {
      const pos = s.pos ?? 0;
      const node = doc.nodeAt(pos);
      const cont = containerAt(doc, pos);
      c.push({
        kind: 'editAttrs',
        sectionId: cont.sectionId,
        blockId: node?.attrs.id ?? undefined,
        blockType: node?.type.name,
        from: pos,
        to: pos + (node?.nodeSize ?? 0),
        details: { nodeMark: true },
      });
      return;
    }
    case 'docAttr':
      c.push({ kind: 'editAttrs', sectionId: null, details: { docAttr: s.attr } });
      return;
    default: {
      // Unknown step: check every section it touches, and treat it as uncontrolled when it touches nothing.
      if (typeof s.from === 'number' && typeof s.to === 'number') {
        for (const target of textTargets(doc, s.from, s.to, () => false, true)) {
          c.push({ kind: 'editAttrs', sectionId: target.sectionId, from: s.from, to: s.to, details: { step: type } });
        }
      } else {
        c.push({ kind: 'editAttrs', sectionId: null, details: { step: type } });
      }
    }
  }
}

/**
 * Classify the steps of a transaction into typed operations.
 *
 * A range that spans several sections yields one operation per section, so a guard can
 * reject the whole transaction when any one section is not allowed.
 *
 * @example
 * ```typescript
 * const ops = classifyTransaction(state.tr.insertText('x', 5));
 * // [{ kind: 'replaceText', sectionId: 'S1', blockId: 'p1', ... }]
 * ```
 */
export function classifyTransaction(tr: Transaction, options: ServiceOwnedOptions = {}): TypedOperation[] {
  const collector = new Collector();
  const types = new Set(options.serviceOwnedTypes ?? SERVICE_OWNED_BLOCK_TYPES);
  let doc = tr.before;
  for (const step of tr.steps) {
    classifyStep(doc, step, collector, types);
    const result = step.apply(doc);
    if (!result.failed && result.doc) doc = result.doc;
  }
  return collector.finish();
}
