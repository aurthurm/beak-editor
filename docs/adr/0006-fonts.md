# ADR-0006: Fonts

- **Status:** Accepted (initial)
- **Date:** 2026-10-22
- **Roadmap:** ADR-6, section 4

## Context

Text width drives pagination. If the editor, the print output and the DOCX reader use different fonts,
page breaks drift, even when the layout engine is correct. System fonts differ between machines.

## Options

1. Use whatever system fonts the viewer has. Simplest, but drift between machines is guaranteed.
2. Bundle metric-compatible fonts: Carlito (Calibri), Caladea (Cambria), and Liberation Sans, Serif and
   Mono (Arial, Times New Roman, Courier New). Same metrics, so the same breaks on screen and in print.

## Decision

Option 2 is the target. The current state:

- The style sheet names the metric-compatible families (`FONTS` and `fontStack` in
  `@amusendame/beakblock-schema`) with fallbacks.
- The DOCX writer maps the bundled names to Office names by default (`DEFAULT_FONT_MAP`: Carlito to Calibri,
  Caladea to Cambria, Liberation Sans to Arial, Liberation Serif to Times New Roman, Liberation Mono to
  Courier New). Set `fontMap: {}` to keep the bundled names.
- Print HTML declares `@font-face` hints for the three families.
- The heuristic measurer uses approximate advance tables scaled from Arial and Times (Carlito about 0.9 of
  Arial, Caladea about 1.05 of Times). They are approximations, not the font programs' metrics.
- **Font files are not bundled** in this repository. The metric parity test (browser against renderer) has
  not been run.

## Consequences

- Office users see Calibri and Cambria in Word. LibreOffice users see Carlito and Caladea, which have the same
  metrics, so page counts should match. The fidelity report uses LibreOffice, so it tests this assumption.
- Until the font files are bundled and the heuristic uses real metrics, the layout is an approximation and
  line breaks can differ on some text.

## Follow-ups

- Bundle the font files and their licences in the editor distribution (Carlito and Caladea are under the
  SIL Open Font License; Liberation fonts are under their own open licence, confirm before shipping).
- Replace the heuristic advance tables with metrics read from the bundled font files.
- Run the font metric parity test (browser against the server renderer) and record the result here.

## References

- `packages/schema/src/styles.ts` (`FONTS`, `FONT_FALLBACKS`)
- `packages/export-docx/README.md` (`DEFAULT_FONT_MAP`)
- `packages/layout/README.md` (Measurers)
