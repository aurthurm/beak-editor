/**
 * Equipment reference types and inline node view.
 *
 * Equipment is resolved through an {@link EquipmentProvider} supplied by the host
 * (typically a LIMS adapter). The node view shows the code and name, and updates
 * the status once the provider resolves the reference.
 *
 * @module
 */

import type { Node as PMNode } from 'prosemirror-model';
import type { ValidationIssue } from '@amusendame/beakblock-core';
import type { NodeView } from 'prosemirror-view';

/** An authorised piece of equipment as reported by the provider. */
export interface EquipmentRecord {
  id: string;
  code: string;
  name: string;
  /** Usually `'active'`; anything else is flagged by validation. */
  status: string;
}

/** Host-supplied source of authorised equipment. */
export interface EquipmentProvider {
  /** Searches equipment by free text (code or name). */
  search(query: string): Promise<EquipmentRecord[]>;
  /** Returns the record for an id, or `null` when it is unknown or not authorised. */
  get(id: string): Promise<EquipmentRecord | null>;
}

/**
 * Cache of provider lookups, shared by node views and validation.
 * `null` means the provider reported the id as unknown.
 */
export type EquipmentCache = Map<string, EquipmentRecord | null>;

/**
 * Inline atom node view for `equipmentReference`.
 *
 * Shows `code name`, marks inactive or unknown equipment with a data attribute,
 * and resolves the reference through the provider when one is configured.
 */
export class EquipmentReferenceView implements NodeView {
  dom: HTMLElement;
  private destroyed = false;
  private node: PMNode;

  constructor(
    node: PMNode,
    private readonly provider: EquipmentProvider | undefined,
    private readonly cache: EquipmentCache
  ) {
    this.node = node;
    this.dom = document.createElement('span');
    this.dom.className = 'beakblock-equipment';
    this.dom.setAttribute('contenteditable', 'false');
    this.render();
    this.resolve();
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'equipmentReference') return false;
    this.node = node;
    this.render();
    return true;
  }

  stopEvent(): boolean {
    return false;
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.destroyed = true;
  }

  /** Renders from the provider record when resolved, otherwise from the node attrs. */
  private render(): void {
    const attrs = this.node.attrs as Record<string, unknown>;
    const id = typeof attrs.equipmentId === 'string' ? attrs.equipmentId : '';
    const record = id !== '' ? this.cache.get(id) : undefined;
    const code = record ? record.code : attrs.code;
    const name = record ? record.name : attrs.name;
    const status = record === null ? 'unknown' : record ? record.status : String(attrs.status ?? '');
    this.dom.setAttribute('data-equipment-id', id);
    this.dom.setAttribute('data-status', status);
    this.dom.classList.toggle('beakblock-equipment--inactive', status !== '' && status !== 'active');
    const label = [code, name].filter((part) => part !== null && part !== undefined && part !== '').join(' ');
    this.dom.textContent = label || id || 'Equipment';
  }

  private resolve(): void {
    const id = this.node.attrs.equipmentId;
    if (!this.provider || typeof id !== 'string' || id === '' || this.cache.has(id)) return;
    this.provider
      .get(id)
      .then((record) => {
        this.cache.set(id, record);
        if (!this.destroyed) this.render();
      })
      .catch(() => {
        this.cache.set(id, null);
        if (!this.destroyed) this.render();
      });
  }
}

/**
 * Validation findings for one equipment reference, using the lookup cache.
 *
 * - `null` in the cache (unknown or unauthorised): warning `equipment-not-authorised`
 * - status other than `active`: warning `equipment-inactive`
 * - not yet resolved: info `equipment-unverified`
 *
 * @param attrs - `equipmentReference` attrs
 * @param cache - Provider lookup cache
 * @param path - Location reported on each issue
 */
export function equipmentIssues(
  attrs: Record<string, unknown>,
  cache: EquipmentCache,
  path?: string
): ValidationIssue[] {
  const id = typeof attrs.equipmentId === 'string' ? attrs.equipmentId : '';
  const label = String(attrs.code || attrs.name || id || 'equipment');
  const make = (severity: ValidationIssue['severity'], code: string, message: string): ValidationIssue => ({
    severity,
    code,
    message,
    ...(path ? { path } : {}),
  });
  if (id === '') {
    return [make('error', 'missing-equipment-id', 'Equipment reference has no equipment id')];
  }
  if (!cache.has(id)) {
    return [make('info', 'equipment-unverified', `Equipment "${label}" has not been verified against the provider`)];
  }
  const record = cache.get(id);
  if (!record) {
    return [make('warning', 'equipment-not-authorised', `Equipment "${label}" is not in the authorised equipment list`)];
  }
  if (record.status !== 'active') {
    return [make('warning', 'equipment-inactive', `Equipment "${label}" has status "${record.status}"`)];
  }
  return [];
}

/**
 * Resolves every equipment reference in a ProseMirror document through the
 * provider and returns the findings. Inline nodes are not visible to the block
 * registry, so hosts call this with `editor.pm.doc`.
 *
 * @param doc - Document to scan
 * @param provider - Equipment provider
 * @param cache - Cache to fill (a new one is used when omitted)
 */
export async function validateEquipmentReferences(
  doc: PMNode,
  provider: EquipmentProvider,
  cache: EquipmentCache = new Map()
): Promise<ValidationIssue[]> {
  const refs: Array<{ id: string; pos: number; attrs: Record<string, unknown> }> = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'equipmentReference') {
      refs.push({ id: String(node.attrs.equipmentId ?? ''), pos, attrs: node.attrs as Record<string, unknown> });
    }
    return true;
  });
  const unique = [...new Set(refs.map((ref) => ref.id).filter((id) => id !== ''))];
  await Promise.all(
    unique.map(async (id) => {
      if (cache.has(id)) return;
      try {
        cache.set(id, await provider.get(id));
      } catch {
        cache.set(id, null);
      }
    })
  );
  return refs.flatMap((ref) => equipmentIssues(ref.attrs, cache, `pos:${ref.pos}`));
}
