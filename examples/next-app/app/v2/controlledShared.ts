/**
 * Shared, DOM-free definitions for the controlled-document vertical slice.
 *
 * Imported by the client scenario and by the server route (`app/api/v2/documents/route.ts`), so
 * everything here must run in both places. The demo identities and roles are for illustration only:
 * a real service resolves identity from its session and roles from its directory.
 */

import type { Block } from '@amusendame/beakblock-core';
import {
  addSection,
  createTemplate,
  type ReleaseManifest,
  type SectionAssignments,
  type SectionLifecycle,
  type SectionRevision,
  type TemplateDefinition,
  type TransitionAuditEvent,
} from '@amusendame/beakblock-templates';
import type { BeakDocument } from '@amusendame/beakblock-schema';

export const DEMO_USERS = [
  { id: 'qm', name: 'Maya (Quality Manager)', roles: ['qualityManager'] },
  { id: 'ann', name: 'Ann (Author A)', roles: ['author'] },
  { id: 'ben', name: 'Ben (Author B)', roles: ['author'] },
  { id: 'cy', name: 'Cy (Author C)', roles: ['author'] },
  { id: 'rita', name: 'Rita (Reviewer)', roles: ['reviewer'] },
  { id: 'ap', name: 'Apex (Approver)', roles: ['approver'] },
] as const;

export type DemoUserId = (typeof DEMO_USERS)[number]['id'];

export function demoUser(id: string): { id: string; name: string; roles: string[] } | null {
  const found = DEMO_USERS.find((u) => u.id === id);
  return found ? { id: found.id, name: found.name, roles: [...found.roles] } : null;
}

export const SECTION_ASSIGNMENTS: SectionAssignments = {
  purpose: { ownerId: 'ann', ownerName: 'Ann (Author A)' },
  scope: { ownerId: 'ben', ownerName: 'Ben (Author B)' },
  procedure: { ownerId: 'cy', ownerName: 'Cy (Author C)' },
  records: { ownerId: 'ben', ownerName: 'Ben (Author B)' },
};

export const TEMPLATE_ID = 'tpl-gram-stain-sop';
export const SECTION_TITLES: Record<string, string> = {
  purpose: 'Purpose',
  scope: 'Scope',
  procedure: 'Procedure',
  records: 'Records',
};

const text = (value: string) => [{ type: 'text' as const, text: value, styles: {} }];
const para = (id: string, value: string, props: Record<string, unknown> = {}): Block => ({
  id,
  type: 'paragraph',
  props,
  content: text(value),
});
const cell = (id: string, value: string): Block => ({ id, type: 'tableCell', props: {}, children: [para(`${id}-p`, value)] });
const row = (id: string, cells: Block[]): Block => ({ id, type: 'tableRow', props: {}, children: cells });

/**
 * Draft of the controlled SOP template: four sections (purpose boilerplate, scope, a formatted
 * procedure table and optional records). The Quality Manager publishes it on the server.
 */
export function buildSopTemplateDraft(): TemplateDefinition {
  let t = createTemplate({
    id: TEMPLATE_ID,
    title: 'Gram stain SOP',
    documentType: 'SOP',
    watermark: 'CONTROLLED COPY',
    properties: {
      docNumber: { generated: true, readOnly: true, required: true, pattern: '^SOP-\\d{4}$' },
      title: { required: true, maxLength: 120 },
      revision: { required: true, readOnly: true },
      effectiveDate: { source: 'workflow', readOnly: true },
    },
  });
  t = addSection(t, {
    templateSectionId: 'purpose',
    title: 'Purpose',
    required: true,
    allowedBlocks: ['paragraph'],
    lockedBoilerplate: [para('bp-1', 'This SOP describes the Gram stain procedure used on bacterial smears.')],
    placeholder: [para('ph-1', 'Describe the purpose.', { placeholder: true })],
  });
  t = addSection(t, {
    templateSectionId: 'scope',
    title: 'Scope',
    required: true,
    allowedBlocks: null,
    placeholder: [para('ph-2', 'Describe the scope.', { placeholder: true })],
  });
  t = addSection(t, {
    templateSectionId: 'procedure',
    title: 'Procedure',
    required: true,
    kind: 'procedure',
    allowedBlocks: ['paragraph', 'table', 'orderedList', 'heading'],
    placeholder: [
      {
        id: 'ph-table',
        type: 'table',
        props: { placeholder: true },
        children: [row('r1', [cell('c1', 'Step'), cell('c2', 'Action')]), row('r2', [cell('c3', 'TBD'), cell('c4', 'TBD')])],
      } as unknown as Block,
    ],
  });
  t = addSection(t, {
    templateSectionId: 'records',
    title: 'Records',
    required: false,
    placeholder: [para('ph-3', 'List the records.', { placeholder: true })],
  });
  return t;
}

/** Section lifecycle and audit state held for one controlled document. */
export interface ControlledDocumentView {
  documentId: string;
  docNumber: string;
  revision: string;
  hash: string;
  template: TemplateDefinition;
  assignments: SectionAssignments;
  /** Blocks of the single section that holds the controlled sections. */
  blocks: Block[];
  lifecycles: Record<string, SectionLifecycle>;
  audit: TransitionAuditEvent[];
  release: ReleaseRecord | null;
}

export interface ReleaseRecord {
  manifest: ReleaseManifest;
  document: BeakDocument;
  sectionRevisions: SectionRevision[];
  releasedAt: string;
}

export interface ServerError {
  error: string;
  code: string;
  violations?: Array<{ reason: string; sectionId?: string | null; kind?: string }>;
}

/** Document content hash for stale and replayed update detection, as sent by the client. */
export const USER_HEADER = 'x-beak-user';

export function sectionIdFor(blocks: Block[], templateSectionId: string): string | null {
  const found = blocks.find((b) => b.type === 'controlledSection' && b.props.templateSectionId === templateSectionId);
  return found ? (found.props.sectionId as string) : null;
}

/**
 * Builds the blocks the client sends: the server copy with only the caller's own sections replaced
 * by what the editor holds. Other sections are sent unchanged, so normalisation in the editor cannot
 * look like a change to someone else's content.
 */
export function mergeOwnSections(serverBlocks: Block[], editorBlocks: Block[], editableSectionIds: string[]): Block[] {
  const editable = new Set(editableSectionIds);
  const editorBySection = new Map<string, Block>();
  for (const block of editorBlocks) {
    if (block.type === 'controlledSection') editorBySection.set(block.props.sectionId as string, block);
  }
  return serverBlocks.map((block) => {
    if (block.type !== 'controlledSection') return block;
    const sid = block.props.sectionId as string;
    if (!editable.has(sid)) return block;
    const replacement = editorBySection.get(sid);
    if (!replacement) return block;
    // Workflow state is written by the server only.
    return { ...replacement, props: { ...replacement.props, workflowState: block.props.workflowState } };
  });
}

export function emptyDocumentProperties(docNumber: string, revision: string, title: string) {
  return { docNumber, revision, title, effectiveDate: '2026-11-01' };
}
