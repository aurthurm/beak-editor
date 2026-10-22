# ADR-0005: Units

- **Status:** Accepted (initial)
- **Date:** 2026-10-22
- **Roadmap:** ADR-5, section 4

## Context

Pixels are a screen unit. OOXML and Word use twips (1/1440 inch) and half-points. Print and PDF need points.
Mixing units in the model makes DOCX and print output drift from each other and from the editor.

## Decision

Store lengths in points and twips. Use pixels only at render time.

- 1 pt = 20 twips. 1 in = 72 pt = 1440 twips. 1 px = 15 twips at 96 dpi (1 px = 0.75 pt).
- `@amusendame/beakblock-schema` exports `ptToTwips`, `twipsToPt`, `twipsToPx`, `pxToTwips` and `mmToTwips`.
- Page setup, margins, table grids (`grid` in the IR) and cell widths are in twips. Spacing and indents on
  paragraphs are in points (`SpacingProps`, `IndentProps`).
- Print HTML writes `pt` values. Editor CSS is the only place pixels are used.

## Consequences

- Page size and margins are exact across editor, print and DOCX. The A4 print width (595.30 pt) and the
  DOCX page width (11906 twips) come from the same constant.
- Existing `colwidth` attributes in the core table model are pixel arrays (prosemirror-tables). Conversion to
  twips happens in the table commands and the IR conversion. Mismatches here are one source of table
  issues (see `tests/conformance/src/tables.test.ts`).

## Follow-ups

- Make the core table widths store twips directly (contract section 1.6 `widthTwips`), and derive
  `colwidth` pixels from them, instead of the reverse.

## References

- `packages/schema/README.md` (Page setup and units)
- `docs/2.0/contracts.md` section 1.6 and the units note at the top
