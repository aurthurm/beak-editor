/**
 * CSS Style Injection
 *
 * Auto-injects BeakBlock editor styles into the document head.
 * This allows the editor to work without requiring manual CSS imports.
 *
 * @module
 */

const STYLE_ID = 'beakblock-styles';
let stylesInjected = false;

/**
 * The complete BeakBlock editor CSS as a string.
 * This is embedded so the editor can work without external CSS files.
 */
const EDITOR_STYLES = `
/* BeakBlock Editor Styles - Auto-injected */

.beakblock-container,
.beakblock-editor {
  --ob-foreground: var(--foreground, 25 5% 22%);
  --ob-background: var(--background, 0 0% 100%);
  --ob-muted: var(--muted, 40 6% 96%);
  --ob-muted-foreground: var(--muted-foreground, 25 2% 57%);
  --ob-border: var(--border, 40 6% 90%);
  --ob-primary: var(--primary, 25 5% 22%);
  --ob-radius: var(--radius, 0.25rem);
  --ob-font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --ob-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --ob-font-size: 16px;
  --ob-line-height: 1.6;
  --ob-block-spacing: 0.75em;
  --ob-content-padding: 1rem;
}

.beakblock-container {
  position: relative;
  width: 100%;
}

.beakblock-editor {
  font-family: var(--ob-font-family);
  font-size: var(--ob-font-size);
  line-height: var(--ob-line-height);
  color: hsl(var(--ob-foreground));
  background: hsl(var(--ob-background));
  padding: var(--ob-content-padding) var(--ob-content-padding) var(--ob-content-padding) calc(var(--ob-content-padding) + 48px);
  outline: none;
  min-height: 100px;
}

.beakblock-editor:focus {
  outline: none;
}

/* ProseMirror Core */
.ProseMirror {
  outline: none;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.ProseMirror-focused {
  outline: none;
}

.ProseMirror p.is-empty::before {
  content: attr(data-placeholder);
  color: hsl(var(--ob-muted-foreground));
  pointer-events: none;
  position: absolute;
}

.ProseMirror ::selection {
  background: hsl(var(--ob-primary) / 0.2);
}

.ProseMirror-gapcursor {
  display: none;
  pointer-events: none;
  position: absolute;
}

.ProseMirror-gapcursor:after {
  content: '';
  display: block;
  position: absolute;
  top: -2px;
  width: 20px;
  border-top: 1px solid hsl(var(--ob-foreground));
  animation: ProseMirror-cursor-blink 1.1s steps(2, start) infinite;
}

@keyframes ProseMirror-cursor-blink {
  to { visibility: hidden; }
}

.ProseMirror-focused .ProseMirror-gapcursor {
  display: block;
}

.ProseMirror-dropcursor {
  position: absolute;
  border-left: 2px solid hsl(var(--ob-primary));
  pointer-events: none;
}

/* Block Spacing */
.beakblock-editor > * + * {
  margin-top: var(--ob-block-spacing);
}

/* Paragraph */
.beakblock-editor p {
  margin: 0;
  line-height: 1.72;
  margin-block-start: 1em;
  margin-block-end: 1em;
}

/* Headings */
.beakblock-editor h1,
.beakblock-editor h2,
.beakblock-editor h3,
.beakblock-editor h4,
.beakblock-editor h5,
.beakblock-editor h6 {
  margin: 0;
  font-family: var(--ob-font-heading);
  font-weight: 600;
  line-height: 1.12;
  letter-spacing: -0.045em;
  text-wrap: balance;
}

.beakblock-editor h1 {
  font-size: 2.35em;
  margin-top: 0.85em;
}

.beakblock-editor h2 {
  font-size: 1.72em;
  margin-top: 0.9em;
}

.beakblock-editor h3 {
  font-size: 1.34em;
  margin-top: 0.85em;
}

.beakblock-editor h4 {
  font-size: 1.08em;
}

.beakblock-editor h5 {
  font-size: 1em;
}

.beakblock-editor h6 {
  font-size: 0.875em;
  color: hsl(var(--ob-muted-foreground));
}

/* Inline Formatting */
.beakblock-editor strong {
  font-weight: 600;
}

.beakblock-editor em {
  font-style: italic;
}

.beakblock-editor u {
  text-decoration: underline;
}

.beakblock-editor s {
  text-decoration: line-through;
}

.beakblock-editor code {
  font-family: var(--ob-font-mono);
  font-size: 0.9em;
  background: hsl(var(--ob-muted));
  padding: 0.125em 0.25em;
  border-radius: calc(var(--ob-radius) / 2);
}

/* Links */
.beakblock-editor a {
  color: hsl(221 83% 53%);
  text-decoration: underline;
  text-underline-offset: 0.14em;
  text-decoration-thickness: 0.08em;
}

.beakblock-editor a:hover {
  color: hsl(221 83% 48%);
}

/* Lists */
.beakblock-editor ul,
.beakblock-editor ol {
  margin: 0;
  padding-left: 1.5em;
}

.beakblock-editor ul.beakblock-bullet-list,
.beakblock-editor ol.beakblock-ordered-list {
  margin: 1em 0;
  padding-left: 1.3em !important;
}

.beakblock-editor ul.beakblock-bullet-list li,
.beakblock-editor ol.beakblock-ordered-list li {
  margin: 0.25em 0;
}

.beakblock-editor li::marker {
  line-height: 1.5em;
}

.beakblock-editor li > p {
  margin: 0;
}

/* Blockquote */
.beakblock-editor blockquote {
  margin: 0.5em 0;
  padding-left: 1em;
  border-left: 3px solid hsl(var(--ob-border));
  border-radius: 0 0.625rem 0.625rem 0;
  background: transparent;
  font-style: italic;
  line-height: 1.68;
}

/* Callout */
.beakblock-editor .beakblock-callout {
  margin: 0;
  padding: 0.75em 1em;
  border-radius: var(--ob-radius);
  border-left: 4px solid;
  background: hsl(var(--ob-muted) / 0.5);
}

.beakblock-editor .beakblock-callout--info {
  border-left-color: hsl(220 90% 56%);
  background: hsl(220 90% 56% / 0.1);
}

.beakblock-editor .beakblock-callout--warning {
  border-left-color: hsl(38 92% 50%);
  background: hsl(38 92% 50% / 0.1);
}

.beakblock-editor .beakblock-callout--success {
  border-left-color: hsl(142 76% 36%);
  background: hsl(142 76% 36% / 0.1);
}

.beakblock-editor .beakblock-callout--error {
  border-left-color: hsl(0 84% 60%);
  background: hsl(0 84% 60% / 0.1);
}

.beakblock-editor .beakblock-callout--note {
  border-left-color: hsl(var(--ob-muted-foreground));
  background: hsl(var(--ob-muted) / 0.5);
}

/* Code Block */
.beakblock-editor pre {
  font-family: var(--ob-font-mono);
  font-size: 0.9em;
  background: hsl(0 0% 97%);
  padding: 0.5em 0.75em;
  border-radius: calc(var(--ob-radius) / 2 + 2px);
  border: 1px solid hsl(0 0% 88%);
  overflow-x: auto;
  margin: 0;
}

.beakblock-editor pre code {
  background: none;
  padding: 0;
}

/* Divider */
.beakblock-editor hr {
  border: none;
  border-top: 1px solid hsl(var(--ob-border));
  margin: 1.5em 0;
}

/* Side Menu */
.ob-side-menu {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 1px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  user-select: none;
  z-index: 100;
}

.ob-side-menu--visible {
  opacity: 1;
  pointer-events: auto;
}

.ob-add-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: #9ca3af;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.ob-add-button svg {
  width: 14px;
  height: 14px;
}

.ob-add-button:hover {
  background: #f3f4f6;
  color: #374151;
}

.ob-add-button:active {
  background: #e5e7eb;
}

.ob-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 24px;
  cursor: grab;
  color: #9ca3af;
  border-radius: 4px;
  transition: background 0.15s ease, color 0.15s ease;
  user-select: none;
  -webkit-user-select: none;
}

.ob-drag-handle svg {
  width: 14px;
  height: 14px;
}

.ob-drag-handle:hover {
  background: #f3f4f6;
  color: #374151;
}

.ob-drag-handle--dragging {
  cursor: grabbing;
}

.ob-drag-handle:active {
  cursor: grabbing;
}

.ob-block-dragging {
  opacity: 0.4;
  background: hsl(var(--ob-muted));
  border-radius: var(--ob-radius);
}

.ob-drop-indicator {
  height: 3px;
  background: hsl(220 90% 56%);
  border-radius: 2px;
  margin: -2px 0;
  pointer-events: none;
  position: relative;
}

.ob-drop-indicator::before {
  content: '';
  position: absolute;
  left: -4px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: hsl(220 90% 56%);
}

.beakblock-editor > *,
.beakblock-editor p,
.beakblock-editor h1,
.beakblock-editor h2,
.beakblock-editor h3,
.beakblock-editor h4,
.beakblock-editor h5,
.beakblock-editor h6,
.beakblock-editor blockquote,
.beakblock-editor .beakblock-callout,
.beakblock-editor pre,
.beakblock-editor ul,
.beakblock-editor ol,
.beakblock-editor hr {
  position: relative;
}

.beakblock-editor [data-block-id] {
  position: relative;
}

/* Slash Menu */
.ob-slash-menu {
  --ob-foreground: var(--foreground, 25 5% 22%);
  --ob-background: var(--background, 0 0% 100%);
  --ob-muted: var(--muted, 40 6% 96%);
  --ob-muted-foreground: var(--muted-foreground, 25 2% 57%);
  --ob-border: var(--border, 40 6% 90%);
  --ob-radius: var(--radius, 0.5rem);
  background: hsl(var(--ob-background));
  border: 1px solid hsl(var(--ob-border));
  border-radius: var(--ob-radius);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
  max-height: 300px;
  min-width: 220px;
  max-width: 320px;
  overflow-y: auto;
  padding: 6px;
}

.ob-slash-menu-empty {
  padding: 8px 12px;
  color: hsl(var(--ob-muted-foreground));
  font-size: 0.875em;
  text-align: center;
}

.ob-slash-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: calc(var(--ob-radius) - 2px);
  cursor: pointer;
  transition: background 0.1s ease;
}

.ob-slash-menu-item:hover,
.ob-slash-menu-item--selected {
  background: hsl(var(--ob-muted));
}

.ob-slash-menu-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  color: hsl(var(--ob-muted-foreground));
}

.ob-slash-menu-item--selected .ob-slash-menu-item-icon {
  color: hsl(var(--ob-foreground));
}

.ob-slash-menu-item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.ob-slash-menu-item-title {
  font-size: 0.875em;
  font-weight: 500;
  color: hsl(var(--ob-foreground));
}

.ob-slash-menu-item-description {
  font-size: 0.75em;
  color: hsl(var(--ob-muted-foreground));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ob-slash-menu-icon-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 14px;
  line-height: 1;
}

.ob-slash-picker {
  min-width: 320px;
  max-width: 420px;
  background:
    linear-gradient(180deg, hsl(var(--ob-background) / 0.98), hsl(var(--ob-background) / 0.94)),
    hsl(var(--ob-background));
  border: 1px solid hsl(var(--ob-border) / 0.95);
  border-radius: calc(var(--ob-radius) + 0.375rem);
  box-shadow: 0 22px 54px rgba(15, 23, 42, 0.14), 0 2px 8px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(18px);
  padding: 14px;
}

.ob-slash-picker-backdrop {
  position: absolute;
  inset: 0;
  z-index: 1000;
  background: hsl(var(--ob-background) / 0.02);
  backdrop-filter: blur(1px);
}

.ob-slash-picker-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.ob-slash-picker-title {
  font-size: 0.9375rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: hsl(var(--ob-foreground));
}

.ob-slash-picker-subtitle {
  font-size: 0.75rem;
  line-height: 1.4;
  color: hsl(var(--ob-muted-foreground));
}

.ob-slash-picker-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 0 2px;
  border: 1px solid hsl(var(--ob-border));
  border-radius: 12px;
  background: linear-gradient(180deg, hsl(var(--ob-background)), hsl(var(--ob-muted) / 0.22));
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.7) inset;
}

.ob-slash-picker-search {
  flex: 1;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: hsl(var(--ob-foreground));
  padding: 11px 6px 11px 0;
  font-size: 0.875rem;
  outline: none;
  min-width: 0;
}

.ob-slash-picker-search::placeholder {
  color: hsl(var(--ob-muted-foreground));
}

.ob-slash-picker-search:focus {
  box-shadow: none;
}

.ob-slash-picker-search-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 10px;
  color: hsl(var(--ob-muted-foreground));
  flex: 0 0 auto;
}

.ob-slash-picker-search-icon svg {
  width: 16px;
  height: 16px;
}

.ob-slash-picker-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}

.ob-slash-picker-grid--emoji {
  max-height: 272px;
  overflow: auto;
  padding-right: 2px;
}

.ob-slash-picker-grid--icon {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  max-height: 264px;
  overflow: auto;
  padding-right: 2px;
}

.ob-slash-picker-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  min-height: 42px;
  padding: 0;
  border: 1px solid hsl(var(--ob-border) / 0.95);
  border-radius: 12px;
  background: linear-gradient(180deg, hsl(var(--ob-background)), hsl(var(--ob-muted) / 0.4));
  color: hsl(var(--ob-foreground));
  font-size: 19px;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.72) inset;
  cursor: pointer;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease,
    border-color 120ms ease,
    background-color 120ms ease;
}

.ob-slash-picker-item:hover {
  transform: translateY(-1px);
  border-color: hsl(var(--ob-primary) / 0.2);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  background: linear-gradient(180deg, hsl(var(--ob-background)), hsl(var(--ob-muted)));
}

.ob-slash-picker-item:focus-visible {
  outline: 2px solid hsl(var(--ob-primary) / 0.35);
  outline-offset: 2px;
}

.ob-slash-picker-footer {
  margin-top: 12px;
}

.ob-slash-picker-item--emoji {
  min-height: 44px;
  font-size: 22px;
}

.ob-slash-picker-item--icon {
  min-height: 44px;
  min-width: 44px;
  padding: 0;
  border-radius: 12px;
  font-size: 16px;
}

.ob-slash-picker-item--icon .iconify {
  width: 22px;
  height: 22px;
}

.ob-slash-picker-emoji {
  font-size: 24px;
  line-height: 1;
}

.ob-slash-picker-empty {
  grid-column: 1 / -1;
  padding: 18px 12px;
  font-size: 0.8125rem;
  color: hsl(var(--ob-muted-foreground));
  text-align: center;
}

.ob-slash-picker-close {
  width: 100%;
  border: 1px solid hsl(var(--ob-border));
  border-radius: 10px;
  background: linear-gradient(180deg, hsl(var(--ob-background)), hsl(var(--ob-muted) / 0.55));
  color: hsl(var(--ob-foreground));
  cursor: pointer;
  padding: 9px 10px;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* Bubble Menu */
.ob-bubble-menu {
  --ob-foreground: var(--foreground, 222 47% 11%);
  --ob-background: var(--background, 0 0% 100%);
  --ob-muted: var(--muted, 210 40% 96%);
  --ob-muted-foreground: var(--muted-foreground, 215 16% 47%);
  --ob-border: var(--border, 214 32% 91%);
  --ob-primary: var(--primary, 222 47% 11%);
  --ob-radius: var(--radius, 0.5rem);
  display: flex;
  align-items: center;
  gap: 1px;
  background: hsl(var(--ob-background));
  border: 1px solid hsl(var(--ob-border));
  border-radius: var(--ob-radius);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.05);
  padding: 4px 6px;
}

.ob-bubble-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: hsl(var(--ob-muted-foreground));
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.ob-bubble-menu-btn svg {
  width: 15px;
  height: 15px;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ob-bubble-menu-btn:hover {
  background: hsl(var(--ob-muted));
  color: hsl(var(--ob-foreground));
}

.ob-bubble-menu-btn--active {
  background: hsl(215 20% 85%);
  color: hsl(var(--ob-foreground));
}

.ob-bubble-menu-btn--active:hover {
  background: hsl(215 20% 80%);
  color: hsl(var(--ob-foreground));
}

.ob-bubble-menu-divider {
  width: 1px;
  height: 16px;
  background: hsl(var(--ob-border));
  margin: 0 6px;
  flex-shrink: 0;
}

/* Text Alignment */
.ob-text-align-buttons {
  display: flex;
  align-items: center;
  gap: 1px;
}

/* Block Type Selector */
.ob-block-type-selector {
  position: relative;
}

.ob-block-type-selector-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: hsl(var(--ob-foreground));
  cursor: pointer;
  transition: background 0.15s ease;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.ob-block-type-selector-btn:hover {
  background: hsl(var(--ob-muted));
}

.ob-block-type-selector-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: hsl(var(--ob-muted-foreground));
}

.ob-block-type-selector-icon svg {
  width: 14px;
  height: 14px;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ob-block-type-selector-label {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ob-block-type-selector-chevron {
  width: 14px;
  height: 14px;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: hsl(var(--ob-muted-foreground));
  transition: transform 0.15s ease;
}

.ob-block-type-selector-chevron--open {
  transform: rotate(180deg);
}

.ob-block-type-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: hsl(var(--ob-background));
  border: 1px solid hsl(var(--ob-border));
  border-radius: var(--ob-radius);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08);
  padding: 4px;
  min-width: 160px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1001;
  animation: ob-dropdown-fade-in 0.12s ease-out;
}

.ob-block-type-dropdown--upward {
  top: auto;
  bottom: 100%;
  margin-top: 0;
  margin-bottom: 4px;
  animation: ob-dropdown-fade-in-up 0.12s ease-out;
}

@keyframes ob-dropdown-fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes ob-dropdown-fade-in-up {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.ob-block-type-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: calc(var(--ob-radius) - 2px);
  color: hsl(var(--ob-foreground));
  cursor: pointer;
  transition: background 0.1s ease;
  text-align: left;
  font-size: 13px;
}

.ob-block-type-option:hover {
  background: hsl(var(--ob-muted));
}

.ob-block-type-option--active {
  background: hsl(var(--ob-muted) / 0.7);
}

.ob-block-type-option-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: hsl(var(--ob-muted-foreground));
  flex-shrink: 0;
}

.ob-block-type-option-icon svg {
  width: 16px;
  height: 16px;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ob-block-type-option-label {
  flex: 1;
}

.ob-block-type-option-check {
  width: 16px;
  height: 16px;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: hsl(var(--ob-primary));
  flex-shrink: 0;
}

/* Column Layout */
.ob-column-list {
  display: grid;
  gap: 1rem;
  width: 100%;
  margin: 0.75rem 0;
  position: relative;
  align-items: start;
}

.ob-column {
  position: relative;
  min-width: 0;
  min-height: 1em;
  padding: 0.25rem 0;
}

.ob-column .ob-side-menu {
  display: none !important;
}

.ob-column > p:only-child:has(> br.ProseMirror-trailingBreak)::before {
  content: 'Write, type "/" for commands...';
  float: left;
  height: 0;
  color: hsl(var(--ob-muted-foreground));
  pointer-events: none;
}

/* Table */
.beakblock-editor table,
.beakblock-editor .ob-table {
  border-collapse: collapse;
  width: calc(100% - 28px);
  margin: 0.5em 0 28px 0;
  table-layout: fixed;
}

.beakblock-editor th,
.beakblock-editor td,
.beakblock-editor .ob-table-cell,
.beakblock-editor .ob-table-header {
  border: 1px solid hsl(var(--ob-border));
  padding: 0.5em 0.75em;
  text-align: left;
  vertical-align: top;
  position: relative;
  min-width: 50px;
}

.beakblock-editor th,
.beakblock-editor .ob-table-header {
  background: hsl(var(--ob-muted));
  font-weight: 600;
}

.beakblock-editor .ob-table-cell > p,
.beakblock-editor .ob-table-header > p,
.beakblock-editor td > p,
.beakblock-editor th > p {
  margin: 0;
}

.beakblock-editor .ob-table-cell > p:first-child,
.beakblock-editor .ob-table-header > p:first-child {
  margin-top: 0;
}

.beakblock-editor .ob-table-cell > p:last-child,
.beakblock-editor .ob-table-header > p:last-child {
  margin-bottom: 0;
}

.beakblock-editor .ob-table-cell.selectedCell,
.beakblock-editor .ob-table-header.selectedCell {
  background: hsl(220 90% 56% / 0.1);
}

.beakblock-editor .ob-table-cell-resize-handle,
.beakblock-editor .ob-table-header-resize-handle {
  position: absolute;
  right: -2px;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background: transparent;
  z-index: 10;
}

.beakblock-editor .ob-table-cell-resize-handle:hover,
.beakblock-editor .ob-table-header-resize-handle:hover {
  background: hsl(var(--ob-primary) / 0.3);
}

.beakblock-editor .ob-table-wrapper {
  overflow-x: auto;
  margin: 0.5em 0;
}

/* Link Popover */
.ob-link-popover-anchor {
  position: relative;
  display: inline-flex;
}

.ob-link-popover {
  --ob-foreground: var(--foreground, 222 47% 11%);
  --ob-background: var(--background, 0 0% 100%);
  --ob-muted: var(--muted, 210 40% 96%);
  --ob-muted-foreground: var(--muted-foreground, 215 16% 47%);
  --ob-border: var(--border, 214 32% 91%);
  --ob-primary: var(--primary, 222 47% 11%);
  --ob-destructive: var(--destructive, 0 84% 60%);
  --ob-radius: var(--radius, 0.5rem);
  position: absolute;
  background: hsl(var(--ob-background));
  border: 1px solid hsl(var(--ob-border));
  border-radius: var(--ob-radius);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08);
  padding: 4px;
  animation: ob-link-popover-fade-in 0.12s ease-out;
}

@keyframes ob-link-popover-fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.ob-link-popover-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ob-link-popover-input-row {
  display: flex;
}

.ob-link-popover-input-wrapper {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px 2px 8px;
  border: 1px solid hsl(var(--ob-border));
  border-radius: calc(var(--ob-radius) - 2px);
  background: hsl(var(--ob-background));
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.ob-link-popover-input-wrapper:focus-within {
  border-color: hsl(var(--ob-primary) / 0.5);
  box-shadow: 0 0 0 2px hsl(var(--ob-primary) / 0.1);
}

.ob-link-popover-input-wrapper--error {
  border-color: hsl(var(--ob-destructive));
}

.ob-link-popover-input-wrapper--error:focus-within {
  border-color: hsl(var(--ob-destructive));
  box-shadow: 0 0 0 2px hsl(var(--ob-destructive) / 0.1);
}

.ob-link-popover-input-icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: hsl(var(--ob-muted-foreground));
}

.ob-link-popover-input {
  flex: 1;
  min-width: 180px;
  padding: 6px 8px;
  font-size: 13px;
  border: none;
  background: transparent;
  color: hsl(var(--ob-foreground));
  outline: none;
}

.ob-link-popover-input::placeholder {
  color: hsl(var(--ob-muted-foreground));
}

.ob-link-popover-inline-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: hsl(var(--ob-muted-foreground));
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.ob-link-popover-inline-btn svg {
  width: 14px;
  height: 14px;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ob-link-popover-inline-btn:hover {
  background: hsl(var(--ob-muted));
  color: hsl(var(--ob-foreground));
}

.ob-link-popover-inline-btn--primary {
  background: hsl(var(--ob-primary));
  color: hsl(var(--ob-background));
}

.ob-link-popover-inline-btn--primary:hover {
  background: hsl(var(--ob-primary) / 0.85);
  color: hsl(var(--ob-background));
}

.ob-link-popover-inline-btn--danger:hover {
  background: hsl(var(--ob-destructive) / 0.1);
  color: hsl(var(--ob-destructive));
}

.ob-link-popover-error {
  margin: 0;
  padding: 0 8px;
  font-size: 11px;
  color: hsl(var(--ob-destructive));
}

/* Color Picker */
.ob-color-picker {
  position: relative;
}

.ob-color-picker > .ob-bubble-menu-btn {
  position: relative;
}

.ob-color-picker-indicator {
  position: absolute;
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
  width: 14px;
  height: 3px;
  border-radius: 2px;
}

.ob-color-picker-dropdown {
  background: hsl(var(--ob-background));
  border: 1px solid hsl(var(--ob-border));
  border-radius: var(--ob-radius);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08);
  padding: 8px;
  min-width: 160px;
  z-index: 1002;
}

.ob-color-picker-section {
  padding: 4px 0;
}

.ob-color-picker-section:first-child {
  padding-top: 0;
}

.ob-color-picker-section:last-child {
  padding-bottom: 0;
}

.ob-color-picker-divider {
  height: 1px;
  background: hsl(var(--ob-border));
  margin: 8px 0;
}

.ob-color-picker-label {
  font-size: 11px;
  font-weight: 500;
  color: hsl(var(--ob-muted-foreground));
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ob-color-picker-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.ob-color-picker-option {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.1s ease;
}

.ob-color-picker-option:hover {
  border-color: hsl(var(--ob-border));
  transform: scale(1.05);
}

.ob-color-picker-option--active {
  border-color: hsl(var(--ob-primary));
  background: hsl(var(--ob-muted) / 0.5);
}

.ob-color-picker-option svg {
  width: 20px;
  height: 20px;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: hsl(var(--ob-muted-foreground));
}

.ob-color-picker-swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.ob-color-picker-swatch--text {
  background: transparent;
  font-size: 14px;
}

/* Multi-Block Selection */
.ob-block-selected {
  background: hsl(220 90% 56% / 0.1);
  outline: 2px solid hsl(220 90% 56% / 0.5);
  outline-offset: -2px;
  border-radius: var(--ob-radius);
}

.ob-block-selected::before {
  content: '';
  position: absolute;
  left: -24px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  background: hsl(220 90% 56%);
  border-radius: 50%;
}

/* Table Menu */
.ob-table-menu {
  --ob-foreground: var(--foreground, 222 47% 11%);
  --ob-background: var(--background, 0 0% 100%);
  --ob-muted: var(--muted, 210 40% 96%);
  --ob-muted-foreground: var(--muted-foreground, 215 16% 47%);
  --ob-border: var(--border, 214 32% 91%);
  --ob-primary: var(--primary, 222 47% 11%);
  --ob-destructive: var(--destructive, 0 84% 60%);
  --ob-radius: var(--radius, 0.5rem);
  display: flex;
  align-items: center;
  gap: 4px;
  background: hsl(var(--ob-background));
  border: 1px solid hsl(var(--ob-border));
  border-radius: var(--ob-radius);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.05);
  padding: 4px 8px;
  animation: ob-table-menu-fade-in 0.15s ease-out;
}

@keyframes ob-table-menu-fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.ob-table-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: hsl(var(--ob-muted-foreground));
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.ob-table-menu-btn svg {
  width: 16px;
  height: 16px;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ob-table-menu-btn:hover {
  background: hsl(var(--ob-muted));
  color: hsl(var(--ob-foreground));
}

.ob-table-menu-btn--danger {
  color: hsl(var(--ob-destructive));
}

.ob-table-menu-btn--danger:hover {
  background: hsl(var(--ob-destructive) / 0.1);
  color: hsl(var(--ob-destructive));
}

.ob-table-menu-divider {
  width: 1px;
  height: 20px;
  background: hsl(var(--ob-border));
  margin: 0 4px;
  flex-shrink: 0;
}

.ob-table-menu-info {
  font-size: 11px;
  color: hsl(var(--ob-muted-foreground));
  padding: 0 8px;
  white-space: nowrap;
}

.ob-table-menu-dropdown {
  position: relative;
}

.ob-table-menu-dropdown-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: hsl(var(--ob-foreground));
  cursor: pointer;
  transition: background 0.15s ease;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.ob-table-menu-dropdown-btn:hover {
  background: hsl(var(--ob-muted));
}

.ob-table-menu-dropdown-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: hsl(var(--ob-muted-foreground));
}

.ob-table-menu-dropdown-icon svg {
  width: 14px;
  height: 14px;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ob-table-menu-dropdown-label {
  min-width: 40px;
}

.ob-table-menu-dropdown-chevron {
  width: 12px;
  height: 12px;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: hsl(var(--ob-muted-foreground));
  transition: transform 0.15s ease;
}

.ob-table-menu-dropdown-chevron--open {
  transform: rotate(180deg);
}

.ob-table-menu-dropdown-content {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: hsl(var(--ob-background));
  border: 1px solid hsl(var(--ob-border));
  border-radius: var(--ob-radius);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08);
  padding: 4px;
  min-width: 180px;
  z-index: 1001;
  animation: ob-dropdown-fade-in 0.12s ease-out;
}

.ob-table-menu-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: calc(var(--ob-radius) - 2px);
  color: hsl(var(--ob-foreground));
  cursor: pointer;
  transition: background 0.1s ease;
  text-align: left;
  font-size: 13px;
}

.ob-table-menu-dropdown-item:hover {
  background: hsl(var(--ob-muted));
}

.ob-table-menu-dropdown-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ob-table-menu-dropdown-item:disabled:hover {
  background: transparent;
}

.ob-table-menu-dropdown-item svg {
  width: 16px;
  height: 16px;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: hsl(var(--ob-muted-foreground));
  flex-shrink: 0;
}

.ob-table-menu-dropdown-item span {
  flex: 1;
}

.ob-table-menu-dropdown-item--danger {
  color: hsl(var(--ob-destructive));
}

.ob-table-menu-dropdown-item--danger svg {
  color: hsl(var(--ob-destructive));
}

.ob-table-menu-dropdown-item--danger:hover {
  background: hsl(var(--ob-destructive) / 0.1);
}

/* Table Handles */
.ob-table-handles {
  pointer-events: none;
  z-index: 100;
}

.ob-table-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: auto;
}

.ob-table-handle--visible {
  opacity: 1;
}

.ob-table-handle--row {
  width: 24px;
}

.ob-table-handle--col {
  height: 24px;
}

.ob-table-handle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: hsl(var(--ob-background, 0 0% 100%));
  border: 1px solid hsl(var(--ob-border, 214 32% 91%));
  border-radius: 4px;
  color: hsl(var(--ob-muted-foreground, 215 16% 47%));
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.ob-table-handle-btn:hover {
  background: hsl(var(--ob-muted, 210 40% 96%));
  color: hsl(var(--ob-foreground, 222 47% 11%));
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.ob-table-handle-btn svg {
  width: 12px;
  height: 12px;
}

.ob-table-handle-menu {
  position: fixed;
  background: hsl(var(--ob-background, 0 0% 100%));
  border: 1px solid hsl(var(--ob-border, 214 32% 91%));
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08);
  padding: 4px;
  min-width: 150px;
  z-index: 1001;
  animation: ob-dropdown-fade-in 0.12s ease-out;
}

.ob-table-handle-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: hsl(var(--ob-foreground, 222 47% 11%));
  cursor: pointer;
  transition: background 0.1s ease;
  text-align: left;
  font-size: 13px;
  white-space: nowrap;
}

.ob-table-handle-menu button:hover {
  background: hsl(var(--ob-muted, 210 40% 96%));
}

.ob-table-handle-menu button svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.ob-table-handle-menu-danger {
  color: hsl(var(--ob-destructive, 0 84% 60%)) !important;
}

.ob-table-handle-menu-danger:hover {
  background: hsl(var(--ob-destructive, 0 84% 60%) / 0.1) !important;
}

.ob-table-extend-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: hsl(var(--ob-muted-foreground, 215 16% 47%) / 0.15);
  color: hsl(var(--ob-muted-foreground, 215 16% 47%));
  cursor: pointer;
  transition: all 0.15s ease;
  opacity: 0;
  pointer-events: auto;
  border-radius: 4px;
}

.ob-table-extend-btn--visible,
.ob-table-handles:hover .ob-table-extend-btn {
  opacity: 1;
}

.ob-table-extend-btn:hover {
  color: hsl(var(--ob-foreground, 222 47% 11%));
  background: hsl(var(--ob-muted-foreground, 215 16% 47%) / 0.3);
}

.ob-table-extend-btn svg {
  width: 14px;
  height: 14px;
}

.ob-table-extend-btn--col {
  width: 20px;
}

.ob-table-extend-btn--row {
  height: 20px;
}

.ob-table-cell .ob-side-menu,
.ob-table-header .ob-side-menu,
td .ob-side-menu,
th .ob-side-menu,
.beakblock-editor table .ob-side-menu {
  display: none !important;
}

/* Checklist / To-do List */
.beakblock-editor ul.beakblock-checklist {
  padding-left: 0;
}

.beakblock-checklist {
  list-style: none !important;
  list-style-type: none !important;
  margin: 0;
  padding: 0 !important;
  padding-left: 0 !important;
}

.beakblock-checklist-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5em;
  margin: 0;
  padding: 0.25em 0;
  position: relative;
  list-style: none !important;
  list-style-type: none !important;
}

.beakblock-checklist > .beakblock-checklist-item::marker {
  content: none;
}

.beakblock-checklist > .beakblock-checklist-item::before {
  content: none;
  display: none;
}

.beakblock-checklist-label {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 0.125em;
}

.beakblock-checklist-checkbox {
  width: 20px;
  height: 20px;
  margin: 0;
  cursor: pointer;
  accent-color: hsl(var(--ob-primary));
}

.beakblock-checklist-content {
  flex: 1;
  min-width: 0;
  line-height: 1.5;
}

.beakblock-checklist-item--checked .beakblock-checklist-content {
  text-decoration: line-through;
  color: hsl(var(--ob-muted-foreground));
}

/* Image Block */
.beakblock-image {
  margin: 1em 0;
  text-align: center;
}

.beakblock-image--left {
  text-align: left;
}

.beakblock-image--center {
  text-align: center;
}

.beakblock-image--right {
  text-align: right;
}

.beakblock-image img {
  max-width: 100%;
  height: auto;
  border-radius: var(--ob-radius);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.beakblock-image figcaption {
  margin-top: 0.5em;
  font-size: 0.875em;
  color: hsl(var(--ob-muted-foreground));
  text-align: center;
}

/* Image Placeholder */
.beakblock-image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 150px;
  padding: 2em;
  background: hsl(var(--ob-muted));
  border: 2px dashed hsl(var(--ob-border));
  border-radius: var(--ob-radius);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.beakblock-image-placeholder:hover {
  background: hsl(var(--ob-muted) / 0.7);
  border-color: hsl(var(--ob-muted-foreground));
}

.beakblock-image-placeholder-icon {
  display: block;
  width: 48px;
  height: 48px;
  margin-bottom: 0.75em;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='M21 15l-5-5L5 21'/%3E%3C/svg%3E");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.beakblock-image-placeholder-text {
  font-size: 0.875em;
  color: hsl(var(--ob-muted-foreground));
}

/* Embed Block */
.beakblock-embed {
  margin: 0.5em 0;
}

.beakblock-embed-container {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: var(--ob-radius);
  background: hsl(var(--ob-muted));
}

.beakblock-embed-container iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
}

.beakblock-embed-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: hsl(var(--ob-muted-foreground));
}

.beakblock-embed-caption {
  margin-top: 0.5em;
  font-size: 0.875em;
  color: hsl(var(--ob-muted-foreground));
  text-align: center;
}

/* Media Menu */
.ob-media-menu {
  --ob-foreground: var(--foreground, 222 47% 11%);
  --ob-background: var(--background, 0 0% 100%);
  --ob-muted: var(--muted, 210 40% 96%);
  --ob-muted-foreground: var(--muted-foreground, 215 16% 47%);
  --ob-border: var(--border, 214 32% 91%);
  --ob-primary: var(--primary, 222 47% 11%);
  --ob-radius: var(--radius, 0.5rem);
  display: flex;
  align-items: center;
  gap: 1px;
  background: hsl(var(--ob-background));
  border: 1px solid hsl(var(--ob-border));
  border-radius: var(--ob-radius);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.05);
  padding: 4px 6px;
  position: relative;
}

.ob-media-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: hsl(var(--ob-muted-foreground));
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.ob-media-menu-btn svg {
  width: 15px;
  height: 15px;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ob-media-menu-btn:hover {
  background: hsl(var(--ob-muted));
  color: hsl(var(--ob-foreground));
}

.ob-media-menu-btn--active {
  background: hsl(215 20% 85%);
  color: hsl(var(--ob-foreground));
}

.ob-media-menu-btn--active:hover {
  background: hsl(215 20% 80%);
  color: hsl(var(--ob-foreground));
}

.ob-media-menu-btn--danger:hover {
  background: hsl(0 84% 60% / 0.1);
  color: hsl(0 84% 60%);
}

.ob-media-menu-divider {
  width: 1px;
  height: 16px;
  background: hsl(var(--ob-border));
  margin: 0 6px;
  flex-shrink: 0;
}

.ob-media-url-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: hsl(var(--ob-background));
  border: 1px solid hsl(var(--ob-border));
  border-radius: var(--ob-radius);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08);
  padding: 12px;
  min-width: 280px;
  z-index: 1001;
}

.ob-media-url-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: hsl(var(--ob-muted-foreground));
  margin-bottom: 8px;
}

.ob-media-url-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid hsl(var(--ob-border));
  border-radius: 4px;
  font-size: 13px;
  color: hsl(var(--ob-foreground));
  background: hsl(var(--ob-background));
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.ob-media-url-input:focus {
  border-color: hsl(var(--ob-primary));
  box-shadow: 0 0 0 2px hsl(var(--ob-primary) / 0.1);
}

.ob-media-url-input::placeholder {
  color: hsl(var(--ob-muted-foreground));
}

.ob-media-url-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.ob-media-url-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.ob-media-url-btn--cancel {
  background: hsl(var(--ob-muted));
  color: hsl(var(--ob-foreground));
}

.ob-media-url-btn--cancel:hover {
  background: hsl(var(--ob-border));
}

.ob-media-url-btn--save {
  background: hsl(var(--ob-primary));
  color: hsl(var(--ob-background));
}

.ob-media-url-btn--save:hover {
  opacity: 0.9;
}

/* ===========================================================================
 * Chart Block
 * =========================================================================== */

.ob-chart-block {
  position: relative;
  margin: 1rem 0;
  padding: 0.35rem;
  border-radius: 8px;
  background: transparent;
}

.ob-chart-block__container {
  position: relative;
}

.ob-chart-block__canvas-wrapper {
  position: relative;
  width: 100%;
  min-height: 240px;
  padding: 0.5rem 0.65rem 0.35rem;
  border: 1px solid hsl(var(--ob-border) / 0.2);
  border-radius: 10px;
  background:
    linear-gradient(180deg, hsl(var(--ob-background) / 0.99), hsl(var(--ob-muted) / 0.18)),
    hsl(var(--ob-background));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.ob-chart-block__canvas {
  width: 100% !important;
  height: 100% !important;
}

.ob-chart-block__edit {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  padding: 0.45rem 0.75rem;
  border: 1px solid hsl(var(--ob-border));
  border-radius: 999px;
  background: hsl(var(--ob-background) / 0.96);
  color: hsl(var(--ob-foreground));
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-2px);
  transition: opacity 0.15s ease, transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.ob-chart-block:hover .ob-chart-block__edit,
.ob-chart-block:focus-within .ob-chart-block__edit {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.ob-chart-block__edit:hover {
  border-color: hsl(var(--ob-primary) / 0.22);
  background: hsl(var(--ob-background));
}

.ob-chart-block--invalid {
  padding: 1rem;
  color: hsl(var(--ob-muted-foreground));
  background: hsl(var(--ob-muted) / 0.22);
  border: 1px dashed hsl(var(--ob-border));
  border-radius: 14px;
}

.ob-chart-modal__overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(10px);
}

.ob-chart-modal__panel {
  width: min(720px, 100%);
  max-height: 92vh;
  overflow: hidden;
  border: 1px solid hsl(var(--ob-border) / 0.85);
  border-radius: 12px;
  background-color: #fff;
  background-image: none;
  opacity: 1;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.6) inset,
    0 24px 64px rgba(15, 23, 42, 0.22);
  isolation: isolate;
}

.ob-chart-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.65rem 0.85rem 0.6rem;
  border-bottom: 1px solid hsl(var(--ob-border) / 0.7);
  background: #fff;
}

.ob-chart-modal__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: hsl(var(--ob-foreground));
}

.ob-chart-modal__subtitle {
  margin: 0.1rem 0 0;
  color: hsl(var(--ob-muted-foreground));
  font-size: 0.75rem;
  line-height: 1.35;
}

.ob-chart-modal__close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  margin: -0.15rem -0.15rem 0 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: hsl(var(--ob-muted-foreground));
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.ob-chart-modal__close:hover {
  background: hsl(var(--ob-muted) / 0.45);
  color: hsl(var(--ob-foreground));
}

.ob-chart-modal__body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.55rem 0.75rem 0.65rem;
  overflow: auto;
  max-height: calc(92vh - 108px);
  background: #fff;
}

.ob-chart-modal__section {
  margin: 0;
  padding: 0.55rem 0.65rem 0.6rem;
  border: 1px solid hsl(var(--ob-border) / 0.65);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.ob-chart-modal__section-title {
  margin: 0 0 0.4rem;
  padding: 0;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: hsl(var(--ob-muted-foreground));
}

.ob-chart-modal__section-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ob-chart-modal__chart-row {
  display: grid;
  grid-template-columns: minmax(132px, 180px) minmax(0, 1fr);
  gap: 0.45rem 0.75rem;
  align-items: end;
}

@media (max-width: 520px) {
  .ob-chart-modal__chart-row {
    grid-template-columns: 1fr;
  }
}

.ob-chart-modal__size-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem 0.75rem;
  align-items: end;
}

@media (max-width: 520px) {
  .ob-chart-modal__size-row {
    grid-template-columns: 1fr;
  }
}

.ob-chart-modal__field,
.ob-chart-modal__datasets,
.ob-chart-modal__dataset,
.ob-chart-modal__subfield {
  display: grid;
  gap: 0.25rem;
  margin: 0;
}

.ob-chart-modal__datasets {
  gap: 0.4rem;
  padding-top: 0.1rem;
}

.ob-chart-modal__label {
  font-size: 0.75rem;
  font-weight: 500;
  color: hsl(var(--ob-foreground));
}

.ob-chart-modal__label--inline {
  flex-shrink: 0;
  margin: 0;
  white-space: nowrap;
}

.ob-chart-modal__field--legend-position {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
}

.ob-chart-modal__field--legend-position .ob-chart-modal__select {
  width: auto;
  min-width: 8.5rem;
  flex: 1 1 8.5rem;
  max-width: 12rem;
}

.ob-chart-modal__hint {
  margin: 0.05rem 0 0;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: hsl(var(--ob-muted-foreground));
}

/* Explicit border/fill so fields stay visible when --ob-* vars are faint (e.g. teleported under body). */
.ob-chart-modal__input,
.ob-chart-modal__select {
  width: 100%;
  min-height: 34px;
  padding: 0.35rem 0.6rem;
  border: 1px solid hsl(220 13% 70%);
  border-radius: 8px;
  background-color: hsl(210 24% 97%);
  color: hsl(var(--ob-foreground, 222 47% 11%));
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.06);
  font-size: 0.875rem;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease;
}

.ob-chart-modal__select {
  cursor: pointer;
  appearance: none;
  background-color: hsl(210 24% 97%);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  padding-right: 1.85rem;
}

.ob-chart-modal__input::placeholder {
  color: hsl(var(--ob-muted-foreground, 215 16% 47%));
  opacity: 1;
}

.ob-chart-modal__input:hover,
.ob-chart-modal__select:hover {
  border-color: hsl(220 13% 58%);
  background-color: hsl(210 24% 99%);
}

.ob-chart-modal__input:focus,
.ob-chart-modal__select:focus {
  outline: none;
  border-color: hsl(221 83% 53%);
  background-color: #fff;
  box-shadow:
    inset 0 1px 2px rgba(15, 23, 42, 0.04),
    0 0 0 3px hsl(221 83% 53% / 0.2);
}

.ob-chart-modal__legend-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.45rem 0.75rem;
}

.ob-chart-modal__checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--ob-foreground));
  cursor: pointer;
  user-select: none;
}

.ob-chart-modal__checkbox {
  width: 1rem;
  height: 1rem;
  margin: 0;
  border-radius: 4px;
  accent-color: hsl(var(--ob-primary));
  cursor: pointer;
}

.ob-chart-modal__datasets-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.ob-chart-modal__datasets-heading {
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: hsl(var(--ob-muted-foreground));
}

.ob-chart-modal__sublabel {
  font-size: 0.6875rem;
  font-weight: 500;
  color: hsl(var(--ob-muted-foreground));
}

.ob-chart-modal__dataset {
  padding: 0.5rem 0.55rem;
  border: 1px solid hsl(var(--ob-border) / 0.55);
  border-radius: 8px;
  background: hsl(var(--ob-muted) / 0.2);
}

.ob-chart-modal__dataset-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.ob-chart-modal__dataset-index {
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--ob-foreground));
}

.ob-chart-modal__dataset-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.45rem 0.65rem;
}

@media (max-width: 520px) {
  .ob-chart-modal__dataset-grid {
    grid-template-columns: 1fr;
  }
}

.ob-chart-modal__footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.45rem;
  min-height: 48px;
  padding: 0.5rem 0.75rem 0.55rem;
  border-top: 1px solid hsl(var(--ob-border) / 0.7);
  background: #fff;
  position: sticky;
  bottom: 0;
}

/* Fixed contrast: teleported modal often inherits --primary as a light tint; white label then disappears. */
.ob-chart-modal__button {
  min-height: 34px;
  min-width: 4.75rem;
  padding: 0.4rem 0.85rem;
  border: 1px solid hsl(221 83% 45%);
  border-radius: 8px;
  background: hsl(221 83% 53%);
  color: #fff;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.ob-chart-modal__button:hover {
  background: hsl(221 83% 48%);
  border-color: hsl(221 83% 40%);
}

.ob-chart-modal__button--secondary {
  border-color: hsl(220 13% 70%);
  background: #fff;
  color: hsl(222 47% 11%);
  box-shadow: none;
}

.ob-chart-modal__button--secondary:hover {
  background: hsl(210 24% 97%);
  border-color: hsl(220 13% 58%);
}

.ob-chart-modal__button--ghost {
  min-height: auto;
  min-width: unset;
  padding: 0.2rem 0.4rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: hsl(221 83% 45%);
  font-size: 0.8125rem;
  font-weight: 600;
  box-shadow: none;
}

.ob-chart-modal__button--ghost:hover {
  background: hsl(221 83% 53% / 0.12);
}

.ob-chart-modal__button--text-danger {
  min-height: auto;
  min-width: unset;
  padding: 0.25rem 0.45rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: hsl(0 72% 42%);
  font-size: 0.75rem;
  font-weight: 600;
  box-shadow: none;
}

.ob-chart-modal__button--text-danger:hover {
  filter: none;
  background: hsl(0 84% 60% / 0.1);
}

.ob-chart-modal__button--danger {
  border-color: hsl(0 84% 60% / 0.4);
  background: hsl(0 84% 60% / 0.08);
  color: hsl(0 84% 45%);
}

/* Comments + AI overlays */
.beakblock-comment-annotation {
  background: hsl(221 83% 53% / 0.08);
  border-radius: 0.2em;
  box-shadow: inset 0 -1px 0 hsl(221 83% 53% / 0.28);
}

.beakblock-comment-annotation--resolved {
  background: hsl(142 71% 45% / 0.08);
  box-shadow: inset 0 -1px 0 hsl(142 71% 45% / 0.28);
  opacity: 0.7;
}

.beakblock-comment-shell {
  position: relative;
  width: 100%;
  min-width: 0;
  overflow: visible;
}

.beakblock-comment-shell__editor {
  width: 100%;
  position: relative;
}

/* Count peek: floats over the editor, 10px from the right (not in the side rail). */
.beakblock-comment-rail__peek {
  position: absolute;
  top: 0.65rem;
  right: 10px;
  z-index: 24;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.55rem;
  border: 1px solid hsl(var(--ob-border));
  border-radius: 999px;
  background: hsl(var(--ob-background));
  color: hsl(var(--ob-foreground));
  cursor: pointer;
  box-shadow: 0 2px 14px rgba(15, 23, 42, 0.1);
  pointer-events: auto;
  transition:
    background 0.12s ease,
    box-shadow 0.12s ease;
}

.beakblock-comment-rail__peek:hover {
  background: hsl(var(--ob-muted) / 0.35);
  box-shadow: 0 4px 18px rgba(15, 23, 42, 0.12);
}

.beakblock-comment-rail__peek-icon {
  font-size: 0.9rem;
  line-height: 1;
}

.beakblock-comment-rail__peek-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  background: hsl(221 83% 53% / 0.14);
  color: hsl(221 83% 34%);
}

/* Expanded: panel sits to the right of the editor box, not inside its width. */
.beakblock-comment-rail {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 100%;
  margin-left: 10px;
  width: min(360px, calc(100vw - 32px));
  max-width: 400px;
  display: flex;
  flex-direction: column;
  border: 1px solid hsl(var(--ob-border));
  border-radius: 0 14px 14px 0;
  background: hsl(var(--ob-muted) / 0.2);
  min-height: 0;
  z-index: 25;
  box-shadow: -6px 0 28px rgba(15, 23, 42, 0.07);
  overflow: hidden;
}

.beakblock-comment-rail__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.7rem;
  border-bottom: 1px solid hsl(var(--ob-border));
  background: hsl(var(--ob-background));
  flex-shrink: 0;
}

.beakblock-comment-rail__head-main {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.beakblock-comment-rail__collapse {
  flex-shrink: 0;
  border: 1px solid hsl(var(--ob-border));
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: hsl(var(--ob-background));
  color: hsl(var(--ob-muted-foreground));
  cursor: pointer;
}

.beakblock-comment-rail__collapse:hover {
  background: hsl(var(--ob-muted) / 0.4);
  color: hsl(var(--ob-foreground));
}

.beakblock-comment-rail__title {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: hsl(var(--ob-muted-foreground));
}

.beakblock-comment-rail__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: hsl(221 83% 53% / 0.12);
  color: hsl(221 83% 36%);
}

.beakblock-comment-rail__body {
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.beakblock-comment-rail__track {
  flex: 0 0 48px;
  position: relative;
  border-right: 1px solid hsl(var(--ob-border) / 0.65);
  background: hsl(var(--ob-muted) / 0.12);
}

.beakblock-comment-rail__bubble {
  position: absolute;
  left: 50%;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.35rem;
  border: 1px solid hsl(221 83% 53% / 0.35);
  border-radius: 999px;
  background: hsl(var(--ob-background));
  color: hsl(var(--ob-foreground));
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
  transition:
    border-color 0.12s ease,
    box-shadow 0.12s ease,
    transform 0.12s ease;
}

.beakblock-comment-rail__bubble:hover {
  border-color: hsl(221 83% 53% / 0.55);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
}

.beakblock-comment-rail__bubble--active {
  border-color: hsl(221 83% 53%);
  box-shadow: 0 0 0 2px hsl(221 83% 53% / 0.15);
}

.beakblock-comment-rail__bubble--resolved {
  opacity: 0.72;
  border-color: hsl(142 71% 36% / 0.35);
  background: hsl(142 71% 45% / 0.08);
}

.beakblock-comment-rail__bubble-icon {
  font-size: 0.85rem;
  line-height: 1;
}

.beakblock-comment-rail__bubble-n {
  font-size: 0.7rem;
  font-weight: 700;
  color: hsl(221 83% 38%);
  min-width: 0.65rem;
  text-align: center;
}

.beakblock-comment-rail__bubble--resolved .beakblock-comment-rail__bubble-n {
  color: hsl(142 71% 30%);
}

.beakblock-comment-rail__detail {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 0.55rem 0.65rem 0.75rem;
}

.beakblock-comment-rail__hint {
  margin: 0.5rem 0 0;
  font-size: 0.88rem;
  line-height: 1.5;
  color: hsl(var(--ob-muted-foreground));
}

.beakblock-modal-overlay {
  /* Teleported modals sit under document.body; re-establish --ob-* so hsl(var(--ob-foreground)) etc. resolve. */
  --ob-foreground: var(--foreground, 25 5% 22%);
  --ob-background: var(--background, 0 0% 100%);
  --ob-muted: var(--muted, 40 6% 96%);
  --ob-muted-foreground: var(--muted-foreground, 25 2% 57%);
  --ob-border: var(--border, 40 6% 90%);
  --ob-primary: var(--primary, 25 5% 22%);
  --ob-radius: var(--radius, 0.25rem);
  --ob-card: var(--card, 0 0% 100%);
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 12px;
  background: rgba(15, 23, 42, 0.42);
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.beakblock-ai-modal,
.beakblock-comment-modal {
  width: min(1100px, calc(100vw - 24px));
  max-height: min(90vh, 960px);
  overflow: hidden;
  border-radius: 28px;
  border: 1px solid hsl(var(--ob-border));
  background: #fff;
  color: hsl(var(--ob-foreground));
  box-shadow: 0 40px 80px rgba(15, 23, 42, 0.22);
  display: flex;
  flex-direction: column;
}

.beakblock-ai-modal {
  position: relative;
}

.beakblock-comment-modal {
  width: min(1040px, calc(100vw - 24px));
}

.beakblock-modal-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.25rem 0.9rem;
  border-bottom: 1px solid hsl(var(--ob-border));
}

.beakblock-modal-header h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: -0.03em;
}

.beakblock-modal-header p {
  margin: 0.3rem 0 0;
  color: hsl(var(--ob-muted-foreground));
  font-size: 0.925rem;
  line-height: 1.5;
}

.beakblock-modal-kicker {
  font-size: 0.74rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: hsl(var(--ob-muted-foreground));
  margin-bottom: 0.25rem;
}

.beakblock-modal-close {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  border: 1px solid hsl(var(--ob-border));
  background: #fff;
  color: hsl(var(--ob-muted-foreground));
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
}

.beakblock-modal-close:hover {
  background: hsl(var(--ob-muted));
  color: hsl(var(--ob-foreground));
}

.beakblock-modal-section-title {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: hsl(var(--ob-muted-foreground));
  margin-bottom: 0.6rem;
}

.beakblock-modal-secondary,
.beakblock-modal-primary,
.beakblock-comment-thread__chip,
.beakblock-comment-thread__reaction {
  border: 1px solid hsl(var(--ob-border));
  border-radius: 999px;
  min-height: 2.25rem;
  padding: 0 0.9rem;
  background: #fff;
  color: hsl(var(--ob-foreground));
  cursor: pointer;
}

.beakblock-modal-primary {
  background: hsl(var(--ob-foreground));
  border-color: hsl(var(--ob-foreground));
  color: #fff;
}

.beakblock-modal-secondary:hover,
.beakblock-comment-thread__chip:hover,
.beakblock-comment-thread__reaction:hover {
  background: hsl(var(--ob-muted));
}

.beakblock-modal-primary:disabled,
.beakblock-modal-secondary:disabled,
.beakblock-comment-thread__chip:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.beakblock-ai-modal__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: min(52vh, 420px);
}

.beakblock-ai-modal__body,
.beakblock-comment-modal__body {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 1rem;
  padding: 1rem 1.25rem;
  overflow: auto;
}

.beakblock-ai-modal__prompt-collapsed {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid hsl(var(--ob-border));
  background: hsl(var(--ob-muted) / 0.18);
}

.beakblock-ai-modal__prompt-collapsed-inner {
  min-width: 0;
  flex: 1;
}

.beakblock-ai-modal__prompt-collapsed-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: hsl(var(--ob-muted-foreground));
}

.beakblock-ai-modal__prompt-collapsed-text {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  line-height: 1.45;
  color: hsl(var(--ob-foreground));
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.beakblock-ai-modal__prompt-collapsed-edit {
  flex-shrink: 0;
}

.beakblock-ai-modal__busy-overlay {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1.5rem;
  background: hsl(0 0% 100% / 0.82);
  backdrop-filter: blur(8px);
}

.beakblock-ai-modal__busy-spinner {
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 999px;
  border: 3px solid hsl(var(--ob-border));
  border-top-color: hsl(221 83% 53%);
  animation: beakblock-ai-spin 0.85s linear infinite;
}

.beakblock-ai-modal__busy-label {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: hsl(var(--ob-foreground));
  text-align: center;
}

.beakblock-ai-modal__chat {
  border-top: 1px solid hsl(var(--ob-border));
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  background: hsl(var(--ob-muted) / 0.25);
  min-height: 0;
}

.beakblock-ai-modal__chat--prominent {
  flex: 1;
  padding: 1.15rem 1.25rem 1.35rem;
  background: hsl(var(--ob-muted) / 0.38);
}

.beakblock-ai-modal--results-focus .beakblock-ai-modal__chat {
  flex: 1;
}

.beakblock-ai-modal__chat-head .beakblock-modal-section-title {
  margin-bottom: 0.2rem;
}

.beakblock-ai-modal__chat-lede {
  margin: 0 0 0.35rem;
  font-size: 0.88rem;
  color: hsl(var(--ob-muted-foreground));
  line-height: 1.45;
}

.beakblock-ai-modal__messages {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  flex: 1;
  min-height: 8rem;
  max-height: min(42vh, 360px);
  overflow: auto;
  padding-right: 0.15rem;
}

.beakblock-ai-modal__chat--prominent .beakblock-ai-modal__messages {
  max-height: min(52vh, 480px);
}

.beakblock-ai-modal__preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(172px, 1fr));
  gap: 0.65rem;
}

.beakblock-ai-modal__preset {
  text-align: left;
  padding: 0.85rem 0.9rem;
  border-radius: 16px;
  border: 1px solid hsl(var(--ob-border));
  background: #fff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.beakblock-ai-modal__preset--active {
  border-color: hsl(221 83% 53% / 0.4);
  box-shadow: 0 0 0 2px hsl(221 83% 53% / 0.08) inset;
}

.beakblock-ai-modal__preset-title {
  font-weight: 600;
}

.beakblock-ai-modal__preset-description {
  color: hsl(var(--ob-muted-foreground));
  font-size: 0.875rem;
  line-height: 1.45;
}

.beakblock-ai-modal__textarea,
.beakblock-comment-modal__textarea {
  width: 100%;
  min-height: 112px;
  resize: vertical;
  padding: 0.9rem 1rem;
  border-radius: 18px;
  border: 1px solid hsl(var(--ob-border));
  background: #fff;
  color: hsl(var(--ob-foreground));
  font: inherit;
  line-height: 1.55;
}

.beakblock-ai-modal__textarea:focus,
.beakblock-comment-modal__textarea:focus {
  outline: none;
  border-color: hsl(221 83% 53% / 0.6);
  box-shadow: 0 0 0 4px hsl(221 83% 53% / 0.1);
}

.beakblock-ai-modal__context-card,
.beakblock-comment-modal__selection,
.beakblock-comment-thread {
  border: 1px solid hsl(var(--ob-border));
  border-radius: 20px;
  background: hsl(var(--ob-muted) / 0.18);
  padding: 0.9rem 1rem;
}

.beakblock-ai-modal__context-card strong {
  display: block;
  margin-bottom: 0.35rem;
}

.beakblock-ai-modal__context-card p,
.beakblock-comment-modal__selection {
  margin: 0;
  color: hsl(var(--ob-muted-foreground));
  line-height: 1.55;
  white-space: pre-wrap;
}

.beakblock-ai-modal__details summary {
  cursor: pointer;
  color: hsl(var(--ob-muted-foreground));
  font-size: 0.92rem;
}

.beakblock-ai-modal__details pre {
  margin: 0.65rem 0 0;
  max-height: 180px;
  overflow: auto;
  font-size: 0.78rem;
  line-height: 1.6;
  background: #fff;
  padding: 0.8rem;
  border-radius: 14px;
  border: 1px solid hsl(var(--ob-border));
}

.beakblock-ai-modal__message {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.75rem 0.9rem;
  border-radius: 16px;
  max-width: 80%;
  line-height: 1.55;
}

.beakblock-ai-modal__message-role {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: hsl(var(--ob-muted-foreground));
}

.beakblock-ai-modal__message-body {
  white-space: pre-wrap;
  word-break: break-word;
}

.beakblock-ai-modal__message--user {
  align-self: flex-end;
  background: hsl(221 83% 53% / 0.12);
}

.beakblock-ai-modal__message--user .beakblock-ai-modal__message-role {
  text-align: right;
  color: hsl(221 83% 40%);
}

.beakblock-ai-modal__message--assistant {
  align-self: flex-start;
  background: #fff;
  border: 1px solid hsl(var(--ob-border));
}

.beakblock-ai-modal--results-focus .beakblock-ai-modal__message--assistant {
  max-width: 100%;
}

.beakblock-ai-modal__message--pending {
  position: relative;
  padding-right: 2.25rem;
}

.beakblock-ai-modal__message--pending::after {
  content: '';
  position: absolute;
  right: 0.85rem;
  top: 50%;
  width: 0.65rem;
  height: 0.65rem;
  margin-top: -0.325rem;
  border-radius: 999px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-right-color: transparent;
  animation: beakblock-ai-spin 0.85s linear infinite;
  opacity: 0.7;
}

.beakblock-ai-modal__empty,
.beakblock-comment-modal__empty {
  color: hsl(var(--ob-muted-foreground));
  font-size: 0.95rem;
  padding: 0.75rem 0;
}

.beakblock-comment-modal__body {
  grid-template-columns: 0.9fr 1.1fr;
}

.beakblock-comment-modal__actions,
.beakblock-comment-thread__row-actions,
.beakblock-comment-thread__header-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.beakblock-comment-thread {
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.beakblock-comment-thread--resolved {
  opacity: 0.82;
}

.beakblock-comment-thread__header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: start;
}

.beakblock-comment-thread__meta {
  color: hsl(var(--ob-muted-foreground));
  font-size: 0.84rem;
  margin-top: 0.2rem;
}

.beakblock-comment-thread__comments {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.beakblock-comment-thread__comment {
  border-top: 1px solid hsl(var(--ob-border));
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.beakblock-comment-thread__comment-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  color: hsl(var(--ob-muted-foreground));
  font-size: 0.85rem;
}

.beakblock-comment-thread__body {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.55;
}

.beakblock-comment-thread__reactions {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.beakblock-comment-thread__reaction {
  min-height: 1.95rem;
  padding: 0 0.7rem;
  font-size: 0.88rem;
}

.beakblock-comment-thread__chip {
  min-height: 1.95rem;
  padding: 0 0.75rem;
  font-size: 0.88rem;
}

.beakblock-comment-thread__reply {
  border-top: 1px solid hsl(var(--ob-border));
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.beakblock-modal-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem 1.25rem;
  border-top: 1px solid hsl(var(--ob-border));
  background: linear-gradient(180deg, hsl(var(--ob-card) / 0) 0%, hsl(var(--ob-muted) / 0.12) 100%);
}

.beakblock-ai-modal__result-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-right: auto;
}

.beakblock-ai-modal__result-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0.8rem;
  border-radius: 999px;
  border: 1px solid hsl(221 83% 53% / 0.18);
  background: hsl(221 83% 53% / 0.08);
  color: hsl(221 83% 31%);
  font-size: 0.9rem;
  font-weight: 600;
}

.beakblock-ai-modal__result-badge svg {
  width: 0.95rem;
  height: 0.95rem;
}

@keyframes beakblock-ai-spin {
  to {
    transform: rotate(360deg);
  }
}
`; 

/**
 * Inject BeakBlock styles into the document head.
 *
 * This function is idempotent - calling it multiple times will only inject styles once.
 *
 * @returns true if styles were injected, false if they were already present
 *
 * @example
 * ```typescript
 * import { injectStyles } from '@beakblock/core';
 *
 * // Automatically inject styles (called by editor by default)
 * injectStyles();
 * ```
 */
export function injectStyles(): boolean {
  // Check if we're in a browser environment
  if (typeof document === 'undefined') {
    return false;
  }

  // Don't inject twice
  if (stylesInjected || document.getElementById(STYLE_ID)) {
    stylesInjected = true;
    return false;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = EDITOR_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;

  return true;
}

/**
 * Remove injected BeakBlock styles from the document.
 *
 * Useful for cleanup in single-page applications or when unmounting the editor.
 *
 * @example
 * ```typescript
 * import { removeStyles } from '@beakblock/core';
 *
 * // Clean up when done
 * removeStyles();
 * ```
 */
export function removeStyles(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const style = document.getElementById(STYLE_ID);
  if (style) {
    style.remove();
    stylesInjected = false;
  }
}

/**
 * Check if BeakBlock styles have been injected.
 *
 * @returns true if styles are present in the document
 */
export function areStylesInjected(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return stylesInjected || !!document.getElementById(STYLE_ID);
}
