/**
 * Minimal, document-like CSS for clinical and form blocks.
 *
 * @module
 */

/** CSS for clinical and form blocks. Colours fall back to neutral values. */
export const CLINICAL_STYLES = `
/* BeakBlock clinical and forms blocks */
.beakblock-sop-step {
  margin: 0.25em 0;
  padding-left: 2.25em;
  position: relative;
}
.beakblock-sop-step::before {
  content: attr(data-step-number) ".";
  position: absolute;
  top: 0;
  left: 0;
  width: 1.75em;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.beakblock-sop-step > p { margin: 0; }
.beakblock-sop-step--critical {
  font-weight: 600;
}

.beakblock-safety {
  border-left: 4px solid #b45309;
  background: rgba(180, 83, 9, 0.08);
  padding: 0.5em 0.75em;
  margin: 0.5em 0;
  border-radius: 2px;
}
.beakblock-safety::before {
  content: attr(data-safety-level);
  display: block;
  font-size: 0.75em;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #92400e;
}
.beakblock-safety--warning { border-left-color: #c2410c; background: rgba(194, 65, 12, 0.08); }
.beakblock-safety--danger { border-left-color: #b91c1c; background: rgba(185, 28, 28, 0.08); }
.beakblock-safety--danger::before { color: #991b1b; }

.beakblock-reagent-table { margin: 0.75em 0; }
.beakblock-reagent-table table { width: 100%; border-collapse: collapse; }
.beakblock-reagent-table th,
.beakblock-reagent-table td { border: 1px solid #d6d3d1; padding: 0.3em 0.5em; text-align: left; }

.beakblock-test-method,
.beakblock-specimen-requirements,
.beakblock-qc-criteria {
  border: 1px solid #d6d3d1;
  border-radius: 4px;
  padding: 0.5em 0.75em;
  margin: 0.5em 0;
  user-select: none;
}
.beakblock-clinical-row { display: flex; gap: 0.5em; font-size: 0.92em; }
.beakblock-clinical-label { font-weight: 600; min-width: 9em; }

.beakblock-equipment {
  display: inline-block;
  padding: 0 0.4em;
  border-radius: 3px;
  background: rgba(59, 130, 246, 0.1);
  font-size: 0.92em;
}
.beakblock-equipment--inactive {
  background: rgba(180, 83, 9, 0.12);
  text-decoration: line-through;
}

.beakblock-form-field {
  margin: 0.4em 0;
}
.beakblock-form-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5em;
}
.beakblock-form-control .beakblock-form-label {
  min-width: 10em;
  font-weight: 500;
}
.beakblock-form-control input,
.beakblock-form-control select {
  font: inherit;
  padding: 0.2em 0.4em;
  border: 1px solid #a8a29e;
  border-radius: 3px;
  min-width: 14em;
}
.beakblock-form-control input:disabled,
.beakblock-form-control select:disabled {
  background: #f5f5f4;
  color: #57534e;
}
.beakblock-form-radio-group { display: inline-flex; gap: 0.75em; flex-wrap: wrap; }
.beakblock-form-radio { display: inline-flex; gap: 0.25em; align-items: center; }
.beakblock-form-unit { color: #57534e; font-size: 0.9em; }
.beakblock-form-calculated-value { font-variant-numeric: tabular-nums; font-weight: 600; }
.beakblock-form-container {
  border-left: 2px solid #d6d3d1;
  padding-left: 0.75em;
  margin: 0.75em 0;
}
.beakblock-form-container-title { font-weight: 600; margin-bottom: 0.25em; }

/* Print view */
@media print {
  .beakblock-form-control input,
  .beakblock-form-control select { border: none; min-width: 0; }
}
`;

const STYLE_ELEMENT_ID = 'beakblock-clinical-styles';

/**
 * Injects {@link CLINICAL_STYLES} into the document head once. Safe to call
 * repeatedly and when there is no DOM (returns `false`).
 *
 * @returns `true` when the styles are present after the call
 */
export function injectClinicalStyles(): boolean {
  if (typeof document === 'undefined' || !document.head) return false;
  if (document.getElementById(STYLE_ELEMENT_ID)) return true;
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = CLINICAL_STYLES;
  document.head.appendChild(style);
  return true;
}
