/**
 * Compliance lock plugin — read-only blocks (e.g. required section headings).
 *
 * ## Policy matrix (what the filter enforces)
 *
 * | Capability | Default behavior |
 * |------------|------------------|
 * | Edit text / marks inside a locked block | Blocked |
 * | Change locked block attrs (e.g. heading level, alignment) | Blocked |
 * | Delete a locked block | Blocked |
 * | Insert content before/after locked block (sibling blocks) | Allowed |
 * | Reorder locked blocks vs each other | Controlled by `allowReorder` |
 * | Drag-handle UI for locked blocks | Hidden when `allowReorder` is false |
 *
 * ## Collaboration (Yjs / shared editing)
 *
 * `filterTransaction` runs only on the local editor. Remote collaborators applying * incompatible steps will still mutate the shared document unless the same rules
 * are enforced by your sync layer (e.g. server validation, shared CRDT policy).
 * Treat client-side locks as UX + accidental-edit prevention, not cryptographic proof.
 *
 * ## Bypass (approved edits / migrations)
 *
 * Dispatch a transaction with {@link COMPLIANCE_LOCK_BYPASS_META} set to `true`
 * so trusted code can mutate locked content (e.g. after an approval workflow).
 *
 * @module
 */

import { Plugin } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';

/**
 * Transaction meta: when truthy, {@link createComplianceLockPlugin} allows the
 * transaction through without compliance checks.
 */
export const COMPLIANCE_LOCK_BYPASS_META = 'beakblockComplianceLockBypass';

/**
 * Options for {@link createComplianceLockPlugin}.
 */
export interface ComplianceLockPluginOptions {
  /**
   * When true, locked blocks may change position relative to each other (e.g. drag).
   * When false, the relative document order of locked blocks must stay the same,
   * and drag handles are hidden for locked blocks in the drag-drop plugin.
   * @default false
   */
  allowReorder?: boolean;
}

/**
 * Returns true when the node carries `attrs.locked` (boolean true or string "true").
 */
export function nodeIsComplianceLocked(node: PMNode | null | undefined): boolean {
  if (!node) return false;
  const v = node.attrs.locked;
  return v === true || v === 'true';
}

interface LockedSnapshot {
  contentJSON: unknown;
  attrsJSON: string;
}

function snapshotLockedNodes(doc: PMNode): Map<string, LockedSnapshot> {
  const m = new Map<string, LockedSnapshot>();
  doc.descendants((node) => {
    if (!node.isBlock || !nodeIsComplianceLocked(node)) return true;
    const id = node.attrs.id;
    if (id == null || id === '') return true;
    const { id: _i, ...attrsNoId } = node.attrs as Record<string, unknown>;
    m.set(String(id), {
      contentJSON: node.content.toJSON(),
      attrsJSON: JSON.stringify(attrsNoId),
    });
    return true;
  });
  return m;
}

function snapshotsMatch(before: Map<string, LockedSnapshot>, after: Map<string, LockedSnapshot>): boolean {
  if (before.size !== after.size) return false;
  for (const [id, snap] of before) {
    const o = after.get(id);
    if (!o) return false;
    if (JSON.stringify(snap.contentJSON) !== JSON.stringify(o.contentJSON)) return false;
    if (snap.attrsJSON !== o.attrsJSON) return false;
  }
  return true;
}

/** Document order of locked block ids (depth-first, same as descendants). */
export function lockedBlockIdOrder(doc: PMNode): string[] {
  const order: string[] = [];
  doc.descendants((node) => {
    if (node.isBlock && nodeIsComplianceLocked(node) && node.attrs.id != null && node.attrs.id !== '') {
      order.push(String(node.attrs.id));
    }
    return true;
  });
  return order;
}

function orderStringsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Creates a plugin that rejects transactions which would edit, re-attribute,
 * delete, or (optionally) reorder compliance-locked blocks.
 */
export function createComplianceLockPlugin(options: ComplianceLockPluginOptions = {}): Plugin {
  const allowReorder = options.allowReorder === true;

  return new Plugin({
    filterTransaction(tr, state) {
      if (!tr.docChanged) return true;
      if (tr.getMeta(COMPLIANCE_LOCK_BYPASS_META)) return true;

      let doc = state.doc;
      for (let i = 0; i < tr.steps.length; i++) {
        const step = tr.steps[i];
        const result = step.apply(doc);
        if (result.failed || !result.doc) return true;
        doc = result.doc;
      }

      const beforeLocked = snapshotLockedNodes(state.doc);
      const afterLocked = snapshotLockedNodes(doc);

      if (!snapshotsMatch(beforeLocked, afterLocked)) {
        return false;
      }

      if (!allowReorder) {
        const beforeOrder = lockedBlockIdOrder(state.doc);
        const afterOrder = lockedBlockIdOrder(doc);
        if (!orderStringsEqual(beforeOrder, afterOrder)) {
          return false;
        }
      }

      return true;
    },
  });
}
