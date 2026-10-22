"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { BeakBlockView, OfficeShell, useBeakBlock } from '@amusendame/beakblock-react';
import type { BeakBlockEditor, Block } from '@amusendame/beakblock-core';
import { documentToIR, irToDocument, type IRDocument } from '@amusendame/beakblock-ir';
import { documentToBlocks, type BeakDocument } from '@amusendame/beakblock-schema';
import { DOCX_MIME, exportDocxWithReport } from '@amusendame/beakblock-export-docx';
import {
  detectHeadings,
  importDocxToDocument,
  ooxmlPassthroughExtension,
  type HeadingCandidate,
  type LossReport,
} from '@amusendame/beakblock-import-docx';
import { mapImportToTemplate, type SectionMappingSuggestion } from '@amusendame/beakblock-templates';
import { buildOfficeSopDocument, officeSopBlocks } from './demoData';
import { buildSopTemplateDraft } from './controlledShared';
import { Badge, downloadFile, errorText, Notice, Panel, ScenarioIntro, useFlash } from './common';

interface ImportResult {
  name: string;
  document: BeakDocument;
  ir: IRDocument;
  losses: LossReport[];
  headings: HeadingCandidate[];
  blocks: Block[];
}

interface RoundTrip {
  exportedBytes: number;
  exportLosses: number;
  reimportBlocks: number;
  originalBlocks: number;
  reimportLosses: number;
  reimportHeadings: number;
}

/** Mounted with a key per import, so each import starts from fresh editor content. */
function ImportEditor({ blocks, onEditor }: { blocks: Block[]; onEditor: (editor: BeakBlockEditor | null) => void }): ReactElement {
  const editor = useBeakBlock({
    mode: 'office',
    wordBehaviour: true,
    initialContent: blocks,
    extensions: [ooxmlPassthroughExtension()],
  });
  // The parent holds the editor for export.
  useEffect(() => {
    onEditor(editor);
    return () => onEditor(null);
  }, [editor, onEditor]);
  return (
    <OfficeShell editor={editor} mode="office" rulers={false} navigation={false} statusBar={false} showRibbon={false}>
      <BeakBlockView editor={editor} className="editor-view v2-office-view" />
    </OfficeShell>
  );
}

function LossBadge({ severity }: { severity: LossReport['severity'] }) {
  return <Badge tone={severity === 'error' ? 'bad' : severity === 'warning' ? 'warn' : 'info'}>{severity}</Badge>;
}

function withFieldCachedFallback(ir: IRDocument): IRDocument {
  const copy = structuredClone(ir);
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (record.type === 'field' && record.fallback === undefined && typeof record.cachedText === 'string') {
      record.fallback = record.cachedText;
    }
    Object.values(record).forEach(visit);
  };
  visit(copy);
  return copy;
}

export function DocxScenario(): ReactElement {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [editor, setEditor] = useState<BeakBlockEditor | null>(null);
  const [trip, setTrip] = useState<RoundTrip | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, showFlash] = useFlash(7000);
  const [mapping, setMapping] = useState<SectionMappingSuggestion[] | null>(null);
  const onEditor = useCallback((next: BeakBlockEditor | null) => setEditor(next), []);
  const template = useMemo(() => buildSopTemplateDraft(), []);

  /**
   * Workaround for a package gap: `irToDocument` copies only a field's `fallback`, but the DOCX importer stores the
   * cached result in `cachedText`. Without this, imported DOCPROPERTY/PAGE fields show their type name in the editor.
   * Remove once packages/ir/src/toDocument.ts falls back to `cachedText`.
   */
  const importBytes = async (bytes: Uint8Array, name: string) => {
    const { ir: importedIr, losses } = await importDocxToDocument(bytes);
    const ir = withFieldCachedFallback(importedIr);
    const document = irToDocument(ir);
    const blocks = documentToBlocks(document);
    const headings = detectHeadings(ir);
    setResult({ name, document, ir, losses, headings, blocks });
    setEpoch((value) => value + 1);
    setMapping(null);
    return { blocks, losses, headings };
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const imported = await importBytes(bytes, file.name);
      showFlash('ok', `Imported ${file.name}: ${imported.blocks.length} blocks, ${imported.losses.length} losses reported.`);
    } catch (error) {
      showFlash('bad', `That file could not be imported. ${errorText(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const generateSample = async () => {
    setBusy(true);
    try {
      const ir = documentToIR(buildOfficeSopDocument(officeSopBlocks()));
      const { bytes, report } = await exportDocxWithReport(ir);
      showFlash('info', `Generated a sample .docx (${bytes.byteLength} bytes, ${report.losses.length} export losses). Importing it now.`);
      const imported = await importBytes(bytes, 'sample-gram-stain-sop.docx');
      showFlash('ok', `Imported the sample: ${imported.blocks.length} blocks and ${imported.headings.length} headings detected.`);
    } catch (error) {
      showFlash('bad', errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const exportAndRoundTrip = async () => {
    if (!editor || editor.isDestroyed) return;
    setBusy(true);
    try {
      const blocks = editor.getDocument();
      const ir = documentToIR(buildOfficeSopDocument(blocks));
      const { bytes, report } = await exportDocxWithReport(ir);
      downloadFile('gram-stain-export.docx', bytes, DOCX_MIME);

      // Round-trip: read the exported file back and compare.
      const again = await importDocxToDocument(bytes);
      const reBlocks = documentToBlocks(again.document);
      const reHeadings = detectHeadings(again.ir);
      setTrip({
        exportedBytes: bytes.byteLength,
        exportLosses: report.losses.length,
        reimportBlocks: reBlocks.length,
        originalBlocks: blocks.length,
        reimportLosses: again.losses.length,
        reimportHeadings: reHeadings.length,
      });
      showFlash('ok', 'Exported and re-imported. The round-trip summary is below.');
    } catch (error) {
      showFlash('bad', errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const runMapping = () => {
    if (!result) return;
    const headings = result.headings.map((h) => ({ index: h.index, text: h.text, level: h.level }));
    setMapping(mapImportToTemplate(headings, template));
  };

  const passthroughs = (result?.blocks ?? []).filter((block) => block.type === 'ooxmlPassthrough');
  const headingRows = result?.headings ?? [];

  return (
    <div className="v2-scenario">
      <ScenarioIntro
        kicker="BeakBlock 2.0 · Import and export"
        title="DOCX import, mapping and export"
        capability="Word import with a loss report and heading detection, mapping of legacy headings to a controlled template, OOXML passthrough for unsupported content, and DOCX export with a round-trip check."
      >
        <p>
          Import a legacy .docx, or generate a sample first. Review what was lost or preserved, map the detected
          headings to the controlled template, then export and re-import the current document.
        </p>
      </ScenarioIntro>

      <div className="v2-toolbar">
        <label className="v2-btn v2-file">
          Choose .docx
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => onFile(event.target.files?.[0])}
            disabled={busy}
          />
        </label>
        <button type="button" className="v2-btn v2-btn--primary" onClick={generateSample} disabled={busy}>
          Generate sample .docx and import
        </button>
        <button type="button" className="v2-btn" onClick={exportAndRoundTrip} disabled={busy || !editor}>
          Export DOCX and re-import
        </button>
        {result ? <Badge tone="info">{result.name}</Badge> : null}
      </div>

      {flash ? <Notice tone={flash.tone === 'bad' ? 'bad' : flash.tone === 'ok' ? 'ok' : 'info'}>{flash.text}</Notice> : null}

      <div className="v2-docx-grid">
        <div className="v2-docx-main">
          {result ? (
            <div className="v2-page-wrap">
              <ImportEditor key={epoch} blocks={result.blocks} onEditor={onEditor} />
            </div>
          ) : (
            <div className="v2-empty">
              <p>Choose a .docx file or generate the sample to see it imported here.</p>
            </div>
          )}
        </div>

        <aside className="v2-docx-side">
          <Panel title="Loss report" right={<Badge tone={result?.losses.length ? 'warn' : 'ok'}>{result?.losses.length ?? 0}</Badge>}>
            {result && result.losses.length ? (
              <table className="v2-table v2-table--compact">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Code</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {result.losses.map((loss, index) => (
                    <tr key={`${loss.code}-${index}`}>
                      <td>
                        <LossBadge severity={loss.severity} />
                      </td>
                      <td>
                        <code>{loss.code}</code>
                      </td>
                      <td>
                        {loss.message}
                        {loss.location ? <div className="v2-muted">{loss.location}</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="v2-muted">{result ? 'Nothing was lost. Unsupported content is listed here when it occurs.' : 'Import a file to see losses.'}</p>
            )}
          </Panel>

          <Panel title="Detected headings" right={<Badge tone="info">{headingRows.length}</Badge>}>
            <ol className="v2-toc">
              {headingRows.map((h) => (
                <li key={`${h.index}-${h.text}`} style={{ paddingLeft: (h.level - 1) * 12 }}>
                  <span>{h.text}</span>
                  <span className="v2-toc__page" title={h.reason}>
                    {Math.round(h.confidence * 100)}%
                  </span>
                </li>
              ))}
              {headingRows.length === 0 ? <li className="v2-muted">No headings detected.</li> : null}
            </ol>
          </Panel>

          <Panel
            title="Map to template"
            right={
              <button type="button" className="v2-btn v2-btn--ghost" onClick={runMapping} disabled={!result}>
                Suggest mapping
              </button>
            }
          >
            <p className="v2-muted">Migration wizard: match legacy headings to the controlled SOP sections.</p>
            {mapping ? (
              <table className="v2-table v2-table--compact">
                <thead>
                  <tr>
                    <th>Template section</th>
                    <th>Matched heading</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {mapping.map((row) => {
                    const section = template.sections.find((s) => s.templateSectionId === row.templateSectionId);
                    return (
                      <tr key={row.templateSectionId}>
                        <td>{section?.title ?? row.templateSectionId}</td>
                        <td>{row.startIndex >= 0 ? row.matchedText ?? `#${row.startIndex}` : <span className="v2-muted">no match</span>}</td>
                        <td>
                          <Badge tone={row.confidence >= 0.6 ? 'ok' : 'warn'}>{Math.round(row.confidence * 100)}%</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : null}
          </Panel>

          <Panel title="Preserved content" right={<Badge tone={passthroughs.length ? 'info' : 'neutral'}>{passthroughs.length}</Badge>}>
            {passthroughs.length === 0 ? (
              <p className="v2-muted">Unsupported Word content (for example text boxes or fields the editor does not model) is kept as passthrough blocks.</p>
            ) : (
              <ul className="v2-list">
                {passthroughs.map((block) => (
                  <li key={block.id}>
                    <strong>Preserved</strong> {String(block.props.preview ?? 'OOXML fragment')}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {trip ? (
            <Panel title="Round trip" right={<Badge tone={trip.reimportBlocks === trip.originalBlocks ? 'ok' : 'warn'}>{trip.reimportBlocks === trip.originalBlocks ? 'stable' : 'changed'}</Badge>}>
              <dl className="v2-dl">
                <dt>Exported size</dt>
                <dd>{(trip.exportedBytes / 1024).toFixed(1)} KB</dd>
                <dt>Export losses</dt>
                <dd>{trip.exportLosses}</dd>
                <dt>Blocks before → after</dt>
                <dd>
                  {trip.originalBlocks} → {trip.reimportBlocks}
                </dd>
                <dt>Headings after re-import</dt>
                <dd>{trip.reimportHeadings}</dd>
                <dt>Import losses on re-read</dt>
                <dd>{trip.reimportLosses}</dd>
              </dl>
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
