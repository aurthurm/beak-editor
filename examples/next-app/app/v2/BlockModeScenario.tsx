"use client";

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { BeakBlockView, BubbleMenu, OfficeShell, SlashMenu, TableHandles, TableMenu, useBeakBlock } from '@amusendame/beakblock-react';
import type { EditorMode } from '@amusendame/beakblock-core';
import { contentHash } from '@amusendame/beakblock-templates';
import { officeSopEditorBlocks } from './demoData';
import { Badge, Notice, Panel, ScenarioIntro, useEditorTick } from './common';

type Projection = 'office' | 'block' | 'controlled';

const PROJECTIONS: Array<{ id: Projection; label: string; blurb: string }> = [
  { id: 'office', label: 'Office', blurb: 'Ribbon, rulers, Word keys. Block chrome is hidden.' },
  { id: 'block', label: 'Block', blurb: 'Slash menu, drag handles, bubble menu. Ribbon hidden.' },
  { id: 'controlled', label: 'Controlled', blurb: 'Office look with governance. Section locks apply.' },
];

const ROWS: Array<{ aspect: string; office: string; block: string; controlled: string }> = [
  { aspect: 'Document model', office: 'Same blocks', block: 'Same blocks', controlled: 'Same blocks' },
  { aspect: 'Slash menu', office: 'Hidden', block: 'Shown on "/"', controlled: 'Hidden' },
  { aspect: 'Drag handles', office: 'Hidden', block: 'Shown', controlled: 'Hidden' },
  { aspect: 'Ribbon and rulers', office: 'Shown', block: 'Hidden', controlled: 'Shown' },
  { aspect: 'Word keyboard', office: 'On', block: 'Off', controlled: 'On' },
  { aspect: 'Section locks', office: 'Not applicable', block: 'Not applicable', controlled: 'Enforced by the guard' },
];

export function BlockModeScenario(): ReactElement {
  const [projection, setProjection] = useState<Projection>('office');
  const [initial] = useState(() => officeSopEditorBlocks());
  const editor = useBeakBlock({ mode: 'office', wordBehaviour: true, initialContent: initial });
  const tick = useEditorTick(editor);
  const [hash, setHash] = useState<string>('');
  const [modeLog, setModeLog] = useState<string[]>([]);

  // The editor is one object for all projections. Switching changes presentation, not content.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const next = projection as EditorMode;
    if (editor.getMode() !== next) {
      editor.setMode(next);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- logs the mode change applied to the external editor
      setModeLog((log) => [...log.slice(-4), `${new Date().toLocaleTimeString()} → ${projection}`]);
    }
  }, [editor, projection]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    let cancelled = false;
    contentHash(editor.getDocument()).then((value) => {
      if (!cancelled) setHash(value.slice(0, 16));
    });
    return () => {
      cancelled = true;
    };
  }, [editor, tick]);

  const blockCount = useMemo(() => (editor && !editor.isDestroyed ? editor.getDocument().length : 0), [editor, tick]);
  const activeMode = editor && !editor.isDestroyed ? editor.getMode() : projection;

  return (
    <div className="v2-scenario">
      <ScenarioIntro
        kicker="BeakBlock 2.0 · Three projections"
        title="One document, three projections"
        capability="One editor and one document model shown as Office, Block and Controlled. Switching changes presentation and behaviour, not content."
      >
        <p>
          Switch the projection in the toolbar. The content hash in the panel does not change, because the document
          was never copied. Edit in Office mode, then switch to Block mode to use the slash menu on the same content.
        </p>
      </ScenarioIntro>

      <div className="v2-segment" role="tablist" aria-label="Projection">
        {PROJECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={projection === item.id}
            className={`v2-segment__btn ${projection === item.id ? 'is-active' : ''}`}
            onClick={() => setProjection(item.id)}
          >
            {item.label}
          </button>
        ))}
        <span className="v2-muted">{PROJECTIONS.find((p) => p.id === projection)?.blurb}</span>
      </div>

      <div className="v2-proj-grid">
        <div className="v2-proj-editor">
          <OfficeShell
            editor={editor}
            mode={projection === 'block' ? 'block' : projection}
            showRibbon={projection !== 'block'}
            rulers={projection !== 'block'}
            navigation={projection !== 'block'}
            statusBar={projection !== 'block'}
          >
            <BeakBlockView editor={editor} className="editor-view v2-office-view" />
            {projection === 'block' ? (
              <>
                <SlashMenu editor={editor} onAI={() => {}} />
                <BubbleMenu editor={editor} onComment={() => {}} onAI={() => {}} />
                <TableMenu editor={editor} />
                <TableHandles editor={editor} />
              </>
            ) : null}
          </OfficeShell>
        </div>

        <aside className="v2-proj-side">
          <Panel title="Document identity" right={<Badge tone="ok">same editor</Badge>}>
            <dl className="v2-dl">
              <dt>Active projection</dt>
              <dd>
                <Badge tone="info">{activeMode}</Badge>
              </dd>
              <dt>Top-level blocks</dt>
              <dd>{blockCount}</dd>
              <dt>Content hash</dt>
              <dd>
                <code>{hash || '…'}</code>
              </dd>
            </dl>
            <p className="v2-muted">
              The hash covers the document JSON only, so it stays the same across projections.
            </p>
          </Panel>

          <Panel title="Projection log">
            <ol className="v2-list">
              {modeLog.length === 0 ? <li className="v2-muted">Switch projections to see the log.</li> : null}
              {modeLog.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </Panel>

          <Panel title="What changes">
            <table className="v2-table v2-table--compact">
              <thead>
                <tr>
                  <th>Aspect</th>
                  <th>Office</th>
                  <th>Block</th>
                  <th>Controlled</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.aspect}>
                    <td>{row.aspect}</td>
                    <td>{row.office}</td>
                    <td>{row.block}</td>
                    <td>{row.controlled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Notice tone="info">
            Controlled sections are the subject of the next scenario. This document has none, so Controlled mode adds
            only the governance chrome here.
          </Notice>
        </aside>
      </div>
    </div>
  );
}
