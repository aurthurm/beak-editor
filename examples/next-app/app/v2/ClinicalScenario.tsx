"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { BeakBlockView, OfficeShell, useBeakBlock } from '@amusendame/beakblock-react';
import type { BeakBlockEditor } from '@amusendame/beakblock-core';
import {
  clinicalExtension,
  EXAMPLE_PLACEHOLDER_RULES,
  formsExtension,
  validateClinicalDocument,
  validateEquipmentReferences,
  validateForm,
} from '@amusendame/beakblock-blocks-clinical';
import { officeBlocksExtension, refreshOfficeBlocks, validateOfficeContent } from '@amusendame/beakblock-blocks-office';
import { clinicalBlocks, CLINICAL_VARIABLES, mockLimsProvider } from './demoData';
import { Badge, Notice, Panel, ScenarioIntro, useEditorTick } from './common';

type Issue = { severity: string; code: string; message: string; blockId?: string };

const LIMS = mockLimsProvider();
const CLINICAL_SERVICES = {
  clinical: clinicalExtension({ equipmentProvider: LIMS, allowedUnits: ['mg/mL', 'mmol/L', 'mL', 'µL'] }),
  forms: formsExtension(),
};

function severityTone(severity: string): 'bad' | 'warn' | 'info' {
  return severity === 'error' ? 'bad' : severity === 'warning' ? 'warn' : 'info';
}

function IssueList({ issues, empty }: { issues: Issue[]; empty: string }) {
  if (issues.length === 0) return <p className="v2-muted">{empty}</p>;
  return (
    <ul className="v2-issues">
      {issues.map((issue, index) => (
        <li key={`${issue.code}-${issue.blockId ?? ''}-${index}`}>
          <Badge tone={severityTone(issue.severity)}>{issue.severity}</Badge> <code>{issue.code}</code>
          <span> {issue.message}</span>
          {issue.blockId ? <span className="v2-muted"> ({issue.blockId})</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function ClinicalScenario(): ReactElement {
  const variables = useRef<Record<string, unknown>>({ ...CLINICAL_VARIABLES });
  const [initial] = useState(() => clinicalBlocks());
  const editor = useBeakBlock({
    mode: 'office',
    wordBehaviour: true,
    initialContent: initial,
    extensions: [
      CLINICAL_SERVICES.clinical,
      CLINICAL_SERVICES.forms,
      // The getter is only invoked by the extension when it validates or renders blocks, never during render.
      // eslint-disable-next-line react-hooks/refs
      officeBlocksExtension({ variables: () => variables.current }),
    ],
  });
  const tick = useEditorTick(editor);
  const [procedureType, setProcedureType] = useState<string>(String(CLINICAL_VARIABLES.procedureType));
  const [equipmentIssues, setEquipmentIssues] = useState<Issue[]>([]);
  const [lims, setLims] = useState<Array<{ id: string; code: string; name: string; status: string }>>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    LIMS.search(query).then((records) => {
      if (!cancelled) setLims(records);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Validation runs on every change. Each layer reports its own issues, and the server runs the same checks.
  const [clinicalIssues, setClinicalIssues] = useState<Issue[]>([]);
  const [registryIssues, setRegistryIssues] = useState<Issue[]>([]);
  const [formIssues, setFormIssues] = useState<Issue[]>([]);
  const [officeIssues, setOfficeIssues] = useState<Issue[]>([]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const blocks = editor.getDocument();
    const withVars = { variables: variables.current };
    // Office types (conditional, caption, equation) are checked by the block registry below, so the
    // clinical rules skip their unregistered-block-type notices.
    // Validators read the external editor document, so the results are mirrored into state here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClinicalIssues(
      (
        validateClinicalDocument(blocks, {
          procedureType: procedureType,
          safetyRequiredFor: ['hazardous'],
          placeholderRules: EXAMPLE_PLACEHOLDER_RULES,
          equipmentProvider: LIMS,
        } as Parameters<typeof validateClinicalDocument>[1]) as Issue[]
      ).filter((issue) => issue.code !== 'unregistered-block-type')
    );
    setRegistryIssues(editor.blockRegistry.validate(blocks, withVars) as Issue[]);
    setFormIssues(validateForm(blocks) as Issue[]);
    setOfficeIssues(validateOfficeContent(blocks, withVars) as Issue[]);
  }, [editor, tick, procedureType]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    let cancelled = false;
    validateEquipmentReferences(editor.pm.doc, LIMS).then((issues) => {
      if (!cancelled) setEquipmentIssues(issues as Issue[]);
    });
    return () => {
      cancelled = true;
    };
  }, [editor, tick]);

  // Several layers check the same rule (for example a missing required field is reported by the clinical rules,
  // the block registry and the forms layer). Show each distinct issue once.
  const allIssues = useMemo(() => {
    const seen = new Set<string>();
    return [...clinicalIssues, ...registryIssues, ...formIssues, ...officeIssues, ...equipmentIssues].filter((issue) => {
      const key = `${issue.severity}|${issue.code}|${issue.blockId ?? ''}|${issue.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [clinicalIssues, registryIssues, formIssues, officeIssues, equipmentIssues]);
  const errorCount = allIssues.filter((i) => i.severity === 'error').length;
  const warningCount = allIssues.filter((i) => i.severity === 'warning').length;

  const setType = (next: string) => {
    variables.current.procedureType = next;
    setProcedureType(next);
    if (editor && !editor.isDestroyed) refreshOfficeBlocks(editor as BeakBlockEditor);
  };

  return (
    <div className="v2-scenario">
      <ScenarioIntro
        kicker="BeakBlock 2.0 · Clinical and forms"
        title="Clinical blocks, forms and validation"
        capability="Semantic lab blocks (auto-numbered steps, GHS warnings, reagent tables, equipment from LIMS, specimen and QC rules), calculated forms, footnotes, captions and cross-references, and a conditional section."
      >
        <p>
          Semantics live in the node, not the styling. Step numbers are automatic. The reagent table checks required
          columns and units. The equipment reference resolves through a mock LIMS, and retired equipment raises a warning.
          Switch the procedure type to show or hide the hazard block.
        </p>
      </ScenarioIntro>

      <div className="v2-toolbar">
        <span className="v2-muted">Procedure type (variable)</span>
        <div className="v2-segment" role="tablist" aria-label="Procedure type">
          {['hazardous', 'routine'].map((type) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={procedureType === type}
              className={`v2-segment__btn ${procedureType === type ? 'is-active' : ''}`}
              onClick={() => setType(type)}
            >
              {type}
            </button>
          ))}
        </div>
        <span className="v2-spacer" />
        <Badge tone={errorCount ? 'bad' : 'ok'}>{errorCount} errors</Badge>
        <Badge tone={warningCount ? 'warn' : 'ok'}>{warningCount} warnings</Badge>
      </div>

      <Notice tone="info">
        Try: edit the dose in the Batch record to a value above 20 (range error), change the unit to mg (not allowed),
        or clear the operator (required). The validation panel updates as you type.
      </Notice>

      <div className="v2-clin-grid">
        <div className="v2-clin-main">
          <div className="v2-page-wrap">
            <OfficeShell editor={editor} mode="office" rulers={false} navigation={false} statusBar={false} showRibbon={false}>
              <BeakBlockView editor={editor} className="editor-view v2-office-view" />
            </OfficeShell>
          </div>
        </div>

        <aside className="v2-clin-side">
          <Panel title="Validation" right={<Badge tone={errorCount ? 'bad' : warningCount ? 'warn' : 'ok'}>{allIssues.length}</Badge>}>
            <p className="v2-muted">Layers: block registry, clinical document rules, forms, office content, LIMS equipment.</p>
            <IssueList issues={allIssues} empty="No issues. The document passes every layer." />
          </Panel>

          <Panel title="Equipment (mock LIMS)" right={<Badge tone="info">provider</Badge>}>
            <input className="v2-input" placeholder="Search by code or name" value={query} onChange={(e) => setQuery(e.target.value)} />
            <ul className="v2-list">
              {lims.map((record) => (
                <li key={record.id}>
                  <code>{record.code}</code> {record.name}{' '}
                  <Badge tone={record.status === 'active' ? 'ok' : 'warn'}>{record.status}</Badge>
                </li>
              ))}
              {lims.length === 0 ? <li className="v2-muted">No matches.</li> : null}
            </ul>
          </Panel>

          <Panel title="Blocks in this document">
            <ul className="v2-list">
              <li>
                <code>sopStep</code> — numbered 1, 2, 3 automatically; a critical flag and time
              </li>
              <li>
                <code>safetyWarning</code> — GHS codes and PPE, inside a conditional
              </li>
              <li>
                <code>reagentTable</code> — required columns, allowed units, expiry dates
              </li>
              <li>
                <code>testMethodSpec</code>, <code>specimenRequirements</code>, <code>qcCriteria</code>
              </li>
              <li>
                <code>formText/Number/Date/Dropdown/Calculated</code> — form controls with rules
              </li>
              <li>
                footnote, caption + cross-reference, equation (LaTeX source shown without KaTeX)
              </li>
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
