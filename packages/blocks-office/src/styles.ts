/**
 * Stylesheet and style injection for office blocks.
 *
 * @module
 */

/** Element id of the injected office stylesheet. */
export const OFFICE_BLOCKS_STYLE_ID = 'beakblock-office-blocks-styles';

/** Office blocks CSS. Colours use the editor's `--ob-*` tokens where available. */
export const officeBlocksCSS = `
/* BeakBlock office blocks */
.beakblock-footnote,
.beakblock-endnote {
  font-size: 0.72em;
  vertical-align: super;
  line-height: 0;
  color: #2563eb;
  cursor: pointer;
  padding: 0 1px;
}

.beakblock-caption {
  font-size: 0.9em;
  color: #475569;
  margin: 0.25em 0 0.75em;
}

.beakblock-caption[data-caption-number]::before {
  content: attr(data-caption-label) " " attr(data-caption-number) ": ";
  font-weight: 600;
  color: #1e293b;
}

.beakblock-equation {
  text-align: center;
  margin: 0.75em 0;
  overflow-x: auto;
}

.beakblock-inline-equation {
  white-space: nowrap;
}

.beakblock-equation-source {
  font-family: var(--ob-font-mono, ui-monospace, monospace);
  font-size: 0.9em;
  background: #f1f5f9;
  padding: 0.1em 0.35em;
  border-radius: 3px;
}

.beakblock-xref {
  color: #1d4ed8;
  border-bottom: 1px dotted #93c5fd;
}

.beakblock-variable {
  background: #ecfdf5;
  border-radius: 3px;
  padding: 0 2px;
}

.beakblock-computed {
  font-variant-numeric: tabular-nums;
  background: #f5f3ff;
  border-radius: 3px;
  padding: 0 2px;
}

.beakblock-textbox {
  border-style: solid;
  border-color: #64748b;
  padding: 0.5em 0.75em;
  margin: 0.5em 0;
  box-sizing: border-box;
  max-width: 100%;
}

.beakblock-textbox[data-float="left"] {
  float: left;
  margin: 0.25em 1em 0.5em 0;
}

.beakblock-textbox[data-float="right"] {
  float: right;
  margin: 0.25em 0 0.5em 1em;
}

.beakblock-shape {
  display: block;
  margin: 0.5em auto;
  max-width: 100%;
}

.beakblock-shape svg {
  max-width: 100%;
  height: auto;
}

.beakblock-conditional {
  border-left: 3px solid #f59e0b;
  padding-left: 0.6em;
  margin: 0.5em 0;
}

.beakblock-conditional[data-condition-result="false"] {
  display: none;
}

.beakblock-repeating {
  border-left: 3px dashed #6366f1;
  padding-left: 0.6em;
  margin: 0.5em 0;
}

.beakblock-repeating[data-repeat-count]::before {
  content: "Repeats for " attr(data-repeat-count) " item(s)";
  display: block;
  font-size: 0.75em;
  color: #6366f1;
}

.beakblock-reusable {
  border: 1px dashed #94a3b8;
  border-radius: 6px;
  padding: 0.5em 0.75em;
  margin: 0.5em 0;
  background: #f8fafc;
}

.beakblock-reusable-header {
  display: flex;
  justify-content: space-between;
  gap: 0.5em;
  font-size: 0.8em;
  color: #475569;
  margin-bottom: 0.35em;
}

.beakblock-reusable-badge[data-pinned="false"] {
  color: #b45309;
}

.beakblock-reusable-missing {
  color: #b91c1c;
  font-style: italic;
}

@media print {
  .beakblock-conditional[data-condition-result="false"] {
    display: none;
  }
}
`;

/**
 * Injects the office blocks stylesheet into the document head once.
 *
 * @returns `true` when the stylesheet was added by this call
 */
export function injectOfficeBlocksStyles(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.getElementById(OFFICE_BLOCKS_STYLE_ID)) return false;
  const style = document.createElement('style');
  style.id = OFFICE_BLOCKS_STYLE_ID;
  style.textContent = officeBlocksCSS;
  document.head.appendChild(style);
  return true;
}
