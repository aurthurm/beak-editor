"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { BeakBlockView, OfficeShell, useBeakBlock } from '@amusendame/beakblock-react';
import type { BeakBlockEditor, Block } from '@amusendame/beakblock-core';
import { documentToIR } from '@amusendame/beakblock-ir';
import type { IRDocument } from '@amusendame/beakblock-ir';
import {
  createDomMeasurer,
  createPaginationPlugin,
  layoutDocument,
  renderPrintHTML,
  type LayoutResult,
} from '@amusendame/beakblock-layout';
import { buildOfficeSopDocument, officeSopEditorBlocks } from './demoData';
import { Badge, Notice, Panel, ScenarioIntro, useEditorTick } from './common';

type LayoutState = { ir: IRDocument; result: LayoutResult };

function topLevelBlockId(editor: BeakBlockEditor | null): string | null {
  if (!editor || editor.isDestroyed) return null;
  const blocks = editor.getSelectedBlocks();
  return blocks[0]?.id ?? null;
}

function pageOfBlock(layout: LayoutResult | null, blockId: string | null): number {
  if (!layout || !blockId) return 1;
  for (const page of layout.pages) {
    if (page.body.some((fragment) => fragment.sourceBlockId === blockId)) return page.number;
  }
  return 1;
}

/** Print Preview renders the layout engine's print HTML in a sandboxed frame with no scripts. */
function PrintPreviewFrame({ html }: { html: string }) {
  return (
    <iframe
      title="Print preview"
      className="v2-print-frame"
      srcDoc={html}
      sandbox=""
    />
  );
}

export function OfficeSopScenario(): ReactElement {
  const [initialBlocks] = useState<Block[]>(() => officeSopEditorBlocks());
  const [layoutState, setLayoutState] = useState<LayoutState | null>(null);
  const layoutRef = useRef<LayoutResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const getLayout = useCallback(() => layoutRef.current, []);
  // The pagination plugin calls this getter during its own updates, not during render.
  // eslint-disable-next-line react-hooks/refs
  const pagination = useMemo(() => createPaginationPlugin({ getLayout, showHeaders: true }), [getLayout]);

  const editor = useBeakBlock({
    mode: 'office',
    wordBehaviour: true,
    initialContent: initialBlocks,
    prosemirror: { plugins: [pagination] },
  });

  const recompute = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const doc = buildOfficeSopDocument(editor.getDocument());
    const ir = documentToIR(doc);
    const result = layoutDocument(ir, { measurer: createDomMeasurer() });
    layoutRef.current = result;
    setLayoutState({ ir, result });
  }, [editor]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    // Initial layout is computed from the external ProseMirror editor once it exists.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recompute();
    const off = editor.on('transaction', (event) => {
      const tr = (event as { transaction?: { docChanged?: boolean } }).transaction;
      if (!tr?.docChanged) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(recompute, 180);
    });
    return () => {
      off();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [editor, recompute]);

  const tick = useEditorTick(editor);
  const layout = layoutState?.result ?? null;
  const topBlock = useMemo(() => topLevelBlockId(editor), [editor, tick]);
  const currentPage = pageOfBlock(layout, topBlock);
  const pageCount = layout?.pageCount ?? 1;

  const printHtml = useMemo(() => {
    if (!layoutState) return '';
    return renderPrintHTML(layoutState.ir, layoutState.result, { title: 'Gram stain procedure SOP-0042' });
  }, [layoutState]);

  const pages = useMemo(
    () => (layout ? layout.pages.map((page) => ({ number: page.number, label: `Page ${page.number}` })) : []),
    [layout]
  );

  const firstPageHeader = layout?.pages[Math.max(0, currentPage - 1)]?.headerText.join(' · ') ?? '';
  const firstPageFooter = layout?.pages[Math.max(0, currentPage - 1)]?.footerText.join(' · ') ?? '';
  const fieldEntries = layout ? Object.entries(layout.fieldValues).slice(0, 6) : [];

  return (
    <div className="v2-scenario">
      <ScenarioIntro
        kicker="BeakBlock 2.0 · Office mode"
        title="Office mode: a Word-style SOP"
        capability="Office shell (ribbon, rulers, styles, navigation, find and replace, status bar) over one document, with layout-driven pages and print preview."
      >
        <p>
          The same SOP is edited in Office mode with Word keyboard behaviour. Headings use multilevel numbering, the
          header and footer carry DOCPROPERTY and PAGE fields, the table has merged cells, and the appendix is a
          landscape section.
        </p>
      </ScenarioIntro>

      <Notice tone="info">
        <strong>Try:</strong> Ctrl+Enter inserts a page break · Ctrl+Alt+1 applies Heading 1 · Tab in the last table
        cell adds a row · type &quot;quotes&quot; to get smart quotes · Ctrl+H opens find and replace (regex is supported).
      </Notice>

      <div className="v2-office-grid">
        <div className="v2-office-editor">
          <OfficeShell
            editor={editor}
            mode="office"
            pages={pages}
            pageInfo={{ page: currentPage, total: pageCount }}
            language="English (South Africa)"
            renderPrintPreview={printHtml ? () => <PrintPreviewFrame html={printHtml} /> : undefined}
          >
            <BeakBlockView editor={editor} className="editor-view v2-office-view" />
          </OfficeShell>
        </div>

        <aside className="v2-office-side">
          <Panel title="Pagination" right={<Badge tone="info">{pageCount} pages</Badge>}>
            <dl className="v2-dl">
              <dt>Sections</dt>
              <dd>{layout?.sections.length ?? 1}</dd>
              <dt>Current page</dt>
              <dd>
                {currentPage} of {pageCount}
              </dd>
              <dt>Header</dt>
              <dd>{firstPageHeader || '—'}</dd>
              <dt>Footer</dt>
              <dd>{firstPageFooter || '—'}</dd>
            </dl>
            <p className="v2-muted">Page numbers come from the layout engine. Break positions are shown in Print Layout.</p>
          </Panel>

          <Panel title="Resolved fields" right={<Badge tone="ok">live</Badge>}>
            {fieldEntries.length === 0 ? (
              <p className="v2-muted">Fields resolve after layout.</p>
            ) : (
              <ul className="v2-list">
                {fieldEntries.map(([key, value]) => (
                  <li key={key}>
                    <code>{key}</code> <span>{value}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Contents (from headings)">
            <ol className="v2-toc">
              {(layout?.toc ?? []).map((entry) => (
                <li key={`${entry.blockId}-${entry.text}`} style={{ paddingLeft: (entry.level - 1) * 12 }}>
                  <span>{entry.text}</span>
                  <span className="v2-toc__page">{entry.page}</span>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="What this shows">
            <ul className="v2-list">
              <li>Styles from a paragraph style sheet, not inline formatting</li>
              <li>Heading numbering continues across sections (1, 1.1, 1.2 …)</li>
              <li>Print Preview uses the same layout and print HTML as the server rendition</li>
              <li>Pagination is a decoration, so the document JSON stays unchanged</li>
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
