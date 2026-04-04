import type { Block } from '@aurthurm/beakblock-core';
import { createDefaultChartData } from '@aurthurm/beakblock-vue';

function createChart(
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea',
  title: string,
  labels: string[],
  data: number[],
  mode: 'default' | 'random' | 'gradient' = 'default'
) {
  const chart = createDefaultChartData(type);
  chart.data = {
    labels,
    datasets: [
      {
        ...chart.data.datasets[0],
        label: title,
        data,
        borderWidth: 2,
      },
    ],
  };
  chart.options = {
    ...chart.options,
    colorScheme: { mode },
    plugins: {
      ...chart.options?.plugins,
      title: {
        ...chart.options?.plugins?.title,
        display: true,
        text: title,
      },
      legend: {
        ...chart.options?.plugins?.legend,
        display: true,
        position: 'top',
      },
    },
  };
  return chart;
}

function p(id: string, text: string): Block {
  return { id, type: 'paragraph', props: {}, content: [{ type: 'text', text, styles: {} }] };
}

/** Product requirements brief — tables, callouts, hierarchy, lists. */
export const prdShowcaseDocument: Block[] = [
  {
    id: 'prd-h1',
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: 'PRB-204 · Northstar ledger export API', styles: {} }],
  },
  {
    id: 'prd-sub',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'Author: ', styles: { bold: true } },
      { type: 'text', text: 'Priya N. · PM · v0.4 draft · ', styles: {} },
      { type: 'text', text: 'Confidential', styles: { italic: true, textColor: '#b45309' } },
    ],
  },
  {
    id: 'prd-goal',
    type: 'callout',
    props: { calloutType: 'success' },
    content: [
      { type: 'text', text: 'Goal: ', styles: { bold: true } },
      {
        type: 'text',
        text: 'Let finance-approved tenants pull immutable journal batches into their ERP within 60 seconds of close, with full audit IDs.',
        styles: {},
      },
    ],
  },
  {
    id: 'prd-h2-prob',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Problem statement', styles: {} }],
  },
  p(
    'prd-prob',
    'Today exports are CSV drops on SFTP; customers miss cutoffs, reconcile manually, and support burns ~40 tickets/month on “missing period” errors.'
  ),
  {
    id: 'prd-h2-personas',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Primary personas', styles: {} }],
  },
  {
    id: 'prd-table-personas',
    type: 'table',
    props: {},
    children: [
      {
        id: 'prd-trp-h',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'prd-th1', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Persona', styles: { bold: true } }] },
          { id: 'prd-th2', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Need', styles: { bold: true } }] },
          { id: 'prd-th3', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Success signal', styles: { bold: true } }] },
        ],
      },
      {
        id: 'prd-trp-1',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'prd-td11', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Corp accountant', styles: {} }] },
          { id: 'prd-td12', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Idempotent API + webhook', styles: {} }] },
          { id: 'prd-td13', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Zero duplicate batches', styles: {} }] },
        ],
      },
      {
        id: 'prd-trp-2',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'prd-td21', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Auditor', styles: {} }] },
          { id: 'prd-td22', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Tamper-evident payload hash', styles: {} }] },
          { id: 'prd-td23', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Hash in audit log', styles: {} }] },
        ],
      },
    ],
  },
  {
    id: 'prd-h2-fr',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Functional requirements', styles: {} }],
  },
  {
    id: 'prd-ol-fr',
    type: 'orderedList',
    props: { start: 1 },
    children: [
      {
        id: 'prd-fr1',
        type: 'listItem',
        props: {},
        content: [
          { type: 'text', text: 'OAuth2 client-credentials ', styles: { bold: true } },
          { type: 'text', text: 'with scoped tenant IDs; rotate secrets without downtime.', styles: {} },
        ],
      },
      {
        id: 'prd-fr2',
        type: 'listItem',
        props: {},
        content: [
          { type: 'text', text: 'GET /v1/ledger-exports?period= ', styles: { code: true } },
          { type: 'text', text: ' returns ', styles: {} },
          { type: 'text', text: '202', styles: { bold: true } },
          { type: 'text', text: ' while job runs, then ', styles: {} },
          { type: 'text', text: '303', styles: { bold: true } },
          { type: 'text', text: ' to signed URL.', styles: {} },
        ],
      },
      {
        id: 'prd-fr3',
        type: 'listItem',
        props: {},
        content: [{ type: 'text', text: 'Rate limit: 10 concurrent exports / tenant; friendly 429 body.', styles: {} }],
      },
    ],
  },
  {
    id: 'prd-risk',
    type: 'callout',
    props: { calloutType: 'warning' },
    content: [
      { type: 'text', text: 'Risk: ', styles: { bold: true } },
      { type: 'text', text: 'Large tenants may exceed 512 MB payloads — ship chunked ZIP in phase 2; document hard cap in this release.', styles: {} },
    ],
  },
  {
    id: 'prd-h2-nfr',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Success metrics (90 days)', styles: {} }],
  },
  {
    id: 'prd-metrics',
    type: 'bulletList',
    props: {},
    children: [
      { id: 'prd-m1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'p95 export-ready < 45s for ≤100k lines', styles: {} }] },
      { id: 'prd-m2', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Support tickets −60% for export failures', styles: {} }] },
      { id: 'prd-m3', type: 'listItem', props: {}, content: [{ type: 'text', text: '3 design partners live in prod', styles: {} }] },
    ],
  },
];

/** On-call runbook — code, warnings, ordered steps, checklists. */
export const runbookShowcaseDocument: Block[] = [
  {
    id: 'rb-h1',
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: 'RUNBOOK: Payments ledger read replica lag', styles: {} }],
  },
  p('rb-own', 'Service: ledger-api · Severity: SEV-2 · On-call: Platform / Payments rotation'),
  {
    id: 'rb-warn',
    type: 'callout',
    props: { calloutType: 'error' },
    content: [
      { type: 'text', text: 'Stop if ', styles: { bold: true } },
      { type: 'text', text: 'data loss suspected — page storage engineer and declare incident commander.', styles: {} },
    ],
  },
  {
    id: 'rb-h2-sym',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Symptoms', styles: {} }],
  },
  {
    id: 'rb-sym',
    type: 'bulletList',
    props: {},
    children: [
      { id: 'rb-s1', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Grafana panel LedgerReplicaLagSeconds > 120 for 5m', styles: { code: true } }] },
      { id: 'rb-s2', type: 'listItem', props: {}, content: [{ type: 'text', text: 'Customers see stale balances in mobile app', styles: {} }] },
    ],
  },
  {
    id: 'rb-h2-steps',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Mitigation steps', styles: {} }],
  },
  {
    id: 'rb-steps',
    type: 'orderedList',
    props: { start: 1 },
    children: [
      {
        id: 'rb-st1',
        type: 'listItem',
        props: {},
        content: [{ type: 'text', text: 'Ack page in PagerDuty; post “investigating” in #incidents-ledger.', styles: {} }],
      },
      {
        id: 'rb-st2',
        type: 'listItem',
        props: {},
        content: [{ type: 'text', text: 'Confirm primary writer healthy: kubectl logs deploy/ledger-writer --tail=200', styles: {} }],
      },
      {
        id: 'rb-st3',
        type: 'listItem',
        props: {},
        content: [{ type: 'text', text: 'If replica only: fail over read pool via Terraform flag use_replica_pool=false (see snippet below).', styles: {} }],
      },
    ],
  },
  {
    id: 'rb-code',
    type: 'codeBlock',
    props: { language: 'bash' },
    content: [
      {
        type: 'text',
        text: '# Emergency: drain replica pool from consul\ncurl -X POST https://consul.internal/v1/kv/ledger/read_pool_enabled \\\n  -d \'false\' -H "X-Consul-Token: $CONSUL_TOKEN"\n# Verify traffic: watch haproxy ledger_frontend backend',
        styles: {},
      },
    ],
  },
  {
    id: 'rb-h2-verify',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Verification checklist', styles: {} }],
  },
  {
    id: 'rb-chk',
    type: 'checkList',
    props: {},
    children: [
      { id: 'rb-c1', type: 'checkListItem', props: { checked: false }, content: [{ type: 'text', text: 'Replica lag < 5s for 15 minutes', styles: {} }] },
      { id: 'rb-c2', type: 'checkListItem', props: { checked: false }, content: [{ type: 'text', text: 'Error budget burn rate normalized', styles: {} }] },
      { id: 'rb-c3', type: 'checkListItem', props: { checked: false }, content: [{ type: 'text', text: 'Customer comms sent if user-visible >30m', styles: {} }] },
    ],
  },
  {
    id: 'rb-info',
    type: 'callout',
    props: { calloutType: 'info' },
    content: [
      { type: 'text', text: 'Escalation: ', styles: { bold: true } },
      { type: 'text', text: 'If step 3 does not clear lag in 10m, invoke ', styles: {} },
      { type: 'text', text: 'INC-MAJOR', styles: { code: true } },
      { type: 'text', text: ' playbook and page DBA secondary.', styles: {} },
    ],
  },
];

/** Board one-pager — KPI columns + chart + executive summary. */
export const boardOnePagerDocument: Block[] = [
  {
    id: 'brd-h1',
    type: 'heading',
    props: { level: 1, textAlign: 'center' },
    content: [{ type: 'text', text: 'Q3 board snapshot · Orion SaaS', styles: {} }],
  },
  {
    id: 'brd-sub',
    type: 'paragraph',
    props: { textAlign: 'center' },
    content: [{ type: 'text', text: 'Prepared for Oct 18 board · CFO review attached separately', styles: { italic: true } }],
  },
  { id: 'brd-div', type: 'divider', props: {} },
  {
    id: 'brd-cols',
    type: 'columnList',
    props: { gap: 20 },
    children: [
      {
        id: 'brd-c1',
        type: 'column',
        props: { width: 33 },
        children: [
          {
            id: 'brd-k1',
            type: 'heading',
            props: { level: 3 },
            content: [{ type: 'text', text: 'ARR', styles: {} }],
          },
          {
            id: 'brd-p1',
            type: 'paragraph',
            props: {},
            content: [
              { type: 'text', text: '$48.2M', styles: { bold: true, fontSize: 22 } },
              { type: 'text', text: '\n+22% YoY', styles: { textColor: '#15803d' } },
            ],
          },
        ],
      },
      {
        id: 'brd-c2',
        type: 'column',
        props: { width: 33 },
        children: [
          {
            id: 'brd-k2',
            type: 'heading',
            props: { level: 3 },
            content: [{ type: 'text', text: 'NRR', styles: {} }],
          },
          {
            id: 'brd-p2',
            type: 'paragraph',
            props: {},
            content: [
              { type: 'text', text: '118%', styles: { bold: true, fontSize: 22 } },
              { type: 'text', text: '\nenterprise-led', styles: { italic: true } },
            ],
          },
        ],
      },
      {
        id: 'brd-c3',
        type: 'column',
        props: { width: 34 },
        children: [
          {
            id: 'brd-k3',
            type: 'heading',
            props: { level: 3 },
            content: [{ type: 'text', text: 'Cash months', styles: {} }],
          },
          {
            id: 'brd-p3',
            type: 'paragraph',
            props: {},
            content: [
              { type: 'text', text: '31', styles: { bold: true, fontSize: 22 } },
              { type: 'text', text: '\npost-raise', styles: {} },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'brd-h2',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Net retention trend', styles: {} }],
  },
  {
    id: 'brd-chart',
    type: 'chart',
    props: {
      data: createChart('line', 'NRR %', ['Q1', 'Q2', 'Q3'], [112, 115, 118], 'gradient'),
    },
  },
  {
    id: 'brd-sum',
    type: 'blockquote',
    props: {},
    content: [
      {
        type: 'text',
        text: 'Narrative: Upsell into workflow automation tier drove 6 pts of NRR expansion; churn flat at 4.1% logo / 1.9% revenue.',
        styles: {},
      },
    ],
  },
  {
    id: 'brd-table',
    type: 'table',
    props: {},
    children: [
      {
        id: 'brd-trh',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'brd-th1', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Initiative', styles: { bold: true } }] },
          { id: 'brd-th2', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Status', styles: { bold: true } }] },
          { id: 'brd-th3', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Impact', styles: { bold: true } }] },
        ],
      },
      {
        id: 'brd-tr1',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'brd-t11', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'EU data residency', styles: {} }] },
          { id: 'brd-t12', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'GA Oct', styles: {} }] },
          { id: 'brd-t13', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Unblocks €3.1M pipeline', styles: {} }] },
        ],
      },
    ],
  },
];

/** Lesson plan — numbered outcomes, time blocks, checklist homework. */
export const lessonPlanDocument: Block[] = [
  {
    id: 'les-h1',
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: 'Lesson 6 · Discounted cash flows (DCF)', styles: {} }],
  },
  {
    id: 'les-meta',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'Course: ', styles: { bold: true } },
      { type: 'text', text: 'Corporate Finance 201 · ', styles: {} },
      { type: 'text', text: '75 minutes · ', styles: { italic: true } },
      { type: 'text', text: 'Room B204', styles: {} },
    ],
  },
  {
    id: 'les-out',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Learning objectives', styles: {} }],
  },
  {
    id: 'les-ol',
    type: 'orderedList',
    props: { start: 1 },
    children: [
      {
        id: 'les-o1',
        type: 'listItem',
        props: {},
        content: [{ type: 'text', text: 'Explain why free cash flow—not net income—anchors enterprise value.', styles: {} }],
      },
      {
        id: 'les-o2',
        type: 'listItem',
        props: {},
        content: [{ type: 'text', text: 'Build a two-stage model: explicit forecast + perpetuity terminal value.', styles: {} }],
      },
      {
        id: 'les-o3',
        type: 'listItem',
        props: {},
        content: [{ type: 'text', text: 'Stress-test WACC ±1% and interpret sensitivity.', styles: {} }],
      },
    ],
  },
  {
    id: 'les-agenda',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Agenda', styles: {} }],
  },
  {
    id: 'les-table',
    type: 'table',
    props: {},
    children: [
      {
        id: 'les-trh',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'les-th1', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Segment', styles: { bold: true } }] },
          { id: 'les-th2', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Time', styles: { bold: true } }] },
          { id: 'les-th3', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Activity', styles: { bold: true } }] },
        ],
      },
      {
        id: 'les-tr1',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'les-t11', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Hook', styles: {} }] },
          { id: 'les-t12', type: 'tableCell', props: {}, content: [{ type: 'text', text: '0:00–0:10', styles: {} }] },
          { id: 'les-t13', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Case: IPO filing cash bridge', styles: {} }] },
        ],
      },
      {
        id: 'les-tr2',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'les-t21', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Core', styles: {} }] },
          { id: 'les-t22', type: 'tableCell', props: {}, content: [{ type: 'text', text: '0:10–0:45', styles: {} }] },
          { id: 'les-t23', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Whiteboard FCF build', styles: {} }] },
        ],
      },
      {
        id: 'les-tr3',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'les-t31', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Lab', styles: {} }] },
          { id: 'les-t32', type: 'tableCell', props: {}, content: [{ type: 'text', text: '0:45–1:15', styles: {} }] },
          { id: 'les-t33', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Excel template pairs', styles: {} }] },
        ],
      },
    ],
  },
  {
    id: 'les-note',
    type: 'callout',
    props: { calloutType: 'note' },
    content: [
      { type: 'text', text: 'Instructor note: ', styles: { bold: true } },
      { type: 'text', text: 'Print slide 14 as handout — students struggle with net working capital add-backs.', styles: {} },
    ],
  },
  {
    id: 'les-hw',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Take-home checklist', styles: {} }],
  },
  {
    id: 'les-chk',
    type: 'checkList',
    props: {},
    children: [
      { id: 'les-c1', type: 'checkListItem', props: { checked: false }, content: [{ type: 'text', text: 'Submit DCF workbook (LMS) by Friday 5pm', styles: {} }] },
      { id: 'les-c2', type: 'checkListItem', props: { checked: false }, content: [{ type: 'text', text: 'Read Damodaran ch. 12 (skim §5)', styles: {} }] },
    ],
  },
];

/** Blameless postmortem — timeline, impact table, action items. */
export const postmortemDocument: Block[] = [
  {
    id: 'pm-h1',
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: 'Postmortem · INV-2025-089 · Checkout API timeout spike', styles: {} }],
  },
  {
    id: 'pm-meta',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'Date: ', styles: { bold: true } },
      { type: 'text', text: '2025-09-02 · Severity ', styles: {} },
      { type: 'text', text: 'SEV-2', styles: { bold: true, backgroundColor: '#fef3c7' } },
      { type: 'text', text: ' · Facilitator: SRE rotation', styles: {} },
    ],
  },
  {
    id: 'pm-sum',
    type: 'callout',
    props: { calloutType: 'info' },
    content: [
      { type: 'text', text: 'Summary: ', styles: { bold: true } },
      {
        type: 'text',
        text: 'A bad deploy increased connection pool wait; 12% of checkouts saw >8s latency for 22 minutes. No data loss; revenue impact estimated at $18k.',
        styles: {},
      },
    ],
  },
  {
    id: 'pm-h2-tl',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Timeline (UTC)', styles: {} }],
  },
  {
    id: 'pm-tl',
    type: 'orderedList',
    props: { start: 1 },
    children: [
      {
        id: 'pm-t1',
        type: 'listItem',
        props: {},
        content: [{ type: 'text', text: '14:02 — Deploy checkout-service v2.14.3 completes canary', styles: {} }],
      },
      {
        id: 'pm-t2',
        type: 'listItem',
        props: {},
        content: [{ type: 'text', text: '14:05 — Pool saturation alert fires; autoscale lag 4m', styles: {} }],
      },
      {
        id: 'pm-t3',
        type: 'listItem',
        props: {},
        content: [{ type: 'text', text: '14:18 — Rollback initiated; traffic normalizes by 14:24', styles: {} }],
      },
    ],
  },
  {
    id: 'pm-h2-root',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Root causes', styles: {} }],
  },
  {
    id: 'pm-bl',
    type: 'bulletList',
    props: {},
    children: [
      {
        id: 'pm-b1',
        type: 'listItem',
        props: {},
        content: [
          { type: 'text', text: 'Primary: ', styles: { bold: true } },
          { type: 'text', text: 'Default DB pool size halved in config map typo (', styles: {} },
          { type: 'text', text: 'max: 10', styles: { code: true } },
          { type: 'text', text: ' vs ', styles: {} },
          { type: 'text', text: '100', styles: { code: true } },
          { type: 'text', text: ').', styles: {} },
        ],
      },
      {
        id: 'pm-b2',
        type: 'listItem',
        props: {},
        content: [{ type: 'text', text: 'Contributing: canary metrics lacked pool wait histogram — blind spot.', styles: {} }],
      },
    ],
  },
  {
    id: 'pm-h2-act',
    type: 'heading',
    props: { level: 2 },
    content: [{ type: 'text', text: 'Action items', styles: {} }],
  },
  {
    id: 'pm-act-table',
    type: 'table',
    props: {},
    children: [
      {
        id: 'pm-trh',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'pm-th1', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Action', styles: { bold: true } }] },
          { id: 'pm-th2', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Owner', styles: { bold: true } }] },
          { id: 'pm-th3', type: 'tableHeader', props: {}, content: [{ type: 'text', text: 'Due', styles: { bold: true } }] },
        ],
      },
      {
        id: 'pm-tr1',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'pm-t11', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Schema validate pool keys in CI', styles: {} }] },
          { id: 'pm-t12', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Platform', styles: {} }] },
          { id: 'pm-t13', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Sep 20', styles: {} }] },
        ],
      },
      {
        id: 'pm-tr2',
        type: 'tableRow',
        props: {},
        children: [
          { id: 'pm-t21', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Add SLO burn alert on pool wait p99', styles: {} }] },
          { id: 'pm-t22', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'SRE', styles: {} }] },
          { id: 'pm-t23', type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Sep 27', styles: {} }] },
        ],
      },
    ],
  },
  {
    id: 'pm-quote',
    type: 'blockquote',
    props: {},
    content: [
      {
        type: 'text',
        text: '“We fixed the symptom fast; the follow-ups are about never trusting silent config defaults again.”',
        styles: { italic: true },
      },
    ],
  },
];

/** Magazine-style newsletter — columns, pull quote, imagery, links. */
export const newsletterShowcaseDocument: Block[] = [
  {
    id: 'nwl-kicker',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'THE LEDGER · WEEKLY · ISSUE 47', styles: { bold: true } }],
  },
  {
    id: 'nwl-h1',
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: 'When rates stall, working capital is the only lever left', styles: {} }],
  },
  {
    id: 'nwl-dek',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'By ', styles: {} },
      { type: 'text', text: 'Mara Okonkwo', styles: { bold: true } },
      { type: 'text', text: ' · ', styles: {} },
      { type: 'text', text: '8 min read', styles: { italic: true } },
    ],
  },
  {
    id: 'nwl-cols',
    type: 'columnList',
    props: { gap: 24 },
    children: [
      {
        id: 'nwl-col1',
        type: 'column',
        props: { width: 58 },
        children: [
          {
            id: 'nwl-lead',
            type: 'paragraph',
            props: {},
            content: [
              { type: 'text', text: 'CFOs are ', styles: {} },
              { type: 'text', text: 'rediscovering', styles: { italic: true, underline: true } },
              {
                type: 'text',
                text: ' the balance sheet: with refinancing cliffs pushed to 2027, the quickest wins live in DSO, inventory turns, and supplier terms — not in another headcount freeze.',
                styles: {},
              },
            ],
          },
          {
            id: 'nwl-img1',
            type: 'image',
            props: {
              src: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=900&q=80',
              alt: 'Financial charts on a desk',
              caption: 'Photo: markets desk, Tokyo (Unsplash)',
              alignment: 'center',
            },
          },
          p(
            'nwl-mid',
            'We spoke with twelve growth-stage controllers who automated three-way match in Q2; seven reported a median 9-day DPO extension without touching headline pricing.'
          ),
        ],
      },
      {
        id: 'nwl-col2',
        type: 'column',
        props: { width: 42 },
        children: [
          {
            id: 'nwl-pull',
            type: 'blockquote',
            props: {},
            content: [
              {
                type: 'text',
                text: 'Liquidity is a product feature now — treasury and AR teams finally share the same dashboard.',
                styles: { italic: true },
              },
            ],
          },
          {
            id: 'nwl-side-h',
            type: 'heading',
            props: { level: 3 },
            content: [{ type: 'text', text: 'On our radar', styles: {} }],
          },
          {
            id: 'nwl-side-list',
            type: 'bulletList',
            props: {},
            children: [
              {
                id: 'nwl-s1',
                type: 'listItem',
                props: {},
                content: [
                  {
                    type: 'link',
                    href: 'https://www.ecb.europa.eu',
                    title: 'ECB',
                    target: '_blank',
                    content: [{ type: 'text', text: 'ECB staff paper', styles: { underline: true } }],
                  },
                  { type: 'text', text: ' on inventory financing', styles: {} },
                ],
              },
              {
                id: 'nwl-s2',
                type: 'listItem',
                props: {},
                content: [{ type: 'text', text: 'IFRS 18 presentation refresh — templates due Oct', styles: {} }],
              },
            ],
          },
          {
            id: 'nwl-img2',
            type: 'image',
            props: {
              src: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=700&q=80',
              alt: 'Calculator and documents',
              caption: 'Still life: close process artifacts',
              alignment: 'center',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'nwl-foot',
    type: 'paragraph',
    props: { textAlign: 'center' },
    content: [
      { type: 'text', text: 'Subscribe · ', styles: {} },
      {
        type: 'link',
        href: 'mailto:newsletter@example.com',
        title: 'Subscribe',
        target: '_self',
        content: [{ type: 'text', text: 'newsletter@example.com', styles: {} }],
      },
      { type: 'text', text: ' · Unsubscribe in one click', styles: { italic: true, textColor: '#6b7280' } },
    ],
  },
];
