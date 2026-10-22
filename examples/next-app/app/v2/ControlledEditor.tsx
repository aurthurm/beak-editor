"use client";

import { useEffect, useMemo, type ReactElement } from 'react';
import { useLatestRef } from './common';
import { BeakBlockView, OfficeShell, useBeakBlock } from '@amusendame/beakblock-react';
import type { BeakBlockEditor, BeakExtension, Block } from '@amusendame/beakblock-core';
import { Decoration, DecorationSet, Plugin, PluginKey } from '@amusendame/beakblock-core';
import { qmsExtension } from '@amusendame/beakblock-blocks-qms';
import { createPermissionGuardPlugin, type PolicyContext, type PolicyDecision } from '@amusendame/beakblock-permissions';

/** Marks sections the current user cannot edit. Decorations only; the guard is the enforcement. */
export const READONLY_KEY = new PluginKey<DecorationSet>('v2-readonly-sections');

export function canEditSection(ctx: PolicyContext, sectionId: string): boolean {
  if ((ctx.lockedSections ?? []).includes(sectionId)) return false;
  return (ctx.sectionGrants[sectionId] ?? []).includes('section.editText');
}

function buildReadonlyDecorations(doc: Parameters<typeof DecorationSet.create>[0], ctx: PolicyContext): DecorationSet {
  const decorations: Decoration[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name !== 'controlledSection') return;
    const sectionId = String(node.attrs.sectionId ?? '');
    if (canEditSection(ctx, sectionId)) return;
    decorations.push(
      Decoration.node(offset, offset + node.nodeSize, {
        class: 'v2-section-readonly',
        'data-section-readonly': 'true',
      })
    );
  });
  return DecorationSet.create(doc, decorations);
}

function readonlyPlugin(getCtx: () => PolicyContext): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: READONLY_KEY,
    state: {
      init(_config, state) {
        return buildReadonlyDecorations(state.doc, getCtx());
      },
      apply(tr, value, _old, state) {
        if (tr.docChanged || tr.getMeta(READONLY_KEY)) return buildReadonlyDecorations(state.doc, getCtx());
        return value.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations(state) {
        return READONLY_KEY.getState(state);
      },
    },
  });
}

export interface ControlledEditorProps {
  /** Blocks at this document hash. The editor remounts when the hash changes. */
  blocks: Block[];
  /** Current principal and grants, read on every transaction. */
  getCtx: () => PolicyContext;
  /** Used to refresh decorations when the principal changes. */
  refreshKey: string;
  onDenied: (decisions: PolicyDecision[]) => void;
  onEditor: (editor: BeakBlockEditor | null) => void;
}

/**
 * Controlled-mode editor. Two layers enforce section ownership on the client: the QMS section plugin
 * and the permission guard. Both are UX. The server verifies every save again.
 */
export function ControlledEditor({ blocks, getCtx, refreshKey, onDenied, onEditor }: ControlledEditorProps): ReactElement {
  const ctxRef = useLatestRef(getCtx);
  const deniedRef = useLatestRef(onDenied);

  const extensions = useMemo<BeakExtension[]>(
    () => [
      // The getters are only invoked by the plugins on transactions, never while rendering.
      // eslint-disable-next-line react-hooks/refs
      qmsExtension({ getPolicyContext: () => ctxRef.current() }),
      {
        name: 'v2-section-guard',
        plugins: () => [
          createPermissionGuardPlugin({
            getContext: () => ctxRef.current(),
            onDenied: (decisions) => deniedRef.current(decisions),
          }),
          readonlyPlugin(() => ctxRef.current()),
        ],
      },
    ],
    []
  );

  const editor = useBeakBlock({
    mode: 'controlled',
    initialContent: blocks,
    extensions,
  });

  useEffect(() => {
    onEditor(editor);
    return () => onEditor(null);
  }, [editor, onEditor]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.pm.view.dispatch(editor.pm.state.tr.setMeta(READONLY_KEY, refreshKey));
  }, [editor, refreshKey]);

  return (
    <OfficeShell
      editor={editor}
      mode="controlled"
      showRibbon={false}
      navigation={false}
      rulers={false}
      statusBar={{ wordCount: undefined }}
    >
      <BeakBlockView editor={editor} className="editor-view v2-controlled-view" />
    </OfficeShell>
  );
}
