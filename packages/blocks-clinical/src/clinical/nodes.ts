/**
 * Node specifications for clinical and lab blocks.
 *
 * Semantics live in the node type and its validation, not in the rendering: a
 * `sopStep` renders as a plain numbered paragraph, a `safetyWarning` as a
 * lightly boxed paragraph. Lab-specific rules live in this package, not in core.
 *
 * `sopStep` and `safetyWarning` hold block content (paragraphs and nested blocks).
 *
 * @module
 */

import type { DOMOutputSpec, NodeSpec, Node as PMNode } from 'prosemirror-model';
import { attrsToDataAttr, labelledRowsDom, readDataAttrs } from '../dom';
import { DEFAULT_REAGENT_COLUMNS } from './constants';

// Register the inline atom so `InlineContent` narrows on `type === 'equipmentReference'`.
declare module '@amusendame/beakblock-core' {
  interface CustomInlineContentRegistry {
    equipmentReference: {
      props: {
        id?: string | null;
        equipmentId?: string | null;
        code?: string | null;
        name?: string | null;
        status?: string | null;
      };
    };
  }
}

const toNumberOrNull = (value: string | null): number | null => {
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * `sopStep`: one instruction in a standard operating procedure.
 *
 * Attrs: `stepNumber` (set by the step numbering plugin), `critical`, `timeMinutes`.
 */
export const sopStepNode: NodeSpec = {
  group: 'block',
  content: 'block+',
  defining: true,
  attrs: {
    id: { default: null },
    stepNumber: { default: null },
    critical: { default: false },
    timeMinutes: { default: null },
  },
  parseDOM: [
    {
      tag: 'div[data-sop-step]',
      getAttrs(dom: HTMLElement) {
        return {
          id: dom.getAttribute('data-block-id'),
          stepNumber: toNumberOrNull(dom.getAttribute('data-step-number')),
          critical: dom.getAttribute('data-critical') === 'true',
          timeMinutes: toNumberOrNull(dom.getAttribute('data-time-minutes')),
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const { id, stepNumber, critical, timeMinutes } = node.attrs;
    const attrs: Record<string, string> = {
      class: critical ? 'beakblock-sop-step beakblock-sop-step--critical' : 'beakblock-sop-step',
      'data-sop-step': '',
      'data-critical': String(critical === true),
    };
    if (id) attrs['data-block-id'] = String(id);
    if (stepNumber !== null && stepNumber !== undefined) attrs['data-step-number'] = String(stepNumber);
    if (timeMinutes !== null && timeMinutes !== undefined) attrs['data-time-minutes'] = String(timeMinutes);
    return ['div', attrs, 0];
  },
};

/**
 * `safetyWarning`: a caution, warning or danger note with GHS hazard codes and PPE.
 */
export const safetyWarningNode: NodeSpec = {
  group: 'block',
  content: 'block+',
  defining: true,
  attrs: {
    id: { default: null },
    level: { default: 'caution' },
    hazardCodes: { default: [] },
    ppe: { default: [] },
  },
  parseDOM: [
    {
      tag: 'div[data-safety-level]',
      getAttrs: readDataAttrs('data-attrs'),
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const { id, level, hazardCodes, ppe } = node.attrs as Record<string, unknown>;
    const attrs: Record<string, string> = {
      class: `beakblock-safety beakblock-safety--${String(level)}`,
      'data-safety-level': String(level),
      'data-attrs': attrsToDataAttr({ id, level, hazardCodes, ppe }),
      'data-hazards': Array.isArray(hazardCodes) ? hazardCodes.join(' ') : '',
    };
    if (id) attrs['data-block-id'] = String(id);
    return ['div', attrs, 0];
  },
};

/**
 * `reagentTable`: a wrapper whose content is a single `table`. The table renders
 * through the core table renderer; this node validates its columns and cells.
 */
export const reagentTableNode: NodeSpec = {
  group: 'block',
  content: 'table',
  defining: true,
  isolating: true,
  attrs: {
    id: { default: null },
    requiredColumns: { default: [...DEFAULT_REAGENT_COLUMNS] },
  },
  parseDOM: [
    {
      tag: 'div[data-reagent-table]',
      getAttrs(dom: HTMLElement) {
        let requiredColumns: unknown = [...DEFAULT_REAGENT_COLUMNS];
        try {
          requiredColumns = JSON.parse(dom.getAttribute('data-required-columns') ?? 'null') ?? requiredColumns;
        } catch {
          requiredColumns = [...DEFAULT_REAGENT_COLUMNS];
        }
        return { id: dom.getAttribute('data-block-id'), requiredColumns };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const { id, requiredColumns } = node.attrs;
    const attrs: Record<string, string> = {
      class: 'beakblock-reagent-table',
      'data-reagent-table': '',
      'data-required-columns': JSON.stringify(requiredColumns ?? []),
    };
    if (id) attrs['data-block-id'] = String(id);
    return ['div', attrs, 0];
  },
};

/** `testMethodSpec`: an analytical method reference (atom). */
export const testMethodSpecNode: NodeSpec = {
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    id: { default: null },
    methodCode: { default: null },
    version: { default: null },
    analyte: { default: null },
    principle: { default: null },
  },
  parseDOM: [{ tag: 'div.beakblock-test-method', getAttrs: readDataAttrs('data-attrs') }],
  toDOM(node: PMNode): DOMOutputSpec {
    return labelledRowsDom(node, 'beakblock-test-method', [
      ['Method', node.attrs.methodCode],
      ['Version', node.attrs.version],
      ['Analyte', node.attrs.analyte],
      ['Principle', node.attrs.principle],
    ]);
  },
};

/** `specimenRequirements`: collection, volume, stability and rejection criteria (atom). */
export const specimenRequirementsNode: NodeSpec = {
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    id: { default: null },
    specimenType: { default: null },
    container: { default: null },
    volumeMl: { default: null },
    minVolumeMl: { default: null },
    stability: { default: null },
    rejectionCriteria: { default: [] },
  },
  parseDOM: [{ tag: 'div.beakblock-specimen-requirements', getAttrs: readDataAttrs('data-attrs') }],
  toDOM(node: PMNode): DOMOutputSpec {
    const a = node.attrs;
    return labelledRowsDom(node, 'beakblock-specimen-requirements', [
      ['Specimen', a.specimenType],
      ['Container', a.container],
      ['Volume (mL)', a.volumeMl],
      ['Minimum volume (mL)', a.minVolumeMl],
      ['Stability', a.stability],
      ['Rejection criteria', a.rejectionCriteria],
    ]);
  },
};

/** `qcCriteria`: quality control target, standard deviation and Westgard rules (atom). */
export const qcCriteriaNode: NodeSpec = {
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    id: { default: null },
    analyte: { default: null },
    level: { default: null },
    target: { default: null },
    sd: { default: null },
    westgardRules: { default: [] },
  },
  parseDOM: [{ tag: 'div.beakblock-qc-criteria', getAttrs: readDataAttrs('data-attrs') }],
  toDOM(node: PMNode): DOMOutputSpec {
    const a = node.attrs;
    return labelledRowsDom(node, 'beakblock-qc-criteria', [
      ['Analyte', a.analyte],
      ['QC level', a.level],
      ['Target', a.target],
      ['SD', a.sd],
      ['Westgard rules', a.westgardRules],
    ]);
  },
};

/**
 * `equipmentReference`: an inline atom pointing at authorised equipment.
 * Resolved through the equipment provider in the node view.
 */
export const equipmentReferenceNode: NodeSpec = {
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  draggable: false,
  attrs: {
    id: { default: null },
    equipmentId: { default: null },
    code: { default: null },
    name: { default: null },
    status: { default: null },
  },
  parseDOM: [
    {
      tag: 'span[data-equipment-id]',
      getAttrs(dom: HTMLElement) {
        return {
          id: dom.getAttribute('data-block-id'),
          equipmentId: dom.getAttribute('data-equipment-id'),
          code: dom.getAttribute('data-code'),
          name: dom.getAttribute('data-name'),
          status: dom.getAttribute('data-status'),
        };
      },
    },
  ],
  toDOM(node: PMNode): DOMOutputSpec {
    const { id, equipmentId, code, name, status } = node.attrs;
    const attrs: Record<string, string> = {
      class: 'beakblock-equipment',
      contenteditable: 'false',
      'data-equipment-id': String(equipmentId ?? ''),
    };
    if (id) attrs['data-block-id'] = String(id);
    if (code) attrs['data-code'] = String(code);
    if (name) attrs['data-name'] = String(name);
    if (status) attrs['data-status'] = String(status);
    return ['span', attrs, [code, name].filter(Boolean).join(' ') || String(equipmentId ?? '')];
  },
};

/** All clinical node specs, keyed by node type name. */
export const CLINICAL_NODES: Record<string, NodeSpec> = {
  sopStep: sopStepNode,
  safetyWarning: safetyWarningNode,
  reagentTable: reagentTableNode,
  testMethodSpec: testMethodSpecNode,
  specimenRequirements: specimenRequirementsNode,
  qcCriteria: qcCriteriaNode,
  equipmentReference: equipmentReferenceNode,
};
