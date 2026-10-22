"use client";

import type { ReactElement } from 'react';
import './v2.css';
import { OfficeSopScenario } from './OfficeSopScenario';
import { BlockModeScenario } from './BlockModeScenario';
import { ControlledScenario } from './ControlledScenario';
import { TrackChangesScenario } from './TrackChangesScenario';
import { DocxScenario } from './DocxScenario';
import { ClinicalScenario } from './ClinicalScenario';
import { AIScenario } from './AIScenario';

/** Scenario ids and names. The Vue example uses the same list and names. */
export const BEAKBLOCK_V2_SCENARIOS = [
  { id: 'v2-office-sop', label: 'Office mode SOP', sub: 'Ribbon · pagination · print preview' },
  { id: 'v2-block-mode', label: 'Block mode', sub: 'Three projections, one document' },
  { id: 'v2-controlled', label: 'Controlled document (vertical slice)', sub: 'Template · sections · approval · release' },
  { id: 'v2-track-compare', label: 'Track changes & compare', sub: 'Revisions · views · threads · redline' },
  { id: 'v2-docx', label: 'DOCX import & export', sub: 'Losses · mapping · round trip' },
  { id: 'v2-clinical', label: 'Clinical blocks & forms', sub: 'SOP steps · reagents · validation' },
  { id: 'v2-ai', label: 'AI proposals', sub: 'Tracked, attributed, policy-checked' },
] as const;

export type BeakBlock2ScenarioId = (typeof BEAKBLOCK_V2_SCENARIOS)[number]['id'];

export function isBeakBlock2Scenario(value: string): value is BeakBlock2ScenarioId {
  return BEAKBLOCK_V2_SCENARIOS.some((s) => s.id === value);
}

/** Renders one BeakBlock 2.0 scenario. Only the active scenario is mounted, so editors are created on demand. */
export function BeakBlock2Panel({ scenario }: { scenario: BeakBlock2ScenarioId }): ReactElement {
  switch (scenario) {
    case 'v2-office-sop':
      return <OfficeSopScenario key={scenario} />;
    case 'v2-block-mode':
      return <BlockModeScenario key={scenario} />;
    case 'v2-controlled':
      return <ControlledScenario key={scenario} />;
    case 'v2-track-compare':
      return <TrackChangesScenario key={scenario} />;
    case 'v2-docx':
      return <DocxScenario key={scenario} />;
    case 'v2-clinical':
      return <ClinicalScenario key={scenario} />;
    case 'v2-ai':
      return <AIScenario key={scenario} />;
    default:
      return <p>Unknown scenario</p>;
  }
}
