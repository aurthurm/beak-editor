/**
 * Stylesheet for the QMS block family.
 *
 * The controlled-section frame stays invisible until hover or focus, so a controlled
 * document reads like a normal Office document. Colours are CSS custom properties with
 * dark-mode overrides.
 *
 * @module
 */

/** Element id of the injected stylesheet. */
export const QMS_STYLE_ELEMENT_ID = 'beakblock-qms-styles';

/** CSS for controlled sections and QMS blocks. */
export const qmsStyles = `
:root {
  --beakblock-qms-bracket: #8aa4c8;
  --beakblock-qms-tab-text: #5b6b7f;
  --beakblock-qms-tab-bg: #eef2f7;
  --beakblock-qms-approved-bg: #e3f4e8;
  --beakblock-qms-border: #c9d1dc;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --beakblock-qms-bracket: #5f7fa8;
    --beakblock-qms-tab-text: #aab6c6;
    --beakblock-qms-tab-bg: #263140;
    --beakblock-qms-approved-bg: #1f3a29;
    --beakblock-qms-border: #3a4655;
  }
}
:root[data-theme="dark"] {
  --beakblock-qms-bracket: #5f7fa8;
  --beakblock-qms-tab-text: #aab6c6;
  --beakblock-qms-tab-bg: #263140;
  --beakblock-qms-approved-bg: #1f3a29;
  --beakblock-qms-border: #3a4655;
}
.beakblock-controlled-section {
  position: relative;
  margin: 0.25em 0;
  border-left: 2px solid transparent;
  padding-left: 0;
  transition: border-color 0.15s ease;
}
.beakblock-controlled-section:hover,
.beakblock-controlled-section:focus-within {
  border-left-color: var(--beakblock-qms-bracket);
}
.beakblock-controlled-section > .beakblock-cs-tab {
  display: flex;
  align-items: center;
  gap: 0.5em;
  height: 0;
  overflow: hidden;
  opacity: 0;
  font: 11px/1.2 system-ui, sans-serif;
  color: var(--beakblock-qms-tab-text);
  user-select: none;
  transition: opacity 0.15s ease;
}
.beakblock-controlled-section:hover > .beakblock-cs-tab,
.beakblock-controlled-section:focus-within > .beakblock-cs-tab,
.beakblock-controlled-section[data-required-tab] > .beakblock-cs-tab {
  height: auto;
  opacity: 1;
  padding: 2px 6px;
}
.beakblock-controlled-section[data-required-tab] > .beakblock-cs-tab {
  opacity: 0.55;
}
.beakblock-controlled-section[data-required-tab]:hover > .beakblock-cs-tab,
.beakblock-controlled-section[data-required-tab]:focus-within > .beakblock-cs-tab {
  opacity: 1;
}
.beakblock-cs-title {
  font-weight: 600;
}
.beakblock-cs-state {
  padding: 0 6px;
  border-radius: 8px;
  background: var(--beakblock-qms-tab-bg);
}
.beakblock-cs-state[data-state="approved"] {
  background: var(--beakblock-qms-approved-bg);
}
.beakblock-cs-lock-slot {
  display: inline-flex;
  align-items: center;
}
.beakblock-controlled-section[data-editable="false"] > .beakblock-cs-content {
  cursor: default;
}
.beakblock-controlled-section.is-locked {
  border-left-color: var(--beakblock-qms-border);
}
.beakblock-qms-block {
  margin: 0.5em 0;
}
.beakblock-qms-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.9em;
}
.beakblock-qms-table caption {
  caption-side: top;
  text-align: left;
  font-weight: 600;
  padding-bottom: 4px;
}
.beakblock-qms-table th,
.beakblock-qms-table td {
  border: 1px solid var(--beakblock-qms-border);
  padding: 4px 6px;
  text-align: left;
  vertical-align: top;
}
.beakblock-signature-line {
  border-bottom: 1px solid currentColor;
  padding-top: 14px;
  min-width: 240px;
}
.beakblock-signature-meta {
  font-size: 0.8em;
  opacity: 0.7;
}
.beakblock-notice-text {
  margin: 0;
  font-size: 0.8em;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-align: center;
}
.beakblock-acknowledgement {
  display: flex;
  gap: 0.5em;
  align-items: flex-start;
}
@media print {
  .beakblock-controlled-section > .beakblock-cs-tab {
    display: none;
  }
  .beakblock-controlled-section {
    border-left-color: transparent;
  }
}
`;

/**
 * Injects the QMS stylesheet into the document head once. Returns false when there is no
 * document (server rendering) or the stylesheet is already present.
 */
export function injectQmsStyles(doc: Document | undefined = typeof document !== 'undefined' ? document : undefined): boolean {
  if (!doc) return false;
  if (doc.getElementById(QMS_STYLE_ELEMENT_ID)) return false;
  const style = doc.createElement('style');
  style.id = QMS_STYLE_ELEMENT_ID;
  style.textContent = qmsStyles;
  doc.head.appendChild(style);
  return true;
}
