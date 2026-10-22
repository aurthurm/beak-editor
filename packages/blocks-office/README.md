# @amusendame/beakblock-blocks-office

Office blocks for BeakBlock 2.0: footnotes and endnotes, equations, captions with
cross-references, text boxes, shapes, and smart content (variables, conditional
sections, repeating sections, computed values, reusable content).

Part of BeakBlock 2.0. See `beakblock-2.0-roadmap.md` and `docs/2.0/contracts.md` §7.

## Usage

```typescript
import { BeakBlockEditor, getDefaultSlashMenuItems } from '@amusendame/beakblock-core';
import {
  officeBlocksExtension,
  officeSlashItems,
  injectOfficeBlocksStyles,
  refreshOfficeBlocks,
  validateOfficeContent,
} from '@amusendame/beakblock-blocks-office';

injectOfficeBlocksStyles();

const variables = { procedureType: 'micro', samples: [{ id: 1 }, { id: 2 }] };

const editor = new BeakBlockEditor({
  element,
  mode: 'office',
  extensions: [
    officeBlocksExtension({
      variables: () => variables,
      resolveReusableContent: (contentId, revision) => library.get(contentId, revision) ?? null,
      renderMath: (latex, displayMode) => katex.renderToString(latex, { displayMode, throwOnError: false }),
    }),
  ],
});

// Slash menu: add the office items next to the defaults.
const slashItems = [...getDefaultSlashMenuItems(editor.pm.state.schema), ...officeSlashItems];

// After changing variables, refresh conditions, variables and computed values.
variables.procedureType = 'chem';
refreshOfficeBlocks(editor);

// Block-level checks through the registry, plus inline checks.
const issues = [
  ...editor.blockRegistry.validate(editor.getDocument(), { variables }),
  ...validateOfficeContent(editor.getDocument(), { variables }),
];
```

## Blocks and inline atoms

| Name | Kind | Family | Attributes | Notes |
|---|---|---|---|---|
| `footnote` | inline atom | office | `id`, `text` | Numbered 1, 2, 3 in document order (plugin decoration). |
| `endnote` | inline atom | office | `id`, `text` | Numbered separately from footnotes. |
| `equation` | block atom | office | `id`, `latex` | Rendered with `renderMath` or `globalThis.katex`; otherwise the LaTeX source is shown in `<code>`. |
| `inlineEquation` | inline atom | office | `id`, `latex` | As above, inline. |
| `caption` | textblock | office | `id`, `label` (`Figure`, `Table`, `Equation`) | Numbered per label. Shows "Figure N: text" through CSS. |
| `crossReference` | inline atom | office | `id`, `targetId`, `display` (`label`, `number`, `text`, `page`) | Resolves to caption or heading text. |
| `textBox` | block container | office | `id`, `width` (pt), `float` (`none`, `left`, `right`), `borderPt`, `fill` | Holds block content. |
| `shape` | block atom | office | `id`, `kind` (`rect`, `ellipse`, `line`, `arrow`), `width`, `height`, `fill`, `stroke`, `strokeWidth` | Inline SVG, sizes in pt. |
| `variable` | inline atom | smart | `id`, `name`, `format` | Dotted names read nested values (`patient.name`). Missing values show `[name]`. |
| `conditional` | block container | smart | `id`, `expression` | Hidden with `data-condition-result="false"` when the expression is false. |
| `repeatingSection` | block container | smart | `id`, `itemsKey`, `min`, `max` | Validates item count against `min` and `max`. Shows the item count. |
| `computedValue` | inline atom | smart | `id`, `expression`, `format` (`number`, `currency`, `percent`, `text`), `decimals`, `unit` | Shows `#ERROR` when the expression cannot be evaluated. |
| `reusableContent` | block atom | smart | `id`, `contentId`, `revision`, `title` | Read-only preview from `resolveReusableContent`. `revision: null` means floating. |

Inline atoms are represented in block JSON as core `{ type, props }` items in `content`,
with attributes under `props` (see `FootnoteContent`, `CrossReferenceContent` and related
types in `types.ts`). Container blocks serialize their children through `getDocument()`.

## Expressions

Conditions and computed values use a small evaluator (`evaluateExpression`,
`tryEvaluateExpression`, `validateExpression`). It supports numbers, strings, `true`,
`false`, `null`, identifiers and dotted paths, `== != < <= > >=`, `&& || !`,
`+ - * / %`, unary minus, and parentheses.

It never calls `eval` or `new Function`. Function calls, indexing, and reads of
`constructor`, `__proto__` or `prototype` are rejected. Only own properties of the
variable scope are read. Expressions are limited to 500 characters and 32 levels of nesting.

A conditional whose expression fails to evaluate is shown, and the validator reports
an `invalid-expression` error.

## Numbering and resolution

- `computeCaptionNumbers(blocks)` returns `Map<captionId, { label, number }>`.
- `collectNotes(blocks)` returns footnotes and endnotes in document order, each with its
  number. Layout and print use this.
- Cross-reference text: `number` gives the caption number, `label` gives the label, and
  `text` gives `Figure 1: caption text` for captions and the heading text for headings.
  `page` needs `crossReferenceResolver`, because page numbers come from layout. An
  unresolved reference shows `?`.
- `crossReferenceResolver(targetId, display, target)` overrides the built-in text.

## Validation

`validateOfficeContent(blocks, options)` runs the block validators and the inline checks.
It reports `unknown-variable`, `invalid-expression`, `empty-note`, `unresolved-reference`,
`repeat-below-min`, `repeat-above-max`, `reusable-unpinned` (a warning when
`revision` is null), and more. `editor.blockRegistry.validate(...)` runs the block
validators only.

## Print

Each block definition has a `renderPrint(block)` that returns an HTML fragment. Containers
render their children as plain-text paragraphs. Layout should replace this with the full
print pipeline when it is available. Repeating sections repeat their children once per
item, but variable references inside the children are not substituted.

## Styles

`officeBlocksCSS` is the stylesheet string. `injectOfficeBlocksStyles()` adds it to the
document head once. Use either this or your own CSS.

## Known gaps

- Numbering and resolution are computed in decorations, so they do not appear in the
  document JSON.
- Footnote and endnote numbers are arabic. Roman numerals and per-section restarts are not
  implemented.
- Reusable content is a read-only preview. Pinning and updating revisions are the host's job.
- `officeSlashItems` inserts nodes with default attributes. Items that need input, such as
  variables and cross-references, are not offered.
