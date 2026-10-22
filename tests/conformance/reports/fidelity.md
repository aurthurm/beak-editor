# Fidelity report (ADR-2 proxy)

Generated 2026-10-22T07:46:06.288Z. Layout: heuristic measurer. Server rendition: LibreOffice 26.2.6.3 620(Build:3), DOCX export.

Drift is `layoutPages - serverPages`. The script reports drift and does not fail on it; the CI gate is a later step.

## Summary

- Documents: 20 (measured 20, skipped 0, failed 0)
- Exact page-count matches: 20
- Within one page: 20
- Within 10 %: 20
- Mean absolute drift: 0 pages; maximum: 0 pages

## Per document

| Document | Category | Layout pages | Server pages (PDF) | Drift | Drift % | Status | DOCX losses |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| lab-gram-stain | lab-sop | 2 | 2 | 0 | 0 | ok | - |
| lab-blood-culture | lab-sop | 1 | 1 | 0 | 0 | ok | - |
| lab-pcr-setup | lab-sop | 1 | 1 | 0 | 0 | ok | - |
| lab-centrifuge | lab-sop | 1 | 1 | 0 | 0 | ok | - |
| lab-specimen-rejection | lab-sop | 1 | 1 | 0 | 0 | ok | - |
| validation-protocol | validation | 2 | 2 | 0 | 0 | ok | - |
| quality-manual-excerpt | manual | 3 | 3 | 0 | 0 | ok | - |
| mixed-permission-sop | controlled | 1 | 1 | 0 | 0 | ok | - |
| qms-release | controlled | 1 | 1 | 0 | 0 | ok | - |
| form-equipment-worksheet | form | 1 | 1 | 0 | 0 | ok | - |
| office-extensions | office | 1 | 1 | 0 | 0 | ok | - |
| long-sop-50 | large | 56 | 56 | 0 | 0 | ok | - |
| multilingual | multilingual | 1 | 1 | 0 | 0 | ok | - |
| complex-tables | tables | 1 | 1 | 0 | 0 | ok | - |
| reviewed-draft | review | 1 | 1 | 0 | 0 | ok | - |
| pathological-empty-blocks | pathological | 1 | 1 | 0 | 0 | ok | - |
| pathological-deep-nesting | pathological | 1 | 1 | 0 | 0 | ok | - |
| pathological-long-paragraph | pathological | 3 | 3 | 0 | 0 | ok | - |
| pathological-unicode | pathological | 1 | 1 | 0 | 0 | ok | - |
| pathological-unknown-types | pathological | 1 | 1 | 0 | 0 | ok | - |

