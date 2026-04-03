# Styling BeakBlock

BeakBlock uses CSS custom properties for theming and is designed to work with modern design systems like shadcn/ui.

## CSS Loading Options

### Option 1: Auto-injection (Default)

By default, BeakBlock automatically injects styles into the document head:

```typescript
const editor = new BeakBlockEditor({
  // injectStyles: true (default)
});
```

This is the simplest option and requires no CSS imports.

### Option 2: Manual Import

For more control, disable auto-injection and import the CSS file:

```typescript
import '@aurthurm/beakblock-core/styles/editor.css';

const editor = new BeakBlockEditor({
  injectStyles: false,
});
```

### Option 3: Custom Styles

For full customization, disable auto-injection and provide your own CSS:

```typescript
import './my-editor-styles.css';

const editor = new BeakBlockEditor({
  injectStyles: false,
});
```

## CSS Custom Properties

BeakBlock uses these CSS variables with fallback values:

```css
.beakblock-editor {
  /* Colors */
  --ob-foreground: var(--foreground, 25 5% 22%);
  --ob-background: var(--background, 0 0% 100%);
  --ob-muted: var(--muted, 40 6% 96%);
  --ob-muted-foreground: var(--muted-foreground, 25 2% 57%);
  --ob-border: var(--border, 40 6% 90%);
  --ob-primary: var(--primary, 25 5% 22%);
  --ob-destructive: var(--destructive, 0 84% 60%);

  /* Sizing */
  --ob-radius: var(--radius, 0.25rem);

  /* Typography */
  --ob-font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --ob-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --ob-font-size: 16px;
  --ob-line-height: 1.6;

  /* Spacing */
  --ob-block-spacing: 0.75em;
  --ob-content-padding: 1rem;
}
```

## Theming with shadcn/ui

If you're using shadcn/ui, BeakBlock automatically picks up your theme variables:

```css
/* Your shadcn theme (in globals.css) */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --border: 214.3 31.8% 91.4%;
  --primary: 222.2 47.4% 11.2%;
  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --border: 217.2 32.6% 17.5%;
  --primary: 210 40% 98%;
}
```

BeakBlock will use these values automatically.

## Custom Theming

### Override Variables

```css
.beakblock-editor {
  /* Custom colors */
  --ob-foreground: 220 15% 20%;
  --ob-background: 220 15% 98%;
  --ob-primary: 220 90% 50%;

  /* Larger font */
  --ob-font-size: 18px;
  --ob-line-height: 1.8;

  /* More spacing between blocks */
  --ob-block-spacing: 1.5em;
}
```

### Dark Mode

```css
.dark .beakblock-editor,
[data-theme="dark"] .beakblock-editor {
  --ob-foreground: 210 40% 98%;
  --ob-background: 222.2 84% 4.9%;
  --ob-muted: 217.2 32.6% 17.5%;
  --ob-muted-foreground: 215 20.2% 65.1%;
  --ob-border: 217.2 32.6% 17.5%;
  --ob-primary: 210 40% 98%;
}
```

## Styling Block Types

### Headings

```css
.beakblock-editor h1 {
  font-size: 2.5em;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.beakblock-editor h2 {
  font-size: 1.75em;
  font-weight: 600;
  border-bottom: 1px solid hsl(var(--ob-border));
  padding-bottom: 0.3em;
}
```

### Code Blocks

```css
.beakblock-editor pre {
  background: hsl(220 15% 10%);
  color: hsl(220 15% 90%);
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 14px;
  padding: 1.5em;
  border-radius: 8px;
  overflow-x: auto;
}

.beakblock-editor pre code {
  background: none;
  padding: 0;
  color: inherit;
}
```

### Blockquotes

```css
.beakblock-editor blockquote {
  border-left: 4px solid hsl(var(--ob-primary));
  padding-left: 1.5em;
  margin-left: 0;
  font-style: italic;
  color: hsl(var(--ob-muted-foreground));
}
```

### Callouts

```css
/* Custom callout colors */
.beakblock-editor .beakblock-callout--info {
  border-left-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.beakblock-editor .beakblock-callout--warning {
  border-left-color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.beakblock-editor .beakblock-callout--success {
  border-left-color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.beakblock-editor .beakblock-callout--error {
  border-left-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}
```

### Tables

```css
.beakblock-editor table {
  border-collapse: collapse;
  width: 100%;
}

.beakblock-editor th,
.beakblock-editor td {
  border: 1px solid hsl(var(--ob-border));
  padding: 0.75em 1em;
}

.beakblock-editor th {
  background: hsl(var(--ob-muted));
  font-weight: 600;
  text-align: left;
}

.beakblock-editor tr:nth-child(even) td {
  background: hsl(var(--ob-muted) / 0.3);
}
```

## Styling UI Components

### Slash Menu

```css
.ob-slash-menu {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  min-width: 280px;
}

.ob-slash-menu-item {
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.1s;
}

.ob-slash-menu-item:hover,
.ob-slash-menu-item--selected {
  background: #f3f4f6;
}

.ob-slash-menu-item-title {
  font-weight: 500;
  color: #1f2937;
}

.ob-slash-menu-item-description {
  font-size: 12px;
  color: #6b7280;
}
```

### Bubble Menu

```css
.ob-bubble-menu {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 4px;
}

.ob-bubble-menu-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: #6b7280;
}

.ob-bubble-menu-btn:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.ob-bubble-menu-btn--active {
  background: #e5e7eb;
  color: #1f2937;
}
```

### Side Menu (Drag Handle)

```css
.ob-side-menu {
  opacity: 0;
  transition: opacity 0.15s;
}

.ob-side-menu--visible {
  opacity: 1;
}

.ob-drag-handle {
  color: #9ca3af;
  cursor: grab;
}

.ob-drag-handle:hover {
  color: #6b7280;
  background: #f3f4f6;
}

.ob-add-button {
  color: #9ca3af;
}

.ob-add-button:hover {
  color: #6b7280;
  background: #f3f4f6;
}
```

## Responsive Design

```css
/* Mobile adjustments */
@media (max-width: 640px) {
  .beakblock-editor {
    --ob-font-size: 16px;
    --ob-content-padding: 0.75rem;
    padding-left: calc(var(--ob-content-padding) + 36px);
  }

  .ob-side-menu {
    transform: scale(0.9);
  }

  .ob-bubble-menu {
    transform: scale(0.95);
  }

  .ob-slash-menu {
    min-width: 240px;
    max-width: calc(100vw - 32px);
  }
}
```

## Print Styles

```css
@media print {
  .beakblock-editor {
    padding: 0;
    background: white;
    color: black;
  }

  .ob-side-menu,
  .ob-slash-menu,
  .ob-bubble-menu,
  .ob-table-handles {
    display: none !important;
  }

  .beakblock-editor pre {
    background: #f8f8f8;
    border: 1px solid #ddd;
  }

  .beakblock-editor a {
    color: black;
    text-decoration: underline;
  }

  .beakblock-editor a::after {
    content: " (" attr(href) ")";
    font-size: 0.8em;
  }
}
```

## Using with Tailwind CSS

If using Tailwind, you can extend the theme:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            '--ob-foreground': 'theme(colors.gray.900)',
            '--ob-background': 'theme(colors.white)',
            '--ob-muted': 'theme(colors.gray.100)',
            '--ob-muted-foreground': 'theme(colors.gray.500)',
            '--ob-border': 'theme(colors.gray.200)',
            '--ob-primary': 'theme(colors.blue.600)',
          },
        },
      },
    },
  },
};
```

## Tips

1. **Use CSS variables** — Makes theming easier
2. **Test dark mode** — Ensure all elements are visible
3. **Check contrast** — Ensure text is readable
4. **Test on mobile** — Menus should be usable on touch devices
5. **Respect user preferences** — Support `prefers-color-scheme` and `prefers-reduced-motion`
