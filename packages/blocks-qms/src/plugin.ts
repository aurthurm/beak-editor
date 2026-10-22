/**
 * Controlled-section plugin.
 *
 * Rejects editor transactions that:
 * - insert a block type the enclosing section does not allow (`allowedBlocks`),
 * - delete a required section,
 * - change a protected section attribute (outside the QMS service or workflow command),
 * - change, delete or pre-sign a signature block (outside the signature service).
 *
 * When `getPolicyContext` is given, the permission guard from
 * `@amusendame/beakblock-permissions` is composed in, and sections the principal
 * cannot edit are decorated read-only.
 *
 * This is a UX and early-rejection layer. The server must run `verifyDocumentChange`
 * on every submitted document. It does not trust the client.
 *
 * @module
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { BEAKBLOCK_META_LOAD_DOCUMENT } from '@amusendame/beakblock-core';
import {
  canonicalJson,
  createPermissionGuardPlugin,
  describeDenials,
  PROTECTED_SECTION_ATTRS,
} from '@amusendame/beakblock-permissions';
import type { Capability, PolicyContext, PolicyDecision, TypedOperation } from '@amusendame/beakblock-permissions';

import {
  CONTROLLED_SECTION_TYPE,
  QMS_SERVICE_META,
  QMS_WORKFLOW_META,
  SIGNATURE_SERVICE_META,
} from './types';
import type { ControlledSectionPluginOptions } from './types';

/** Plugin key of the controlled-section plugin. */
export const CONTROLLED_SECTION_PLUGIN_KEY = new PluginKey('beakblock-qms-controlled-sections');

/** Node type of a signature block. */
const SIGNATURE_TYPE = 'signatureBlock';

/** Capabilities that make a section editable in the UI. */
const EDIT_CAPABILITIES: readonly Capability[] = ['section.editText', 'section.insertBlock', 'section.deleteBlock'];

interface SectionInfo {
  attrs: Record<string, unknown>;
  pos: number;
}

interface SignatureInfo {
  attrs: Record<string, unknown>;
  pos: number;
}

interface DocIndex {
  sections: Map<string, SectionInfo>;
  signatures: Map<string, SignatureInfo>;
}

/** Collects controlled sections and signature blocks of a document, keyed by identity. */
function indexDocument(doc: PMNode): DocIndex {
  const index: DocIndex = { sections: new Map(), signatures: new Map() };
  doc.descendants((node, pos) => {
    if (node.type.name === CONTROLLED_SECTION_TYPE) {
      const sid = typeof node.attrs.sectionId === 'string' ? node.attrs.sectionId : '';
      if (sid) index.sections.set(sid, { attrs: node.attrs, pos });
    } else if (node.type.name === SIGNATURE_TYPE) {
      const id = typeof node.attrs.id === 'string' ? node.attrs.id : '';
      if (id) index.signatures.set(id, { attrs: node.attrs, pos });
    }
    return true;
  });
  return index;
}

/** A signature is "signed" as soon as any of its service-written fields is set. */
function isSigned(attrs: Record<string, unknown>): boolean {
  return Boolean(attrs.signatureId) || Boolean(attrs.signedAt) || Boolean(attrs.contentHash);
}

function decision(kind: TypedOperation['kind'], sectionId: string | null, reason: string, extra?: Partial<TypedOperation>): PolicyDecision {
  return {
    allowed: false,
    operation: { kind, sectionId, ...extra },
    reason,
  };
}

/** Changed ranges of a transaction, expressed in the final document's positions. */
function changedRanges(tr: Transaction): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  tr.mapping.maps.forEach((map, i) => {
    const rest = tr.mapping.slice(i + 1);
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      ranges.push([rest.map(newStart, -1), rest.map(newEnd, 1)]);
    });
  });
  return ranges;
}

/** Whether a section allows a block type. `null` allowedBlocks allows everything. */
function allows(allowedBlocks: unknown, type: string): boolean {
  if (!Array.isArray(allowedBlocks)) return true;
  return allowedBlocks.includes(type);
}

/**
 * Structural checks on a content-changing transaction. Returns the denied decisions.
 *
 * A trusted document load (`setDocument(blocks, { trustedLoad: true })`) replaces saved content,
 * so it is not checked against these edit rules. The server still verifies the document.
 */
export function checkControlledSectionChange(
  state: EditorState,
  tr: Transaction,
  options: {
    enforceAllowedBlocks?: boolean;
    service?: boolean;
    signatureService?: boolean;
    workflow?: boolean;
    trustedLoad?: boolean;
  } = {}
): PolicyDecision[] {
  const denied: PolicyDecision[] = [];
  if (options.trustedLoad) return denied;
  const before = indexDocument(state.doc);
  const after = indexDocument(tr.doc);

  if (!options.service) {
    for (const [sid, info] of before.sections) {
      const next = after.sections.get(sid);
      if (!next) {
        if (info.attrs.required === true) {
          denied.push(
            decision('deleteSection', sid, 'required section cannot be deleted', {
              blockType: CONTROLLED_SECTION_TYPE,
              details: { required: true },
            })
          );
        }
        continue;
      }
      for (const attr of PROTECTED_SECTION_ATTRS) {
        if (canonicalJson(info.attrs[attr]) === canonicalJson(next.attrs[attr])) continue;
        if (attr === 'workflowState' && options.workflow) continue;
        denied.push(
          decision('editAttrs', sid, `protected section attribute "${attr}" can only be changed by the QMS service`, {
            blockType: CONTROLLED_SECTION_TYPE,
            details: { attr, protected: true },
          })
        );
      }
    }
  }

  if (!options.signatureService) {
    for (const [id, info] of before.signatures) {
      const next = after.signatures.get(id);
      if (!next) {
        if (isSigned(info.attrs)) {
          denied.push(
            decision('deleteBlock', null, 'signed signature block cannot be deleted', {
              blockId: id,
              blockType: SIGNATURE_TYPE,
            })
          );
        }
        continue;
      }
      if (canonicalJson(info.attrs) !== canonicalJson(next.attrs)) {
        denied.push(
          decision('editAttrs', null, 'signature blocks are written only by the signature service', {
            blockId: id,
            blockType: SIGNATURE_TYPE,
            details: { protected: true },
          })
        );
      }
    }
    for (const [id, info] of after.signatures) {
      if (before.signatures.has(id)) continue;
      if (isSigned(info.attrs)) {
        denied.push(
          decision('insertBlock', null, 'signed signature blocks can only be inserted by the signature service', {
            blockId: id,
            blockType: SIGNATURE_TYPE,
            details: { protected: true },
          })
        );
      }
    }
  }

  if (options.enforceAllowedBlocks !== false) {
    const seen = new Set<string>();
    for (const [from, to] of changedRanges(tr)) {
      tr.doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isBlock) return true;
        // Direct children of a section that overlap a changed range. Retyped blocks can map to a
        // range smaller than the node, so "fully inside" would miss them.
        const $pos = tr.doc.resolve(pos);
        const parent = $pos.parent;
        if (parent.type.name !== CONTROLLED_SECTION_TYPE) return true;
        if (allows(parent.attrs.allowedBlocks, node.type.name)) return true;
        const key = `${pos}:${node.type.name}`;
        if (seen.has(key)) return true;
        seen.add(key);
        denied.push(
          decision('insertBlock', String(parent.attrs.sectionId ?? ''), `block type "${node.type.name}" is not allowed in this section`, {
            blockId: node.attrs.id ?? undefined,
            blockType: node.type.name,
            from: pos,
            to: pos + node.nodeSize,
          })
        );
        return true;
      });
    }
  }

  return denied;
}

/** Whether the principal can edit a section (UI decision only). */
export function canEditControlledSection(ctx: PolicyContext, sectionId: string): boolean {
  if (ctx.lockedSections?.includes(sectionId)) return false;
  const grants = [...(ctx.sectionGrants[sectionId] ?? []), ...(ctx.defaultGrants ?? [])];
  return EDIT_CAPABILITIES.some((cap) => grants.includes(cap));
}

/**
 * Create the controlled-section plugin.
 *
 * @example
 * ```typescript
 * const plugin = createControlledSectionPlugin({
 *   getPolicyContext: (state) => currentPolicyContext(state),
 *   onDenied: (decisions) => console.warn(decisions),
 * });
 * ```
 */
export function createControlledSectionPlugin(options: ControlledSectionPluginOptions = {}): Plugin {
  const guard = options.getPolicyContext
    ? createPermissionGuardPlugin({ getContext: options.getPolicyContext, onDenied: options.onDenied })
    : null;

  return new Plugin({
    key: CONTROLLED_SECTION_PLUGIN_KEY,
    filterTransaction(tr, state) {
      if (!tr.docChanged) return true;
      const denied = checkControlledSectionChange(state, tr, {
        enforceAllowedBlocks: options.enforceAllowedBlocks,
        service: tr.getMeta(QMS_SERVICE_META) === true,
        signatureService: tr.getMeta(SIGNATURE_SERVICE_META) === true,
        workflow: tr.getMeta(QMS_WORKFLOW_META) === true,
        trustedLoad: tr.getMeta(BEAKBLOCK_META_LOAD_DOCUMENT) === true,
      });
      if (denied.length > 0) {
        if (options.onDenied) {
          options.onDenied(denied, tr);
        } else {
          console.warn(`BeakBlock QMS: a change was rejected. ${describeDenials(denied)}`);
        }
        return false;
      }
      const guardFilter = guard?.spec.filterTransaction;
      return guardFilter ? guardFilter.call(guard.spec, tr, state) : true;
    },
    props: {
      decorations(state) {
        if (!options.getPolicyContext) return null;
        const ctx = options.getPolicyContext(state);
        const decorations: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (node.type.name !== CONTROLLED_SECTION_TYPE) return true;
          const sid = typeof node.attrs.sectionId === 'string' ? node.attrs.sectionId : '';
          const editable = sid !== '' && canEditControlledSection(ctx, sid);
          decorations.push(
            Decoration.node(
              pos,
              pos + node.nodeSize,
              editable
                ? { 'data-editable': 'true' }
                : { 'data-editable': 'false', contenteditable: 'false' }
            )
          );
          return true;
        });
        return decorations.length > 0 ? DecorationSet.create(state.doc, decorations) : null;
      },
    },
  });
}
