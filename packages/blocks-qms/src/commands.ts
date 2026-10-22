/**
 * QMS command definitions.
 *
 * These match the shape of `CommandDefinition` in `@amusendame/beakblock-commands`, but are
 * declared locally so this package does not depend on the commands package. Register them with
 * `registry.register(createQmsCommands())`.
 *
 * `qms.submitSection` only requests a workflow transition. The QMS service performs and
 * verifies the transition, so the local change is a UX step.
 *
 * @module
 */

import type { EditorState, Transaction } from 'prosemirror-state';
import type { Node as PMNode, NodeType } from 'prosemirror-model';
import type { OperationKind } from '@amusendame/beakblock-permissions';

import { CONTROLLED_SECTION_TYPE, NOTICE_KINDS, QMS_WORKFLOW_META } from './types';
import type { NoticeKind, RevisionHistoryEntry, SignatureMeaning, WorkflowState } from './types';

/** The part of the editor a QMS command needs. Matches `BeakBlockEditor.pm`. */
export interface QmsCommandEditor {
  readonly pm: {
    readonly state: EditorState;
    dispatch(tr: Transaction): void;
  };
}

/** Context passed to a QMS command. */
export interface QmsCommandContext {
  editor: QmsCommandEditor;
  args?: unknown;
}

/** Command definition compatible with the commands registry. */
export interface QmsCommandDefinition {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  group: string;
  /** Operation kind for policy checks. */
  operation?: OperationKind;
  isEnabled?(ctx: QmsCommandContext): boolean;
  isActive?(ctx: QmsCommandContext): boolean;
  run(ctx: QmsCommandContext): boolean;
  repeatable?: boolean;
}

/** Arguments of `qms.insertSection`. */
export interface InsertSectionArgs {
  sectionId?: string;
  title?: string;
  templateSectionId?: string | null;
  required?: boolean;
  allowedBlocks?: string[] | null;
  ownerName?: string | null;
}

/** Arguments of `qms.insertSignature`. */
export interface InsertSignatureArgs {
  role?: string;
  meaning?: SignatureMeaning;
}

/** Arguments of `qms.insertNotice`. */
export interface InsertNoticeArgs {
  kind?: NoticeKind;
  copyNumber?: number | null;
}

/** Arguments of `qms.insertRevisionHistory`. */
export interface InsertRevisionHistoryArgs {
  entries?: RevisionHistoryEntry[];
}

const GROUP = 'QMS';

let counter = 0;

/** Local id generator for new blocks. Ids are replaced by the core id plugin when needed. */
export function newQmsId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** The nearest controlled section around a document position, with its position. */
export function findControlledSection(
  state: EditorState,
  pos: number = state.selection.from
): { node: PMNode; pos: number } | null {
  const $pos = state.doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === CONTROLLED_SECTION_TYPE) {
      return { node, pos: $pos.before(depth) };
    }
  }
  return null;
}

function insertNode(tr: Transaction, node: PMNode): Transaction {
  tr.replaceSelectionWith(node).scrollIntoView();
  return tr;
}

function args<T>(ctx: QmsCommandContext): T {
  return (ctx.args ?? {}) as T;
}

function nodeType(state: EditorState, name: string): NodeType | null {
  return state.schema.nodes[name] ?? null;
}

/** Changes the attributes of the section containing the selection. */
function updateSection(
  ctx: QmsCommandContext,
  change: (attrs: Record<string, unknown>) => Record<string, unknown> | null,
  meta?: Record<string, unknown>
): boolean {
  const { state } = ctx.editor.pm;
  const found = findControlledSection(state);
  if (!found) return false;
  const next = change({ ...found.node.attrs });
  if (!next) return false;
  const tr = state.tr.setNodeMarkup(found.pos, undefined, next);
  for (const [key, value] of Object.entries(meta ?? {})) tr.setMeta(key, value);
  ctx.editor.pm.dispatch(tr.scrollIntoView());
  return true;
}

/** Commands in the QMS group. */
export function createQmsCommands(): QmsCommandDefinition[] {
  return [
    {
      id: 'qms.insertSection',
      label: 'Controlled section',
      description: 'Insert a controlled section at the cursor',
      group: GROUP,
      operation: 'insertBlock',
      isEnabled: (ctx) => nodeType(ctx.editor.pm.state, CONTROLLED_SECTION_TYPE) !== null,
      run(ctx) {
        const { state } = ctx.editor.pm;
        const type = nodeType(state, CONTROLLED_SECTION_TYPE);
        const paragraph = state.schema.nodes.paragraph;
        if (!type || !paragraph) return false;
        const a = args<InsertSectionArgs>(ctx);
        const node = type.create(
          {
            id: newQmsId('blk'),
            sectionId: a.sectionId ?? newQmsId('sec'),
            templateSectionId: a.templateSectionId ?? null,
            policyRef: null,
            required: a.required ?? false,
            allowedBlocks: a.allowedBlocks ?? null,
            title: a.title ?? 'New section',
            ownerName: a.ownerName ?? null,
            workflowState: 'draft',
            locked: false,
          },
          [paragraph.create({ id: newQmsId('blk') })]
        );
        ctx.editor.pm.dispatch(insertNode(state.tr, node));
        return true;
      },
    },
    {
      id: 'qms.submitSection',
      label: 'Submit section',
      description: 'Request submission of the current section for review',
      group: GROUP,
      operation: 'editAttrs',
      isEnabled: (ctx) => {
        const found = findControlledSection(ctx.editor.pm.state);
        return found !== null && ['draft', 'reopened'].includes(String(found.node.attrs.workflowState));
      },
      run: (ctx) =>
        updateSection(
          ctx,
          (attrs) => {
            if (!['draft', 'reopened'].includes(String(attrs.workflowState))) return null;
            return { ...attrs, workflowState: 'submitted' as WorkflowState };
          },
          { [QMS_WORKFLOW_META]: true }
        ),
    },
    {
      id: 'qms.lockSection',
      label: 'Lock section',
      description: 'Toggle the presentation lock on the current section (UX only)',
      group: GROUP,
      operation: 'editAttrs',
      isEnabled: (ctx) => findControlledSection(ctx.editor.pm.state) !== null,
      isActive: (ctx) => Boolean(findControlledSection(ctx.editor.pm.state)?.node.attrs.locked),
      run: (ctx) => updateSection(ctx, (attrs) => ({ ...attrs, locked: !attrs.locked })),
    },
    {
      id: 'qms.insertSignature',
      label: 'Signature block',
      description: 'Insert an unsigned signature placeholder (the signature service signs it)',
      group: GROUP,
      operation: 'insertBlock',
      run(ctx) {
        const { state } = ctx.editor.pm;
        const type = nodeType(state, 'signatureBlock');
        if (!type) return false;
        const a = args<InsertSignatureArgs>(ctx);
        const node = type.create({
          id: newQmsId('blk'),
          role: a.role ?? 'Author',
          signerName: null,
          signedAt: null,
          meaning: a.meaning ?? 'authored',
          contentHash: null,
          signatureId: null,
        });
        ctx.editor.pm.dispatch(insertNode(state.tr, node));
        return true;
      },
    },
    {
      id: 'qms.insertNotice',
      label: 'Controlled notice',
      description: 'Insert a controlled, uncontrolled or draft notice',
      group: GROUP,
      operation: 'insertBlock',
      run(ctx) {
        const { state } = ctx.editor.pm;
        const type = nodeType(state, 'controlledNotice');
        if (!type) return false;
        const a = args<InsertNoticeArgs>(ctx);
        const kind = a.kind ?? 'uncontrolledWhenPrinted';
        if (!(NOTICE_KINDS as readonly string[]).includes(kind)) return false;
        const node = type.create({
          id: newQmsId('blk'),
          kind,
          copyNumber: kind === 'controlledCopy' ? (a.copyNumber ?? 1) : null,
        });
        ctx.editor.pm.dispatch(insertNode(state.tr, node));
        return true;
      },
    },
    {
      id: 'qms.insertRevisionHistory',
      label: 'Revision history',
      description: 'Insert a revision history table',
      group: GROUP,
      operation: 'insertBlock',
      run(ctx) {
        const { state } = ctx.editor.pm;
        const type = nodeType(state, 'revisionHistory');
        if (!type) return false;
        const a = args<InsertRevisionHistoryArgs>(ctx);
        const node = type.create({ id: newQmsId('blk'), entries: a.entries ?? [] });
        ctx.editor.pm.dispatch(insertNode(state.tr, node));
        return true;
      },
    },
  ];
}
